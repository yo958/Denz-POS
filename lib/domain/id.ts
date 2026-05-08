// Tiny ID generator. Not cryptographically secure — IDs are local-only.
export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
