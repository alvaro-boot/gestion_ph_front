'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientProcess, FollowUp, FollowUpType } from '@/lib/types';
import { api } from '@/lib/api';
import { followUpTypeLabels, formatDate, formatDateTime, toDatetimeLocalValue } from '@/lib/format';
import { onboardingProcesses } from '@/lib/process-utils';

const TYPES: FollowUpType[] = [
  'call',
  'meeting',
  'email',
  'visit',
  'note',
  'other',
];

export function SeguimientosPanel({
  clientId,
  clientName,
  initialItems,
  processes,
  defaultProcessId,
  currentStageName,
}: {
  clientId: string;
  clientName: string;
  initialItems: FollowUp[];
  processes: ClientProcess[];
  defaultProcessId?: string;
  /** Etapa en curso (solo durante onboarding activo). */
  currentStageName?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const linkableProcesses = onboardingProcesses(processes).filter(
    (p) => p.status === 'active' || p.status === 'completed',
  );
  const defaultProcess =
    linkableProcesses.find((p) => p.id === defaultProcessId) ??
    linkableProcesses.find((p) => p.status === 'active') ??
    linkableProcesses[0];
  const canRegister = linkableProcesses.length > 0;
  const isDuringOnboarding = linkableProcesses.some((p) => p.status === 'active');

  const [form, setForm] = useState({
    title: '',
    description: '',
    followUpType: 'note' as FollowUpType,
    occurredAt: toDatetimeLocalValue(new Date()),
    nextActionAt: '',
    clientProcessId: defaultProcess?.id ?? '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canRegister) return;
    setLoading(true);
    try {
      const created = await api.seguimientos.create({
        clientId,
        title: form.title,
        description: form.description || undefined,
        followUpType: form.followUpType,
        occurredAt: new Date(form.occurredAt).toISOString(),
        nextActionAt: form.nextActionAt
          ? new Date(form.nextActionAt).toISOString()
          : undefined,
        clientProcessId: form.clientProcessId || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setForm({
        title: '',
        description: '',
        followUpType: 'note',
        occurredAt: toDatetimeLocalValue(new Date()),
        nextActionAt: '',
        clientProcessId: defaultProcess?.id ?? '',
      });
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este seguimiento?')) return;
    setLoading(true);
    try {
      await api.seguimientos.remove(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="seguimientos" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Seguimientos</h2>
        <p className="text-sm text-slate-600 mt-1">
          Llamadas, visitas y notas con <strong>{clientName}</strong>
          {currentStageName && isDuringOnboarding ? (
            <>
              {' '}
              durante la etapa <strong>{currentStageName}</strong> del onboarding.
            </>
          ) : (
            <> (durante o después del onboarding).</>
          )}
        </p>
      </div>

      <div className="p-5 space-y-4">
        {!canRegister ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Inicia el proceso de onboarding del cliente para poder registrar seguimientos.
          </p>
        ) : (
          <>
            {!showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Nuevo seguimiento
              </button>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Título
                    </label>
                    <input
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Ej: Llamada de control mensual"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  {linkableProcesses.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Proceso / onboarding
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={form.clientProcessId}
                        onChange={(e) =>
                          setForm({ ...form, clientProcessId: e.target.value })
                        }
                      >
                        {linkableProcesses.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.processTemplate?.name ?? 'Onboarding'}
                            {p.status === 'active' ? ' (en curso)' : ' (completado)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tipo
                    </label>
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={form.followUpType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          followUpType: e.target.value as FollowUpType,
                        })
                      }
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {followUpTypeLabels[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha del seguimiento
                    </label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={form.occurredAt}
                      onChange={(e) =>
                        setForm({ ...form, occurredAt: e.target.value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Detalle (opcional)
                    </label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Próximo contacto (opcional)
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={form.nextActionAt}
                      onChange={(e) =>
                        setForm({ ...form, nextActionAt: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Guardar seguimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay seguimientos registrados.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {followUpTypeLabels[item.followUpType]} ·{' '}
                          {formatDateTime(item.occurredAt)}
                        </p>
                        {item.description && (
                          <p className="text-sm text-slate-600 mt-2">{item.description}</p>
                        )}
                        {item.nextActionAt &&
                          new Date(item.nextActionAt).getTime() >
                            new Date(item.occurredAt).getTime() && (
                          <p className="text-xs text-indigo-600 mt-1">
                            Próximo contacto: {formatDate(item.nextActionAt)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={loading}
                        className="text-xs text-red-600 hover:underline h-fit"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
