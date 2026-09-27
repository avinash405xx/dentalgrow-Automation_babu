# Upgrade Strategy

Every release increments the semantic version. Super Admin should see current/latest/minimum-supported versions and release notes.

Recommended production flow:

1. Build artifact.
2. Generate SHA-256 checksum.
3. Sign artifact.
4. Publish to private release storage/CDN.
5. Update release manifest.
6. Roll out to beta channel.
7. Validate login, tenant isolation, child-user provisioning, CRM, automations and critical workflows.
8. Promote to stable.
9. Keep previous artifact available for rollback.

Do not let clients execute an arbitrary update URL supplied by an untrusted user.
