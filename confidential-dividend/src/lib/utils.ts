export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function padTo32Bytes(input: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = new TextEncoder().encode(input);
  bytes.set(encoded.slice(0, 32));
  return bytes;
}

export async function deriveKey(masterKey: Uint8Array, purpose: string): Promise<Uint8Array> {
  const data = new Uint8Array(masterKey.length + purpose.length);
  data.set(masterKey);
  data.set(new TextEncoder().encode(purpose), masterKey.length);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

export async function deriveKeyFromPassword(password: string, salt: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return new Uint8Array(derived);
}

export function generateRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes));
}

export function validatePassword(password: string): string | null {
  if (password.length < 16) return 'Password must be at least 16 characters';
  const types = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*(),.?":{}|<>+/=\-_\[\]]/];
  const typeCount = types.filter((t) => t.test(password)).length;
  if (typeCount < 3) return 'Use at least 3 of: uppercase, lowercase, digits, special chars';
  return null;
}
