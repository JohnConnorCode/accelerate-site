-- Align the original seed display name with the configured business identity.
-- Preserve workspace names already customized by an operator.
UPDATE public.tenants
SET name = btrim(config #>> '{brand,name}'), updated_at = now()
WHERE slug = 'accelerate' AND name = 'Accelerate'
  AND char_length(btrim(config #>> '{brand,name}')) BETWEEN 1 AND 120
  AND btrim(config #>> '{brand,name}') <> name;
