import type { ClientFollowUpSummary } from '@/lib/types';
import {
  followUpUrgency,
  followUpUrgencyStyles,
  formatDaysSinceFollowUp,
  formatDate,
} from '@/lib/format';

export function FollowUpStatusBadge({
  summary,
  hasProcess,
}: {
  summary?: ClientFollowUpSummary;
  hasProcess: boolean;
}) {
  if (!hasProcess) {
    return (
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${followUpUrgencyStyles.muted}`}
      >
        Sin proceso
      </span>
    );
  }

  const urgency = followUpUrgency(summary, true);
  const label = formatDaysSinceFollowUp(summary?.daysSinceLastFollowUp ?? null);

  return (
    <div className="space-y-0.5">
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${followUpUrgencyStyles[urgency]}`}
      >
        {label}
      </span>
      {summary?.nextActionAt && (
        <p
          className={`text-[10px] ${
            summary.nextActionOverdue ? 'text-red-600 font-medium' : 'text-slate-500'
          }`}
        >
          {summary.nextActionOverdue ? 'Venció' : 'Próximo'}:{' '}
          {formatDate(summary.nextActionAt)}
        </p>
      )}
    </div>
  );
}
