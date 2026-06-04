'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Client, ClientUpdateLog } from '@/lib/types';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { SeguimientosPanel } from '@/components/SeguimientosPanel';
import { FollowUpStatusBadge } from '@/components/FollowUpStatusBadge';
import { onboardingProcesses } from '@/lib/process-utils';
import { isAdminUser } from '@/lib/auth';

export function ClientDetailClient({
  initialClient,
}: {
  initialClient: Client;
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    contactName: client.contactName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    company: client.company ?? '',
    notes: client.notes ?? '',
  });

  const processes = onboardingProcesses(client.processes);
  const hasOnboardingProcess = processes.some(
    (p) => p.status === 'completed' || p.status === 'active',
  );
  const activeProcess = processes.find((p) => p.status === 'active');
  const canDeleteClient = isAdminUser();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await api.clients.update(client.id, {
        name: form.name,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        company: form.company,
        notes: form.notes,
      });
      setClient(updated);
      setForm({
        name: updated.name,
        contactName: updated.contactName ?? '',
        email: updated.email ?? '',
        phone: updated.phone ?? '',
        company: updated.company ?? '',
        notes: updated.notes ?? '',
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  function displayValue(value: string | null | undefined) {
    return value?.trim() ? value : '—';
  }

  async function handleDelete() {
    const label = client.company
      ? `${client.name} (${client.company})`
      : client.name;
    const ok = window.confirm(
      `¿Eliminar el cliente «${label}»?\n\nSe borrarán procesos, reuniones, seguimientos y todo el historial asociado. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setLoading(true);
    try {
      await api.clients.remove(client.id);
      router.push('/clientes');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/clientes" className="text-sm text-indigo-600 hover:underline">
            ← Clientes
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{client.name}</h1>
          {client.company && (
            <p className="text-slate-600">{client.company}</p>
          )}
        </div>
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Editar datos
            </button>
            {canDeleteClient && (
              <button
                type="button"
                disabled={loading}
                onClick={handleDelete}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Eliminar cliente
              </button>
            )}
          </div>
        )}
      </div>

      {hasOnboardingProcess && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Control de seguimiento</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Basado en los registros de llamadas, visitas y notas del panel inferior.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FollowUpStatusBadge
              summary={client.followUpSummary}
              hasProcess={hasOnboardingProcess}
            />
            <a
              href="#seguimientos"
              className="text-sm text-indigo-600 font-medium hover:underline whitespace-nowrap"
            >
              Registrar seguimiento →
            </a>
          </div>
        </div>
      )}

      {editing ? (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm space-y-4"
        >
          <h2 className="font-semibold text-slate-900">Editar cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre *
              </label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contacto
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Empresa
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notas
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Guardar cambios
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setEditing(false);
                setForm({
                  name: client.name,
                  contactName: client.contactName ?? '',
                  email: client.email ?? '',
                  phone: client.phone ?? '',
                  company: client.company ?? '',
                  notes: client.notes ?? '',
                });
              }}
              className="text-sm text-slate-600 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm">
          <div>
            <span className="text-slate-500">Contacto</span>
            <p className="font-medium">{displayValue(client.contactName)}</p>
          </div>
          <div>
            <span className="text-slate-500">Email</span>
            <p className="font-medium">{displayValue(client.email)}</p>
          </div>
          <div>
            <span className="text-slate-500">Teléfono</span>
            <p className="font-medium">{displayValue(client.phone)}</p>
          </div>
          <div>
            <span className="text-slate-500">Empresa</span>
            <p className="font-medium">{displayValue(client.company)}</p>
          </div>
          {client.notes && (
            <div className="sm:col-span-2">
              <span className="text-slate-500">Notas</span>
              <p className="font-medium">{client.notes}</p>
            </div>
          )}
          <div className="sm:col-span-2 text-xs text-slate-400">
            Última modificación del registro:{' '}
            {client.updatedAt
              ? formatDateTime(client.updatedAt)
              : '—'}
          </div>
        </div>
      )}

      <UpdateHistorySection logs={client.updateLogs ?? []} />

      <section>
        <h2 className="font-semibold text-slate-900 mb-3">Onboarding</h2>
        {!processes.length ? (
          <p className="text-sm text-slate-500">Sin procesos asignados.</p>
        ) : (
          <ul className="space-y-2">
            {processes.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium">{p.processTemplate?.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.startedAt
                      ? `Inicio ${formatDate(p.startedAt)}`
                      : 'Sin fecha de inicio'}
                    {p.completedAt && ` · Fin ${formatDate(p.completedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <Link
                    href={`/procesos/${p.id}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Ver
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasOnboardingProcess && (
        <SeguimientosPanel
          clientId={client.id}
          clientName={client.name}
          initialItems={client.followUps ?? []}
          initialNextContactAt={client.nextContactAt ?? null}
          initialNextContactTitle={client.nextContactTitle ?? null}
          processes={processes}
          defaultProcessId={activeProcess?.id}
          currentStageName={
            activeProcess?.stageProgresses?.find((s) => s.status === 'in_progress')
              ?.stageTemplate?.name
          }
        />
      )}
    </div>
  );
}

function UpdateHistorySection({ logs }: { logs: ClientUpdateLog[] }) {
  if (logs.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1">Historial de cambios</h2>
        <p className="text-sm text-slate-500">Aún no hay actualizaciones registradas.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Historial de cambios</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Quién modificó qué y cuándo.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {logs.map((log) => (
          <li key={log.id} className="px-5 py-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm mb-2">
              <span className="font-medium text-slate-800">
                {log.updatedByName ?? 'Usuario'}
              </span>
              <span className="text-slate-500">{formatDateTime(log.createdAt)}</span>
            </div>
            <ul className="space-y-1.5">
              {log.changes.map((c, i) => (
                <li
                  key={`${log.id}-${c.field}-${i}`}
                  className="text-sm rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="font-medium text-slate-700">{c.label}:</span>{' '}
                  <span className="text-red-600 line-through">
                    {c.oldValue ?? '(vacío)'}
                  </span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="text-emerald-700 font-medium">
                    {c.newValue ?? '(vacío)'}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
