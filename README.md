# DentaGrow Suite v1.0.0

Production-oriented monorepo containing:

- `apps/super-admin` — DentaGrow Super Admin control center.
- `apps/clinic-admin` — tenant/clinic admin control center.
- `api` — secure server-side control API for user provisioning, roles, tenant resolution and update metadata.
- `packages/shared` — shared role/permission/version contracts.
- `supabase/migrations` — tenant/RLS-aligned SQL additions.

## Important architecture

The browser never receives Supabase service-role credentials. Creating Auth users is server-side only through `api`.

### Roles

`SUPER_ADMIN > ORGANIZATION_OWNER > ADMIN > MANAGER > STAFF > VIEWER`

- Super Admin can create organizations and users inside any organization.
- Clinic Organization Owner/Admin can create child users inside their own organization, subject to role hierarchy and permissions.
- Managers/Staff/Viewers cannot create users by default.
- Every privileged action is intended to be audit logged.

### Versioning

The suite uses semantic versions. `update_manifest.json` and the Super Admin Updates screen provide the foundation for staged upgrades. Do not auto-install arbitrary builds; production rollout should verify signed artifacts/checksums and an approved release channel.

## Setup

1. Copy `.env.example` to the relevant app/API `.env` file.
2. Add your Supabase project URL and public anon key to the frontend apps.
3. Add the Supabase service-role key ONLY to the API environment.
4. Run the SQL migrations in the production Supabase project after reviewing them.
5. Run `npm install` from the repository root.
6. Run `npm run dev:clinic`, `npm run dev:super`, or `npm run dev:api`.

No real credentials are included in this ZIP.

## Production checklist

- Put API behind HTTPS.
- Store service-role key only in server secret storage.
- Configure CORS to exact production origins.
- Enable rate limiting/WAF.
- Verify JWTs server-side.
- Keep RLS enabled in Supabase.
- Configure audit-log retention and backups.
- Sign desktop/mobile artifacts before distribution.
- Verify update artifacts by checksum/signature before rollout.
- Run cross-tenant/RLS tests before production.
