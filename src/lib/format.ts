import type { ClientFollowUpSummary } from './types';

/** Valor para input datetime-local (permite fechas pasadas) */
export function toDatetimeLocalValue(
  value: string | Date | null | undefined,
): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToIso(local: string): string {
  return new Date(local).toISOString();
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function stageDurationLabel(stage: {
  durationDays?: number | null;
  minDurationDays?: number | null;
  maxDurationDays?: number | null;
  formDeadlineDays?: number | null;
}) {
  if (stage.formDeadlineDays) {
    return `${stage.formDeadlineDays} días calendario (formulario)`;
  }
  if (stage.durationDays) return `${stage.durationDays} días`;
  if (stage.minDurationDays && stage.maxDurationDays) {
    return `${stage.minDurationDays}–${stage.maxDurationDays} días`;
  }
  if (stage.minDurationDays) return `mín. ${stage.minDurationDays} días`;
  return 'Sin plazo definido';
}

export const stageTypeLabels: Record<string, string> = {
  meeting: 'Reunión',
  form: 'Formulario',
  task: 'Tarea',
  general: 'General',
};

export const followUpTypeLabels: Record<string, string> = {
  call: 'Llamada',
  meeting: 'Reunión',
  email: 'Correo',
  visit: 'Visita',
  note: 'Nota',
  other: 'Otro',
};

export function formatDaysSinceFollowUp(days: number | null): string {
  if (days === null) return 'Sin seguimientos';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}

export type FollowUpUrgency = 'ok' | 'warning' | 'critical' | 'muted';

export function followUpUrgency(
  summary: ClientFollowUpSummary | undefined,
  hasProcess: boolean,
): FollowUpUrgency {
  if (!hasProcess) return 'muted';
  if (!summary || summary.totalFollowUps === 0) return 'critical';
  if (summary.nextActionOverdue) return 'critical';
  const days = summary.daysSinceLastFollowUp;
  if (days === null) return 'critical';
  if (days <= 7) return 'ok';
  if (days <= 30) return 'warning';
  return 'critical';
}

export const followUpUrgencyStyles: Record<
  FollowUpUrgency,
  string
> = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
  muted: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completada',
  blocked: 'Bloqueada',
  skipped: 'Omitida',
  active: 'Activo',
  paused: 'Pausado',
  cancelled: 'Cancelado',
};
