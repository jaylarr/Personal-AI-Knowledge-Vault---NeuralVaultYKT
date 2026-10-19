-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE TABLE atlas.collections (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  parent_id uuid,normalized_name text NOT NULL CHECK(normalized_name=lower(btrim(name)) AND normalized_name<>''),name text NOT NULL,archived_at timestamptz,merged_into_id uuid,seed_key text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),FOREIGN KEY(workspace_id,parent_id) REFERENCES atlas.collections(workspace_id,id),FOREIGN KEY(workspace_id,merged_into_id) REFERENCES atlas.collections(workspace_id,id),CHECK(parent_id IS DISTINCT FROM id),CHECK(merged_into_id IS DISTINCT FROM id),CHECK(merged_into_id IS NULL OR archived_at IS NOT NULL),UNIQUE(workspace_id,seed_key)
);
CREATE UNIQUE INDEX collections_active_sibling ON atlas.collections(workspace_id,parent_id,normalized_name) NULLS NOT DISTINCT WHERE archived_at IS NULL;

CREATE TABLE atlas.knowledge_items (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  kind text NOT NULL CHECK(kind IN ('source','memory','entity','relationship')),title text NOT NULL CHECK(btrim(title)<>''),scope text NOT NULL CHECK(scope IN ('personal','global_development','project','agent_private','shared_agents')),project_id uuid,owner_agent_id uuid,access_partition text NOT NULL CHECK(access_partition<>''),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),deleted_at timestamptz,FOREIGN KEY(workspace_id,project_id) REFERENCES atlas.projects(workspace_id,id),FOREIGN KEY(workspace_id,owner_agent_id) REFERENCES atlas.agents(workspace_id,id),UNIQUE(workspace_id,id,kind),UNIQUE(workspace_id,id,access_partition),CHECK((scope='project')=(project_id IS NOT NULL)),CHECK((scope='agent_private')=(owner_agent_id IS NOT NULL)),CHECK((scope='personal' AND access_partition LIKE 'personal:%') OR (scope='global_development' AND access_partition='global:'||workspace_id::text) OR (scope='project' AND access_partition='project:'||project_id::text) OR (scope='agent_private' AND access_partition='agent:'||owner_agent_id::text) OR (scope='shared_agents' AND access_partition ~ '^shared:[0-9a-f]{64}$'))
);


CREATE TABLE atlas.sources (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  item_kind text GENERATED ALWAYS AS ('source'::text) STORED,FOREIGN KEY(workspace_id,id,item_kind) REFERENCES atlas.knowledge_items(workspace_id,id,kind),input_type text NOT NULL CHECK(input_type IN ('note','text','markdown','url')),current_version_id uuid,content_revision integer NOT NULL DEFAULT 1 CHECK(content_revision>0),processing_state text NOT NULL DEFAULT 'capturing' CHECK(processing_state IN ('capturing','indexing','awaiting_agent','claimed','review_pending','organized','failed')),sensitivity text NOT NULL DEFAULT 'clear' CHECK(sensitivity IN ('clear','quarantined','released_for_agent')),url text,CHECK((input_type='url')=(url IS NOT NULL))
);


CREATE TABLE atlas.source_versions (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  source_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),raw_sha256 text NOT NULL CHECK(raw_sha256 ~ '^[0-9a-f]{64}$'),normalized_sha256 text NOT NULL CHECK(normalized_sha256 ~ '^[0-9a-f]{64}$'),object_key text NOT NULL CHECK(object_key<>''),byte_count integer NOT NULL CHECK(byte_count BETWEEN 0 AND 2097152),media_type text NOT NULL,markdown text NOT NULL,normalized_text text NOT NULL,editor_json jsonb,source_timestamp timestamptz,origin_uri text,repository_commit text,FOREIGN KEY(workspace_id,source_id) REFERENCES atlas.sources(workspace_id,id),UNIQUE(workspace_id,source_id,version),UNIQUE(workspace_id,source_id,id),UNIQUE(workspace_id,object_key)
);

ALTER TABLE atlas.sources ADD CONSTRAINT current_version_belongs_to_source FOREIGN KEY(workspace_id,id,current_version_id) REFERENCES atlas.source_versions(workspace_id,source_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE atlas.source_chunks (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  source_id uuid NOT NULL,version_id uuid NOT NULL,sequence integer NOT NULL CHECK(sequence>=0),text text NOT NULL,heading_path text[] NOT NULL DEFAULT '{}',start_offset integer NOT NULL CHECK(start_offset>=0),end_offset integer NOT NULL CHECK(end_offset>start_offset),sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),estimated_tokens integer NOT NULL CHECK(estimated_tokens BETWEEN 1 AND 800),FOREIGN KEY(workspace_id,source_id,version_id) REFERENCES atlas.source_versions(workspace_id,source_id,id),UNIQUE(workspace_id,version_id,sequence),UNIQUE(workspace_id,version_id,id)
);


CREATE TABLE atlas.collection_items (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  collection_id uuid NOT NULL,item_id uuid NOT NULL,origin text NOT NULL CHECK(origin IN ('manual','ai')),confidence numeric CHECK(confidence BETWEEN 0 AND 1),locked boolean NOT NULL DEFAULT false,FOREIGN KEY(workspace_id,collection_id) REFERENCES atlas.collections(workspace_id,id),FOREIGN KEY(workspace_id,item_id) REFERENCES atlas.knowledge_items(workspace_id,id),UNIQUE(workspace_id,collection_id,item_id)
);


CREATE TABLE atlas.classification_overrides (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  source_id uuid NOT NULL,collection_id uuid NOT NULL,decision text NOT NULL CHECK(decision IN ('include','exclude')),actor_user_id uuid NOT NULL REFERENCES atlas.app_users(id),FOREIGN KEY(workspace_id,source_id) REFERENCES atlas.sources(workspace_id,id),FOREIGN KEY(workspace_id,collection_id) REFERENCES atlas.collections(workspace_id,id),UNIQUE(workspace_id,source_id,collection_id)
);


CREATE TABLE atlas.tags (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  name text NOT NULL,normalized_name text NOT NULL CHECK(normalized_name=lower(btrim(name)) AND normalized_name<>''),UNIQUE(workspace_id,normalized_name)
);


CREATE TABLE atlas.knowledge_tags (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  item_id uuid NOT NULL,tag_id uuid NOT NULL,FOREIGN KEY(workspace_id,item_id) REFERENCES atlas.knowledge_items(workspace_id,id),FOREIGN KEY(workspace_id,tag_id) REFERENCES atlas.tags(workspace_id,id),UNIQUE(workspace_id,item_id,tag_id)
);


RESET ROLE;
