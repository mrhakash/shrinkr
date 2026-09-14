export function nowIso(): string {
  return new Date().toISOString();
}

export function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
