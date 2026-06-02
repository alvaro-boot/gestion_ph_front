import { statusLabels } from '@/lib/format';

const styles: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  blocked: 'bg-red-100 text-red-800',
  skipped: 'bg-slate-100 text-slate-500',
  active: 'bg-indigo-100 text-indigo-800',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
