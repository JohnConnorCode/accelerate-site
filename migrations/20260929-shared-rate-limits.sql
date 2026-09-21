-- Platform abuse metadata, deliberately outside the exposed business schema.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.rate_limit_buckets (
  key text PRIMARY KEY CHECK (key ~ '^[a-f0-9]{64}$'),
  hits timestamptz[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL
);
ALTER TABLE private.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.rate_limit_buckets FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS rate_limit_buckets_expiry ON private.rate_limit_buckets(expires_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_ms integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog SET lock_timeout = '2s' AS $$
DECLARE
  observed_at timestamptz;
  active_hits timestamptz[];
  allowed boolean;
  retry_after integer;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$' OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000
     OR p_window_ms IS NULL OR p_window_ms NOT BETWEEN 1 AND 86400000 THEN
    RAISE EXCEPTION 'Invalid rate-limit policy' USING ERRCODE='22023';
  END IF;
  -- Bound maintenance and never wait on another request's active bucket.
  DELETE FROM private.rate_limit_buckets WHERE key IN (
    SELECT key FROM private.rate_limit_buckets WHERE expires_at < clock_timestamp()
    ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
  );
  INSERT INTO private.rate_limit_buckets(key, expires_at)
    VALUES(p_key, clock_timestamp() + p_window_ms * interval '1 millisecond') ON CONFLICT DO NOTHING;
  SELECT hits INTO active_hits FROM private.rate_limit_buckets WHERE key=p_key FOR UPDATE;
  observed_at := clock_timestamp();
  SELECT coalesce(array_agg(hit ORDER BY hit), '{}'::timestamptz[]) INTO active_hits
    FROM unnest(active_hits) AS hit WHERE hit > observed_at - p_window_ms * interval '1 millisecond';
  allowed := cardinality(active_hits) < p_limit;
  IF allowed THEN active_hits := array_append(active_hits, observed_at); END IF;
  retry_after := CASE WHEN allowed THEN 0 ELSE greatest(1, ceil(extract(epoch FROM
    (active_hits[1] + p_window_ms * interval '1 millisecond' - observed_at)))::integer) END;
  UPDATE private.rate_limit_buckets SET hits=active_hits,
    expires_at=active_hits[cardinality(active_hits)] + p_window_ms * interval '1 millisecond' WHERE key=p_key;
  RETURN jsonb_build_object('allowed',allowed,'remaining',greatest(0,p_limit-cardinality(active_hits)),
    'retry_after',retry_after);
END $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;
