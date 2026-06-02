'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  CalendarBootstrap,
  CalendarClientOption,
  CalendarItemKind,
  CalendarMonthItem,
  CalendarPickerOption,
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

function itemIsOpen(item: CalendarMonthItem) {
  if (item.kind === 'meeting') return item.status === 'scheduled';
  return item.status === 'active';
}

function statusLabel(item: CalendarMonthItem) {
  if (item.status === 'completed') return 'Terminada';
  if (item.status === 'cancelled') return 'Cancelada';
  if (item.kind === 'meeting') return 'Programada';
  return 'Pendiente';
}

type ViewAction = 'postpone' | 'complete' | null;

export function MeetingsCalendar({
  initialBootstrap = null,
  initialYear,
  initialMonth,
}: {
  initialBootstrap?: CalendarBootstrap | null;
  initialYear?: number;
  initialMonth?: number;
}) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth() + 1);
  const [items, setItems] = useState<CalendarMonthItem[]>(
    initialBootstrap?.items ?? [],
  );
  const [pickerOptions, setPickerOptions] = useState<CalendarPickerOption[]>(
    initialBootstrap?.pickerOptions ?? [],
  );
  const [clients, setClients] = useState<CalendarClientOption[]>(
    initialBootstrap?.clients ?? [],
  );
  const [loadingMonth, setLoadingMonth] = useState(!initialBootstrap);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState<{
    kind: AddKind;
    date: Date;
  } | null>(null);
  const [viewItem, setViewItem] = useState<CalendarMonthItem | null>(null);
  const [viewAction, setViewAction] = useState<ViewAction>(null);
  const [postponeAt, setPostponeAt] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

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

  const initialLoadDone = useRef(!!initialBootstrap);
  const skipFirstMonthEffect = useRef(!!initialBootstrap);

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);
    setError(null);
    try {
      const monthItems = await api.calendar.month(year, month);
      setItems(monthItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar calendario');
      setItems([]);
    } finally {
      setLoadingMonth(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (skipFirstMonthEffect.current) {
      skipFirstMonthEffect.current = false;
      return;
    }

    let cancelled = false;

    async function run() {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoadingMonth(true);
        setError(null);
        try {
          const data = await api.calendar.bootstrap(year, month);
          if (cancelled) return;
          setItems(data.items);
          setPickerOptions(data.pickerOptions);
          setClients(data.clients);
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : 'Error al cargar calendario',
            );
            setItems([]);
          }
        } finally {
          if (!cancelled) setLoadingMonth(false);
        }
        return;
      }

      setLoadingMonth(true);
      setError(null);
      try {
        const monthItems = await api.calendar.month(year, month);
        if (!cancelled) setItems(monthItems);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar calendario',
          );
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

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
      await loadMonth();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function openViewItem(item: CalendarMonthItem) {
    setViewItem(item);
    setViewAction(null);
    setPostponeAt(toDatetimeLocalValue(new Date(item.at)));
    setCompletionNotes('');
  }

  function closeViewItem() {
    setViewItem(null);
    setViewAction(null);
    setCompletionNotes('');
  }

  async function handleCancelItem() {
    if (!viewItem) return;
    const label =
      viewItem.kind === 'meeting' ? '¿Cancelar esta reunión?' : '¿Cancelar esta entrega?';
    if (!confirm(label)) return;

    setSaving(true);
    try {
      if (viewItem.kind === 'meeting') {
        await api.calendar.cancelMeeting(viewItem.id);
      } else {
        await api.calendar.updateDelivery(viewItem.id, { status: 'cancelled' });
      }
      closeViewItem();
      await loadMonth();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePostponeItem(e: React.FormEvent) {
    e.preventDefault();
    if (!viewItem || !postponeAt) return;

    setSaving(true);
    try {
      const iso = new Date(postponeAt).toISOString();
      if (viewItem.kind === 'meeting') {
        await api.calendar.updateMeeting(viewItem.id, { scheduledAt: iso });
      } else {
        await api.calendar.updateDelivery(viewItem.id, { dueAt: iso });
      }
      closeViewItem();
      await loadMonth();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteItem(e: React.FormEvent) {
    e.preventDefault();
    if (!viewItem || !completionNotes.trim()) {
      alert('Escribe notas para terminar el evento.');
      return;
    }

    setSaving(true);
    try {
      if (viewItem.kind === 'meeting') {
        await api.calendar.updateMeeting(viewItem.id, {
          status: 'completed',
          notes: completionNotes.trim(),
        });
      } else {
        await api.calendar.updateDelivery(viewItem.id, {
          status: 'completed',
          completionNotes: completionNotes.trim(),
        });
      }
      closeViewItem();
      await loadMonth();
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

      <div
        className={`p-4 ${loadingMonth ? 'opacity-50 pointer-events-none' : ''}`}
      >
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
                        onClick={() => openViewItem(item)}
                        className={`w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight border ${meetingItemStyle(item)} ${
                          item.status === 'completed' ? 'opacity-60 line-through' : ''
                        }`}
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
                            {p.name}
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${meetingItemStyle(viewItem)}`}
            >
              {viewItem.kind === 'meeting' && viewItem.processKind === 'seguimiento'
                ? 'Reunión · Seguimiento'
                : KIND_LABELS[viewItem.kind]}
            </span>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{viewItem.title}</h3>
              <span className="text-xs font-medium text-slate-500 shrink-0">
                {statusLabel(viewItem)}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-1">{viewItem.clientName}</p>
            <p className="text-sm text-slate-500 mt-2">{formatDateTime(viewItem.at)}</p>
            {viewItem.description && (
              <p className="text-sm text-slate-600 mt-2">
                <span className="font-medium text-slate-700">Detalle: </span>
                {viewItem.description}
              </p>
            )}
            {(viewItem.notes || viewItem.completionNotes) && (
              <p className="text-sm text-emerald-800 mt-2 rounded-lg bg-emerald-50 px-3 py-2">
                <span className="font-medium">Notas de cierre: </span>
                {viewItem.notes ?? viewItem.completionNotes}
              </p>
            )}

            {viewAction === 'postpone' && itemIsOpen(viewItem) && (
              <form onSubmit={handlePostponeItem} className="mt-4 space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-slate-800">Aplazar evento</p>
                <input
                  required
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={postponeAt}
                  onChange={(e) => setPostponeAt(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Guardar nueva fecha
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewAction(null)}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Volver
                  </button>
                </div>
              </form>
            )}

            {viewAction === 'complete' && itemIsOpen(viewItem) && (
              <form onSubmit={handleCompleteItem} className="mt-4 space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-slate-800">Terminar con notas</p>
                <textarea
                  required
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="¿Qué se hizo? Resultado, acuerdos, pendientes…"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Marcar como terminada
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewAction(null)}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Volver
                  </button>
                </div>
              </form>
            )}

            {!viewAction && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {viewItem.processId && (
                  <Link
                    href={`/procesos/${viewItem.processId}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Ver proceso
                  </Link>
                )}
                {itemIsOpen(viewItem) && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setViewAction('postpone')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Aplazar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setViewAction('complete')}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Terminar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleCancelItem}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeViewItem}
                  className="text-sm text-slate-600 hover:underline ml-auto"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
