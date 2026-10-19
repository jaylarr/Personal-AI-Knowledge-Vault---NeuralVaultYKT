-- S05 local-first domain schema. All application access remains closed until S06.
SET LOCAL ROLE atlas_owner;

CREATE TABLE atlas.app_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issuer text NOT NULL CHECK(issuer<>''),subject text NOT NULL CHECK(subject<>''),disabled_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(issuer,subject));
CREATE TABLE atlas.workspaces(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_user_id uuid NOT NULL REFERENCES atlas.app_users(id),name text NOT NULL CHECK(btrim(name)<>''),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,UNIQUE(id,owner_user_id));

CREATE TABLE atlas_private.workspace_members (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  user_id uuid NOT NULL,role text NOT NULL DEFAULT 'owner' CHECK(role='owner'),UNIQUE(workspace_id,user_id),FOREIGN KEY(workspace_id,user_id) REFERENCES atlas.workspaces(id,owner_user_id)
);


CREATE TABLE atlas.agents (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  name text NOT NULL CHECK(btrim(name)<>''),description text NOT NULL DEFAULT '',type text NOT NULL CHECK(type IN ('codex','claude','other')),disabled_at timestamptz,revision integer NOT NULL DEFAULT 1 CHECK(revision>0)
);


CREATE TABLE atlas.workspace_settings (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),auto_classify boolean NOT NULL DEFAULT true,default_agent_processing boolean NOT NULL DEFAULT false,default_processor_agent_id uuid,log_raw_queries boolean NOT NULL DEFAULT false,UNIQUE(workspace_id),FOREIGN KEY(workspace_id,default_processor_agent_id) REFERENCES atlas.agents(workspace_id,id),CHECK(NOT default_agent_processing OR default_processor_agent_id IS NOT NULL)
);


CREATE TABLE atlas.projects (
  workspace_id uuid NOT NULL REFERENCES atlas.workspaces(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES atlas.app_users(id), created_by_agent_id uuid,
  PRIMARY KEY(workspace_id,id), CHECK(num_nonnulls(created_by_user_id,created_by_agent_id)<=1),
  slug text NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),name text NOT NULL CHECK(btrim(name)<>''),description text NOT NULL DEFAULT '',archived_at timestamptz,default_agent_processing boolean NOT NULL DEFAULT false,default_processor_agent_id uuid,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),FOREIGN KEY(workspace_id,default_processor_agent_id) REFERENCES atlas.agents(workspace_id,id),CHECK(NOT default_agent_processing OR default_processor_agent_id IS NOT NULL)
);
CREATE UNIQUE INDEX projects_active_slug ON atlas.projects(workspace_id,slug) WHERE archived_at IS NULL;

RESET ROLE;
