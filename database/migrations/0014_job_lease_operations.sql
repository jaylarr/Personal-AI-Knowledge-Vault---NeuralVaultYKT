SET LOCAL ROLE atlas_owner;

CREATE FUNCTION atlas_private.claim_job()
RETURNS TABLE(workspace_id uuid,job_id uuid,source_version_id uuid,item_id uuid,lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selected atlas.ingestion_jobs; token uuid:=gen_random_uuid();
BEGIN
  IF session_user<>'atlas_worker' THEN RAISE EXCEPTION 'Worker role required' USING ERRCODE='42501'; END IF;
  SELECT j.* INTO selected FROM atlas.ingestion_jobs j JOIN atlas.workspaces w ON w.id=j.workspace_id JOIN atlas.app_users u ON u.id=w.owner_user_id
    WHERE j.status='queued' AND j.available_at<=clock_timestamp() AND j.attempt_count<4 AND j.cancel_requested_at IS NULL AND w.deleted_at IS NULL AND u.disabled_at IS NULL
    AND ((j.source_version_id IS NOT NULL AND EXISTS(SELECT 1 FROM atlas.source_versions v JOIN atlas.sources s ON s.workspace_id=v.workspace_id AND s.id=v.source_id
      JOIN atlas.knowledge_items i ON i.workspace_id=s.workspace_id AND i.id=s.id WHERE v.workspace_id=j.workspace_id AND v.id=j.source_version_id AND s.current_version_id=v.id AND i.deleted_at IS NULL))
    OR (j.item_id IS NOT NULL AND EXISTS(SELECT 1 FROM atlas.knowledge_items i WHERE i.workspace_id=j.workspace_id AND i.id=j.item_id AND i.revision=j.expected_revision AND i.deleted_at IS NULL)))
    ORDER BY j.available_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE atlas.ingestion_jobs j SET status='processing',attempt_count=j.attempt_count+1,lease_token=token,
    lease_expires_at=clock_timestamp()+interval '120 seconds',heartbeat_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE j.workspace_id=selected.workspace_id AND j.id=selected.id;
  RETURN QUERY SELECT selected.workspace_id,selected.id,selected.source_version_id,selected.item_id,token;
END;
$$;

CREATE FUNCTION atlas_private.heartbeat_job(target uuid,token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
  IF NOT coalesce(atlas_private.valid_job(),false) OR target IS DISTINCT FROM atlas_private.context_uuid('app.job_id') OR token IS DISTINCT FROM atlas_private.context_uuid('app.job_lease_token') THEN RETURN false; END IF;
  UPDATE atlas.ingestion_jobs SET lease_expires_at=clock_timestamp()+interval '120 seconds',heartbeat_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE workspace_id=atlas_private.context_uuid('app.workspace_id') AND id=target AND lease_token=token AND status='processing' AND lease_expires_at>clock_timestamp() AND cancel_requested_at IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END;
$$;

CREATE FUNCTION atlas_private.finish_job(target uuid,token uuid,outcome text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
  IF outcome NOT IN ('completed','failed','cancelled','queued') OR NOT coalesce(atlas_private.valid_job(),false)
    OR target IS DISTINCT FROM atlas_private.context_uuid('app.job_id') OR token IS DISTINCT FROM atlas_private.context_uuid('app.job_lease_token') THEN RETURN false; END IF;
  UPDATE atlas.ingestion_jobs SET status=CASE WHEN outcome='queued' AND attempt_count>=4 THEN 'failed' ELSE outcome END,
    available_at=CASE WHEN outcome='queued' THEN clock_timestamp()+CASE attempt_count WHEN 1 THEN interval '5 seconds' WHEN 2 THEN interval '30 seconds' ELSE interval '120 seconds' END ELSE available_at END,
    lease_token=NULL,lease_expires_at=NULL,updated_at=clock_timestamp()
    WHERE workspace_id=atlas_private.context_uuid('app.workspace_id') AND id=target AND lease_token=token AND status='processing' AND lease_expires_at>clock_timestamp() AND cancel_requested_at IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;
  RETURN affected=1;
END;
$$;
REVOKE EXECUTE ON FUNCTION atlas_private.claim_job(),atlas_private.heartbeat_job(uuid,uuid),atlas_private.finish_job(uuid,uuid,text) FROM PUBLIC,atlas_api;
GRANT EXECUTE ON FUNCTION atlas_private.claim_job(),atlas_private.heartbeat_job(uuid,uuid),atlas_private.finish_job(uuid,uuid,text) TO atlas_worker;
RESET ROLE;
