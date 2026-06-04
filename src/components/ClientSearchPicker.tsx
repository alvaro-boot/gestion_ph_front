'use client';

import { useMemo, useState } from 'react';

export type ClientSearchOption = {
  id: string;
  name: string;
  company?: string | null;
};

function label(c: ClientSearchOption) {
  return c.company ? `${c.name} — ${c.company}` : c.name;
}

export function ClientSearchPicker({
  clients,
  value,
  onChange,
  required = true,
  placeholder = 'Buscar por nombre o empresa…',
  emptyLabel = '— Elija un conjunto —',
}: {
  clients: ClientSearchOption[];
  value: string;
  onChange: (clientId: string) => void;
  required?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company?.toLowerCase().includes(q) ?? false),
    );
  }, [clients, query]);

  const selected = clients.find((c) => c.id === value);

  return (
    <div className="space-y-2">
      <input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <select
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery('');
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
      >
        <option value="">{emptyLabel}</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {label(c)}
          </option>
        ))}
      </select>
      {query.trim() && filtered.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {filtered.slice(0, 12).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setQuery('');
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${
                  c.id === value ? 'bg-indigo-50 font-medium text-indigo-900' : 'text-slate-800'
                }`}
              >
                {label(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && !query.trim() && (
        <p className="text-xs text-slate-500">
          Seleccionado: <span className="font-medium text-slate-700">{label(selected)}</span>
        </p>
      )}
    </div>
  );
}
