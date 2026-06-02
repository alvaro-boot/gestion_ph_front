/** Proceso con plantilla obsoleta «Seguimiento» (no es el panel de bitácora). */
export function isSeguimientoProcess(process: {
  processTemplate?: { name?: string } | null;
}): boolean {
  return (
    process.processTemplate?.name?.trim().toLowerCase() === 'seguimiento'
  );
}

export function onboardingProcesses<T extends { processTemplate?: { name?: string } | null }>(
  processes: T[] | undefined,
): T[] {
  return (processes ?? []).filter((p) => !isSeguimientoProcess(p));
}
