'use client';

import { toDatetimeLocalValue } from '@/lib/format';

export interface StageDateValues {
  startedAt: string;
  dueDate: string;
  completedAt: string;
}

export function StageDateFields({
  values,
  onChange,
  showCompleted = false,
  disabled = false,
  variant = 'default',
}: {
  values: StageDateValues;
  onChange: (values: StageDateValues) => void;
  showCompleted?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'compact';
}) {
  const fieldClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50';

  const labels =
    variant === 'compact'
      ? {
          started: 'Empezó el',
          due: 'Plazo límite',
          completed: 'Terminó el',
        }
      : {
          started: '¿Cuándo empezó esta etapa?',
          due: '¿Cuál es el plazo límite? (opcional)',
          completed: '¿Cuándo terminó?',
        };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {labels.started}
        </label>
        <input
          type="datetime-local"
          disabled={disabled}
          className={fieldClass}
          value={values.startedAt}
          onChange={(e) => onChange({ ...values, startedAt: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {labels.due}
        </label>
        <input
          type="datetime-local"
          disabled={disabled}
          className={fieldClass}
          value={values.dueDate}
          onChange={(e) => onChange({ ...values, dueDate: e.target.value })}
        />
      </div>
      {showCompleted && (
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {labels.completed}
          </label>
          <input
            type="datetime-local"
            disabled={disabled}
            className={fieldClass}
            value={values.completedAt}
            onChange={(e) => onChange({ ...values, completedAt: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export function stageToDateValues(stage: {
  startedAt: string | null;
  dueDate: string | null;
  completedAt?: string | null;
}): StageDateValues {
  return {
    startedAt: toDatetimeLocalValue(stage.startedAt),
    dueDate: toDatetimeLocalValue(stage.dueDate),
    completedAt: toDatetimeLocalValue(stage.completedAt ?? null),
  };
}

export function buildDatePayload(values: StageDateValues) {
  const payload: {
    startedAt?: string;
    dueDate?: string;
    completedAt?: string;
  } = {};
  if (values.startedAt) {
    payload.startedAt = new Date(values.startedAt).toISOString();
  }
  if (values.dueDate) {
    payload.dueDate = new Date(values.dueDate).toISOString();
  }
  if (values.completedAt) {
    payload.completedAt = new Date(values.completedAt).toISOString();
  }
  return payload;
}
