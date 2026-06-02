import { notFound, redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { isSeguimientoProcess, onboardingProcesses } from '@/lib/process-utils';
import { ProcessDetailClient } from './ProcessDetailClient';

export default async function ProcesoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let process;
  try {
    process = await api.processes.get(id);
  } catch {
    notFound();
  }

  if (isSeguimientoProcess(process) && process.client?.id) {
    redirect(`/clientes/${process.client.id}#seguimientos`);
  }

  let followUps: import('@/lib/types').FollowUp[] = [];
  let clientProcesses: import('@/lib/types').ClientProcess[] = [];

  if (
    process.client?.id &&
    (process.status === 'completed' || process.status === 'active')
  ) {
    try {
      const client = await api.clients.get(process.client.id);
      followUps = client.followUps ?? [];
      clientProcesses = onboardingProcesses(client.processes);
    } catch {
      /* seguimientos opcionales */
    }
  }

  return (
    <ProcessDetailClient
      initialProcess={process}
      followUps={followUps}
      clientProcesses={clientProcesses}
    />
  );
}
