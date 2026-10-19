-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE TABLE atlas_private.agent_credentials (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  agent_id uuid NOT NULL,token_digest text NOT NULL CHECK(token_digest ~ '^[0-9a-f]{64}$'),display_prefix text NOT NULL CHECK(display_prefix ~ '^atlas_[A-Za-z0-9_-]{4,12}$'),issued_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,revoked_at timestamptz,operations text[] NOT NULL CHECK(cardinality(operations)>0 AND operations <@ ARRAY['read','propose','process_knowledge']::text[] AND array_position(operations,NULL) IS NULL),FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),CHECK(expires_at>issued_at),UNIQUE(token_digest)
);


CREATE TABLE atlas_private.agent_project_grants (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  agent_id uuid NOT NULL,project_id uuid NOT NULL,read boolean NOT NULL DEFAULT false,propose boolean NOT NULL DEFAULT false,process_knowledge boolean NOT NULL DEFAULT false,FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),FOREIGN KEY(workspace_id,project_id) REFERENCES atlas.projects(workspace_id,id),UNIQUE(workspace_id,agent_id,project_id),CHECK(NOT process_knowledge OR read)
);


CREATE TABLE atlas_private.item_agent_grants (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  agent_id uuid NOT NULL,item_id uuid NOT NULL,read boolean NOT NULL DEFAULT false,propose boolean NOT NULL DEFAULT false,process_knowledge boolean NOT NULL DEFAULT false,FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),FOREIGN KEY(workspace_id,item_id) REFERENCES atlas.knowledge_items(workspace_id,id),UNIQUE(workspace_id,agent_id,item_id),CHECK(NOT process_knowledge OR read)
);


CREATE TABLE atlas_private.agent_scope_grants (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  agent_id uuid NOT NULL,scope text NOT NULL CHECK(scope IN ('global_development','agent_private')),read boolean NOT NULL DEFAULT false,propose boolean NOT NULL DEFAULT false,process_knowledge boolean NOT NULL DEFAULT false,FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),UNIQUE(workspace_id,agent_id,scope),CHECK(NOT process_knowledge OR read)
);


CREATE TABLE atlas_private.processing_grants (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  source_version_id uuid NOT NULL,agent_id uuid NOT NULL,allowed_collection_ids uuid[] NOT NULL DEFAULT '{}' CHECK(array_position(allowed_collection_ids,NULL) IS NULL),granted_by_user_id uuid NOT NULL REFERENCES atlas.app_users(id),expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',revoked_at timestamptz,FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days')
);
CREATE UNIQUE INDEX processing_current_named_processor ON atlas_private.processing_grants(workspace_id,source_version_id) WHERE revoked_at IS NULL;
ALTER TABLE atlas_private.workspace_members ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.agents ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.workspace_settings ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.projects ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.collections ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.knowledge_items ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.sources ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.source_versions ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.source_chunks ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.collection_items ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.classification_overrides ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.tags ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.knowledge_tags ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.memories ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.memory_versions ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.entities ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.relationships ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.memory_evidence ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.entity_evidence ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.relationship_evidence ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.memory_entities ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.ingestion_jobs ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.job_results ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.organization_tasks ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.organization_submissions ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.review_queue ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.search_documents ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.retrieval_traces ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.retrieval_trace_items ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.activity_events ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.graph_layouts ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas.idempotency_requests ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas_private.agent_credentials ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas_private.agent_project_grants ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas_private.item_agent_grants ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas_private.agent_scope_grants ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);
ALTER TABLE atlas_private.processing_grants ADD FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id);

RESET ROLE;
