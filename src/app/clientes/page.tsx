import { ClientsPageClient } from './ClientsPageClient';
import { api } from '@/lib/api';

export default async function ClientesPage() {
  const [clients, templates] = await Promise.all([
    api.clients.list().catch(() => []),
    api.templates.list().catch(() => []),
  ]);
  return <ClientsPageClient initialClients={clients} templates={templates} />;
}
