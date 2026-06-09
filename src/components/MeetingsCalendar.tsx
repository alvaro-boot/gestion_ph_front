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
import { api, invalidateApiCache } from '@/lib/api';
import { formatDateTime, toDatetimeLocalValue } from '@/lib/format';
import { ClientSearchPicker } from '@/components/ClientSearchPicker';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const KIND_LABELS: Record<CalendarItemKind, string> = {
  meeting: 'Reunión',
  client_delivery: 'Entrega del cliente',
  internal_delivery: 'Nuestra entrega',
  next_contact: 'Próximo contacto',
};

const KIND_STYLES: Record<Exclude<CalendarItemKind, 'meeting' | 'next_contact'>, string> = {
  client_delivery: 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200',
  internal_delivery:
    'bg-emerald-100 border-emerald-300 text-emerald-950 hover:bg-emerald-200',
};
const CLIENT_DELIVERY_UNFULFILLED_STYLE =
  'bg-rose-100 border-rose-400 text-rose-950 hover:bg-rose-200';

const MEETING_ONBOARDING_STYLE =
  'bg-indigo-100 border-indigo-300 text-indigo-950 hover:bg-indigo-200';
const MEETING_SEGUIMIENTO_STYLE =
  'bg-violet-100 border-violet-300 text-violet-950 hover:bg-violet-200';
const MEETING_GENERAL_STYLE =
  'bg-orange-100 border-orange-400 text-orange-950 hover:bg-orange-200';
const NEXT_CONTACT_STYLE =
  'bg-sky-100 border-sky-300 text-sky-950 hover:bg-sky-200';
const NEXT_CONTACT_OVERDUE_STYLE =
  'bg-rose-100 border-rose-400 text-rose-950 hover:bg-rose-200';

function calendarChipStyle(item: CalendarMonthItem) {
  if (item.kind === 'next_contact') {
    return item.status === 'overdue'
      ? NEXT_CONTACT_OVERDUE_STYLE
      : NEXT_CONTACT_STYLE;
  }
  if (item.kind === 'meeting') {
    if (item.meetingSource === 'general') return MEETING_GENERAL_STYLE;
    return item.processKind === 'seguimiento'
      ? MEETING_SEGUIMIENTO_STYLE
      : MEETING_ONBOARDING_STYLE;
  }
  if (item.kind === 'client_delivery' && item.status === 'unfulfilled') {
    return CLIENT_DELIVERY_UNFULFILLED_STYLE;
  }
  return KIND_STYLES[item.kind];
}

const LEGEND_ITEMS: { kind: CalendarItemKind; dot: string; label: string }[] = [
  { kind: 'meeting', dot: 'bg-indigo-500', label: 'Reunión onboarding' },
  { kind: 'meeting', dot: 'bg-violet-500', label: 'Reunión seguimiento' },
  { kind: 'meeting', dot: 'bg-orange-500', label: 'Reunión general' },
  { kind: 'client_delivery', dot: 'bg-amber-500', label: 'Entrega del cliente' },
  { kind: 'internal_delivery', dot: 'bg-emerald-500', label: 'Nuestra entrega' },
  { kind: 'next_contact', dot: 'bg-sky-500', label: 'Próximo contacto' },
];

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

function isFollowUpPlannedContact(item: CalendarMonthItem) {
  return item.kind === 'next_contact' && item.nextContactSource === 'followup';
}

function itemIsOpen(item: CalendarMonthItem) {
  if (item.kind === 'next_contact') return item.status !== 'completed';
  if (item.kind === 'meeting') {
    if (item.meetingSource === 'followup') return item.status !== 'completed';
    return item.status === 'scheduled';
  }
  return item.status === 'active';
}

function statusLabel(item: CalendarMonthItem) {
  if (item.kind === 'next_contact') {
    if (item.status === 'completed') return 'Realizado';
    return item.status === 'overdue' ? 'Vencido' : 'Pendiente';
  }
  if (item.status === 'completed') return 'Terminada';
  if (item.status === 'unfulfilled') return 'Incumplida';
  if (item.status === 'cancelled') return 'Cancelada';
  if (item.kind === 'meeting' && item.meetingSource === 'followup') {
    return 'Seguimiento';
  }
  if (item.kind === 'meeting' && item.meetingSource === 'general') {
    return 'General';
  }
  if (item.kind === 'meeting') return 'Programada';
  return 'Pendiente';
}

function chipPrimaryLine(item: CalendarMonthItem) {
  if (item.kind === 'next_contact') {
    return item.clientName;
  }
  return item.title;
}

function chipSecondaryLine(item: CalendarMonthItem) {
  if (item.kind === 'meeting' && item.meetingSource === 'general') {
    return 'Sin conjunto';
  }
  if (item.kind === 'next_contact') {
    const prefix =
      item.status === 'completed'
        ? 'Realizado · '
        : item.status === 'overdue'
          ? 'Vencido · '
          : 'Próximo · ';
    return `${prefix}${item.title}`;
  }
  return item.clientName;
}

type ViewAction = 'postpone' | 'complete' | 'unfulfilled' | null;

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
  const [unfulfilledReason, setUnfulfilledReason] = useState('');

  const [meetingForm, setMeetingForm] = useState({
    scope: 'client' as 'client' | 'general',
    clientId: '',
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
    const c = {
      meeting_onboarding: 0,
      meeting_seguimiento: 0,
      meeting_general: 0,
      client_delivery: 0,
      internal_delivery: 0,
      next_contact: 0,
    };
    for (const i of items) {
      if (i.kind === 'meeting') {
        if (i.meetingSource === 'general') c.meeting_general++;
        else if (i.processKind === 'seguimiento') c.meeting_seguimiento++;
        else c.meeting_onboarding++;
      } else if (i.kind in c) {
        c[i.kind as 'client_delivery' | 'internal_delivery' | 'next_contact']++;
      }
    }
    return c;
  }, [items]);

  const processesForMeetingClient = useMemo(() => {
    if (!meetingForm.clientId) return [];
    return pickerOptions.filter((p) => p.clientId === meetingForm.clientId);
  }, [pickerOptions, meetingForm.clientId]);

  function openAdd(kind: AddKind, date: Date) {
    setAddModal({ kind, date });
    const dt = defaultDatetimeForDay(date);
    if (kind === 'meeting') {
      const firstClient = clients[0];
      const firstProcess = firstClient
        ? pickerOptions.find((p) => p.clientId === firstClient.id)
        : pickerOptions[0];
      setMeetingForm({
        scope: 'client',
        clientId: firstClient?.id ?? '',
        processKey: firstProcess?.processId ?? '',
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
        if (meetingForm.scope === 'general') {
          await api.calendar.createMeeting({
            title: meetingForm.title,
            scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
          });
        } else {
          const opt = pickerOptions.find((p) => p.processId === meetingForm.processKey);
          if (!opt) {
            alert('Selecciona un conjunto y su proceso.');
            return;
          }
          await api.calendar.createMeeting({
            processId: opt.processId,
            stageProgressId: opt.currentStageProgressId ?? undefined,
            title: meetingForm.title,
            scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
          });
        }
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
      invalidateApiCache('/calendar');
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
    const when = item.scheduledAt ?? item.at;
    setPostponeAt(toDatetimeLocalValue(new Date(when)));
    setCompletionNotes('');
    setUnfulfilledReason('');
  }

  function closeViewItem() {
    setViewItem(null);
    setViewAction(null);
    setCompletionNotes('');
    setUnfulfilledReason('');
  }

  async function handleCancelItem() {
    if (!viewItem) return;
    const label =
      viewItem.kind === 'next_contact'
        ? '¿Quitar este próximo contacto del calendario?'
        : viewItem.kind === 'meeting'
          ? '¿Cancelar esta reunión?'
          : '¿Cancelar esta entrega?';
    if (!confirm(label)) return;

    setSaving(true);
    try {
      if (viewItem.kind === 'next_contact') {
        if (isFollowUpPlannedContact(viewItem)) {
          await api.seguimientos.update(viewItem.id, { nextActionAt: null });
        } else {
          await api.clients.update(viewItem.clientId, {
            nextContactAt: null,
            nextContactTitle: null,
          });
        }
      } else if (viewItem.kind === 'meeting') {
        if (viewItem.meetingSource === 'followup') {
          await api.seguimientos.remove(viewItem.id);
        } else {
          await api.calendar.cancelMeeting(viewItem.id);
        }
      } else {
        await api.calendar.updateDelivery(viewItem.id, { status: 'cancelled' });
      }
      invalidateApiCache('/calendar');
      invalidateApiCache('/clients');
      invalidateApiCache('/seguimientos');
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
      if (viewItem.kind === 'next_contact') {
        if (isFollowUpPlannedContact(viewItem)) {
          await api.seguimientos.update(viewItem.id, { nextActionAt: iso });
        } else {
          await api.clients.update(viewItem.clientId, {
            nextContactAt: iso,
          });
        }
      } else if (viewItem.kind === 'meeting') {
        if (viewItem.meetingSource === 'followup') {
          await api.seguimientos.update(viewItem.id, { occurredAt: iso });
        } else {
          await api.calendar.updateMeeting(viewItem.id, { scheduledAt: iso });
        }
      } else {
        await api.calendar.updateDelivery(viewItem.id, { dueAt: iso });
      }
      invalidateApiCache('/calendar');
      invalidateApiCache('/clients');
      invalidateApiCache('/seguimientos');
      closeViewItem();
      await loadMonth();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnfulfilledItem(e: React.FormEvent) {
    e.preventDefault();
    if (!viewItem || viewItem.kind !== 'client_delivery') return;
    if (!unfulfilledReason.trim()) {
      alert('Indica por qué el cliente no cumplió la entrega.');
      return;
    }

    setSaving(true);
    try {
      await api.calendar.updateDelivery(viewItem.id, {
        status: 'unfulfilled',
        unfulfilledReason: unfulfilledReason.trim(),
      });
      invalidateApiCache('/calendar');
      invalidateApiCache('/clients');
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
      if (viewItem.kind === 'next_contact') {
        const notes = completionNotes.trim();
        await api.seguimientos.create({
          clientId: viewItem.clientId,
          title: `Contacto realizado · ${viewItem.title}`,
          description: notes,
          followUpType: 'call',
          occurredAt: new Date().toISOString(),
          clientProcessId: viewItem.processId ?? undefined,
        });
        if (isFollowUpPlannedContact(viewItem)) {
          await api.seguimientos.update(viewItem.id, { nextActionAt: null });
        } else {
          await api.clients.update(viewItem.clientId, {
            nextContactAt: null,
            nextContactTitle: null,
          });
        }
      } else if (viewItem.kind === 'meeting') {
        if (viewItem.meetingSource === 'followup') {
          const notes = completionNotes.trim();
          const base = viewItem.description?.trim() ?? '';
          const marker = '[Realizada]';
          if (!base.includes(marker)) {
            await api.seguimientos.update(viewItem.id, {
              description: base ? `${base}\n${marker}` : marker,
            });
          }
          await api.seguimientos.create({
            clientId: viewItem.clientId,
            title: `Cierre: ${viewItem.title}`,
            description: notes,
            followUpType: 'meeting',
            occurredAt: new Date().toISOString(),
            clientProcessId: viewItem.processId ?? undefined,
          });
        } else {
          await api.calendar.updateMeeting(viewItem.id, {
            status: 'completed',
            notes: completionNotes.trim(),
          });
        }
      } else {
        await api.calendar.updateDelivery(viewItem.id, {
          status: 'completed',
          completionNotes: completionNotes.trim(),
        });
      }
      invalidateApiCache('/calendar');
      invalidateApiCache('/clients');
      invalidateApiCache('/seguimientos');
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
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm">
            {LEGEND_ITEMS.map((leg) => (
              <span
                key={leg.label}
                className="inline-flex items-center gap-2 text-slate-600"
              >
                <span className={`h-3 w-3 rounded-full shrink-0 ${leg.dot}`} />
                {leg.label}
                {leg.kind === 'meeting' && leg.dot.includes('indigo')
                  ? ` (${counts.meeting_onboarding})`
                  : leg.kind === 'meeting' && leg.dot.includes('violet')
                    ? ` (${counts.meeting_seguimiento})`
                    : leg.kind === 'meeting' && leg.dot.includes('orange')
                      ? ` (${counts.meeting_general})`
                      : leg.kind === 'client_delivery'
                        ? ` (${counts.client_delivery})`
                        : leg.kind === 'internal_delivery'
                          ? ` (${counts.internal_delivery})`
                          : leg.kind === 'next_contact'
                            ? ` (${counts.next_contact})`
                            : ''}
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
        className={`p-5 sm:p-6 ${loadingMonth ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="grid grid-cols-7 gap-1 bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="bg-slate-100 px-2 py-3 text-center text-sm font-semibold text-slate-600"
            >
              {wd}
            </div>
          ))}
          {grid.map((cell, i) => {
            if (!cell.date) {
              return (
                <div key={`empty-${i}`} className="min-h-[11rem] bg-slate-50/80" />
              );
            }
            const key = dateKey(cell.date);
            const dayItems = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                className={`min-h-[11rem] bg-white p-2 flex flex-col group ${
                  cell.isToday ? 'ring-2 ring-inset ring-indigo-400' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span
                    className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                      cell.isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      type="button"
                      title="Reunión"
                      onClick={() => openAdd('meeting', cell.date!)}
                      className="h-6 w-6 rounded text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600"
                    >
                      R
                    </button>
                    <button
                      type="button"
                      title="Entrega cliente"
                      onClick={() => openAdd('client_delivery', cell.date!)}
                      className="h-6 w-6 rounded text-xs font-medium bg-amber-500 text-white hover:bg-amber-600"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      title="Nuestra entrega"
                      onClick={() => openAdd('internal_delivery', cell.date!)}
                      className="h-6 w-6 rounded text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                      N
                    </button>
                  </div>
                </div>
                <ul className="flex-1 space-y-1 overflow-y-auto min-h-0">
                  {dayItems.map((item) => (
                    <li key={`${item.kind}-${item.id}-${item.at}`}>
                      <button
                        type="button"
                        onClick={() => openViewItem(item)}
                        className={`w-full text-left rounded-md px-2 py-1.5 text-xs leading-snug border ${calendarChipStyle(item)} ${
                          item.status === 'completed' || item.status === 'unfulfilled'
                            ? 'opacity-75 line-through'
                            : ''
                        }`}
                      >
                        <span className="block font-semibold tabular-nums">
                          {formatTime(item.at)}
                        </span>
                        <span className="block font-medium line-clamp-2 break-words">
                          {chipPrimaryLine(item)}
                        </span>
                        <span className="block opacity-90 line-clamp-2 break-words mt-0.5">
                          {chipSecondaryLine(item)}
                        </span>
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
                    <span className="block text-sm font-medium text-slate-700 mb-2">
                      Tipo de reunión
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
                        <input
                          type="radio"
                          name="meeting-scope"
                          checked={meetingForm.scope === 'client'}
                          onChange={() =>
                            setMeetingForm((f) => ({
                              ...f,
                              scope: 'client',
                              processKey:
                                processesForMeetingClient[0]?.processId ?? f.processKey,
                            }))
                          }
                        />
                        Con conjunto
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
                        <input
                          type="radio"
                          name="meeting-scope"
                          checked={meetingForm.scope === 'general'}
                          onChange={() =>
                            setMeetingForm((f) => ({ ...f, scope: 'general' }))
                          }
                        />
                        General (sin conjunto)
                      </label>
                    </div>
                  </div>
                  {meetingForm.scope === 'client' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Conjunto (cliente)
                        </label>
                        <ClientSearchPicker
                          clients={clients}
                          value={meetingForm.clientId}
                          onChange={(clientId) => {
                            const first = pickerOptions.find(
                              (p) => p.clientId === clientId,
                            );
                            setMeetingForm({
                              ...meetingForm,
                              clientId,
                              processKey: first?.processId ?? '',
                            });
                          }}
                        />
                      </div>
                      {processesForMeetingClient.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Proceso
                          </label>
                          <select
                            required
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            value={meetingForm.processKey}
                            onChange={(e) =>
                              setMeetingForm({
                                ...meetingForm,
                                processKey: e.target.value,
                              })
                            }
                          >
                            {processesForMeetingClient.map((p) => (
                              <option key={p.processId} value={p.processId}>
                                {p.templateName}
                                {p.processKind === 'onboarding' && p.currentStageName
                                  ? ` — ${p.currentStageName}`
                                  : p.processKind === 'seguimiento'
                                    ? ' — post-onboarding'
                                    : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {meetingForm.clientId &&
                        processesForMeetingClient.length === 0 && (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Este conjunto no tiene proceso de onboarding activo o
                            completado para agendar reuniones.
                          </p>
                        )}
                    </>
                  ) : (
                    <p className="text-sm text-orange-900 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      Reunión interna o con terceros, sin vínculo a un conjunto. Se
                      mostrará en <strong>naranja</strong> en el calendario.
                    </p>
                  )}
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
                      Conjunto (cliente)
                    </label>
                    <ClientSearchPicker
                      clients={clients}
                      value={deliveryForm.clientId}
                      onChange={(clientId) =>
                        setDeliveryForm({
                          ...deliveryForm,
                          clientId,
                          processId: '',
                        })
                      }
                    />
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
                  disabled={
                    saving ||
                    (addModal.kind === 'meeting' &&
                      meetingForm.scope === 'client' &&
                      !meetingForm.processKey)
                  }
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <span
              className={`inline-block text-sm font-medium px-2.5 py-1 rounded-full mb-3 ${calendarChipStyle(viewItem)}`}
            >
              {viewItem.kind === 'meeting' && viewItem.meetingSource === 'general'
                ? 'Reunión general'
                : viewItem.kind === 'meeting' && viewItem.processKind === 'seguimiento'
                  ? 'Reunión · Seguimiento'
                  : KIND_LABELS[viewItem.kind]}
            </span>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                {viewItem.kind === 'next_contact'
                  ? `Próximo contacto · ${viewItem.clientName}`
                  : viewItem.title}
              </h3>
              <span className="text-sm font-medium text-slate-500 shrink-0">
                {statusLabel(viewItem)}
              </span>
            </div>
            {viewItem.kind !== 'next_contact' &&
              viewItem.meetingSource !== 'general' && (
              <p className="text-base text-slate-600 mt-1">{viewItem.clientName}</p>
            )}
            {viewItem.meetingSource === 'general' && (
              <p className="text-base text-orange-800 mt-1">Sin conjunto asociado</p>
            )}
            {viewItem.kind === 'next_contact' && (
              <p className="text-base text-slate-700 mt-2">{viewItem.title}</p>
            )}
            <p className="text-base text-slate-500 mt-2">{formatDateTime(viewItem.at)}</p>
            {viewItem.kind === 'next_contact' &&
              viewItem.scheduledAt &&
              viewItem.scheduledAt !== viewItem.at && (
                <p className="text-sm text-rose-700 mt-1">
                  Compromiso original: {formatDateTime(viewItem.scheduledAt)}
                </p>
              )}
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
            {viewItem.unfulfilledReason && (
              <p className="text-sm text-rose-900 mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                <span className="font-medium">Incumplimiento del cliente: </span>
                {viewItem.unfulfilledReason}
              </p>
            )}

            {viewAction === 'postpone' && itemIsOpen(viewItem) && (
              <form onSubmit={handlePostponeItem} className="mt-4 space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-slate-800">
                  {viewItem.kind === 'next_contact'
                    ? 'Reprogramar próximo contacto'
                    : 'Aplazar evento'}
                </p>
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
                <p className="text-sm font-medium text-slate-800">
                  {viewItem.kind === 'next_contact'
                    ? 'Registrar contacto realizado'
                    : 'Terminar con notas'}
                </p>
                <textarea
                  required
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder={
                    viewItem.kind === 'next_contact'
                      ? 'Resumen del contacto con el cliente…'
                      : '¿Qué se hizo? Resultado, acuerdos, pendientes…'
                  }
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {viewItem.kind === 'next_contact'
                      ? 'Marcar como realizado'
                      : 'Marcar como terminada'}
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

            {viewAction === 'unfulfilled' && itemIsOpen(viewItem) && (
              <form onSubmit={handleUnfulfilledItem} className="mt-4 space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-rose-900">
                  Incumplimiento por parte del cliente
                </p>
                <p className="text-xs text-slate-600">
                  Registra por qué el cliente no entregó a tiempo o no cumplió el compromiso.
                </p>
                <textarea
                  required
                  rows={4}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm"
                  placeholder="Ej: No enviaron la base de datos; pidieron aplazar sin nueva fecha…"
                  value={unfulfilledReason}
                  onChange={(e) => setUnfulfilledReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Marcar como incumplida
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
                {viewItem.kind === 'next_contact' ? (
                  <Link
                    href={`/clientes/${viewItem.clientId}#seguimientos`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Ver ficha del cliente
                  </Link>
                ) : viewItem.meetingSource === 'general' ? null : viewItem.meetingSource === 'followup' ? (
                  <Link
                    href={`/clientes/${viewItem.clientId}#seguimientos`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Ver en seguimientos
                  </Link>
                ) : (
                  viewItem.processId && (
                    <Link
                      href={`/procesos/${viewItem.processId}`}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Ver etapa del proceso
                    </Link>
                  )
                )}
                {itemIsOpen(viewItem) && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setViewAction('postpone')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {viewItem.kind === 'next_contact' ? 'Reprogramar' : 'Aplazar'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setViewAction('complete')}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      {viewItem.kind === 'next_contact' ? 'Realizado' : 'Terminar'}
                    </button>
                    {viewItem.kind === 'client_delivery' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setViewAction('unfulfilled')}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Incumplida
                      </button>
                    )}
                    {viewItem.kind !== 'next_contact' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleCancelItem}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                    {viewItem.kind === 'next_contact' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleCancelItem}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Quitar del calendario
                      </button>
                    )}
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
