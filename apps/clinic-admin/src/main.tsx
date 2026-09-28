import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  APP_VERSION,
  ROLE_LEVEL,
  DEFAULT_PERMISSIONS,
  Role,
  getApiBaseUrl,
  provisionUser,
  useApiStatus,
} from '../../../packages/shared/src';
import './styles.css';

const nav = [
  'Dashboard',
  'CRM / Leads',
  'Appointments',
  'Conversations',
  'AI Assistant',
  'Automations',
  'Reports',
  'Billing',
  'Team',
  'Settings',
];

type Theme = 'light' | 'dark' | 'system';

function App() {
  const [tab, setTab] = useState('Dashboard');
  const [role, setRole] = useState<Role>('STAFF');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const api = useApiStatus();

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dentagrow-theme');
    return saved === 'light' || saved === 'system' ? saved : 'dark';
  });

  const [accent, setAccent] = useState(
    () => localStorage.getItem('dentagrow-accent') || '#66e5e5'
  );

  const [clinicName, setClinicName] = useState(
    () =>
      localStorage.getItem('dentagrow-clinic-name') || 'Summit Dental'
  );

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      const resolved =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark'
          : theme;

      root.dataset.theme = resolved;
    };

    applyTheme();
    localStorage.setItem('dentagrow-theme', theme);

    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', applyTheme);

    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    localStorage.setItem('dentagrow-accent', accent);
  }, [accent]);

  useEffect(() => {
    localStorage.setItem('dentagrow-clinic-name', clinicName);
  }, [clinicName]);

  const create = async () => {
    if (ROLE_LEVEL[role] >= ROLE_LEVEL.ADMIN) {
      setMsg(
        'Clinic Admin cannot create an equal/higher privileged role. Choose Manager, Staff or Viewer.'
      );
      return;
    }

    if (!name || !email) {
      setMsg('Name and email are required.');
      return;
    }

    if (!orgId.trim()) {
      setMsg('Organization UUID is required — the API validates it as a UUID.');
      return;
    }

    setBusy(true);

    const result = await provisionUser({
      email,
      fullName: name,
      role,
      organizationId: orgId.trim(),
    });

    setBusy(false);

    setMsg(
      result.ok
        ? `API accepted the request (HTTP ${result.status}).`
        : `API refused provisioning (HTTP ${result.status}): ${result.error}`,
    );
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          DentaGrow
          <span>PRACTICE CONTROL CENTER</span>
        </div>

        {nav.map((item) => (
          <button
            key={item}
            className={tab === item ? 'active' : ''}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}

        <div className="clinic">
          {clinicName}
          <br />
          <small>PRO • ACTIVE</small>
          <br />
          <small>v{APP_VERSION}</small>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <small>CLINIC ADMIN</small>
            <h1>{tab}</h1>
          </div>

          <div className="pill">ORGANIZATION ADMIN</div>
        </header>

        {tab === 'Dashboard' && (
          <>
            <section className="grid">
              <Card t="New Leads" v="24" />
              <Card t="Appointments" v="18" />
              <Card t="Follow-ups" v="31" />
              <Card t="AI Conversations" v="46" />
            </section>

            <Panel title="Practice performance">
              <div className="rows">
                <Row a="Leads contacted" b="18" />
                <Row a="Appointments booked" b="12" />
                <Row a="Missed calls recovered" b="—" />
                <Row a="Patient reactivation" b="—" />
              </div>
            </Panel>

            <Panel title="API connection">
              <div className="rows">
                <Row a="Endpoint" b={getApiBaseUrl()} />
                <Row
                  a="Health"
                  b={api.loading ? 'checking…' : api.online ? 'ok' : 'unavailable'}
                />
                <Row a="Service" b={api.service || '—'} />
                <Row a="API version" b={api.apiVersion || '—'} />
                <Row a="Latest release" b={api.latestRelease || '—'} />
                <Row a="Last problem" b={api.problem || 'none'} />
              </div>

              <button className="primary" onClick={() => void api.refresh()}>
                Re-check API
              </button>
            </Panel>
          </>
        )}

        {tab === 'Team' && (
          <Panel title="Create child user">
            <p>
              Clinic Admin can create lower-level team members inside this
              clinic only. Cross-clinic access is blocked by tenant
              authorization and Supabase RLS.
            </p>

            <div className="form">
              <input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                placeholder="Organization UUID"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {['MANAGER', 'STAFF', 'VIEWER'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <button
                className="primary"
                disabled={busy}
                onClick={() => void create()}
              >
                {busy ? 'Contacting API…' : 'Create Child'}
              </button>
            </div>

            <p className="muted">
              Role level {ROLE_LEVEL[role]} •{' '}
              {DEFAULT_PERMISSIONS[role].length} default permissions
            </p>

            {msg && <div className="notice">{msg}</div>}
          </Panel>
        )}

        {tab === 'Settings' && (
          <Panel title="Appearance & Clinic Settings">
            <div className="settings-grid">
              <div className="setting-block">
                <h3>Theme</h3>
                <p className="muted">
                  Choose the appearance for this clinic.
                </p>

                <div className="theme-options">
                  <button
                    className={`theme-option ${
                      theme === 'light' ? 'selected' : ''
                    }`}
                    onClick={() => setTheme('light')}
                  >
                    <span className="theme-preview light-preview" />
                    <span>Light</span>
                  </button>

                  <button
                    className={`theme-option ${
                      theme === 'dark' ? 'selected' : ''
                    }`}
                    onClick={() => setTheme('dark')}
                  >
                    <span className="theme-preview dark-preview" />
                    <span>Dark</span>
                  </button>

                  <button
                    className={`theme-option ${
                      theme === 'system' ? 'selected' : ''
                    }`}
                    onClick={() => setTheme('system')}
                  >
                    <span className="theme-preview system-preview" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              <div className="setting-block">
                <h3>Clinic Branding</h3>
                <p className="muted">
                  Customize the clinic identity without changing the DentaGrow
                  design system.
                </p>

                <label className="setting-label">
                  Clinic Name
                  <input
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Clinic name"
                  />
                </label>

                <label className="setting-label">
                  Accent Color
                  <div className="color-control">
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                    />
                    <span>{accent.toUpperCase()}</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="appearance-note">
              Appearance and branding preferences are stored locally on this
              device.
            </div>
          </Panel>
        )}

        {!['Dashboard', 'Team', 'Settings'].includes(tab) && (
          <Panel title={tab}>
            <p>
              This module is ready for the tenant-aware data layer: leads,
              appointments, conversations, AI, automations, reports, billing
              and settings.
            </p>
          </Panel>
        )}
      </main>
    </div>
  );
}

const Card = ({ t, v }: { t: string; v: string }) => (
  <div className="card">
    <small>{t}</small>
    <strong>{v}</strong>
    <span>Current period</span>
  </div>
);

const Panel = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="panel">
    <h2>{title}</h2>
    {children}
  </section>
);

const Row = ({ a, b }: { a: string; b: string }) => (
  <div className="row">
    <span>{a}</span>
    <b>{b}</b>
  </div>
);

createRoot(document.getElementById('root')!).render(<App />);