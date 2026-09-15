BEGIN;

-- These two platform-global columns were created by interrupted browser QA runs.
-- Feature Board cards use the fixed status set, so the columns cannot own valid
-- work. Match both the generated key and label to avoid touching an operator
-- column that happens to use a similar name.
DELETE FROM public.kanban_columns
WHERE board_key = 'features'
  AND tenant_id IS NULL
  AND (
    (column_key = 'probe_column_1788458727686' AND label = 'PROBE Column 1788458727686')
    OR (column_key = 'probe3_column_1788459708293' AND label = 'PROBE3 Column 1788459708293')
  );

COMMIT;
