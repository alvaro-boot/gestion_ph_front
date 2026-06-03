'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuth, getStoredUser, getToken } from '@/lib/auth';
import { useEffect, useState } from 'react';

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setUserName(user?.name ?? null);
    setUserRole(user?.role ?? null);
  }, [pathname]);

  if (pathname === '/login') return null;

  const isConjuntosPublic =
    pathname === '/conjuntos' || pathname.startsWith('/conjuntos/');
  const loggedIn = !!getToken();

  if (isConjuntosPublic && !loggedIn) {
    return (
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/conjuntos"
            className="flex items-center gap-2 font-semibold text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
              G
            </span>
            Gestion PH · Reporte conjuntos
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Acceso equipo interno
          </Link>
        </div>
      </header>
    );
  }

  const baseLinks = [
    { href: '/', label: 'Panel' },
    { href: '/conjuntos', label: 'Reporte conjuntos' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/plantillas', label: 'Plantillas' },
  ];
  const links =
    userRole === 'admin'
      ? [...baseLinks, { href: '/usuarios', label: 'Usuarios' }]
      : baseLinks;

  function logout() {
    clearAuth();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white">
            G
          </span>
          Gestion PH
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1">
            {links.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
            {userName && (
              <span className="hidden text-sm text-slate-600 sm:inline">{userName}</span>
            )}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
