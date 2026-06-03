import { Suspense } from 'react';
import { api } from '@/lib/api';
import { ConjuntoReportPageClient } from '@/components/ConjuntoReportPageClient';

export default async function ConjuntosPage() {
  const clients = await api.clients.conjuntoPicker();

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 animate-pulse">
          Cargando…
        </div>
      }
    >
      <ConjuntoReportPageClient initialClients={clients} />
    </Suspense>
  );
}
