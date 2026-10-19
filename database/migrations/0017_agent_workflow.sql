-- A01: small append-only project checkpoints, separate from canonical memories/source ingestion.
SET LOCAL ROLE atlas_owner;
ALTER TABLE atlas_private.agent_credentials DROP CONSTRAINT agent_credentials_operations_check;
ALTER TABLE atlas_private.agent_credentials ADD CONSTRAINT agent_credentials_operations_check
CHECK(cardinality(operations)>0 AND operations <@ ARRAY['read','propose','process_knowledge','manage_projects','capture_checkpoint']::text[] AND array_position(operations,NULL) IS NULL);

CREATE OR REPLACE FUNCTION atlas_private.active_agent(operation text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT session_user='atlas_api' AND current_setting('app.principal_kind',true)='agent'
    AND operation IN ('read','propose','process_knowledge','manage_projects','capture_checkpoint') AND EXISTS (
      SELECT 1 FROM atlas_private.agent_credentials c JOIN atlas.agents a ON a.workspace_id=c.workspace_id AND a.id=c.agent_id
      JOIN atlas.workspaces w ON w.id=a.workspace_id JOIN atlas.app_users u ON u.id=w.owner_user_id
      WHERE c.workspace_id=atlas_private.context_uuid('app.workspace_id')
        AND c.id=atlas_private.context_uuid('app.credential_id') AND a.id=atlas_private.context_uuid('app.agent_id')
        AND a.disabled_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=clock_timestamp() AND c.expires_at>clock_timestamp()
        AND operation=ANY(c.operations) AND w.deleted_at IS NULL AND u.disabled_at IS NULL
    )
$$;

CREATE TABLE atlas_private.project_repositories (
  workspace_id uuid NOT NULL, project_id uuid NOT NULL, repository_digest text NOT NULL CHECK(repository_digest ~ '^[0-9a-f]{64}$'),
  created_by_agent_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,repository_digest), UNIQUE(workspace_id,project_id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES atlas.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id)
);
ALTER TABLE atlas_private.project_repositories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON atlas_private.project_repositories FROM PUBLIC,atlas_api,atlas_worker;

CREATE FUNCTION atlas_private.checkpoint_project_allowed(target uuid,operation text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT operation IN ('read','capture_checkpoint') AND atlas_private.active_agent(operation) AND EXISTS (
   SELECT 1 FROM atlas.projects p JOIN atlas_private.agent_project_grants g ON g.workspace_id=p.workspace_id AND g.project_id=p.id
   WHERE p.workspace_id=atlas_private.context_uuid('app.workspace_id') AND p.id=target AND p.archived_at IS NULL
     AND g.agent_id=atlas_private.context_uuid('app.agent_id') AND g.read
     AND (operation='read' OR (g.propose AND EXISTS(SELECT 1 FROM atlas_private.project_repositories r WHERE r.workspace_id=p.workspace_id AND r.project_id=p.id)))
 )
$$;
REVOKE ALL ON FUNCTION atlas_private.checkpoint_project_allowed(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atlas_private.checkpoint_project_allowed(uuid,text) TO atlas_api;

-- Narrow capability: creates a new project/grant atomically; existing grants are never restored or widened.
CREATE FUNCTION atlas_private.ensure_repository(digest text,display_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=atlas_private.context_uuid('app.workspace_id'); a uuid:=atlas_private.context_uuid('app.agent_id'); p uuid;
BEGIN
 IF NOT coalesce(atlas_private.active_agent('manage_projects') AND atlas_private.active_agent('read'),false)
 THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF digest !~ '^[0-9a-f]{64}$' OR display_name IS NULL OR length(btrim(display_name)) NOT BETWEEN 1 AND 120
 THEN RAISE EXCEPTION 'Invalid repository' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM atlas.workspaces WHERE id=w FOR UPDATE;
 SELECT project_id INTO p FROM atlas_private.project_repositories WHERE workspace_id=w AND repository_digest=digest;
 IF FOUND THEN
   IF NOT coalesce(atlas_private.checkpoint_project_allowed(p,'read'),false)
   THEN RAISE EXCEPTION 'Project unavailable or grant revoked' USING ERRCODE='42501'; END IF;
   RETURN p;
 END IF;
 p:=gen_random_uuid();
 INSERT INTO atlas.projects(workspace_id,id,slug,name,description,created_by_agent_id)
 VALUES(w,p,'repo-'||replace(p::text,'-',''),btrim(display_name),'Automatically registered by a connected agent.',a);
 INSERT INTO atlas_private.project_repositories(workspace_id,project_id,repository_digest,created_by_agent_id) VALUES(w,p,digest,a);
 INSERT INTO atlas_private.agent_project_grants(workspace_id,agent_id,project_id,read,propose,created_by_agent_id) VALUES(w,a,p,true,true,a);
 INSERT INTO atlas.activity_events(workspace_id,actor_kind,agent_id,action,correlation_id,created_by_agent_id)
 VALUES(w,'agent',a,'project.registered',gen_random_uuid(),a);
 RETURN p;
END
$$;
REVOKE ALL ON FUNCTION atlas_private.ensure_repository(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atlas_private.ensure_repository(text,text) TO atlas_api;
CREATE POLICY checkpoint_project_read ON atlas.projects FOR SELECT TO atlas_api
USING(atlas_private.checkpoint_project_allowed(id,'read'));

CREATE TABLE atlas.project_checkpoints (
 workspace_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),project_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),created_by_agent_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
 kind text NOT NULL CHECK(kind IN ('decision','lesson','progress','handoff')),
 markdown text NOT NULL CHECK(octet_length(markdown) BETWEEN 1 AND 32768),
 provenance jsonb NOT NULL CHECK(jsonb_typeof(provenance)='object'),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
 content_digest text NOT NULL CHECK(content_digest ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'agent_recorded' CHECK(status='agent_recorded'),
 PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,project_id,created_by_agent_id,request_key),
 UNIQUE(workspace_id,project_id,created_by_agent_id,content_digest),
 FOREIGN KEY(workspace_id,project_id) REFERENCES atlas.projects(workspace_id,id),
 FOREIGN KEY(workspace_id,created_by_agent_id) REFERENCES atlas.agents(workspace_id,id)
);
CREATE INDEX project_checkpoints_recent ON atlas.project_checkpoints(workspace_id,project_id,created_at DESC,id);
ALTER TABLE atlas.project_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON atlas.project_checkpoints FROM PUBLIC,atlas_api,atlas_worker;
GRANT SELECT,INSERT ON atlas.project_checkpoints TO atlas_api;
CREATE POLICY workspace_boundary ON atlas.project_checkpoints AS RESTRICTIVE FOR ALL TO atlas_api
USING(workspace_id=atlas_private.context_uuid('app.workspace_id')) WITH CHECK(workspace_id=atlas_private.context_uuid('app.workspace_id'));
CREATE POLICY checkpoint_read ON atlas.project_checkpoints FOR SELECT TO atlas_api
USING(atlas_private.current_member(workspace_id) OR atlas_private.checkpoint_project_allowed(project_id,'read'));
CREATE POLICY checkpoint_insert ON atlas.project_checkpoints FOR INSERT TO atlas_api
WITH CHECK(created_by_agent_id=atlas_private.context_uuid('app.agent_id') AND atlas_private.checkpoint_project_allowed(project_id,'capture_checkpoint'));
CREATE TRIGGER immutable_checkpoint BEFORE UPDATE OR DELETE ON atlas.project_checkpoints FOR EACH ROW EXECUTE FUNCTION atlas.reject_history_mutation();

CREATE TABLE atlas_private.checkpoint_requests (
 workspace_id uuid NOT NULL,project_id uuid NOT NULL,agent_id uuid NOT NULL,request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
 content_digest text NOT NULL CHECK(content_digest ~ '^[0-9a-f]{64}$'),checkpoint_id uuid NOT NULL,
 PRIMARY KEY(workspace_id,project_id,agent_id,request_key),
 FOREIGN KEY(workspace_id,project_id) REFERENCES atlas.projects(workspace_id,id),
 FOREIGN KEY(workspace_id,agent_id) REFERENCES atlas.agents(workspace_id,id),
 FOREIGN KEY(workspace_id,checkpoint_id) REFERENCES atlas.project_checkpoints(workspace_id,id)
);
ALTER TABLE atlas_private.checkpoint_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON atlas_private.checkpoint_requests FROM PUBLIC,atlas_api,atlas_worker;
CREATE FUNCTION atlas_private.checkpoint_request(p uuid,k text,digest text,checkpoint uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=atlas_private.context_uuid('app.workspace_id'); a uuid:=atlas_private.context_uuid('app.agent_id'); r record;
BEGIN
 IF NOT coalesce(atlas_private.checkpoint_project_allowed(p,'capture_checkpoint'),false) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF k IS NULL OR k !~ '^[A-Za-z0-9_-]{8,128}$' OR digest IS NULL OR digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(w::text||':'||p::text||':'||a::text,4317));
 SELECT * INTO r FROM atlas_private.checkpoint_requests WHERE workspace_id=w AND project_id=p AND agent_id=a AND request_key=k;
 IF FOUND THEN
   IF r.content_digest<>digest THEN RAISE EXCEPTION 'Request conflict' USING ERRCODE='23505'; END IF;
   RETURN r.checkpoint_id;
 END IF;
 IF checkpoint IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM atlas.project_checkpoints n WHERE n.workspace_id=w AND n.project_id=p AND n.created_by_agent_id=a AND n.id=checkpoint AND n.content_digest=digest) THEN RAISE EXCEPTION 'Invalid checkpoint reference' USING ERRCODE='42501'; END IF;
 INSERT INTO atlas_private.checkpoint_requests VALUES(w,p,a,k,digest,checkpoint);
 RETURN checkpoint;
END
$$;
REVOKE ALL ON FUNCTION atlas_private.checkpoint_request(uuid,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atlas_private.checkpoint_request(uuid,text,text,uuid) TO atlas_api;
RESET ROLE;
