'use client';

const CLOSURE_MARKERS = ['[Contacto realizado]', '[Realizada]'] as const;

/** Quita notas de cierre pegadas al mismo registro (legacy); cada cierre debe ser otro seguimiento. */
export function stripClosureMarkers(raw: string): string {
  let body = raw.trim();
  for (const tag of CLOSURE_MARKERS) {
    const idx = body.indexOf(tag);
    if (idx !== -1) body = body.slice(0, idx).trim();
  }
  return body;
}

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

  const isList =
    lines.length > 1 &&
    lines.every((l) => /^(\d+[\.\)]\s|[-•*]\s)/.test(l) || /^\*\*\d+/.test(l));

  if (isList) {
    return (
      <ol
        key={index}
        className="list-decimal list-outside ml-5 space-y-2 leading-relaxed"
      >
        {lines.map((line, li) => {
          const cleaned = line
            .replace(/^\*\*(\d+[\.\)]?\s*)\*\*\s*/i, '$1 ')
            .replace(/^(\d+[\.\)]\s*)/, '')
            .replace(/^[-•*]\s*/, '')
            .trim();
          return (
            <li key={li} className="pl-1">
              {renderInline(cleaned, `li-${index}-${li}`)}
            </li>
          );
        })}
      </ol>
    );
  }

  if (lines.length === 1) {
    return (
      <p key={index} className="leading-relaxed">
        {renderInline(lines[0], `p-${index}`)}
      </p>
    );
  }

  return (
    <div key={index} className="space-y-2">
      {lines.map((line, li) => (
        <p key={li} className="leading-relaxed">
          {renderInline(line, `ln-${index}-${li}`)}
        </p>
      ))}
    </div>
  );
}

function splitBody(raw: string) {
  const body = stripClosureMarkers(raw);
  const normalized = body
    .replace(/\s*(\*\*\d+[\.\)]\s*)/g, '\n\n$1')
    .replace(/\s+(\d+[\.\)]\s+(?=[A-Za-zÁÉÍÓÚáéíóúÑñ]))/g, '\n\n$1');

  return normalized.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
}

export function FollowUpDescription({ text }: { text: string }) {
  const bodyOnly = stripClosureMarkers(text);
  if (!bodyOnly) return null;

  const blocks = splitBody(bodyOnly);

  return (
    <div className="mt-3 text-sm text-slate-700 space-y-3">
      {blocks.length > 0 ? (
        blocks.map((block, i) => renderBlock(block, i))
      ) : (
        <p className="leading-relaxed whitespace-pre-wrap">{bodyOnly}</p>
      )}
    </div>
  );
}
