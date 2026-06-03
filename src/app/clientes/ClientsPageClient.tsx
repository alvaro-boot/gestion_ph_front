'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Client, ClientProcess, ProcessTemplate } from '@/lib/types';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { FollowUpStatusBadge } from '@/components/FollowUpStatusBadge';
import { onboardingProcesses } from '@/lib/process-utils';
import { isAdminUser } from '@/lib/auth';

/** Proceso activo primero; si no hay, el onboarding completado más reciente. */
function getDisplayProcess(processes?: ClientProcess[]) {
  const list = onboardingProcesses(processes);
  if (!list.length) return null;
  const active = list.find((p) => p.status === 'active');
  if (active) return { process: active, kind: 'active' as const };
  const completed = [...list]
    .filter((p) => p.status === 'completed')
    .sort((a, b) => {
      const tb = new Date(b.completedAt ?? b.startedAt ?? 0).getTime();
      const ta = new Date(a.completedAt ?? a.startedAt ?? 0).getTime();
      return tb - ta;
    });
  if (completed[0]) return { process: completed[0], kind: 'completed' as const };
  return null;
}

function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function clientMatchesSearch(client: Client, query: string) {
  const q = normalizeSearch(query.trim());
  if (!q) return true;
  const haystack = [
    client.name,
    client.company,
    client.contactName,
    client.email,
    client.phone,
    client.notes,
  ]
    .filter(Boolean)
    .map((v) => normalizeSearch(String(v)));
  return haystack.some((field) => field.includes(q));
}

function clientHasTrackableProcess(client: Client): boolean {
  return onboardingProcesses(client.processes).some(
    (p) => p.status === 'active' || p.status === 'completed',
  );
}

type FollowUpFilter = 'all' | 'stale30' | 'never' | 'overdue';

export function ClientsPageClient({
  initialClients = [],
  templates: initialTemplates = [],
}: {
  initialClients?: Client[];
  templates?: ProcessTemplate[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [templates, setTemplates] = useState(initialTemplates);
  const [pageLoading, setPageLoading] = useState(initialClients.length === 0);
  const [search, setSearch] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('all');
  const [sortBy, setSortBy] = useState<'name' | 'followUp'>('followUp');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processStartDates, setProcessStartDates] = useState<Record<string, string>>({});
  const [processStageNumbers, setProcessStageNumbers] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    contactName: '',
  });
  const canDeleteClient = isAdminUser();

  useEffect(() => {
    if (initialClients.length > 0 && initialTemplates.length > 0) return;
    let cancelled = false;
    (async () => {
      setPageLoading(true);
      try {
        const [clientList, templateList] = await Promise.all([
          api.clients.list(),
          api.templates.list(),
        ]);
        if (cancelled) return;
        setClients(clientList);
        setTemplates(templateList);
      } catch {
        /* el usuario verá lista vacía */
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialClients.length, initialTemplates.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await api.clients.create(form);
      setClients((c) => [created, ...c]);
      setShowForm(false);
      setForm({ name: '', company: '', email: '', phone: '', contactName: '' });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear cliente');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(client: Client) {
    const label = client.company ? `${client.name} (${client.company})` : client.name;
    const ok = window.confirm(
      `¿Eliminar el cliente «${label}»?\n\nSe borrarán todos sus procesos y seguimientos. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setLoading(true);
    try {
      await api.clients.remove(client.id);
      setClients((list) => list.filter((c) => c.id !== client.id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  }

  async function startProcess(clientId: string, template: ProcessTemplate) {
    setLoading(true);
    try {
      const local = processStartDates[clientId];
      const startedAt = local ? new Date(local).toISOString() : undefined;
      const stageNum = processStageNumbers[clientId] ?? 1;
      const proc = await api.processes.start(clientId, template.id, {
        startedAt,
        currentStageNumber: stageNum,
      });
      router.push(`/procesos/${proc.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al iniciar proceso');
    } finally {
      setLoading(false);
    }
  }

  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];

  const filteredClients = useMemo(() => {
    let list = clients.filter((c) => clientMatchesSearch(c, search));

    if (followUpFilter !== 'all') {
      list = list.filter((c) => {
        if (!clientHasTrackableProcess(c)) return false;
        const s = c.followUpSummary;
        if (followUpFilter === 'never') {
          return s?.totalFollowUps === 0 || s?.daysSinceLastFollowUp === null;
        }
        if (followUpFilter === 'stale30') {
          const d = s?.daysSinceLastFollowUp;
          return d == null || d >= 30;
        }
        if (followUpFilter === 'overdue') {
          return s?.nextActionOverdue === true;
        }
        return true;
      });
    }

    if (sortBy === 'followUp') {
      list = [...list].sort((a, b) => {
        const trackA = clientHasTrackableProcess(a);
        const trackB = clientHasTrackableProcess(b);
        if (trackA && !trackB) return -1;
        if (!trackA && trackB) return 1;
        if (!trackA && !trackB) return a.name.localeCompare(b.name, 'es');

        const da = a.followUpSummary?.daysSinceLastFollowUp ?? 99999;
        const db = b.followUpSummary?.daysSinceLastFollowUp ?? 99999;
        if (a.followUpSummary?.nextActionOverdue && !b.followUpSummary?.nextActionOverdue) {
          return -1;
        }
        if (!a.followUpSummary?.nextActionOverdue && b.followUpSummary?.nextActionOverdue) {
          return 1;
        }
        if (db !== da) return db - da;
        return a.name.localeCompare(b.name, 'es');
      });
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }

    return list;
  }, [clients, search, followUpFilter, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-600">
            Registro, procesos y control de cuándo fue el último seguimiento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancelar' : 'Nuevo cliente'}
        </button>
      </div>

      {pageLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded" />
            ))}
          </div>
        </div>
      ) : (
        <>
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Nombre del cliente *"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder="Empresa"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
            <input
              placeholder="Contacto"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              placeholder="Teléfono"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Guardar cliente
          </button>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              ⌕
            </span>
            <input
              type="search"
              placeholder="Buscar por nombre, empresa, contacto, email o teléfono…"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-sm text-slate-500 shrink-0">
            {search.trim() ? (
              <>
                {filteredClients.length} de {clients.length} cliente
                {clients.length === 1 ? '' : 's'}
              </>
            ) : (
              <>
                {clients.length} cliente{clients.length === 1 ? '' : 's'}
              </>
            )}
          </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value as FollowUpFilter)}
            >
              <option value="all">Todos los seguimientos</option>
              <option value="stale30">Sin contacto 30+ días</option>
              <option value="never">Nunca registrado</option>
              <option value="overdue">Próximo contacto vencido</option>
            </select>
            <select
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'followUp')}
            >
              <option value="followUp">Orden: más tiempo sin seguimiento</option>
              <option value="name">Orden: nombre A–Z</option>
            </select>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Empresa</th>
              <th className="px-4 py-3 font-medium">Último seguimiento</th>
              <th className="px-4 py-3 font-medium">Proceso</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay clientes registrados.
                </td>
              </tr>
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Ningún cliente coincide con «{search.trim()}».
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const display = getDisplayProcess(client.processes);
                return (
                  <tr key={client.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/clientes/${client.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-600">
                      {client.company ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <FollowUpStatusBadge
                        summary={client.followUpSummary}
                        hasProcess={clientHasTrackableProcess(client)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {display ? (
                        <div className="space-y-0.5">
                          <StatusBadge
                            status={
                              display.kind === 'active' ? 'active' : 'completed'
                            }
                          />
                          {display.kind === 'completed' && (
                            <p className="text-xs text-slate-500">
                              {display.process.processTemplate?.name ?? 'Onboarding'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Sin proceso</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDeleteClient && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleDelete(client)}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50 mb-2 block ml-auto"
                        >
                          Eliminar
                        </button>
                      )}
                      {display?.kind === 'active' ? (
                        <Link
                          href={`/procesos/${display.process.id}`}
                          className="text-indigo-600 hover:underline"
                        >
                          Ver seguimiento
                        </Link>
                      ) : display?.kind === 'completed' ? (
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <Link
                            href={`/procesos/${display.process.id}`}
                            className="text-indigo-600 hover:underline"
                          >
                            Ver proceso
                          </Link>
                          <Link
                            href={`/clientes/${client.id}`}
                            className="text-slate-600 hover:underline text-xs"
                          >
                            Seguimientos
                          </Link>
                        </div>
                      ) : defaultTemplate ? (
                        <div className="flex flex-col items-end gap-1.5 max-w-[220px]">
                          <label className="text-xs text-slate-500 w-full text-right">
                            Etapa actual del cliente
                          </label>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={processStageNumbers[client.id] ?? 1}
                            onChange={(e) =>
                              setProcessStageNumbers((d) => ({
                                ...d,
                                [client.id]: Number(e.target.value),
                              }))
                            }
                          >
                            {[...(defaultTemplate.stages ?? [])]
                              .sort((a, b) => a.orderIndex - b.orderIndex)
                              .map((s, i) => (
                                <option key={s.id} value={i + 1}>
                                  {i + 1}. {s.name}
                                </option>
                              ))}
                          </select>
                          <input
                            type="datetime-local"
                            title="Fecha de inicio (opcional)"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={processStartDates[client.id] ?? ''}
                            onChange={(e) =>
                              setProcessStartDates((d) => ({
                                ...d,
                                [client.id]: e.target.value,
                              }))
                            }
                          />
                          <p className="text-[10px] text-slate-400 text-right">
                            Sin fecha = etapas anteriores hechas sin registrar día
                          </p>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => startProcess(client.id, defaultTemplate)}
                            className="text-indigo-600 hover:underline disabled:opacity-50 text-sm"
                          >
                            Iniciar proceso
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
