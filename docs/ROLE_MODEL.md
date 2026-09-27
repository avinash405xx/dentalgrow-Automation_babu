# DentaGrow Role Model

## Super Admin

Global control. Can create organizations, organization owners, admins and lower-level users. Can manage licenses, subscriptions, payments, automations, AI configuration, integrations, devices, releases, audit logs and system controls.

## Clinic Admin / Organization Owner

Tenant-scoped control. Can invite and manage child users inside the same clinic, subject to role hierarchy and permissions. Cannot create a Super Admin or another organization owner.

## Child roles

- MANAGER — operational team management.
- STAFF — daily CRM/appointments/conversations.
- VIEWER — read-only access.

All access must be enforced in API authorization and Supabase RLS. UI hiding is not a security boundary.
