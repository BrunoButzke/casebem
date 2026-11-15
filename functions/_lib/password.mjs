export const PBKDF2_ITERATIONS = 10000;

function bytesToB64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function randomSaltB64() {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
}

async function derive(password, saltB64) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: b64ToBytes(saltB64),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function hashPassword(password, saltB64) {
  return derive(password, saltB64);
}

export async function verifyPassword(password, saltB64, hashB64) {
  const got = await derive(password, saltB64);
  if (got.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}