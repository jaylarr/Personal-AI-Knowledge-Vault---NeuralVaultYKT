-- N01 setup-only schema. Does not initialize or bypass future vault permissions.
CREATE SCHEMA IF NOT EXISTS atlas_setup;
REVOKE ALL ON SCHEMA atlas_setup FROM PUBLIC;
CREATE TABLE IF NOT EXISTS atlas_setup.auth_checks (
  issuer text NOT NULL,
  subject text NOT NULL,
  check_id uuid NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer,subject)
);
ALTER TABLE atlas_setup.auth_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_setup.auth_checks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_check ON atlas_setup.auth_checks;
CREATE POLICY own_check ON atlas_setup.auth_checks TO atlas_api
  USING (issuer=current_setting('app.auth_issuer',true) AND subject=current_setting('app.auth_subject',true))
  WITH CHECK (issuer=current_setting('app.auth_issuer',true) AND subject=current_setting('app.auth_subject',true));
GRANT USAGE ON SCHEMA atlas_setup TO atlas_api;
GRANT SELECT,INSERT,UPDATE ON atlas_setup.auth_checks TO atlas_api;
REVOKE ALL ON atlas_setup.auth_checks FROM PUBLIC;
