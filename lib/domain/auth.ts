// ─────────────────────────────────────────────────────────────────
// PIN hashing — Web Crypto SubtleCrypto.digest('SHA-256').
// Soft auth: this protects a shared device, not a network.
// ─────────────────────────────────────────────────────────────────

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${pin}${salt}`);
}

export function newSalt(): string {
  // 8 bytes is enough for a soft local lock.
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  const h = await hashPin(pin, salt);
  // Constant-time compare (length-checked).
  if (h.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
