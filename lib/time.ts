/**
 * Fora do corpo de componentes de propósito — a regra de pureza do
 * react-hooks reclama de Date.now() direto ali, mesmo em Server Components.
 */
export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function daysAgoIso(days: number): string {
  return hoursAgoIso(days * 24);
}
