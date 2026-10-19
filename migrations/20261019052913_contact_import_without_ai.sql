-- Preserve historical provider provenance and allow explicit no-model preparation.
ALTER TABLE public.contact_import_batches
  DROP CONSTRAINT IF EXISTS contact_import_batches_ai_provider_check;
ALTER TABLE public.contact_import_batches
  ADD CONSTRAINT contact_import_batches_ai_provider_check
  CHECK (ai_provider IN ('openrouter', 'none'));
ALTER TABLE public.contact_import_batches
  DROP CONSTRAINT IF EXISTS contact_import_batches_no_ai_usage_check;
ALTER TABLE public.contact_import_batches
  ADD CONSTRAINT contact_import_batches_no_ai_usage_check
  CHECK (ai_provider <> 'none' OR (
    ai_model IS NULL AND ai_request_id IS NULL AND
    ai_usage = '{"cost":0,"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}'::jsonb
  ));
