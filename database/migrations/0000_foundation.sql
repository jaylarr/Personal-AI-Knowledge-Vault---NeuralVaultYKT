-- Local harness creates these roles before applying this migration.
-- Dedicated Neon setup will create them separately under explicit authorization.
CREATE SCHEMA atlas AUTHORIZATION atlas_owner;
CREATE SCHEMA atlas_private AUTHORIZATION atlas_owner;
REVOKE ALL ON SCHEMA atlas_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA atlas TO atlas_api, atlas_worker;
-- No domain tables or permissive placeholder policies. S05/S06 add the actual model and RLS.
