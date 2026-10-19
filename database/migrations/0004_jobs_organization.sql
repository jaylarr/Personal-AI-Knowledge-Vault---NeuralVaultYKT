-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE TABLE atlas.ingestion_jobs (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  kind text NOT NULL CHECK(kind IN ('normalize','chunk','lexical_index','reconcile_original','materialize_memory')),source_version_id uuid,item_id uuid,expected_revision integer CHECK(expected_revision>0),status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','failed','cancelled')),stage text NOT NULL,attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 4),available_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_expires_at timestamptz,heartbeat_at timestamptz,cancel_requested_at timestamptz,idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[0-9a-f]{64}$'),last_error_code text,FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,item_id) REFERENCES atlas.knowledge_items(workspace_id,id),UNIQUE(workspace_id,idempotency_key),CHECK((source_version_id IS NOT NULL AND item_id IS NULL AND expected_revision IS NULL) OR (source_version_id IS NULL AND item_id IS NOT NULL AND expected_revision IS NOT NULL)),CHECK((status='processing')=(lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),CHECK((lease_token IS NULL)=(lease_expires_at IS NULL))
);


CREATE TABLE atlas.job_results (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  job_id uuid NOT NULL,stage text NOT NULL,input_hash text NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),pipeline_version text NOT NULL,result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),FOREIGN KEY(workspace_id,job_id) REFERENCES atlas.ingestion_jobs(workspace_id,id),UNIQUE(workspace_id,job_id,stage,input_hash)
);


CREATE TABLE atlas.organization_tasks (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  source_version_id uuid NOT NULL,expected_source_revision integer NOT NULL CHECK(expected_source_revision>0),contract_version integer NOT NULL DEFAULT 1 CHECK(contract_version=1),batch_index integer NOT NULL CHECK(batch_index>=0),chunk_ids uuid[] NOT NULL CHECK(cardinality(chunk_ids) BETWEEN 1 AND 20 AND array_position(chunk_ids,NULL) IS NULL),allowed_collection_ids uuid[] NOT NULL DEFAULT '{}' CHECK(array_position(allowed_collection_ids,NULL) IS NULL),assigned_agent_id uuid,state text NOT NULL DEFAULT 'awaiting_agent' CHECK(state IN ('awaiting_agent','claimed','submitted','completed','cancelled','superseded')),lease_digest text CHECK(lease_digest ~ '^[0-9a-f]{64}$'),lease_expires_at timestamptz,first_claimed_at timestamptz,claimed_by_agent_id uuid,submission_id uuid,last_error_code text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),FOREIGN KEY(workspace_id,source_version_id) REFERENCES atlas.source_versions(workspace_id,id),FOREIGN KEY(workspace_id,assigned_agent_id) REFERENCES atlas.agents(workspace_id,id),FOREIGN KEY(workspace_id,claimed_by_agent_id) REFERENCES atlas.agents(workspace_id,id),CHECK(state<>'claimed' OR (lease_digest IS NOT NULL AND lease_expires_at IS NOT NULL AND first_claimed_at IS NOT NULL AND claimed_by_agent_id IS NOT NULL)),CHECK(lease_expires_at IS NULL OR (first_claimed_at IS NOT NULL AND lease_expires_at<=first_claimed_at+interval '60 minutes')),CHECK((state IN ('submitted','completed'))=(submission_id IS NOT NULL))
);
CREATE UNIQUE INDEX organization_live_batch ON atlas.organization_tasks(workspace_id,source_version_id,contract_version,batch_index) WHERE state NOT IN ('cancelled','superseded');

CREATE TABLE atlas.organization_submissions (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  task_id uuid NOT NULL,agent_id uuid NOT NULL,idempotency_key text NOT NULL CHECK(idempotency_key<>''),payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144),reported_client text,reported_model text,created_candidate_ids uuid[] NOT NULL DEFAULT '{}',FOREIGN KEY(workspace_id,task_id) REFERENCES atlas.organization_tasks(workspace_id,id),FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),UNIQUE(workspace_id,agent_id,task_id,idempotency_key),UNIQUE(workspace_id,task_id,id)
);

ALTER TABLE atlas.organization_tasks ADD CONSTRAINT task_submission_identity FOREIGN KEY(workspace_id,id,submission_id) REFERENCES atlas.organization_submissions(workspace_id,task_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE atlas.review_queue (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  kind text NOT NULL CHECK(kind IN ('classification','entity','memory','relationship','decision','collection_suggestion','duplicate','summary')),target_item_id uuid,origin_submission_id uuid,candidate_id text,direct_request_key text,payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),reviewer_user_id uuid REFERENCES atlas.app_users(id),reason text,reviewed_at timestamptz,FOREIGN KEY(workspace_id,target_item_id) REFERENCES atlas.knowledge_items(workspace_id,id),FOREIGN KEY(workspace_id,origin_submission_id) REFERENCES atlas.organization_submissions(workspace_id,id),CHECK((origin_submission_id IS NOT NULL AND candidate_id IS NOT NULL AND direct_request_key IS NULL) OR (origin_submission_id IS NULL AND candidate_id IS NULL AND direct_request_key IS NOT NULL)),CHECK((status='pending')=(reviewer_user_id IS NULL AND reviewed_at IS NULL)),CHECK(status='pending' OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX review_submission_candidate ON atlas.review_queue(workspace_id,origin_submission_id,candidate_id) WHERE origin_submission_id IS NOT NULL;
CREATE UNIQUE INDEX review_direct_request ON atlas.review_queue(workspace_id,direct_request_key) WHERE direct_request_key IS NOT NULL;

RESET ROLE;
