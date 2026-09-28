import { useCallback, useEffect, useState } from 'react';
import {
  ApiHealth,
  ApiRelease,
  fetchCurrentRelease,
  fetchHealth,
  getApiBaseUrl,
} from './api';

export type ApiStatus = {
  loading: boolean;
  online: boolean;
  /** Version reported by the API, or null when unreachable. */
  apiVersion: string | null;
  service: string | null;
  latestRelease: string | null;
  releaseChannel: string | null;
  /** Human readable failure reason, shown verbatim in the UI. */
  problem: string | null;
  refresh: () => Promise<void>;
};

/**
 * Polls the API health and release endpoints so both admin panels display
 * live server state instead of hard-coded placeholders.
 */
export function useApiStatus(pollMs = 30000): ApiStatus {
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [apiVersion, setApiVersion] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [latestRelease, setLatestRelease] = useState<string | null>(null);
  const [releaseChannel, setReleaseChannel] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [health, release] = await Promise.all([
      fetchHealth(),
      fetchCurrentRelease(),
    ]);

    if (health.ok) {
      const payload: ApiHealth = health.data;
      setOnline(Boolean(payload.ok));
      setApiVersion(payload.version);
      setService(payload.service);
      setProblem(null);
    } else {
      setOnline(false);
      setApiVersion(null);
      setService(null);
      setProblem(health.error);
    }

    if (release.ok) {
      const payload: ApiRelease = release.data;
      setLatestRelease(payload.latestVersion);
      setReleaseChannel(payload.releaseChannel);
    } else {
      setLatestRelease(null);
      setReleaseChannel(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    if (pollMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  return {
    loading,
    online,
    apiVersion,
    service,
    latestRelease,
    releaseChannel,
    problem,
    refresh,
  };
}
