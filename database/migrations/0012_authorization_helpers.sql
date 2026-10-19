-- Metadata-only authorization boundary. No helper returns knowledge content or credential digests.
SET LOCAL ROLE atlas_owner;

CREATE FUNCTION atlas_private.context_uuid(setting_name text) RETURNS uuid
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT CASE WHEN current_setting(setting_name,true) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN current_setting(setting_name,true)::uuid ELSE NULL END
$$;

CREATE FUNCTION atlas_private.current_member(w uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT session_user='atlas_api' AND current_setting('app.principal_kind',true)='human'
    AND w=atlas_private.context_uuid('app.workspace_id') AND EXISTS (
      SELECT 1 FROM atlas_private.workspace_members m JOIN atlas.workspaces s ON s.id=m.workspace_id
      JOIN atlas.app_users u ON u.id=m.user_id WHERE m.workspace_id=w
      AND m.user_id=atlas_private.context_uuid('app.user_id') AND m.role='owner'
      AND s.owner_user_id=u.id AND s.deleted_at IS NULL AND u.disabled_at IS NULL
      AND u.issuer=current_setting('app.issuer',true) AND u.subject=current_setting('app.subject',true)
    )
$$;

CREATE FUNCTION atlas_private.active_agent(operation text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT session_user='atlas_api' AND current_setting('app.principal_kind',true)='agent'
    AND operation IN ('read','propose','process_knowledge') AND EXISTS (
      SELECT 1 FROM atlas_private.agent_credentials c JOIN atlas.agents a ON a.workspace_id=c.workspace_id AND a.id=c.agent_id
      JOIN atlas.workspaces w ON w.id=a.workspace_id JOIN atlas.app_users u ON u.id=w.owner_user_id
      WHERE c.workspace_id=atlas_private.context_uuid('app.workspace_id')
        AND c.id=atlas_private.context_uuid('app.credential_id') AND a.id=atlas_private.context_uuid('app.agent_id')
        AND a.disabled_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=clock_timestamp() AND c.expires_at>clock_timestamp()
        AND operation=ANY(c.operations) AND w.deleted_at IS NULL AND u.disabled_at IS NULL
    )
$$;

CREATE FUNCTION atlas_private.authenticate_agent(digest text)
RETURNS TABLE(workspace_id uuid,agent_id uuid,credential_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT c.workspace_id,c.agent_id,c.id FROM atlas_private.agent_credentials c
  JOIN atlas.agents a ON a.workspace_id=c.workspace_id AND a.id=c.agent_id
  JOIN atlas.workspaces w ON w.id=a.workspace_id JOIN atlas.app_users u ON u.id=w.owner_user_id
  WHERE session_user='atlas_api' AND digest ~ '^[0-9a-f]{64}$' AND c.token_digest=digest
    AND c.revoked_at IS NULL AND c.issued_at<=clock_timestamp() AND c.expires_at>clock_timestamp()
    AND a.disabled_at IS NULL AND w.deleted_at IS NULL AND u.disabled_at IS NULL
$$;

CREATE FUNCTION atlas_private.item_scope_allowed(target uuid,operation text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE i record; agent uuid:=atlas_private.context_uuid('app.agent_id');
BEGIN
  IF NOT coalesce(atlas_private.active_agent(operation),false) THEN RETURN false; END IF;
  SELECT * INTO i FROM atlas.knowledge_items WHERE workspace_id=atlas_private.context_uuid('app.workspace_id') AND id=target AND deleted_at IS NULL;
  IF NOT FOUND OR i.scope='personal' THEN RETURN false; END IF;
  IF i.scope='project' THEN
    RETURN EXISTS(SELECT 1 FROM atlas.projects p JOIN atlas_private.agent_project_grants g ON g.workspace_id=p.workspace_id AND g.project_id=p.id
      WHERE p.workspace_id=i.workspace_id AND p.id=i.project_id AND p.archived_at IS NULL AND g.agent_id=agent AND
      CASE operation WHEN 'read' THEN g.read WHEN 'propose' THEN g.propose WHEN 'process_knowledge' THEN g.read AND g.process_knowledge ELSE false END);
  ELSIF i.scope IN ('global_development','agent_private') THEN
    IF i.scope='agent_private' AND i.owner_agent_id IS DISTINCT FROM agent THEN RETURN false; END IF;
    RETURN EXISTS(SELECT 1 FROM atlas_private.agent_scope_grants g WHERE g.workspace_id=i.workspace_id AND g.agent_id=agent AND g.scope=i.scope AND
      CASE operation WHEN 'read' THEN g.read WHEN 'propose' THEN g.propose WHEN 'process_knowledge' THEN g.read AND g.process_knowledge ELSE false END);
  ELSIF i.scope='shared_agents' THEN
    RETURN EXISTS(SELECT 1 FROM atlas_private.item_agent_grants g WHERE g.workspace_id=i.workspace_id AND g.item_id=i.id AND g.agent_id=agent AND
      CASE operation WHEN 'read' THEN g.read WHEN 'propose' THEN g.propose WHEN 'process_knowledge' THEN g.read AND g.process_knowledge ELSE false END);
  END IF;
  RETURN false;
END;
$$;

CREATE FUNCTION atlas_private.base_item_read(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.knowledge_items i WHERE i.workspace_id=atlas_private.context_uuid('app.workspace_id') AND i.id=target AND i.deleted_at IS NULL
    AND (atlas_private.current_member(i.workspace_id) OR (atlas_private.item_scope_allowed(i.id,'read') AND
      (i.kind<>'source' OR EXISTS(SELECT 1 FROM atlas.sources s WHERE s.workspace_id=i.workspace_id AND s.id=i.id AND s.sensitivity='clear')))))
$$;

CREATE FUNCTION atlas_private.evidence_readable(version_arg uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.source_versions v JOIN atlas.sources s ON s.workspace_id=v.workspace_id AND s.id=v.source_id
    WHERE v.workspace_id=atlas_private.context_uuid('app.workspace_id') AND v.id=version_arg AND s.current_version_id=v.id
      AND atlas_private.base_item_read(s.id))
$$;

CREATE FUNCTION atlas_private.can_read_item(target uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE i record; w uuid:=atlas_private.context_uuid('app.workspace_id'); r record;
BEGIN
  IF NOT coalesce(atlas_private.base_item_read(target),false) THEN RETURN false; END IF;
  IF atlas_private.current_member(w) THEN RETURN true; END IF;
  SELECT kind INTO i FROM atlas.knowledge_items WHERE workspace_id=w AND id=target;
  IF i.kind='source' THEN RETURN true;
  ELSIF i.kind='memory' THEN
    RETURN EXISTS(SELECT 1 FROM atlas.memories m WHERE m.workspace_id=w AND m.id=target AND m.status='active' AND NOT m.requires_revalidation
      AND m.valid_from<=clock_timestamp() AND (m.valid_to IS NULL OR m.valid_to>clock_timestamp()))
      AND EXISTS(SELECT 1 FROM atlas.memory_evidence e WHERE e.workspace_id=w AND e.memory_id=target)
      AND NOT EXISTS(SELECT 1 FROM atlas.memory_evidence e WHERE e.workspace_id=w AND e.memory_id=target AND NOT atlas_private.evidence_readable(e.source_version_id));
  ELSIF i.kind='entity' THEN
    RETURN EXISTS(SELECT 1 FROM atlas.entities e WHERE e.workspace_id=w AND e.id=target AND e.status='active')
      AND EXISTS(SELECT 1 FROM atlas.entity_evidence e WHERE e.workspace_id=w AND e.entity_id=target)
      AND NOT EXISTS(SELECT 1 FROM atlas.entity_evidence e WHERE e.workspace_id=w AND e.entity_id=target AND NOT atlas_private.evidence_readable(e.source_version_id));
  ELSIF i.kind='relationship' THEN
    SELECT * INTO r FROM atlas.relationships WHERE workspace_id=w AND id=target AND status='active'
      AND valid_from<=clock_timestamp() AND (valid_to IS NULL OR valid_to>clock_timestamp());
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN atlas_private.can_read_item(r.from_item_id) AND atlas_private.can_read_item(r.to_item_id)
      AND EXISTS(SELECT 1 FROM atlas.relationship_evidence e WHERE e.workspace_id=w AND e.relationship_id=target)
      AND NOT EXISTS(SELECT 1 FROM atlas.relationship_evidence e WHERE e.workspace_id=w AND e.relationship_id=target AND NOT atlas_private.evidence_readable(e.source_version_id));
  END IF;
  RETURN false;
END;
$$;

CREATE FUNCTION atlas_private.can_write_item(target uuid,action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.knowledge_items i WHERE i.workspace_id=atlas_private.context_uuid('app.workspace_id') AND i.id=target
    AND (atlas_private.current_member(i.workspace_id) AND action IN ('update','delete','propose')
      OR (action='propose' AND i.deleted_at IS NULL AND atlas_private.can_read_item(i.id) AND atlas_private.item_scope_allowed(i.id,'propose'))))
$$;

CREATE FUNCTION atlas_private.task_eligible(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT atlas_private.active_agent('process_knowledge') AND EXISTS(
    SELECT 1 FROM atlas.organization_tasks t JOIN atlas.source_versions v ON v.workspace_id=t.workspace_id AND v.id=t.source_version_id
    JOIN atlas.sources s ON s.workspace_id=v.workspace_id AND s.id=v.source_id
    JOIN atlas.knowledge_items i ON i.workspace_id=s.workspace_id AND i.id=s.id
    WHERE t.workspace_id=atlas_private.context_uuid('app.workspace_id') AND t.id=target AND t.state IN ('awaiting_agent','claimed')
    AND (t.assigned_agent_id IS NULL OR t.assigned_agent_id=atlas_private.context_uuid('app.agent_id'))
    AND s.current_version_id=v.id AND s.content_revision=t.expected_source_revision AND i.deleted_at IS NULL AND s.sensitivity IN ('clear','released_for_agent')
    AND ((atlas_private.can_read_item(s.id) AND atlas_private.item_scope_allowed(s.id,'process_knowledge')) OR EXISTS(
      SELECT 1 FROM atlas_private.processing_grants g WHERE g.workspace_id=t.workspace_id AND g.source_version_id=v.id
      AND g.agent_id=atlas_private.context_uuid('app.agent_id') AND g.revoked_at IS NULL AND g.expires_at>clock_timestamp()
      AND t.allowed_collection_ids <@ g.allowed_collection_ids)))
$$;

CREATE FUNCTION atlas_private.can_process_task(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT target=atlas_private.context_uuid('app.processing_task_id') AND atlas_private.task_eligible(target) AND EXISTS(
    SELECT 1 FROM atlas.organization_tasks t WHERE t.workspace_id=atlas_private.context_uuid('app.workspace_id') AND t.id=target
      AND t.state='claimed' AND t.claimed_by_agent_id=atlas_private.context_uuid('app.agent_id')
      AND t.lease_digest=current_setting('app.processing_lease_digest',true) AND t.lease_expires_at>clock_timestamp()
      AND t.lease_expires_at<=t.first_claimed_at+interval '60 minutes')
$$;

CREATE FUNCTION atlas_private.processing_source(source_arg uuid,version_arg uuid DEFAULT NULL,chunk_arg uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.organization_tasks t JOIN atlas.source_versions v ON v.workspace_id=t.workspace_id AND v.id=t.source_version_id
    WHERE t.workspace_id=atlas_private.context_uuid('app.workspace_id') AND v.source_id=source_arg
    AND (version_arg IS NULL OR v.id=version_arg) AND (chunk_arg IS NULL OR chunk_arg=ANY(t.chunk_ids))
    AND atlas_private.can_process_task(t.id))
$$;

CREATE FUNCTION atlas_private.valid_job() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT session_user='atlas_worker' AND current_setting('app.principal_kind',true)='worker' AND EXISTS(
    SELECT 1 FROM atlas.ingestion_jobs j JOIN atlas.workspaces w ON w.id=j.workspace_id JOIN atlas.app_users u ON u.id=w.owner_user_id
    WHERE j.workspace_id=atlas_private.context_uuid('app.workspace_id') AND j.id=atlas_private.context_uuid('app.job_id')
    AND j.status='processing' AND j.cancel_requested_at IS NULL AND j.lease_token=atlas_private.context_uuid('app.job_lease_token')
    AND j.lease_expires_at>clock_timestamp() AND w.deleted_at IS NULL AND u.disabled_at IS NULL
    AND ((j.source_version_id=atlas_private.context_uuid('app.source_version_id') AND EXISTS(
      SELECT 1 FROM atlas.source_versions v JOIN atlas.sources s ON s.workspace_id=v.workspace_id AND s.id=v.source_id
      JOIN atlas.knowledge_items i ON i.workspace_id=s.workspace_id AND i.id=s.id
      WHERE v.workspace_id=j.workspace_id AND v.id=j.source_version_id AND s.current_version_id=v.id AND i.deleted_at IS NULL))
      OR (j.source_version_id IS NULL AND atlas_private.context_uuid('app.source_version_id') IS NULL AND EXISTS(
        SELECT 1 FROM atlas.knowledge_items i WHERE i.workspace_id=j.workspace_id AND i.id=j.item_id AND i.revision=j.expected_revision AND i.deleted_at IS NULL))))
$$;

CREATE FUNCTION atlas_private.can_work_item(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT atlas_private.valid_job() AND EXISTS(SELECT 1 FROM atlas.ingestion_jobs j
    LEFT JOIN atlas.source_versions v ON v.workspace_id=j.workspace_id AND v.id=j.source_version_id
    WHERE j.workspace_id=atlas_private.context_uuid('app.workspace_id') AND j.id=atlas_private.context_uuid('app.job_id')
    AND (v.source_id=target OR j.item_id=target))
$$;

CREATE FUNCTION atlas_private.can_read_collection(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.collections c WHERE c.workspace_id=atlas_private.context_uuid('app.workspace_id') AND c.id=target
    AND (atlas_private.current_member(c.workspace_id) OR (c.archived_at IS NULL AND
      (EXISTS(SELECT 1 FROM atlas.collection_items ci WHERE ci.workspace_id=c.workspace_id AND ci.collection_id=c.id AND atlas_private.can_read_item(ci.item_id))
       OR EXISTS(SELECT 1 FROM atlas.organization_tasks t WHERE t.workspace_id=c.workspace_id AND c.id=ANY(t.allowed_collection_ids) AND atlas_private.can_process_task(t.id))))))
$$;

CREATE FUNCTION atlas_private.can_read_tag(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.tags t WHERE t.workspace_id=atlas_private.context_uuid('app.workspace_id') AND t.id=target
    AND (atlas_private.current_member(t.workspace_id) OR EXISTS(SELECT 1 FROM atlas.knowledge_tags kt WHERE kt.workspace_id=t.workspace_id AND kt.tag_id=t.id AND atlas_private.can_read_item(kt.item_id))))
$$;

CREATE FUNCTION atlas_private.can_read_trace(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.retrieval_traces t WHERE t.workspace_id=atlas_private.context_uuid('app.workspace_id') AND t.id=target
    AND (atlas_private.current_member(t.workspace_id) OR (atlas_private.active_agent('read') AND t.agent_id=atlas_private.context_uuid('app.agent_id')
    AND NOT EXISTS(SELECT 1 FROM atlas.retrieval_trace_items ti WHERE ti.workspace_id=t.workspace_id AND ti.trace_id=t.id AND NOT atlas_private.can_read_item(ti.item_id)))))
$$;

CREATE FUNCTION atlas_private.owns_trace(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM atlas.retrieval_traces t WHERE t.workspace_id=atlas_private.context_uuid('app.workspace_id') AND t.id=target
    AND ((atlas_private.current_member(t.workspace_id) AND t.user_id=atlas_private.context_uuid('app.user_id'))
    OR (atlas_private.active_agent('read') AND t.agent_id=atlas_private.context_uuid('app.agent_id'))))
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA atlas_private FROM PUBLIC,atlas_api,atlas_worker;
GRANT USAGE ON SCHEMA atlas_private TO atlas_api,atlas_worker;
GRANT EXECUTE ON FUNCTION atlas_private.context_uuid(text),atlas_private.current_member(uuid),atlas_private.active_agent(text),
  atlas_private.can_read_item(uuid),atlas_private.can_write_item(uuid,text),atlas_private.task_eligible(uuid),atlas_private.can_process_task(uuid),
  atlas_private.processing_source(uuid,uuid,uuid),atlas_private.valid_job(),atlas_private.can_work_item(uuid),
  atlas_private.can_read_collection(uuid),atlas_private.can_read_tag(uuid),atlas_private.can_read_trace(uuid),atlas_private.owns_trace(uuid)
TO atlas_api,atlas_worker;
GRANT EXECUTE ON FUNCTION atlas_private.authenticate_agent(text) TO atlas_api;
RESET ROLE;
