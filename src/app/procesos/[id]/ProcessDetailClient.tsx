'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ClientProcess, FollowUp, StageProgress } from '@/lib/types';
import { SeguimientosPanel } from '@/components/SeguimientosPanel';
import { api, invalidateApiCache } from '@/lib/api';
import { StageTimeline } from '@/components/StageTimeline';
import { StatusBadge } from '@/components/StatusBadge';
import {
  StageDateFields,
  buildDatePayload,
  stageToDateValues,
} from '@/components/StageDateFields';
import { formatDate, formatDateTime } from '@/lib/format';

export function ProcessDetailClient({
  initialProcess,
  followUps = [],
  clientProcesses = [],
}: {
  initialProcess: ClientProcess;
  followUps?: FollowUp[];
  clientProcesses?: ClientProcess[];
}) {
  const router = useRouter();
  const [process, setProcess] = useState(initialProcess);
  const [loading, setLoading] = useState(false);
  const [showPlazos, setShowPlazos] = useState(false);
  const [showNextStart, setShowNextStart] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: '', scheduledAt: '' });
  const [notes, setNotes] = useState('');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  const current = process.stageProgresses.find((s) => s.status === 'in_progress');

  const [stageDates, setStageDates] = useState(() =>
    current ? stageToDateValues(current) : { startedAt: '', dueDate: '', completedAt: '' },
  );
  const [finishDate, setFinishDate] = useState('');
  const [showFinishDate, setShowFinishDate] = useState(false);
  const [nextStartDate, setNextStartDate] = useState('');
  const [showSetStage, setShowSetStage] = useState(false);
  const [setStageNumber, setSetStageNumber] = useState(1);

  function initDatesForStage(stage: StageProgress) {
    setStageDates(stageToDateValues(stage));
    setFinishDate('');
    setShowFinishDate(false);
    setNextStartDate('');
    setShowNextStart(false);
  }

  async function advance(withoutDates = false) {
    if (!current) return;
    if (!withoutDates && showFinishDate && !finishDate) {
      alert('Indica la fecha o usa "Terminar sin fecha".');
      return;
    }
    setLoading(true);
    try {
      const options: { completedAt?: string; nextStartedAt?: string } = {};
      if (!withoutDates && showFinishDate && finishDate) {
        options.completedAt = new Date(finishDate).toISOString();
      }
      if (showNextStart && nextStartDate) {
        options.nextStartedAt = new Date(nextStartDate).toISOString();
      }
      const updated = await api.processes.advanceStage(current.id, options);
      setProcess(updated);
      const next = updated.stageProgresses.find((s) => s.status === 'in_progress');
      if (next) initDatesForStage(next);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function applyCurrentStage() {
    setLoading(true);
    try {
      const updated = await api.processes.setCurrentStage(process.id, setStageNumber);
      setProcess(updated);
      setShowSetStage(false);
      const next = updated.stageProgresses.find((s) => s.status === 'in_progress');
      if (next) initDatesForStage(next);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function savePlazos() {
    if (!current) return;
    setLoading(true);
    try {
      const updated = await api.processes.updateStage(
        current.id,
        buildDatePayload(stageDates),
      );
      setProcess(updated);
      setShowPlazos(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function saveStageDates(stageId: string, includeCompleted = false) {
    setLoading(true);
    try {
      const payload = buildDatePayload(
        includeCompleted ? stageDates : { ...stageDates, completedAt: '' },
      );
      const updated = await api.processes.updateStage(stageId, payload);
      setProcess(updated);
      setEditingStageId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes() {
    if (!current) return;
    setLoading(true);
    try {
      await api.processes.updateStage(current.id, { notes });
      setProcess((p) => ({
        ...p,
        stageProgresses: p.stageProgresses.map((s) =>
          s.id === current.id ? { ...s, notes } : s,
        ),
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function scheduleMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setLoading(true);
    try {
      await api.calendar.createMeeting({
        processId: process.id,
        stageProgressId: current.id,
        title: meetingForm.title,
        scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
      });
      invalidateApiCache('/calendar');
      invalidateApiCache('/client-processes');
      setMeetingForm({ title: '', scheduledAt: '' });
      setShowMeetingForm(false);
      const updated = await api.processes.get(process.id);
      setProcess(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  const nextStageName = current
    ? process.stageProgresses.find(
        (s) =>
          s.stageTemplate.orderIndex === current.stageTemplate.orderIndex + 1,
      )?.stageTemplate.name
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Volver al panel
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            {process.client?.name ?? 'Cliente'}
          </h1>
          <StatusBadge status={process.status} />
        </div>
        <p className="text-slate-600">{process.processTemplate.name}</p>
        {process.client && (
          <Link
            href={`/clientes/${process.client.id}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Ver ficha del cliente
          </Link>
        )}
      </div>

      {process.status === 'completed' && process.client && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="font-semibold text-emerald-900">Onboarding completado</p>
          <p className="text-sm text-emerald-800 mt-1">
            Puedes seguir registrando llamadas, visitas y notas de control con el cliente.
          </p>
        </div>
      )}

      {process.client &&
        (process.status === 'active' || process.status === 'completed') && (
          <SeguimientosPanel
            clientId={process.client.id}
            clientName={process.client.name}
            initialItems={followUps}
            processes={clientProcesses.length ? clientProcesses : [process]}
            defaultProcessId={process.id}
            currentStageName={
              process.status === 'active' ? current?.stageTemplate.name : undefined
            }
          />
        )}

      {process.status === 'active' && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              const idx = process.stageProgresses.findIndex(
                (s) => s.status === 'in_progress',
              );
              setSetStageNumber(idx >= 0 ? idx + 1 : 1);
              setShowSetStage(!showSetStage);
            }}
            className="text-sm font-medium text-amber-900 hover:underline"
          >
            {showSetStage ? '▼' : '▶'} El cliente ya estaba en otra etapa (sin fechas)
          </button>
          <p className="text-xs text-amber-800 mt-1">
            Marca etapas 1, 2 o 3 como hechas aunque no tengas el día exacto.
          </p>
          {showSetStage && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Etapa actual
                </label>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={setStageNumber}
                  onChange={(e) => setSetStageNumber(Number(e.target.value))}
                >
                  {process.stageProgresses.map((sp, i) => (
                    <option key={sp.id} value={i + 1}>
                      {i + 1}. {sp.stageTemplate.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={applyCurrentStage}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}

      {current && process.status === 'active' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Encabezado etapa */}
          <div className="bg-indigo-600 px-5 py-4 text-white">
            <p className="text-sm text-indigo-100">Ahora estás en</p>
            <p className="text-xl font-semibold">{current.stageTemplate.name}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-indigo-100">
              {current.startedAt && (
                <span>Empezó: {formatDate(current.startedAt)}</span>
              )}
              {current.dueDate ? (
                <span>Plazo: {formatDate(current.dueDate)}</span>
              ) : (
                <span>Sin plazo definido</span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Seguimiento en etapa */}
            <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Seguimiento en esta etapa
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 mb-2">
                Llamadas, visitas o notas mientras avanzas el onboarding (no solo al final).
              </p>
              <a
                href="#seguimientos"
                className="text-sm text-indigo-600 font-medium hover:underline"
              >
                + Registrar seguimiento →
              </a>
            </section>

            {/* 1. Notas */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                1. ¿Qué pasó en esta etapa?
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Ejemplo: reunión cancelada, pendiente de respuesta del cliente, etc.
              </p>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Escribe aquí lo que ocurrió..."
                value={notes || current.notes || ''}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="button"
                onClick={saveNotes}
                disabled={loading}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Guardar comentario
              </button>
            </section>

            {/* 2. Reuniones */}
            {(current.stageTemplate.stageType === 'meeting' ||
              (current.meetings && current.meetings.length > 0)) && (
              <section className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  2. Reuniones de esta etapa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  Registra cada cita o llamada, aunque haya sido hace días.
                </p>

                {current.meetings && current.meetings.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {current.meetings.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span aria-hidden>📅</span>
                        <span>
                          <strong>{m.title}</strong>
                          <br />
                          <span className="text-slate-500">
                            {formatDateTime(m.scheduledAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {!showMeetingForm ? (
                  <button
                    type="button"
                    onClick={() => setShowMeetingForm(true)}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    + Agregar reunión
                  </button>
                ) : (
                  <form
                    onSubmit={scheduleMeeting}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2"
                  >
                    <input
                      required
                      placeholder="Nombre de la reunión"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={meetingForm.title}
                      onChange={(e) =>
                        setMeetingForm({ ...meetingForm, title: e.target.value })
                      }
                    />
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">
                        Fecha y hora de la reunión
                      </label>
                      <input
                        required
                        type="datetime-local"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={meetingForm.scheduledAt}
                        onChange={(e) =>
                          setMeetingForm({
                            ...meetingForm,
                            scheduledAt: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Guardar reunión
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMeetingForm(false)}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {/* 3. Ajustar plazos (colapsado) */}
            <section className="border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setShowPlazos(!showPlazos)}
                className="text-sm font-semibold text-slate-900 flex items-center gap-2"
              >
                <span>{showPlazos ? '▼' : '▶'}</span>
                Ajustar fechas de inicio o plazo (opcional)
              </button>
              <p className="text-xs text-slate-500 mt-1 ml-5">
                Solo si necesitas corregir el historial o cargar datos de antes.
              </p>
              {showPlazos && (
                <div className="mt-3 ml-5 rounded-lg border border-slate-200 p-4">
                  <StageDateFields
                    values={stageDates}
                    onChange={setStageDates}
                    disabled={loading}
                    variant="compact"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={savePlazos}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Guardar plazos
                  </button>
                </div>
              )}
            </section>

            {/* 4. Terminar etapa */}
            <section className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                {current.stageTemplate.stageType === 'meeting' ||
                (current.meetings && current.meetings.length > 0)
                  ? '3'
                  : '2'}
                . Terminar esta etapa
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Cuando esta fase quedó lista, pasa a la siguiente.
                {nextStageName && (
                  <>
                    {' '}
                    Siguiente: <strong>{nextStageName}</strong>
                  </>
                )}
              </p>

              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => advance(true)}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Terminar sin fecha →
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowFinishDate(!showFinishDate)}
                    className="rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm text-emerald-800 hover:bg-emerald-50"
                  >
                    {showFinishDate ? 'Ocultar fechas' : 'Registrar con fecha'}
                  </button>
                </div>

                {showFinishDate && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1">
                        Fecha en que terminó esta etapa
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        value={finishDate}
                        onChange={(e) => setFinishDate(e.target.value)}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showNextStart}
                        onChange={(e) => setShowNextStart(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      La siguiente etapa empezó en otra fecha
                    </label>
                    {showNextStart && (
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Inicio de la siguiente etapa
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                          value={nextStartDate}
                          onChange={(e) => setNextStartDate(e.target.value)}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => advance(false)}
                      className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      Terminar con estas fechas →
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1">Historial del proceso</h2>
        <p className="text-xs text-slate-500 mb-4">
          Todas las etapas. En las ya hechas puedes corregir fechas.
        </p>
        <StageTimeline
          stages={process.stageProgresses}
          editingStageId={editingStageId}
          onEditStage={(stage) => {
            setEditingStageId(stage.id);
            initDatesForStage(stage);
          }}
          onCancelEdit={() => setEditingStageId(null)}
          editContent={
            editingStageId ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600 mb-2">Corregir fechas del historial</p>
                <StageDateFields
                  values={stageDates}
                  onChange={setStageDates}
                  showCompleted
                  disabled={loading}
                  variant="compact"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => saveStageDates(editingStageId, true)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStageId(null)}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null
          }
        />
      </section>
    </div>
  );
}
