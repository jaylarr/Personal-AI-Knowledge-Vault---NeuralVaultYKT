-- A cancelled/superseded submitted task keeps its original immutable submission link.
SET LOCAL ROLE atlas_owner;
ALTER TABLE atlas.organization_tasks DROP CONSTRAINT organization_tasks_check3;
ALTER TABLE atlas.organization_tasks ADD CONSTRAINT task_submission_state CHECK (
  (state NOT IN ('submitted','completed') OR submission_id IS NOT NULL)
  AND (state NOT IN ('awaiting_agent','claimed') OR submission_id IS NULL)
);
RESET ROLE;
