-- Editable, versioned email copy. Built-in source templates remain the safe
-- fallback until an operator explicitly publishes a database revision.
create table if not exists public.email_templates (
  template_key text primary key,
  name text not null,
  description text,
  category text not null,
  built_in boolean not null default true,
  enabled boolean not null default true,
  current_published_version uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_key text not null references public.email_templates(template_key) on delete cascade,
  state text not null check (state in ('draft', 'published', 'archived')),
  subject_template text not null,
  preview_text text,
  body_template text not null,
  sample_data jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists email_template_one_draft
  on public.email_template_versions(template_key) where state = 'draft';
create index if not exists email_template_versions_lookup
  on public.email_template_versions(template_key, state, created_at desc);

alter table public.email_templates
  drop constraint if exists email_templates_current_published_version_fkey;
alter table public.email_templates
  add constraint email_templates_current_published_version_fkey
  foreign key (current_published_version) references public.email_template_versions(id) on delete set null;

alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
revoke all on public.email_templates from anon, authenticated;
revoke all on public.email_template_versions from anon, authenticated;

create or replace function public.publish_email_template(p_template_key text, p_actor text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft uuid;
begin
  select id into v_draft
  from public.email_template_versions
  where template_key = p_template_key and state = 'draft'
  order by updated_at desc
  limit 1
  for update;

  if v_draft is null then
    raise exception 'No draft is available to publish';
  end if;

  update public.email_template_versions
  set state = 'archived', updated_at = now()
  where template_key = p_template_key and state = 'published';

  update public.email_template_versions
  set state = 'published', published_at = now(), updated_at = now(), created_by = coalesce(p_actor, created_by)
  where id = v_draft;

  update public.email_templates
  set current_published_version = v_draft, updated_at = now()
  where template_key = p_template_key;

  return v_draft;
end;
$$;

revoke all on function public.publish_email_template(text, text) from public, anon, authenticated;
grant execute on function public.publish_email_template(text, text) to service_role;

comment on table public.email_template_versions is 'Immutable draft/published history for operator-managed email copy.';
