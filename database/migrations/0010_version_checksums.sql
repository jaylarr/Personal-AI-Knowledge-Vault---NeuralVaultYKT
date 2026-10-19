-- Validate normalized content at creation; raw-object verification remains S09.
SET LOCAL ROLE atlas_owner;
CREATE FUNCTION atlas.check_version_checksum() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.normalized_sha256<>encode(sha256(convert_to(NEW.normalized_text,'UTF8')),'hex') THEN
    RAISE EXCEPTION 'Normalized version checksum mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER normalized_version_checksum BEFORE INSERT ON atlas.source_versions
FOR EACH ROW EXECUTE FUNCTION atlas.check_version_checksum();
REVOKE EXECUTE ON FUNCTION atlas.check_version_checksum() FROM PUBLIC;
RESET ROLE;
