'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { CalendarBootstrap, Dashboard } from '@/lib/types';

const MeetingsCalendar = dynamic(
  () =>
    import('@/components/MeetingsCalendar').then((m) => ({
      default: m.MeetingsCalendar,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-slate-200 bg-white h-96 animate-pulse" />
    ),
  },
);

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded" />
      <div className="h-8 w-12 bg-slate-200 rounded mt-3" />
    </div>
  );
}

export function HomePageClient() {
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [calendarBootstrap, setCalendarBootstrap] =
    useState<CalendarBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.home.bootstrap(year, month);
        if (cancelled) return;
        setDashboard(data.dashboard);
        setCalendarBootstrap(data.calendar);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar el panel',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">API no disponible</h1>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  const stats = dashboard
    ? [
        { label: 'Clientes', value: dashboard.stats.totalClients },
        { label: 'Procesos activos', value: dashboard.stats.activeProcesses },
        { label: 'Completados', value: dashboard.stats.completedProcesses },
        {
          label: 'Etapas vencidas',
          value: dashboard.stats.overdueStages,
          alert: true,
        },
        {
          label: 'Sin seguimiento 30+ días',
          value:
            dashboard.stats.needsFollowUp ??
            dashboard.followUpAlerts?.length ??
            0,
          alert: true,
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel de seguimiento</h1>
        <p className="mt-1 text-slate-600">
          Vista general de clientes, etapas y plazos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{s.label}</p>
                <p
                  className={`mt-1 text-3xl font-bold ${
                    s.alert && s.value > 0 ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
      </div>

      {calendarBootstrap ? (
        <MeetingsCalendar
          initialBootstrap={calendarBootstrap}
          initialYear={year}
          initialMonth={month}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white min-h-[28rem] animate-pulse" />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Conjuntos por fase</h2>
            <p className="mt-1 text-sm text-slate-500">
              Clientes agrupados según la etapa actual de su proceso activo.
            </p>
          </div>
          <Link
            href="/clientes"
            className="text-sm font-medium text-indigo-700 hover:underline"
          >
            Ver todos los clientes →
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 h-40 rounded-lg bg-slate-100 animate-pulse" />
        ) : (dashboard?.processesByStage?.length ?? 0) === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No hay procesos activos.</p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {(dashboard?.processesByStage ?? []).map((group) => (
              <div
                key={`${group.templateName}-${group.stageName}`}
                className="rounded-lg border border-slate-200 bg-slate-50/80 overflow-hidden"
              >
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <h3 className="font-medium text-slate-900">{group.stageName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {group.templateName} · {group.count}{' '}
                    {group.count === 1 ? 'conjunto' : 'conjuntos'}
                  </p>
                </div>
                <ul className="divide-y divide-slate-200/80 max-h-72 overflow-y-auto">
                  {group.items.map((item) => (
                    <li
                      key={item.processId}
                      className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm bg-white/60"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/procesos/${item.processId}`}
                          className="font-medium text-indigo-700 hover:underline line-clamp-2"
                        >
                          {item.clientName}
                        </Link>
                        {item.company && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {item.company}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {item.overdue ? (
                          <span className="text-xs font-medium text-red-600">
                            Vencida
                          </span>
                        ) : item.dueDate ? (
                          <span className="text-xs text-slate-500">
                            {formatDate(item.dueDate)}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {!loading && (dashboard?.overdue.length ?? 0) > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">Etapas vencidas</h2>
          <ul className="mt-3 space-y-2">
            {dashboard!.overdue.map((o, i) => (
              <li key={i} className="text-sm text-red-800">
                <Link href={`/procesos/${o.processId}`} className="font-medium underline">
                  {o.clientName}
                </Link>
                {' — '}
                {o.stageName} (venció {formatDate(o.dueDate)})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
