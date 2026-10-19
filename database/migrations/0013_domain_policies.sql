SET LOCAL ROLE atlas_owner;

CREATE POLICY self_user ON atlas.app_users FOR SELECT TO atlas_api
USING(id=atlas_private.context_uuid('app.user_id') AND atlas_private.current_member(atlas_private.context_uuid('app.workspace_id')));
GRANT SELECT ON atlas.app_users TO atlas_api;
CREATE POLICY owner_workspace_read ON atlas.workspaces FOR SELECT TO atlas_api USING(atlas_private.current_member(id));
CREATE POLICY owner_workspace_update ON atlas.workspaces FOR UPDATE TO atlas_api USING(atlas_private.current_member(id))
WITH CHECK(id=atlas_private.context_uuid('app.workspace_id') AND owner_user_id=atlas_private.context_uuid('app.user_id'));
GRANT SELECT,UPDATE(name,revision,updated_at,deleted_at) ON atlas.workspaces TO atlas_api;

-- All domain tables have a human-only policy. Private ACL tables intentionally have none.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['workspace_settings','projects','collections','agents','knowledge_items','sources','source_versions','source_chunks',
    'collection_items','classification_overrides','tags','knowledge_tags','memories','memory_versions','memory_evidence','entities','entity_evidence','memory_entities',
    'relationships','relationship_evidence','ingestion_jobs','job_results','organization_tasks','organization_submissions','review_queue','search_documents',
    'retrieval_traces','retrieval_trace_items','activity_events','graph_layouts','idempotency_requests'] LOOP
    EXECUTE format('CREATE POLICY owner_read ON atlas.%I FOR SELECT TO atlas_api USING(atlas_private.current_member(workspace_id))',table_name);
    EXECUTE format('CREATE POLICY owner_insert ON atlas.%I FOR INSERT TO atlas_api WITH CHECK(atlas_private.current_member(workspace_id) AND created_by_user_id=atlas_private.context_uuid(''app.user_id'') AND created_by_agent_id IS NULL)',table_name);
    EXECUTE format('CREATE POLICY owner_update ON atlas.%I FOR UPDATE TO atlas_api USING(atlas_private.current_member(workspace_id)) WITH CHECK(atlas_private.current_member(workspace_id))',table_name);
    EXECUTE format('CREATE POLICY owner_delete ON atlas.%I FOR DELETE TO atlas_api USING(atlas_private.current_member(workspace_id))',table_name);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON atlas.%I TO atlas_api',table_name);
  END LOOP;
END;
$$;

-- Immutable provenance is protected even during ordinary authorized UPDATEs.
CREATE FUNCTION atlas.freeze_row_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (NEW.workspace_id,NEW.id,NEW.created_at,NEW.created_by_user_id,NEW.created_by_agent_id)
    IS DISTINCT FROM (OLD.workspace_id,OLD.id,OLD.created_at,OLD.created_by_user_id,OLD.created_by_agent_id) THEN
    RAISE EXCEPTION 'Row identity/provenance is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='atlas' AND tablename NOT IN ('app_users','workspaces') LOOP
    EXECUTE format('CREATE TRIGGER row_identity BEFORE UPDATE ON atlas.%I FOR EACH ROW EXECUTE FUNCTION atlas.freeze_row_identity()',r.tablename);
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION atlas.freeze_row_identity() FROM PUBLIC;

-- UUIDs are unique within a workspace, not globally. This mandatory AND predicate
-- prevents colliding IDs in another workspace from satisfying any item helper.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='atlas' AND tablename NOT IN ('app_users','workspaces') LOOP
    EXECUTE format('CREATE POLICY workspace_boundary ON atlas.%I AS RESTRICTIVE FOR ALL TO atlas_api,atlas_worker USING(workspace_id=atlas_private.context_uuid(''app.workspace_id'')) WITH CHECK(workspace_id=atlas_private.context_uuid(''app.workspace_id''))',r.tablename);
  END LOOP;
END;
$$;

CREATE POLICY agent_self ON atlas.agents FOR SELECT TO atlas_api
USING(id=atlas_private.context_uuid('app.agent_id') AND workspace_id=atlas_private.context_uuid('app.workspace_id')
  AND (atlas_private.active_agent('read') OR atlas_private.active_agent('process_knowledge') OR atlas_private.active_agent('propose')));
CREATE POLICY agent_projects ON atlas.projects FOR SELECT TO atlas_api
USING(archived_at IS NULL AND workspace_id=atlas_private.context_uuid('app.workspace_id') AND atlas_private.active_agent('read') AND EXISTS(
  SELECT 1 FROM atlas.knowledge_items i WHERE i.workspace_id=projects.workspace_id AND i.project_id=projects.id AND atlas_private.can_read_item(i.id)));
CREATE POLICY scoped_items ON atlas.knowledge_items FOR SELECT TO atlas_api,atlas_worker
USING(atlas_private.can_read_item(id) OR atlas_private.processing_source(id) OR atlas_private.can_work_item(id));
CREATE POLICY scoped_sources ON atlas.sources FOR SELECT TO atlas_api,atlas_worker
USING(atlas_private.can_read_item(id) OR atlas_private.processing_source(id) OR atlas_private.can_work_item(id));
CREATE POLICY scoped_versions ON atlas.source_versions FOR SELECT TO atlas_api,atlas_worker
USING(atlas_private.can_read_item(source_id) OR atlas_private.processing_source(source_id,id)
  OR (atlas_private.can_work_item(source_id) AND id=atlas_private.context_uuid('app.source_version_id')));
CREATE POLICY scoped_chunks ON atlas.source_chunks FOR SELECT TO atlas_api,atlas_worker
USING(atlas_private.can_read_item(source_id) OR atlas_private.processing_source(source_id,version_id,id)
  OR (atlas_private.can_work_item(source_id) AND version_id=atlas_private.context_uuid('app.source_version_id')));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['memories','entities','relationships'] LOOP
    EXECUTE format('CREATE POLICY agent_item_read ON atlas.%I FOR SELECT TO atlas_api USING(atlas_private.can_read_item(id))',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['memory_versions','memory_evidence'] LOOP
    EXECUTE format('CREATE POLICY agent_item_read ON atlas.%I FOR SELECT TO atlas_api USING(atlas_private.can_read_item(memory_id))',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['entity_evidence','relationship_evidence'] LOOP
    EXECUTE format('CREATE POLICY agent_item_read ON atlas.%I FOR SELECT TO atlas_api USING(atlas_private.can_read_item(%I))',table_name,replace(table_name,'_evidence','_id'));
  END LOOP;
END;
$$;
-- Complete prior snapshots may contain formerly private text: agent history is never exposed in P0.
DROP POLICY agent_item_read ON atlas.memory_versions;
CREATE POLICY agent_memory_entities ON atlas.memory_entities FOR SELECT TO atlas_api
USING(atlas_private.can_read_item(memory_id) AND atlas_private.can_read_item(entity_id));
CREATE POLICY scoped_collection ON atlas.collections FOR SELECT TO atlas_api USING(atlas_private.can_read_collection(id));
CREATE POLICY scoped_membership ON atlas.collection_items FOR SELECT TO atlas_api
USING(atlas_private.can_read_item(item_id) AND atlas_private.can_read_collection(collection_id));
CREATE POLICY scoped_tag ON atlas.tags FOR SELECT TO atlas_api USING(atlas_private.can_read_tag(id));
CREATE POLICY scoped_knowledge_tag ON atlas.knowledge_tags FOR SELECT TO atlas_api
USING(atlas_private.can_read_item(item_id) AND atlas_private.can_read_tag(tag_id));
CREATE POLICY scoped_search ON atlas.search_documents FOR SELECT TO atlas_api,atlas_worker
USING((atlas_private.can_read_item(item_id) OR atlas_private.can_work_item(item_id)) AND
  ((source_version_id IS NOT NULL AND EXISTS(SELECT 1 FROM atlas.sources s WHERE s.workspace_id=search_documents.workspace_id AND s.id=item_id AND s.current_version_id=source_version_id))
   OR (item_revision IS NOT NULL AND EXISTS(SELECT 1 FROM atlas.knowledge_items i WHERE i.workspace_id=search_documents.workspace_id AND i.id=item_id AND i.revision=item_revision))));

CREATE POLICY agent_tasks ON atlas.organization_tasks FOR SELECT TO atlas_api USING(atlas_private.task_eligible(id));
CREATE POLICY agent_submissions ON atlas.organization_submissions FOR SELECT TO atlas_api
USING(agent_id=atlas_private.context_uuid('app.agent_id') AND atlas_private.can_process_task(task_id));
CREATE POLICY agent_submit ON atlas.organization_submissions FOR INSERT TO atlas_api
WITH CHECK(agent_id=atlas_private.context_uuid('app.agent_id') AND created_by_agent_id=agent_id AND created_by_user_id IS NULL AND atlas_private.can_process_task(task_id));
CREATE POLICY agent_review_insert ON atlas.review_queue FOR INSERT TO atlas_api
WITH CHECK(workspace_id=atlas_private.context_uuid('app.workspace_id') AND created_by_agent_id=atlas_private.context_uuid('app.agent_id')
  AND created_by_user_id IS NULL AND status='pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL
  AND ((origin_submission_id IS NULL AND target_item_id IS NOT NULL AND atlas_private.can_write_item(target_item_id,'propose'))
    OR (origin_submission_id IS NOT NULL AND EXISTS(SELECT 1 FROM atlas.organization_submissions s WHERE s.workspace_id=review_queue.workspace_id AND s.id=origin_submission_id
      AND s.agent_id=atlas_private.context_uuid('app.agent_id') AND atlas_private.can_process_task(s.task_id)))));
CREATE POLICY agent_own_review ON atlas.review_queue FOR SELECT TO atlas_api
USING(created_by_agent_id=atlas_private.context_uuid('app.agent_id') AND target_item_id IS NOT NULL AND atlas_private.can_write_item(target_item_id,'propose'));

CREATE POLICY scoped_trace ON atlas.retrieval_traces FOR SELECT TO atlas_api USING(atlas_private.can_read_trace(id));
CREATE POLICY scoped_trace_items ON atlas.retrieval_trace_items FOR SELECT TO atlas_api
USING(atlas_private.can_read_trace(trace_id) AND atlas_private.can_read_item(item_id));
CREATE POLICY agent_trace_insert ON atlas.retrieval_traces FOR INSERT TO atlas_api
WITH CHECK(workspace_id=atlas_private.context_uuid('app.workspace_id') AND atlas_private.active_agent('read')
 AND agent_id=atlas_private.context_uuid('app.agent_id') AND user_id IS NULL AND created_by_agent_id=agent_id AND created_by_user_id IS NULL);
CREATE POLICY agent_trace_item_insert ON atlas.retrieval_trace_items FOR INSERT TO atlas_api
WITH CHECK(atlas_private.owns_trace(trace_id) AND atlas_private.can_read_item(item_id)
 AND created_by_agent_id=atlas_private.context_uuid('app.agent_id') AND created_by_user_id IS NULL);

-- Worker role has no ability to impersonate a human, change a grant, or approve canonical memories.
GRANT SELECT ON atlas.knowledge_items,atlas.sources,atlas.source_versions,atlas.source_chunks,atlas.search_documents,atlas.ingestion_jobs,atlas.job_results TO atlas_worker;
GRANT INSERT ON atlas.source_chunks,atlas.search_documents,atlas.job_results,atlas.activity_events TO atlas_worker;
GRANT UPDATE(processing_state) ON atlas.sources TO atlas_worker;
CREATE POLICY worker_source_progress ON atlas.sources FOR UPDATE TO atlas_worker
USING(atlas_private.can_work_item(id)) WITH CHECK(atlas_private.can_work_item(id));
CREATE POLICY worker_chunks ON atlas.source_chunks FOR INSERT TO atlas_worker
WITH CHECK(atlas_private.can_work_item(source_id) AND version_id=atlas_private.context_uuid('app.source_version_id') AND created_by_user_id IS NULL AND created_by_agent_id IS NULL);
CREATE POLICY worker_search ON atlas.search_documents FOR INSERT TO atlas_worker
WITH CHECK(atlas_private.can_work_item(item_id) AND (source_version_id=atlas_private.context_uuid('app.source_version_id') OR source_version_id IS NULL)
 AND created_by_user_id IS NULL AND created_by_agent_id IS NULL);
CREATE POLICY worker_job ON atlas.ingestion_jobs FOR SELECT TO atlas_worker
USING(id=atlas_private.context_uuid('app.job_id') AND atlas_private.valid_job());
CREATE POLICY worker_job_result ON atlas.job_results FOR SELECT TO atlas_worker
USING(job_id=atlas_private.context_uuid('app.job_id') AND atlas_private.valid_job());
CREATE POLICY worker_result_insert ON atlas.job_results FOR INSERT TO atlas_worker
WITH CHECK(job_id=atlas_private.context_uuid('app.job_id') AND atlas_private.valid_job() AND created_by_user_id IS NULL AND created_by_agent_id IS NULL);
CREATE POLICY worker_activity ON atlas.activity_events FOR INSERT TO atlas_worker
WITH CHECK(actor_kind='worker' AND job_id=atlas_private.context_uuid('app.job_id') AND atlas_private.valid_job()
 AND (target_item_id IS NULL OR atlas_private.can_work_item(target_item_id)) AND created_by_user_id IS NULL AND created_by_agent_id IS NULL);

RESET ROLE;
