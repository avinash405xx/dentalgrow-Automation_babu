-- DentaGrow Notification Idempotency
-- Prevents duplicate notification processing per tenant.

create table if not exists public.notification_idempotency (
  id uuid primary key default gen_random_uuid(),

  tenant_id text not null,
  idempotency_key text not null,
  notification_id text,

  status text not null default 'reserved'
    check (status in ('reserved', 'processing', 'completed', 'failed')),

  response_data jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_idempotency_unique
    unique (tenant_id, idempotency_key)
);

create index if not exists idx_notification_idempotency_tenant
  on public.notification_idempotency(tenant_id);

create index if not exists idx_notification_idempotency_status
  on public.notification_idempotency(status);

create index if not exists idx_notification_idempotency_created
  on public.notification_idempotency(created_at);

alter table public.notification_idempotency enable row level security;

create trigger notification_idempotency_updated_at
before update on public.notification_idempotency
for each row
execute function public.set_updated_at();