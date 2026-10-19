-- Source versions contain the entire document, editor state and object key.
-- A purpose-only grant authorizes task chunks, never this complete payload.
SET LOCAL ROLE atlas_owner;
DROP POLICY scoped_versions ON atlas.source_versions;
CREATE POLICY scoped_versions ON atlas.source_versions FOR SELECT TO atlas_api,atlas_worker
USING(atlas_private.can_read_item(source_id)
  OR (atlas_private.can_work_item(source_id) AND id=atlas_private.context_uuid('app.source_version_id')));
RESET ROLE;
