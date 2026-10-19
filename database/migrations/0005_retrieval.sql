-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE TABLE atlas.search_documents (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  item_id uuid NOT NULL,chunk_id uuid,source_version_id uuid,item_revision integer CHECK(item_revision>0),text text NOT NULL,identifier_text text NOT NULL DEFAULT '',approved_aliases text NOT NULL DEFAULT '',normalizer_version text NOT NULL,origin_key text NOT NULL,search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,text||' '||identifier_text||' '||approved_aliases)) STORED,FOREIGN KEY(workspace_id,item_id) REFERENCES atlas.knowledge_items(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id,chunk_id) REFERENCES atlas.source_chunks(workspace_id,version_id,id),UNIQUE(workspace_id,origin_key),CHECK((source_version_id IS NOT NULL AND chunk_id IS NOT NULL AND item_revision IS NULL) OR (source_version_id IS NULL AND chunk_id IS NULL AND item_revision IS NOT NULL))
);


CREATE TABLE atlas.retrieval_traces (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  user_id uuid REFERENCES atlas.app_users(id),agent_id uuid,query_hash text NOT NULL CHECK(query_hash ~ '^[0-9a-f]{64}$'),filters jsonb NOT NULL DEFAULT '{}',token_measure text NOT NULL DEFAULT 'utf8_conservative_estimate_v1',requested_tokens integer NOT NULL CHECK(requested_tokens BETWEEN 256 AND 8192),used_tokens integer NOT NULL CHECK(used_tokens BETWEEN 0 AND requested_tokens),latency_ms integer NOT NULL CHECK(latency_ms>=0),fallback_flags text[] NOT NULL DEFAULT '{}',FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),CHECK(num_nonnulls(user_id,agent_id)=1)
);


CREATE TABLE atlas.retrieval_trace_items (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  trace_id uuid NOT NULL,item_id uuid NOT NULL,item_revision integer NOT NULL CHECK(item_revision>0),rank integer NOT NULL CHECK(rank>=0),FOREIGN KEY(workspace_id,trace_id) REFERENCES atlas.retrieval_traces(workspace_id,id),FOREIGN KEY(workspace_id,item_id) REFERENCES atlas.knowledge_items(workspace_id,id),UNIQUE(workspace_id,trace_id,item_id),UNIQUE(workspace_id,trace_id,rank)
);


CREATE TABLE atlas.activity_events (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  actor_kind text NOT NULL CHECK(actor_kind IN ('human','agent','worker')),user_id uuid REFERENCES atlas.app_users(id),agent_id uuid,job_id uuid,action text NOT NULL,target_item_id uuid,metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'),correlation_id uuid NOT NULL,FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),FOREIGN KEY(workspace_id,job_id) REFERENCES atlas.ingestion_jobs(workspace_id,id),FOREIGN KEY(workspace_id,target_item_id) REFERENCES atlas.knowledge_items(workspace_id,id),CHECK((actor_kind='human' AND user_id IS NOT NULL AND agent_id IS NULL AND job_id IS NULL) OR (actor_kind='agent' AND agent_id IS NOT NULL AND user_id IS NULL AND job_id IS NULL) OR (actor_kind='worker' AND job_id IS NOT NULL AND user_id IS NULL AND agent_id IS NULL))
);


CREATE TABLE atlas.graph_layouts (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  user_id uuid NOT NULL REFERENCES atlas.app_users(id),view_key text NOT NULL,positions jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(positions)='object'),camera jsonb NOT NULL DEFAULT '{}',filters jsonb NOT NULL DEFAULT '{}',graph_revision integer NOT NULL CHECK(graph_revision>0),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),UNIQUE(workspace_id,user_id,view_key)
);


CREATE TABLE atlas.idempotency_requests (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  principal_kind text NOT NULL CHECK(principal_kind IN ('human','agent')),principal_id uuid NOT NULL,route text NOT NULL,key text NOT NULL CHECK(key<>''),request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),response_reference jsonb NOT NULL,UNIQUE(workspace_id,principal_kind,principal_id,route,key)
);


RESET ROLE;
