CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE INDEX search_documents_fts ON atlas.search_documents USING gin(search_vector);
CREATE INDEX search_identifiers_trigram ON atlas.search_documents USING gin(identifier_text public.gin_trgm_ops);
CREATE INDEX item_project_scope ON atlas.knowledge_items(workspace_id,project_id,scope) WHERE deleted_at IS NULL;
CREATE INDEX item_title_trigram ON atlas.knowledge_items USING gin(title public.gin_trgm_ops);
CREATE INDEX jobs_ready ON atlas.ingestion_jobs(available_at,id) WHERE status='queued';
CREATE INDEX tasks_ready ON atlas.organization_tasks(workspace_id,assigned_agent_id,created_at) WHERE state='awaiting_agent';
CREATE INDEX tasks_version ON atlas.organization_tasks(workspace_id,source_version_id);
CREATE INDEX memories_current ON atlas.memories(workspace_id,type,valid_from) WHERE status='active' AND NOT requires_revalidation;
CREATE INDEX relationships_neighbors ON atlas.relationships(workspace_id,from_item_id,to_item_id) WHERE status='active';
CREATE INDEX relationships_incoming ON atlas.relationships(workspace_id,to_item_id) WHERE status='active';
CREATE INDEX collections_parent ON atlas.collections(workspace_id,parent_id);
CREATE INDEX activity_timeline ON atlas.activity_events(workspace_id,created_at DESC,id);

RESET ROLE;
