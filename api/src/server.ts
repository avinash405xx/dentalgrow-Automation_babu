import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const app = express();

app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  }),
);

app.use(express.json({ limit: '1mb' }));

const url = process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const internalSecret = process.env.DENTAGROW_INTERNAL_SECRET || '';

const admin =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const userSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.enum([
    'ORGANIZATION_OWNER',
    'ADMIN',
    'MANAGER',
    'STAFF',
    'VIEWER',
  ]),
  organizationId: z.string().uuid(),
});

const idempotencySchema = z.object({
  tenant_id: z.string().min(1).max(200),
  idempotency_key: z.string().min(1).max(500),
  notification_id: z.string().max(500).optional().nullable(),
});

function requireInternalSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!internalSecret) {
    return res.status(503).json({
      success: false,
      error: 'API internal secret is not configured',
    });
  }

  const suppliedSecret = req.header('X-DentaGrow-Internal-Key');

  if (!suppliedSecret || suppliedSecret !== internalSecret) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized internal request',
    });
  }

  next();
}

app.get('/health', (_, res) =>
  res.json({
    ok: true,
    version: '1.0.0',
    service: 'dentagrow-api',
  }),
);

app.post(
  '/v1/notifications/idempotency/check-and-reserve',
  requireInternalSecret,
  async (req, res) => {
    if (!admin) {
      return res.status(503).json({
        success: false,
        error: 'API is not configured',
      });
    }

    const parsed = idempotencySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid idempotency payload',
        details: parsed.error.flatten(),
      });
    }

    const {
      tenant_id,
      idempotency_key,
      notification_id,
    } = parsed.data;

    try {
      const { data: existing, error: existingError } = await admin
        .from('notification_idempotency')
        .select(
          'id, tenant_id, idempotency_key, notification_id, status, response_data, created_at, updated_at',
        )
        .eq('tenant_id', tenant_id)
        .eq('idempotency_key', idempotency_key)
        .maybeSingle();

      if (existingError) {
        console.error(
          'Notification idempotency lookup failed:',
          existingError,
        );

        return res.status(503).json({
          success: false,
          error: 'Notification idempotency storage unavailable',
        });
      }

      if (existing) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          already_processed: true,
          reserved: false,
          status: existing.status,
          notification_id: existing.notification_id,
          idempotency_key: existing.idempotency_key,
          response_data: existing.response_data ?? null,
        });
      }

      const { data: inserted, error: insertError } = await admin
        .from('notification_idempotency')
        .insert({
          tenant_id,
          idempotency_key,
          notification_id: notification_id ?? null,
          status: 'reserved',
        })
        .select(
          'id, tenant_id, idempotency_key, notification_id, status, response_data, created_at',
        )
        .maybeSingle();

      if (!insertError && inserted) {
        return res.status(200).json({
          success: true,
          duplicate: false,
          already_processed: false,
          reserved: true,
          status: inserted.status,
          notification_id: inserted.notification_id,
          idempotency_key: inserted.idempotency_key,
          response_data: null,
        });
      }

      const { data: concurrentExisting, error: concurrentLookupError } =
        await admin
          .from('notification_idempotency')
          .select(
            'id, tenant_id, idempotency_key, notification_id, status, response_data',
          )
          .eq('tenant_id', tenant_id)
          .eq('idempotency_key', idempotency_key)
          .maybeSingle();

      if (!concurrentLookupError && concurrentExisting) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          already_processed: true,
          reserved: false,
          status: concurrentExisting.status,
          notification_id: concurrentExisting.notification_id,
          idempotency_key: concurrentExisting.idempotency_key,
          response_data: concurrentExisting.response_data ?? null,
        });
      }

      console.error(
        'Notification idempotency insert failed:',
        insertError,
      );

      return res.status(503).json({
        success: false,
        error: 'Notification idempotency storage unavailable',
      });
    } catch (error) {
      console.error(
        'Notification idempotency unexpected error:',
        error,
      );

      return res.status(503).json({
        success: false,
        error: 'Notification idempotency storage unavailable',
      });
    }
  },
);

app.post('/v1/admin/users', async (req, res) => {
  if (!admin) {
    return res.status(503).json({
      error: 'API is not configured',
    });
  }

  const parsed = userSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid user payload',
      details: parsed.error.flatten(),
    });
  }

  // TODO: verify caller JWT + role + organization scope
  // before provisioning. This endpoint intentionally fails closed
  // until auth middleware is configured.

  return res.status(501).json({
    error:
      'Caller authorization middleware must be enabled before user provisioning is activated.',
  });
});

app.get('/v1/releases/current', (_, res) =>
  res.json({
    latestVersion: '1.0.0',
    minimumSupportedVersion: '1.0.0',
    releaseChannel: 'stable',
    releaseNotes: [
      'Initial dual-panel control suite foundation.',
    ],
  }),
);

app.listen(Number(process.env.PORT || 4400), () =>
  console.log('DentaGrow API listening'),
);