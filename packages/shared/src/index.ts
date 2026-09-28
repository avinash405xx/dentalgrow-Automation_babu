export const APP_VERSION = '1.0.0';
export const APP_NAME = 'DentaGrow Suite';

export const ROLES = ['SUPER_ADMIN','ORGANIZATION_OWNER','ADMIN','MANAGER','STAFF','VIEWER'] as const;
export type Role = typeof ROLES[number];

export const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ORGANIZATION_OWNER: 80,
  ADMIN: 70,
  MANAGER: 50,
  STAFF: 30,
  VIEWER: 10
};

export const PERMISSIONS = [
  'crm.read','crm.write','appointments.read','appointments.write','conversations.read','conversations.write',
  'ai.read','ai.write','reports.read','reports.export','billing.read','billing.write','settings.read','settings.write',
  'team.read','team.invite','team.manage_roles','licenses.read','licenses.manage','automations.read','automations.manage',
  'system.read','system.manage','updates.read','updates.manage','audit.read'
] as const;
export type Permission = typeof PERMISSIONS[number];

export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ORGANIZATION_OWNER: PERMISSIONS.filter(p => !p.startsWith('system.')),
  ADMIN: PERMISSIONS.filter(p => !['system.read','system.manage','updates.manage','audit.read','licenses.manage'].includes(p)),
  MANAGER: ['crm.read','crm.write','appointments.read','appointments.write','conversations.read','conversations.write','ai.read','reports.read','reports.export','automations.read','automations.manage','team.read','team.invite'],
  STAFF: ['crm.read','crm.write','appointments.read','appointments.write','conversations.read','conversations.write','ai.read'],
  VIEWER: ['crm.read','appointments.read','conversations.read','ai.read','reports.read']
};

export type ChildUserInput = {
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
};

export type UpdateManifest = {
  latestVersion: string;
  minimumSupportedVersion: string;
  releaseChannel: 'stable'|'beta';
  releaseNotes: string[];
  artifactUrl?: string;
  sha256?: string;
};

export * from './api';
export * from './useApiStatus';

