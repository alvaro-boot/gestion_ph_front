import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { ClientDetailClient } from '@/components/ClientDetailClient';

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let client;
  try {
    client = await api.clients.get(id);
  } catch {
    notFound();
  }

  return <ClientDetailClient initialClient={client} />;
}
