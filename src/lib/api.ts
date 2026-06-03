import { getServerToken, getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const getCache = new Map<string, { expires: number; data: unknown }>();
const GET_CACHE_MS = 30_000;

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    return;
  }
  for (const key of [...getCache.keys()]) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const token =
    typeof window !== 'undefined' ? getToken() : await getServerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeaders();
  const method = (init?.method ?? 'GET').toUpperCase();
  const isServer = typeof window === 'undefined';

  if (!isServer && method === 'GET') {
    const hit = getCache.get(path);
    if (hit && hit.expires > Date.now()) {
      return hit.data as T;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...auth,
        ...init?.headers,
      },
      // En cliente permitimos caché para GET (mejor percepción de velocidad).
      // En servidor mantenemos no-store para evitar respuestas stale entre requests.
      cache: isServer
        ? 'no-store'
        : method === 'GET'
          ? 'default'
          : 'no-store',
    });
  } catch {
    throw new Error(
      `No se pudo conectar con el servidor (${API_URL}). Verifica que el backend esté en marcha: cd backend && npm run start:dev`,
    );
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      const { clearAuth } = await import('./auth');
      clearAuth();
      window.location.href = '/login';
    }
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? (Array.isArray(body.message) ? body.message.join(', ') : message);
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  const data = (await res.json()) as T;
  if (!isServer && method === 'GET') {
    getCache.set(path, { data, expires: Date.now() + GET_CACHE_MS });
  }
  return data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: import('./auth').AuthUser }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      ),
    me: () => request<import('./auth').AuthUser>('/auth/me'),
  },
  dashboard: () => request<import('./types').Dashboard>('/client-processes/dashboard'),
  home: {
    bootstrap: (year: number, month: number) =>
      request<import('./types').HomeBootstrap>(
        `/client-processes/home?year=${year}&month=${month}`,
      ),
  },
  clients: {
    list: () => request<import('./types').Client[]>('/clients'),
    get: (id: string) => request<import('./types').Client>(`/clients/${id}`),
    create: (data: Record<string, string>) =>
      request<import('./types').Client>('/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, string>) =>
      request<import('./types').Client>(`/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ deleted: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
    conjuntoReport: (id: string) =>
      request<import('./types').ConjuntoReport>(`/clients/${id}/conjunto-report`),
  },
  templates: {
    list: () => request<import('./types').ProcessTemplate[]>('/process-templates'),
    get: (id: string) =>
      request<import('./types').ProcessTemplate>(`/process-templates/${id}`),
    create: (data: unknown) =>
      request<import('./types').ProcessTemplate>('/process-templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  processes: {
    get: (id: string) =>
      request<import('./types').ClientProcess>(`/client-processes/${id}`),
    start: (
      clientId: string,
      processTemplateId: string,
      options?: { startedAt?: string; currentStageNumber?: number },
    ) =>
      request<import('./types').ClientProcess>('/client-processes/start', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          processTemplateId,
          ...(options?.startedAt ? { startedAt: options.startedAt } : {}),
          ...(options?.currentStageNumber
            ? { currentStageNumber: options.currentStageNumber }
            : {}),
        }),
      }),
    setCurrentStage: (processId: string, stageNumber: number) =>
      request<import('./types').ClientProcess>(
        `/client-processes/${processId}/set-current-stage`,
        {
          method: 'POST',
          body: JSON.stringify({ stageNumber }),
        },
      ),
    advanceStage: (
      progressId: string,
      options?: { completedAt?: string; nextStartedAt?: string },
    ) =>
      request<import('./types').ClientProcess>(
        `/client-processes/stages/${progressId}/advance`,
        {
          method: 'POST',
          body: JSON.stringify(options ?? {}),
        },
      ),
    updateStage: (
      progressId: string,
      data: {
        notes?: string;
        startedAt?: string;
        dueDate?: string;
        completedAt?: string;
      },
    ) =>
      request<import('./types').ClientProcess>(
        `/client-processes/stages/${progressId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
  },
  calendar: {
    bootstrap: (year: number, month: number) =>
      request<import('./types').CalendarBootstrap>(
        `/calendar/bootstrap?year=${year}&month=${month}`,
      ),
    month: (year: number, month: number) =>
      request<import('./types').CalendarMonthItem[]>(
        `/calendar?year=${year}&month=${month}`,
      ),
    pickerOptions: () =>
      request<import('./types').CalendarPickerOption[]>('/calendar/picker-options'),
    createDelivery: (data: Record<string, unknown>) =>
      request('/calendar/deliveries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateDelivery: (id: string, data: Record<string, unknown>) =>
      request(`/calendar/deliveries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteDelivery: (id: string) =>
      request(`/calendar/deliveries/${id}`, { method: 'DELETE' }),
    createMeeting: (data: Record<string, unknown>) =>
      request('/calendar/meetings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    cancelMeeting: (id: string) =>
      request(`/calendar/meetings/${id}/cancel`, { method: 'POST' }),
    updateMeeting: (id: string, data: Record<string, unknown>) =>
      request(`/calendar/meetings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  meetings: {
    create: (data: Record<string, unknown>) =>
      request('/meetings', { method: 'POST', body: JSON.stringify(data) }),
  },
  tasks: {
    create: (data: Record<string, unknown>) =>
      request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  },
  seguimientos: {
    list: (clientId: string) =>
      request<import('./types').FollowUp[]>(`/clients/${clientId}/seguimientos`),
    create: (data: Record<string, unknown>) =>
      request<import('./types').FollowUp>('/seguimientos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<import('./types').FollowUp>(`/seguimientos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request(`/seguimientos/${id}`, { method: 'DELETE' }),
  },
  users: {
    list: () => request<import('./types').User[]>('/users'),
    create: (data: Record<string, unknown>) =>
      request<import('./types').User>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    setActive: (id: string, isActive: boolean) =>
      request<import('./types').User>(`/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
  },
};

/** Login sin token (ruta pública) */
export async function loginRequest(email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. Inicia el backend en la carpeta backend.',
    );
  }
  if (!res.ok) {
    let message = 'Credenciales incorrectas';
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<{
    access_token: string;
    user: import('./auth').AuthUser;
  }>;
}
