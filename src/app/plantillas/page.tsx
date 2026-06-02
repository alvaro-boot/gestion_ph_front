import { api } from '@/lib/api';
import { stageDurationLabel, stageTypeLabels } from '@/lib/format';

export default async function PlantillasPage() {
  const templates = await api.templates.list().catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plantillas de proceso</h1>
        <p className="text-slate-600">
          Define las etapas, plazos y tipos de actividad para cada flujo de trabajo.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay plantillas. El backend crea una de ejemplo al iniciar.
        </p>
      ) : (
        <div className="space-y-6">
          {templates.map((t) => (
            <article
              key={t.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {t.name}
                    {t.isDefault && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Por defecto
                      </span>
                    )}
                  </h2>
                  {t.description && (
                    <p className="mt-1 text-sm text-slate-600">{t.description}</p>
                  )}
                </div>
              </div>

              <ol className="mt-4 space-y-2">
                {[...(t.stages ?? [])]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((s, i) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {i + 1}. {s.name}
                      </span>
                      <span className="text-slate-500">
                        {stageTypeLabels[s.stageType]}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">
                        {stageDurationLabel(s)}
                      </span>
                    </li>
                  ))}
              </ol>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Para crear o editar plantillas vía API: POST/PATCH{' '}
        <code className="rounded bg-slate-100 px-1">/api/process-templates</code>
      </p>
    </div>
  );
}
