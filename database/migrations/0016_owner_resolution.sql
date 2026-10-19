SET LOCAL ROLE atlas_owner;
CREATE FUNCTION atlas_private.resolve_owner(issuer_arg text,subject_arg text)
RETURNS TABLE(user_id uuid,workspace_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT u.id,w.id FROM atlas.app_users u JOIN atlas.workspaces w ON w.owner_user_id=u.id
    JOIN atlas_private.workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id AND m.role='owner'
  WHERE session_user='atlas_api' AND u.issuer=issuer_arg AND u.subject=subject_arg
    AND u.disabled_at IS NULL AND w.deleted_at IS NULL
$$;
REVOKE EXECUTE ON FUNCTION atlas_private.resolve_owner(text,text) FROM PUBLIC,atlas_worker;
GRANT EXECUTE ON FUNCTION atlas_private.resolve_owner(text,text) TO atlas_api;
RESET ROLE;
