'use client';

const CLOSURE_MARKERS = [
  { tag: '[Contacto realizado]', label: 'Contacto realizado', className: 'bg-sky-50 border-sky-200 text-sky-900' },
  { tag: '[Realizada]', label: 'Reunión realizada', className: 'bg-violet-50 border-violet-200 text-violet-900' },
] as const;

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t-${i}`}>{part}</span>;
  });
}

function renderBlock(text: string, index: number) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const isList = lines.every(
    (l) => /^(\d+[\.\)]\s|[-•*]\s)/.test(l) || /^\*\*\d+/.test(l),
  );

  if (isList && lines.length > 1) {
    return (
      <ol key={index} className="list-decimal list-outside ml-5 space-y-2 text-sm text-slate-700">
        {lines.map((line, li) => {
          const cleaned = line
            .replace(/^\*\*(\d+[\.\)]?\s*)\*\*\s*/i, '$1 ')
            .replace(/^(\d+[\.\)]\s*)/, '')
            .replace(/^[-•*]\s*/, '')
            .trim();
          return (
            <li key={li} className="pl-1 leading-relaxed">
              {renderInline(cleaned, `li-${index}-${li}`)}
            </li>
          );
        })}
      </ol>
    );
  }

  if (lines.length === 1) {
    return (
      <p key={index} className="text-sm text-slate-700 leading-relaxed">
        {renderInline(lines[0], `p-${index}`)}
      </p>
    );
  }

  return (
    <div key={index} className="space-y-2">
      {lines.map((line, li) => (
        <p key={li} className="text-sm text-slate-700 leading-relaxed">
          {renderInline(line, `ln-${index}-${li}`)}
        </p>
      ))}
    </div>
  );
}

function splitDescription(raw: string) {
  let body = raw.trim();
  const closures: { label: string; text: string; className: string }[] = [];

  for (const { tag, label, className } of CLOSURE_MARKERS) {
    const idx = body.indexOf(tag);
    if (idx !== -1) {
      const after = body.slice(idx + tag.length).trim();
      if (after) closures.push({ label, text: after.replace(/^\s*:\s*/, ''), className });
      body = body.slice(0, idx).trim();
    }
  }

  const normalized = body
    .replace(/\s*(\*\*\d+[\.\)]\s*)/g, '\n\n$1')
    .replace(/\s+(\d+[\.\)]\s+(?=[A-Za-zÁÉÍÓÚáéíóúÑñ]))/g, '\n\n$1');

  const blocks = normalized.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  return { blocks, closures };
}

export function FollowUpDescription({ text }: { text: string }) {
  const { blocks, closures } = splitDescription(text);

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-slate-50/90 border border-slate-100 px-3 py-3">
      {blocks.length > 0 ? (
        blocks.map((block, i) => renderBlock(block, i))
      ) : (
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {text}
        </p>
      )}
      {closures.map((c, i) => (
        <div
          key={i}
          className={`rounded-md border px-3 py-2 text-sm ${c.className}`}
        >
          <span className="font-semibold block text-xs uppercase tracking-wide opacity-80 mb-1">
            {c.label}
          </span>
          <p className="leading-relaxed whitespace-pre-wrap">{c.text}</p>
        </div>
      ))}
    </div>
  );
}
