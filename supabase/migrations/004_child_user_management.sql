-- DentaGrow Suite v1.0.0
-- Adds tenant-scoped team profile metadata. Auth user creation remains server-side.

create table if not exists public.team_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('ORGANIZATION_OWNER','ADMIN','MANAGER','STAFF','VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_profiles_org on public.team_profiles(organization_id);
create index if not exists idx_team_profiles_role on public.team_profiles(role);
alter table public.team_profiles enable row level security;

create policy team_profiles_select_member on public.team_profiles for select to authenticated
using ((select private.is_org_member(organization_id)) or user_id = (select auth.uid()));

create policy team_profiles_update_member on public.team_profiles for update to authenticated
using ((select private.is_org_member(organization_id)))
with check ((select private.is_org_member(organization_id)));

create policy team_profiles_insert_member on public.team_profiles for insert to authenticated
with check ((select private.is_org_member(organization_id)));

create trigger team_profiles_updated_at before update on public.team_profiles
for each row execute function public.set_updated_at();
