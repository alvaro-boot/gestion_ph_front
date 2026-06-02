'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { getStoredUser } from '@/lib/auth';

export default function UsuariosPage() {
  const router = useRouter();
  const storedUser = getStoredUser();
  const isAdmin = storedUser?.role === 'admin';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: 'user' | 'admin';
    isActive: boolean;
  }>({
    name: '',
    email: '',
    password: '',
    role: 'user',
    isActive: true,
  });

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    api.users
      .list()
      .then((res) => setUsers(res))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;

    const ok = window.confirm(
      '¿Crear este usuario? La cuenta quedará habilitada según el campo “Activo”.',
    );
    if (!ok) return;

    setSubmitLoading(true);
    try {
      const created = await api.users.create(form);
      setUsers((prev) => [created, ...prev]);
      setForm((prev) => ({
        ...prev,
        name: '',
        email: '',
        password: '',
        role: 'user',
        isActive: true,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleToggleActive(user: User) {
    const nextState = !user.isActive;
    const action = nextState ? 'activar' : 'desactivar';
    const ok = window.confirm(
      `¿Seguro que deseas ${action} a ${user.name} (${user.email})?`,
    );
    if (!ok) return;

    setStatusLoadingId(user.id);
    try {
      const updated = await api.users.setActive(user.id, nextState);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado');
    } finally {
      setStatusLoadingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-2 text-sm">
          Solo el administrador puede crear y gestionar usuarios.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 border border-red-200"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Crea más usuarios para permitir acceso al sistema.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Crear usuario</h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-700">Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-700">Email</span>
              <input
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))}
                required
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-700">Contraseña</span>
              <input
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))}
                required
                type="password"
                minLength={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-700">Rol</span>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    role: e.target.value as 'user' | 'admin',
                  }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Activo (puede iniciar sesión)
          </label>

          <button
            type="submit"
            disabled={submitLoading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitLoading ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Listado</h2>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              api.users
                .list()
                .then((res) => setUsers(res))
                .catch(() => setUsers([]))
                .finally(() => setLoading(false));
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {users.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No hay usuarios.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 font-medium text-slate-700">Nombre</th>
                  <th className="px-2 py-2 font-medium text-slate-700">Email</th>
                  <th className="px-2 py-2 font-medium text-slate-700">Rol</th>
                  <th className="px-2 py-2 font-medium text-slate-700">Activo</th>
                  <th className="px-2 py-2 font-medium text-slate-700 text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-2 py-2">{u.name}</td>
                    <td className="px-2 py-2 text-slate-600">{u.email}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          u.role === 'admin'
                            ? 'rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {u.isActive ? (
                        <span className="text-xs font-medium text-emerald-700">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        disabled={statusLoadingId === u.id}
                        onClick={() => handleToggleActive(u)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium border disabled:opacity-50 ${
                          u.isActive
                            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {statusLoadingId === u.id
                          ? 'Guardando...'
                          : u.isActive
                            ? 'Desactivar'
                            : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

