'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  CalendarItemKind,
  CalendarMonthItem,
  CalendarPickerOption,
  Client,
} from '@/lib/types';
import { api } from '@/lib/api';
import { formatDateTime, toDatetimeLocalValue } from '@/lib/format';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const KIND_LABELS: Record<CalendarItemKind, string> = {
  meeting: 'Reunión',
  client_delivery: 'Entrega del cliente',
  internal_delivery: 'Nuestra entrega',
};

const KIND_STYLES: Record<CalendarItemKind, string> = {
  meeting: 'bg-indigo-100 border-indigo-300 text-indigo-950 hover:bg-indigo-200',
  client_delivery: 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200',
  internal_delivery:
    'bg-emerald-100 border-emerald-300 text-emerald-950 hover:bg-emerald-200',
};

const MEETING_SEGUIMIENTO_STYLE =
  'bg-violet-100 border-violet-300 text-violet-950 hover:bg-violet-200';

function meetingItemStyle(item: CalendarMonthItem) {
  if (item.kind !== 'meeting') return KIND_STYLES[item.kind];
  return item.processKind === 'seguimiento' ? MEETING_SEGUIMIENTO_STYLE : KIND_STYLES.meeting;
}

const LEGEND_DOT: Record<CalendarItemKind, string> = {
  meeting: 'bg-indigo-500',
  client_delivery: 'bg-amber-500',
  internal_delivery: 'bg-emerald-500',
};

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(year: number, month: number) {
  const m = month - 1;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const startPad = (new Date(year, m, 1).getDay() + 6) % 7;
  const cells: Array<{ date: Date | null; day: number; isToday: boolean }> = [];
  const todayKey = dateKey(new Date());

  for (let i = 0; i < startPad; i++) {
    cells.push({ date: null, day: 0, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, m, d);
    cells.push({ date, day: d, isToday: dateKey(date) === todayKey });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: 0, isToday: false });
  }
  return cells;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function defaultDatetimeForDay(date: Date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

type AddKind = CalendarItemKind;

export function MeetingsCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<CalendarMonthItem[]>([]);
  const [pickerOptions, setPickerOptions] = useState<CalendarPickerOption[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState<{
    kind: AddKind;
    date: Date;
  } | null>(null);
  const [viewItem, setViewItem] = useState<CalendarMonthItem | null>(null);

  const [meetingForm, setMeetingForm] = useState({
    processKey: '',
    title: '',
    scheduledAt: '',
  });
  const [deliveryForm, setDeliveryForm] = useState({
    clientId: '',
    processId: '',
    title: '',
    dueAt: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [monthItems, options, clientList] = await Promise.all([
        api.calendar.month(year, month),
        api.calendar.pickerOptions(),
        api.clients.list(),
      ]);
      setItems(monthItems);
      setPickerOptions(options);
      setClients(clientList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar calendario');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function goMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarMonthItem[]>();
    for (const item of items) {
      const key = dateKey(new Date(item.at));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const counts = useMemo(() => {
    const c = { meeting: 0, client_delivery: 0, internal_delivery: 0 };
    for (const i of items) c[i.kind]++;
    return c;
  }, [items]);

  function openAdd(kind: AddKind, date: Date) {
    setAddModal({ kind, date });
    const dt = defaultDatetimeForDay(date);
    if (kind === 'meeting') {
      const first = pickerOptions[0];
      setMeetingForm({
        processKey: first?.processId ?? '',
        title: '',
        scheduledAt: dt,
      });
    } else {
      const firstClient = clients[0];
      setDeliveryForm({
        clientId: firstClient?.id ?? '',
        processId: '',
        title: kind === 'client_delivery' ? 'Entrega del cliente' : 'Entrega nuestra',
        dueAt: dt,
        description: '',
      });
    }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addModal) return;
    setSaving(true);
    try {
      if (addModal.kind === 'meeting') {
        const opt = pickerOptions.find((p) => p.processId === meetingForm.processKey);
        if (!opt?.currentStageProgressId) {
          alert('Selecciona un cliente con proceso activo.');
          return;
        }
        await api.calendar.createMeeting({
          stageProgressId: opt.currentStageProgressId,
          title: meetingForm.title,
          scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
        });
      } else {
        await api.calendar.createDelivery({
          clientId: deliveryForm.clientId,
          clientProcessId: deliveryForm.processId || undefined,
          eventType: addModal.kind,
          title: deliveryForm.title,
          description: deliveryForm.description || undefined,
          dueAt: new Date(deliveryForm.dueAt).toISOString(),
        });
      }
      setAddModal(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrDelete() {
    if (!viewItem) return;
    if (
      !confirm(
        viewItem.kind === 'meeting'
          ? '¿Cancelar esta reunión?'
          : '¿Eliminar esta fecha de entrega?',
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      if (viewItem.kind === 'meeting') {
        await api.calendar.cancelMeeting(viewItem.id);
      } else {
        await api.calendar.deleteDelivery(viewItem.id);
      }
      setViewItem(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  const processesForClient =
    clients.find((c) => c.id === deliveryForm.clientId)?.processes ?? [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-900">Calendario</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length} evento{items.length === 1 ? '' : 's'} este mes
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              Reunión onboarding ({counts.meeting})
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              Reunión seguimiento
            </span>
            {(Object.keys(KIND_LABELS) as CalendarItemKind[])
              .filter((k) => k !== 'meeting')
              .map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${LEGEND_DOT[k]}`} />
                  {KIND_LABELS[k]} ({counts[k]})
                </span>
              ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-900">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setYear(t.getFullYear());
              setMonth(t.getMonth() + 1);
            }}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Hoy
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-5 mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className={`p-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="bg-slate-100 px-1 py-2 text-center text-xs font-semibold text-slate-600"
            >
              {wd}
            </div>
          ))}
          {grid.map((cell, i) => {
            if (!cell.date) {
              return <div key={`empty-${i}`} className="min-h-[6.5rem] bg-slate-50/80" />;
            }
            const key = dateKey(cell.date);
            const dayItems = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-[6.5rem] bg-white p-1 flex flex-col group ${
                  cell.isToday ? 'ring-2 ring-inset ring-indigo-400' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      cell.isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                    <button
                      type="button"
                      title="Reunión"
                      onClick={() => openAdd('meeting', cell.date!)}
                      className="h-5 w-5 rounded text-[10px] bg-indigo-500 text-white hover:bg-indigo-600"
                    >
                      R
                    </button>
                    <button
                      type="button"
                      title="Entrega cliente"
                      onClick={() => openAdd('client_delivery', cell.date!)}
                      className="h-5 w-5 rounded text-[10px] bg-amber-500 text-white hover:bg-amber-600"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      title="Nuestra entrega"
                      onClick={() => openAdd('internal_delivery', cell.date!)}
                      className="h-5 w-5 rounded text-[10px] bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                      N
                    </button>
                  </div>
                </div>
                <ul className="flex-1 space-y-0.5 overflow-y-auto max-h-28">
                  {dayItems.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => setViewItem(item)}
                        className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight border ${meetingItemStyle(item)}`}
                      >
                        <span className="font-medium">{formatTime(item.at)}</span>
                        <span className="line-clamp-1 opacity-90">{item.clientName}</span>
                        <span className="line-clamp-1">{item.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900">
              Agregar {KIND_LABELS[addModal.kind]}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {addModal.date.toLocaleDateString('es-CO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <form onSubmit={submitAdd} className="space-y-3">
              {addModal.kind === 'meeting' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cliente / proceso
                    </label>
                    <select
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={meetingForm.processKey}
                      onChange={(e) =>
                        setMeetingForm({ ...meetingForm, processKey: e.target.value })
                      }
                    >
                      {pickerOptions.length === 0 ? (
                        <option value="">Sin clientes disponibles</option>
                      ) : (
                        <>
                          {pickerOptions.filter((p) => p.processKind === 'onboarding')
                            .length > 0 && (
                            <optgroup label="Clientes">
                              {pickerOptions
                                .filter((p) => p.processKind === 'onboarding')
                                .map((p) => (
                                  <option key={p.processId} value={p.processId}>
                                    {p.clientName}
                                    {p.currentStageName
                                      ? ` — ${p.currentStageName}`
                                      : ` — ${p.templateName}`}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Título
                    </label>
                    <input
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={meetingForm.title}
                      onChange={(e) =>
                        setMeetingForm({ ...meetingForm, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha y hora
                    </label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={meetingForm.scheduledAt}
                      onChange={(e) =>
                        setMeetingForm({ ...meetingForm, scheduledAt: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Cliente
                    </label>
                    <select
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={deliveryForm.clientId}
                      onChange={(e) =>
                        setDeliveryForm({
                          ...deliveryForm,
                          clientId: e.target.value,
                          processId: '',
                        })
                      }
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {processesForClient.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Proceso (opcional)
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={deliveryForm.processId}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, processId: e.target.value })
                        }
                      >
                        <option value="">—</option>
                        {processesForClient.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.processTemplate?.name ?? 'Proceso'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Título
                    </label>
                    <input
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={deliveryForm.title}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fecha de entrega
                    </label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={deliveryForm.dueAt}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, dueAt: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Detalle (opcional)
                    </label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={deliveryForm.description}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, description: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setAddModal(null)}
                  className="text-sm text-slate-600 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${meetingItemStyle(viewItem)}`}
            >
              {viewItem.kind === 'meeting' && viewItem.processKind === 'seguimiento'
                ? 'Reunión · Seguimiento'
                : KIND_LABELS[viewItem.kind]}
            </span>
            <h3 className="font-semibold text-slate-900">{viewItem.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{viewItem.clientName}</p>
            <p className="text-sm text-slate-500 mt-2">
              {formatDateTime(viewItem.at)}
            </p>
            {viewItem.description && (
              <p className="text-sm text-slate-600 mt-2">{viewItem.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              {viewItem.processId && (
                <Link
                  href={`/procesos/${viewItem.processId}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Ver proceso
                </Link>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={cancelOrDelete}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {viewItem.kind === 'meeting' ? 'Cancelar reunión' : 'Eliminar entrega'}
              </button>
              <button
                type="button"
                onClick={() => setViewItem(null)}
                className="text-sm text-slate-600 hover:underline ml-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
