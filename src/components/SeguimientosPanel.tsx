'use client';

import { useEffect, useState } from 'react';
import type { ClientProcess, FollowUp, FollowUpType } from '@/lib/types';
import { api, invalidateApiCache } from '@/lib/api';
import {
  followUpTypeLabels,
  formatDate,
  formatDateTime,
  toDatetimeLocalValue,
} from '@/lib/format';
import { onboardingProcesses } from '@/lib/process-utils';
import { isAdminUser } from '@/lib/auth';
import { FollowUpDescription } from '@/components/FollowUpDescription';

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
  initialNextContactAt,
  initialNextContactTitle,
  processes,
  defaultProcessId,
  currentStageName,
  onDataChange,
}: {
  clientId: string;
  clientName: string;
  initialItems: FollowUp[];
  initialNextContactAt?: string | null;
  initialNextContactTitle?: string | null;
  processes: ClientProcess[];
  defaultProcessId?: string;
  /** Etapa en curso (solo durante onboarding activo). */
  currentStageName?: string;
  onDataChange?: () => void | Promise<void>;
}) {
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const canDelete = isAdminUser();

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    invalidateApiCache('/seguimientos');
    api.seguimientos
      .list(clientId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const linkableProcesses = onboardingProcesses(processes).filter(
    (p) => p.status === 'active' || p.status === 'completed',
  );
  const defaultProcess =
    linkableProcesses.find((p) => p.id === defaultProcessId) ??
    linkableProcesses.find((p) => p.status === 'active') ??
    linkableProcesses[0];
  const canRegister = linkableProcesses.length > 0;
  const isDuringOnboarding = linkableProcesses.some((p) => p.status === 'active');

  const [nextContact, setNextContact] = useState({
    at: toDatetimeLocalValue(initialNextContactAt),
    title: initialNextContactTitle ?? '',
  });

  useEffect(() => {
    setNextContact({
      at: toDatetimeLocalValue(initialNextContactAt),
      title: initialNextContactTitle ?? '',
    });
  }, [initialNextContactAt, initialNextContactTitle]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    followUpType: 'note' as FollowUpType,
    occurredAt: toDatetimeLocalValue(new Date()),
    clientProcessId: defaultProcess?.id ?? '',
  });

  async function saveNextContact(clear = false) {
    setLoading(true);
    try {
      await api.clients.update(clientId, {
        nextContactAt: clear
          ? null
          : nextContact.at
            ? new Date(nextContact.at).toISOString()
            : null,
        nextContactTitle: clear ? null : nextContact.title.trim() || null,
      });
      if (clear) {
        setNextContact({ at: '', title: '' });
      }
      invalidateApiCache('/clients');
      invalidateApiCache('/calendar');
      invalidateApiCache('/seguimientos');
      await onDataChange?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  async function reloadSeguimientos() {
    invalidateApiCache('/seguimientos');
    invalidateApiCache('/clients');
    const refreshed = await api.seguimientos.list(clientId);
    setItems(refreshed);
    await onDataChange?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canRegister) return;
    setLoading(true);
    try {
      await api.seguimientos.create({
        clientId,
        title: form.title,
        description: form.description || undefined,
        followUpType: form.followUpType,
        occurredAt: new Date(form.occurredAt).toISOString(),
        clientProcessId: form.clientProcessId || undefined,
      });
      setForm({
        title: '',
        description: '',
        followUpType: 'note',
        occurredAt: toDatetimeLocalValue(new Date()),
        clientProcessId: defaultProcess?.id ?? '',
      });
      setShowForm(false);
      await reloadSeguimientos();
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
      await reloadSeguimientos();
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
          {items.length > 0 && (
            <span className="text-slate-500">
              {' '}
              · {items.length} registro{items.length === 1 ? '' : 's'}
            </span>
          )}
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
            <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-sky-950">
                  Próximo contacto del conjunto
                </h3>
                <p className="text-xs text-sky-800/80 mt-0.5">
                  Aplica a <strong>{clientName}</strong>, no a un seguimiento en particular.
                  Aparece en el calendario y en el reporte público.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha y hora
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    value={nextContact.at}
                    onChange={(e) =>
                      setNextContact({ ...nextContact, at: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Motivo (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Llamada de control"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    value={nextContact.title}
                    onChange={(e) =>
                      setNextContact({ ...nextContact, title: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || !nextContact.at}
                  onClick={() => saveNextContact(false)}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Guardar próximo contacto
                </button>
                {(initialNextContactAt || nextContact.at) && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => saveNextContact(true)}
                    className="text-sm text-slate-600 hover:underline disabled:opacity-50"
                  >
                    Quitar del calendario
                  </button>
                )}
              </div>
              {initialNextContactAt && (
                <p className="text-xs text-sky-800">
                  Programado: {formatDate(initialNextContactAt)}
                  {initialNextContactTitle ? ` · ${initialNextContactTitle}` : ''}
                </p>
              )}
            </div>

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
                      rows={5}
                      placeholder="Escribe el detalle. Usa párrafos separados y listas (1. 2. 3.) para que se vea ordenado."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
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

            {listLoading ? (
              <p className="text-sm text-slate-500 animate-pulse">Cargando seguimientos…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay seguimientos registrados.</p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-slate-200 px-4 py-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {followUpTypeLabels[item.followUpType]} ·{' '}
                          {formatDateTime(item.occurredAt)}
                          {item.clientProcess?.processTemplate?.name && (
                            <> · {item.clientProcess.processTemplate.name}</>
                          )}
                        </p>
                        {item.description && (
                          <FollowUpDescription text={item.description} />
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={loading}
                          className="text-xs text-red-600 hover:underline h-fit shrink-0"
                        >
                          Eliminar
                        </button>
                      )}
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
