'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ConjuntoPickerItem, ConjuntoReport } from '@/lib/types';
import { api, invalidateApiCache } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  followUpTypeLabels,
  formatDate,
  formatDateTime,
  formatDaysSinceFollowUp,
  stageTypeLabels,
} from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { FollowUpStatusBadge } from '@/components/FollowUpStatusBadge';
import { FollowUpDescription } from '@/components/FollowUpDescription';

const DELIVERY_LABELS: Record<string, string> = {
  client_delivery: 'Entrega del cliente',
  internal_delivery: 'Nuestra entrega',
};

function clientLabel(c: ConjuntoPickerItem) {
  return c.company ? `${c.name} — ${c.company}` : c.name;
}

export function ConjuntoReportPageClient({
  initialClients,
}: {
  initialClients: ConjuntoPickerItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get('clientId') ?? '';

  const [clients] = useState(
    [...initialClients].sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );
  const selectedId = clientIdFromUrl;
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<ConjuntoReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company?.toLowerCase().includes(q) ?? false),
    );
  }, [clients, query]);

  useEffect(() => {
    if (!selectedId) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setReport(null);
    setLoading(true);
    setError(null);
    invalidateApiCache('/clients');

    api.clients
      .conjuntoReport(selectedId)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setReport(null);
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar el reporte',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function handleSelect(id: string) {
    setQuery('');
    if (id) {
      router.replace(`/conjuntos?clientId=${encodeURIComponent(id)}`, {
        scroll: false,
      });
    } else {
      router.replace('/conjuntos', { scroll: false });
    }
  }

  const reportMatchesSelection =
    report != null && report.client.id === selectedId;

  const pendingDeliveries =
    report?.deliveries.filter((d) => d.status === 'active') ?? [];
  const completedDeliveries =
    report?.deliveries.filter((d) => d.status === 'completed') ?? [];
  const unfulfilledDeliveries =
    report?.deliveries.filter((d) => d.status === 'unfulfilled') ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reporte del conjunto</h1>
        <p className="mt-1 text-slate-600 max-w-2xl">
          Vista para el encargado: etapa del onboarding, últimos seguimientos,
          plazos de entrega y entregas pendientes.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="conjunto-search" className="block text-sm font-medium text-slate-700">
          Seleccionar conjunto (cliente)
        </label>
        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          <input
            id="conjunto-search"
            type="search"
            placeholder="Buscar por nombre o empresa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
          <select
            value={selectedId}
            onChange={(e) => handleSelect(e.target.value)}
            className="sm:min-w-[16rem] rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
          >
            <option value="">— Elija un conjunto —</option>
            {filteredClients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientLabel(c)}
              </option>
            ))}
          </select>
        </div>
        {query && filteredClients.length > 0 && !selectedId && (
          <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {filteredClients.slice(0, 12).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 text-slate-800"
                >
                  {clientLabel(c)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!selectedId && (
        <p className="text-sm text-slate-500 text-center py-12">
          Seleccione un conjunto para ver el reporte.
        </p>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 animate-pulse">
          Cargando reporte…
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {reportMatchesSelection && !loading && (
        <div className="space-y-6">
          <header className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  Conjunto
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  {report.client.name}
                </h2>
                {report.client.company && (
                  <p className="text-lg text-slate-600 mt-0.5">{report.client.company}</p>
                )}
                <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
                  <div>
                    <dt className="text-slate-500">Contacto</dt>
                    <dd>{report.client.contactName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Teléfono</dt>
                    <dd>{report.client.phone ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Correo</dt>
                    <dd>{report.client.email ?? '—'}</dd>
                  </div>
                </dl>
              </div>
              {isLoggedIn && (
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/clientes/${report.client.id}`}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 text-center"
                  >
                    Ficha completa
                  </Link>
                  {report.process && (
                    <Link
                      href={`/procesos/${report.process.id}`}
                      className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 text-center"
                    >
                      Ver proceso
                    </Link>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Seguimientos</h3>
              <p className="text-sm text-slate-500 mt-1">
                Solo los 3 registros más recientes (sin reuniones del calendario).
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <FollowUpStatusBadge
                  summary={report.followUpSummary}
                  hasProcess={!!report.process}
                />
                {report.followUpSummary.totalFollowUps > 0 && (
                  <span className="text-sm text-slate-600">
                    {formatDaysSinceFollowUp(
                      report.followUpSummary.daysSinceLastFollowUp,
                    )}
                  </span>
                )}
              </div>

              {report.pendingNextContacts.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-800">Próximo contacto</p>
                  <ul className="mt-2 space-y-2">
                    {report.pendingNextContacts.map((nc) => (
                      <li
                        key={nc.followUpId}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          nc.overdue
                            ? 'border-rose-200 bg-rose-50 text-rose-900'
                            : 'border-sky-200 bg-sky-50 text-sky-900'
                        }`}
                      >
                        <span className="font-medium">{nc.title}</span>
                        <span className="block text-xs mt-0.5 opacity-90">
                          {nc.overdue ? 'Venció' : 'Programado'}: {formatDateTime(nc.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.recentFollowUps.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Aún no hay seguimientos.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {report.recentFollowUps.map((fu, index) => (
                    <li
                      key={fu.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/80 p-4"
                    >
                      {index === 0 && (
                        <p className="text-xs font-semibold uppercase text-slate-500 mb-1">
                          Más reciente
                        </p>
                      )}
                      <p className="font-semibold text-slate-900">{fu.title}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {followUpTypeLabels[fu.followUpType] ?? 'Seguimiento'} ·{' '}
                        {formatDateTime(fu.occurredAt)}
                        {fu.stageName && <> · Etapa: {fu.stageName}</>}
                      </p>
                      {fu.description && (
                        <FollowUpDescription text={fu.description} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Etapa del proceso</h3>
              {!report.process ? (
                <p className="mt-3 text-sm text-slate-500">
                  Este conjunto no tiene un proceso de onboarding iniciado.
                </p>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={report.process.status} />
                    <span className="text-sm text-slate-600">
                      {report.process.templateName}
                    </span>
                  </div>
                  {report.process.currentStageName && (
                    <p className="mt-3 text-base font-medium text-indigo-800">
                      Etapa actual: {report.process.currentStageName}
                    </p>
                  )}
                  {report.process.startedAt && (
                    <p className="text-sm text-slate-500 mt-1">
                      Inicio onboarding: {formatDate(report.process.startedAt)}
                    </p>
                  )}
                  <ol className="mt-4 space-y-2">
                    {report.process.stages.map((stage) => (
                      <li
                        key={stage.id}
                        className={`rounded-lg border px-3 py-3 text-sm ${
                          stage.isCurrent
                            ? 'border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-200'
                            : stage.overdue
                              ? 'border-rose-200 bg-rose-50/50'
                              : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">
                            {stage.orderIndex + 1}. {stage.name}
                          </span>
                          <StatusBadge status={stage.status} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {stageTypeLabels[stage.stageType] ?? stage.stageType} · Plazo:{' '}
                          {stage.durationLabel}
                        </p>
                        {stage.dueDate && (
                          <p
                            className={`text-xs mt-1 ${
                              stage.overdue ? 'text-rose-700 font-medium' : 'text-slate-600'
                            }`}
                          >
                            Vence: {formatDate(stage.dueDate)}
                            {stage.overdue ? ' (vencida)' : ''}
                          </p>
                        )}
                        {stage.isCurrent && (
                          <span className="inline-block mt-1 text-xs font-semibold text-indigo-700">
                            ← En curso
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">
                Entregas y plazos de entrega
              </h3>
              {pendingDeliveries.length === 0 &&
              completedDeliveries.length === 0 &&
              unfulfilledDeliveries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No hay entregas registradas en el calendario para este conjunto.
                </p>
              ) : (
                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-amber-800">Pendientes</p>
                    {pendingDeliveries.length === 0 ? (
                      <p className="text-sm text-slate-500 mt-2">Ninguna pendiente.</p>
                    ) : (
                      <ul className="mt-2 space-y-3">
                        {pendingDeliveries.map((d) => (
                          <li
                            key={d.id}
                            className={`rounded-lg border px-4 py-3 ${
                              d.overdue
                                ? 'border-rose-300 bg-rose-50'
                                : 'border-amber-200 bg-amber-50/80'
                            }`}
                          >
                            <span className="text-xs font-medium text-amber-800">
                              {DELIVERY_LABELS[d.eventType]}
                            </span>
                            <p className="font-medium text-slate-900 mt-1">{d.title}</p>
                            <p
                              className={`text-sm mt-1 ${
                                d.overdue ? 'text-rose-700 font-medium' : 'text-slate-600'
                              }`}
                            >
                              Fecha entrega: {formatDateTime(d.dueAt)}
                              {d.overdue ? ' · Vencida' : ''}
                            </p>
                            {d.description && (
                              <p className="text-sm text-slate-600 mt-2">{d.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {(completedDeliveries.length > 0 || unfulfilledDeliveries.length > 0) && (
                    <div className="space-y-4">
                      {completedDeliveries.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-emerald-800">Realizadas</p>
                          <ul className="mt-2 space-y-2">
                            {completedDeliveries.map((d) => (
                              <li
                                key={d.id}
                                className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm opacity-90"
                              >
                                <p className="font-medium text-slate-800">{d.title}</p>
                                <p className="text-xs text-slate-500">
                                  {DELIVERY_LABELS[d.eventType]} · {formatDateTime(d.dueAt)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {unfulfilledDeliveries.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-rose-800">
                            Incumplidas por el cliente
                          </p>
                          <ul className="mt-2 space-y-2">
                            {unfulfilledDeliveries.map((d) => (
                              <li
                                key={d.id}
                                className="rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm"
                              >
                                <p className="font-medium text-slate-800 line-through opacity-80">
                                  {d.title}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {DELIVERY_LABELS[d.eventType]} · {formatDateTime(d.dueAt)}
                                </p>
                                {d.unfulfilledReason && (
                                  <p className="text-sm text-rose-900 mt-2">
                                    <span className="font-medium">Motivo: </span>
                                    {d.unfulfilledReason}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {report.process && (
                <p className="mt-4 text-xs text-slate-500">
                  Los plazos por etapa del onboarding se muestran en la sección «Etapa del
                  proceso». Las entregas del calendario son compromisos adicionales (cliente o
                  COOTRAVIR).
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
