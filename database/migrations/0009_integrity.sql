-- S05 structural and evidence constraints; no permission-elevating functions.
SET LOCAL ROLE atlas_owner;

CREATE FUNCTION atlas.reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Immutable history cannot be changed' USING ERRCODE='23514';
END;
$$;

CREATE FUNCTION atlas.check_collection_paths() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cycle_found boolean;
BEGIN
  -- Serialize structural edits within a workspace to prevent concurrent opposite moves.
  PERFORM 1 FROM atlas.workspaces WHERE id=NEW.workspace_id FOR UPDATE;
  WITH RECURSIVE ancestors(id,parent_id) AS (
    SELECT id,parent_id FROM atlas.collections WHERE workspace_id=NEW.workspace_id AND id=NEW.parent_id
    UNION
    SELECT c.id,c.parent_id FROM atlas.collections c JOIN ancestors a ON a.parent_id=c.id WHERE c.workspace_id=NEW.workspace_id
  ) SELECT EXISTS(SELECT 1 FROM ancestors WHERE id=NEW.id) INTO cycle_found;
  IF cycle_found THEN RAISE EXCEPTION 'Collection parent cycle' USING ERRCODE='23514'; END IF;
  WITH RECURSIVE replacements(id,merged_into_id) AS (
    SELECT id,merged_into_id FROM atlas.collections WHERE workspace_id=NEW.workspace_id AND id=NEW.merged_into_id
    UNION
    SELECT c.id,c.merged_into_id FROM atlas.collections c JOIN replacements r ON r.merged_into_id=c.id WHERE c.workspace_id=NEW.workspace_id
  ) SELECT EXISTS(SELECT 1 FROM replacements WHERE id=NEW.id) INTO cycle_found;
  IF cycle_found THEN RAISE EXCEPTION 'Collection merge cycle' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER collection_paths BEFORE INSERT OR UPDATE OF parent_id,merged_into_id ON atlas.collections
FOR EACH ROW EXECUTE FUNCTION atlas.check_collection_paths();

CREATE FUNCTION atlas.check_personal_partition() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE owner_id uuid;
BEGIN
  IF NEW.scope='personal' THEN
    SELECT owner_user_id INTO owner_id FROM atlas.workspaces WHERE id=NEW.workspace_id;
    IF NEW.access_partition IS DISTINCT FROM 'personal:'||owner_id::text THEN
      RAISE EXCEPTION 'Personal partition must name the workspace owner' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER personal_partition BEFORE INSERT OR UPDATE ON atlas.knowledge_items
FOR EACH ROW EXECUTE FUNCTION atlas.check_personal_partition();

CREATE FUNCTION atlas.check_chunk_span() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE original text;
BEGIN
  SELECT normalized_text INTO original FROM atlas.source_versions WHERE workspace_id=NEW.workspace_id AND id=NEW.version_id AND source_id=NEW.source_id;
  -- Offsets are zero-based Unicode code points, end-exclusive, in normalized_text.
  IF original IS NULL OR NEW.end_offset>char_length(original)
    OR substring(original FROM NEW.start_offset+1 FOR NEW.end_offset-NEW.start_offset)<>NEW.text
    OR encode(sha256(convert_to(NEW.text,'UTF8')),'hex')<>NEW.sha256 THEN
    RAISE EXCEPTION 'Invalid chunk span or checksum' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER chunk_span BEFORE INSERT ON atlas.source_chunks FOR EACH ROW EXECUTE FUNCTION atlas.check_chunk_span();

CREATE FUNCTION atlas.check_evidence_span() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE original text; chunk_start integer; chunk_end integer;
BEGIN
  SELECT normalized_text INTO original FROM atlas.source_versions WHERE workspace_id=NEW.workspace_id AND id=NEW.source_version_id;
  IF original IS NULL OR NEW.end_offset>char_length(original)
    OR encode(sha256(convert_to(substring(original FROM NEW.start_offset+1 FOR NEW.end_offset-NEW.start_offset),'UTF8')),'hex')<>NEW.quote_sha256 THEN
    RAISE EXCEPTION 'Invalid evidence span or checksum' USING ERRCODE='23514';
  END IF;
  IF NEW.chunk_id IS NOT NULL THEN
    SELECT start_offset,end_offset INTO chunk_start,chunk_end FROM atlas.source_chunks WHERE workspace_id=NEW.workspace_id AND id=NEW.chunk_id AND version_id=NEW.source_version_id;
    IF chunk_start IS NULL OR NEW.start_offset<chunk_start OR NEW.end_offset>chunk_end THEN
      RAISE EXCEPTION 'Evidence is outside its chunk' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION atlas.check_task_batch() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE matching integer;
BEGIN
  SELECT count(DISTINCT id) INTO matching FROM atlas.source_chunks
    WHERE workspace_id=NEW.workspace_id AND version_id=NEW.source_version_id AND id=ANY(NEW.chunk_ids);
  IF matching<>cardinality(NEW.chunk_ids) THEN RAISE EXCEPTION 'Task chunks must be unique and belong to its version' USING ERRCODE='23514'; END IF;
  SELECT count(DISTINCT id) INTO matching FROM atlas.collections WHERE workspace_id=NEW.workspace_id AND id=ANY(NEW.allowed_collection_ids);
  IF matching<>cardinality(NEW.allowed_collection_ids) THEN RAISE EXCEPTION 'Task catalog must belong to its workspace' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.source_version_id,NEW.expected_source_revision,NEW.contract_version,NEW.batch_index,NEW.chunk_ids)
    IS DISTINCT FROM (OLD.source_version_id,OLD.expected_source_revision,OLD.contract_version,OLD.batch_index,OLD.chunk_ids) THEN
    RAISE EXCEPTION 'Task batch identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER task_batch BEFORE INSERT OR UPDATE ON atlas.organization_tasks FOR EACH ROW EXECUTE FUNCTION atlas.check_task_batch();

CREATE FUNCTION atlas.check_processing_catalog() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE matching integer;
BEGIN
  SELECT count(DISTINCT id) INTO matching FROM atlas.collections WHERE workspace_id=NEW.workspace_id AND id=ANY(NEW.allowed_collection_ids);
  IF matching<>cardinality(NEW.allowed_collection_ids) THEN RAISE EXCEPTION 'Processing catalog must belong to its workspace' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.source_version_id,NEW.agent_id,NEW.allowed_collection_ids,NEW.granted_by_user_id,NEW.created_at,NEW.expires_at)
    IS DISTINCT FROM (OLD.source_version_id,OLD.agent_id,OLD.allowed_collection_ids,OLD.granted_by_user_id,OLD.created_at,OLD.expires_at) THEN
    RAISE EXCEPTION 'Processing grants are immutable except revocation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER processing_catalog BEFORE INSERT OR UPDATE ON atlas_private.processing_grants FOR EACH ROW EXECUTE FUNCTION atlas.check_processing_catalog();

CREATE FUNCTION atlas.check_supersession() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cycle_found boolean; replacement_subject text; old_partition text; new_partition text;
BEGIN
  IF NEW.superseded_by_id IS NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM atlas.workspaces WHERE id=NEW.workspace_id FOR UPDATE;
  SELECT subject_key INTO replacement_subject FROM atlas.memories WHERE workspace_id=NEW.workspace_id AND id=NEW.superseded_by_id;
  SELECT access_partition INTO old_partition FROM atlas.knowledge_items WHERE workspace_id=NEW.workspace_id AND id=NEW.id;
  SELECT access_partition INTO new_partition FROM atlas.knowledge_items WHERE workspace_id=NEW.workspace_id AND id=NEW.superseded_by_id;
  IF replacement_subject IS DISTINCT FROM NEW.subject_key OR new_partition IS DISTINCT FROM old_partition THEN
    RAISE EXCEPTION 'Supersession requires matching subject and audience' USING ERRCODE='23514';
  END IF;
  WITH RECURSIVE successors(id,superseded_by_id) AS (
    SELECT id,superseded_by_id FROM atlas.memories WHERE workspace_id=NEW.workspace_id AND id=NEW.superseded_by_id
    UNION
    SELECT m.id,m.superseded_by_id FROM atlas.memories m JOIN successors s ON s.superseded_by_id=m.id WHERE m.workspace_id=NEW.workspace_id
  ) SELECT EXISTS(SELECT 1 FROM successors WHERE id=NEW.id) INTO cycle_found;
  IF cycle_found THEN RAISE EXCEPTION 'Memory supersession cycle' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER memory_supersession BEFORE INSERT OR UPDATE OF superseded_by_id ON atlas.memories FOR EACH ROW EXECUTE FUNCTION atlas.check_supersession();

CREATE FUNCTION atlas.check_search_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.source_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM atlas.source_versions WHERE workspace_id=NEW.workspace_id AND id=NEW.source_version_id AND source_id=NEW.item_id
  ) THEN RAISE EXCEPTION 'Search origin is not the source item' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER search_origin BEFORE INSERT OR UPDATE ON atlas.search_documents FOR EACH ROW EXECUTE FUNCTION atlas.check_search_origin();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['source_versions','source_chunks','memory_versions','memory_evidence','entity_evidence','relationship_evidence','activity_events','job_results','organization_submissions'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON atlas.%I FOR EACH ROW EXECUTE FUNCTION atlas.reject_history_mutation()',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['memory_evidence','entity_evidence','relationship_evidence'] LOOP
    EXECUTE format('CREATE TRIGGER evidence_span BEFORE INSERT ON atlas.%I FOR EACH ROW EXECUTE FUNCTION atlas.check_evidence_span()',table_name);
  END LOOP;
END;
$$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA atlas FROM PUBLIC;
RESET ROLE;
