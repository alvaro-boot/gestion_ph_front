import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-500">Cargando…</div>}>
      <LoginForm />
    </Suspense>
  );
}
