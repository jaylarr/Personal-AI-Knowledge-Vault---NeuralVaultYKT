-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE TABLE atlas.memories (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  item_kind text GENERATED ALWAYS AS ('memory'::text) STORED,FOREIGN KEY(workspace_id,id,item_kind) REFERENCES atlas.knowledge_items(workspace_id,id,kind),type text NOT NULL CHECK(type IN ('semantic','procedural','episodic','project','core')),subject_key text NOT NULL CHECK(subject_key<>''),structured_content jsonb NOT NULL CHECK(jsonb_typeof(structured_content)='object'),summary text NOT NULL CHECK(btrim(summary)<>''),status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','verified','active','rejected','archived','superseded')),claim_kind text NOT NULL CHECK(claim_kind IN ('explicit_fact','inference','recommendation','opinion','unverified_claim','historical','decision')),confidence numeric CHECK(confidence BETWEEN 0 AND 1),verified_by_user_id uuid REFERENCES atlas.app_users(id),verified_at timestamptz,last_validated_at timestamptz,valid_from timestamptz NOT NULL DEFAULT now(),valid_to timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),superseded_by_id uuid,requires_revalidation boolean NOT NULL DEFAULT false,critical boolean NOT NULL DEFAULT false,retrieval_level text NOT NULL DEFAULT 'detail' CHECK(retrieval_level IN ('core','project','detail')),FOREIGN KEY(workspace_id,superseded_by_id) REFERENCES atlas.memories(workspace_id,id),CHECK(superseded_by_id IS DISTINCT FROM id),CHECK((verified_at IS NULL)=(verified_by_user_id IS NULL)),CHECK(status NOT IN ('verified','active','superseded') OR verified_at IS NOT NULL),CHECK((status='superseded')=(superseded_by_id IS NOT NULL)),CHECK(status<>'superseded' OR valid_to IS NOT NULL)
);


CREATE TABLE atlas.memory_versions (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  memory_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),reason text NOT NULL CHECK(btrim(reason)<>''),FOREIGN KEY(workspace_id,memory_id) REFERENCES atlas.memories(workspace_id,id),UNIQUE(workspace_id,memory_id,version)
);


CREATE TABLE atlas.entities (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  item_kind text GENERATED ALWAYS AS ('entity'::text) STORED,FOREIGN KEY(workspace_id,id,item_kind) REFERENCES atlas.knowledge_items(workspace_id,id,kind),access_partition text NOT NULL,canonical_key text NOT NULL CHECK(canonical_key=lower(btrim(canonical_key)) AND canonical_key<>''),entity_type text NOT NULL,aliases text[] NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','active','archived')),approved_by_user_id uuid REFERENCES atlas.app_users(id),approved_at timestamptz,FOREIGN KEY(workspace_id,id,access_partition) REFERENCES atlas.knowledge_items(workspace_id,id,access_partition),CHECK((approved_at IS NULL)=(approved_by_user_id IS NULL)),CHECK(status<>'active' OR approved_at IS NOT NULL)
);
CREATE UNIQUE INDEX entities_active_canonical ON atlas.entities(workspace_id,access_partition,canonical_key) WHERE status='active';

CREATE TABLE atlas.relationships (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  item_kind text GENERATED ALWAYS AS ('relationship'::text) STORED,FOREIGN KEY(workspace_id,id,item_kind) REFERENCES atlas.knowledge_items(workspace_id,id,kind),from_item_id uuid NOT NULL,to_item_id uuid NOT NULL,from_kind text NOT NULL CHECK(from_kind IN ('source','memory','entity')),to_kind text NOT NULL CHECK(to_kind IN ('source','memory','entity')),type text NOT NULL CHECK(type IN ('USES','DEPENDS_ON','IMPLEMENTS','BELONGS_TO','RELATED_TO','REPLACES','RESOLVES','DOCUMENTS','REFERENCES')),status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','active','rejected','archived','superseded')),claim_kind text NOT NULL CHECK(claim_kind IN ('explicit_fact','inference','recommendation','opinion','unverified_claim','historical','decision')),confidence numeric CHECK(confidence BETWEEN 0 AND 1),valid_from timestamptz NOT NULL DEFAULT now(),valid_to timestamptz,CHECK(valid_to IS NULL OR valid_to>valid_from),FOREIGN KEY(workspace_id,from_item_id,from_kind) REFERENCES atlas.knowledge_items(workspace_id,id,kind),FOREIGN KEY(workspace_id,to_item_id,to_kind) REFERENCES atlas.knowledge_items(workspace_id,id,kind),CHECK(from_item_id<>to_item_id)
);
CREATE UNIQUE INDEX relationships_active_exact ON atlas.relationships(workspace_id,from_item_id,to_item_id,type) WHERE status='active';

CREATE TABLE atlas.memory_evidence (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  memory_id uuid NOT NULL,source_version_id uuid NOT NULL,chunk_id uuid,start_offset integer NOT NULL CHECK(start_offset>=0),end_offset integer NOT NULL CHECK(end_offset>start_offset),quote_sha256 text NOT NULL CHECK(quote_sha256 ~ '^[0-9a-f]{64}$'),FOREIGN KEY(workspace_id,memory_id) REFERENCES atlas.memories(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id,chunk_id) REFERENCES atlas.source_chunks(workspace_id,version_id,id)
);


CREATE TABLE atlas.entity_evidence (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  entity_id uuid NOT NULL,source_version_id uuid NOT NULL,chunk_id uuid,start_offset integer NOT NULL CHECK(start_offset>=0),end_offset integer NOT NULL CHECK(end_offset>start_offset),quote_sha256 text NOT NULL CHECK(quote_sha256 ~ '^[0-9a-f]{64}$'),FOREIGN KEY(workspace_id,entity_id) REFERENCES atlas.entities(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id,chunk_id) REFERENCES atlas.source_chunks(workspace_id,version_id,id)
);


CREATE TABLE atlas.relationship_evidence (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  relationship_id uuid NOT NULL,source_version_id uuid NOT NULL,chunk_id uuid,start_offset integer NOT NULL CHECK(start_offset>=0),end_offset integer NOT NULL CHECK(end_offset>start_offset),quote_sha256 text NOT NULL CHECK(quote_sha256 ~ '^[0-9a-f]{64}$'),FOREIGN KEY(workspace_id,relationship_id) REFERENCES atlas.relationships(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,source_version_id,chunk_id) REFERENCES atlas.source_chunks(workspace_id,version_id,id)
);


CREATE TABLE atlas.memory_entities (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  memory_id uuid NOT NULL,entity_id uuid NOT NULL,FOREIGN KEY(workspace_id,memory_id) REFERENCES atlas.memories(workspace_id,id),FOREIGN KEY(workspace_id,entity_id) REFERENCES atlas.entities(workspace_id,id),UNIQUE(workspace_id,memory_id,entity_id)
);


RESET ROLE;
