import type { ReactNode } from 'react';
import type { StageProgress } from '@/lib/types';
import { formatDate, stageDurationLabel, stageTypeLabels } from '@/lib/format';
import { StatusBadge } from './StatusBadge';

export function StageTimeline({
  stages,
  editingStageId,
  onEditStage,
  onCancelEdit,
  editContent,
}: {
  stages: StageProgress[];
  editingStageId?: string | null;
  onEditStage?: (stage: StageProgress) => void;
  onCancelEdit?: () => void;
  editContent?: ReactNode;
}) {
  return (
    <ol className="relative space-y-0 border-l-2 border-slate-200 ml-3">
      {stages.map((sp, i) => {
        const isActive = sp.status === 'in_progress';
        const isDone = sp.status === 'completed';
        const isEditing = editingStageId === sp.id;

        return (
          <li key={sp.id} className="relative pb-8 pl-6 last:pb-0">
            <span
              className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white ${
                isDone
                  ? 'bg-emerald-500'
                  : isActive
                    ? 'bg-indigo-500 ring-4 ring-indigo-100'
                    : 'bg-slate-300'
              }`}
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {i + 1}. {sp.stageTemplate.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stageTypeLabels[sp.stageTemplate.stageType]} ·{' '}
                  {stageDurationLabel(sp.stageTemplate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={sp.status} />
                {onEditStage && (isDone || isActive) && (
                  <button
                    type="button"
                    onClick={() => (isEditing ? onCancelEdit?.() : onEditStage(sp))}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {isEditing ? 'Cerrar' : 'Corregir fechas'}
                  </button>
                )}
              </div>
            </div>
            {sp.stageTemplate.description && (
              <p className="mt-1 text-sm text-slate-600">
                {sp.stageTemplate.description}
              </p>
            )}
            {sp.stageTemplate.formUrl && (
              <a
                href={sp.stageTemplate.formUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-indigo-600 hover:underline"
              >
                Abrir formulario
              </a>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              {sp.startedAt ? (
                <span>Inicio: {formatDate(sp.startedAt)}</span>
              ) : isDone || isActive ? (
                <span className="text-slate-400 italic">Sin fecha de inicio</span>
              ) : null}
              {sp.dueDate && (
                <span
                  className={
                    sp.status === 'in_progress' &&
                    new Date(sp.dueDate) < new Date()
                      ? 'text-red-600 font-medium'
                      : ''
                  }
                >
                  Vence: {formatDate(sp.dueDate)}
                </span>
              )}
              {sp.completedAt ? (
                <span>Fin: {formatDate(sp.completedAt)}</span>
              ) : isDone ? (
                <span className="text-slate-400 italic">Sin fecha de cierre</span>
              ) : null}
            </div>
            {sp.notes && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                {sp.notes}
              </p>
            )}
            {isEditing && editContent}
          </li>
        );
      })}
    </ol>
  );
}
