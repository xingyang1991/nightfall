import crypto from 'node:crypto';

export interface AuthPayload {
  uid: string;
  iat: number;
  exp: number;
}

const DEFAULT_TTL_DAYS = 30;

function getSecret(): string {
  return String(process.env.NF_AUTH_SECRET ?? '').trim();
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const base = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base + pad, 'base64');
}

function sign(data: string, secret: string): string {
  return b64url(crypto.createHmac('sha256', secret).update(data).digest());
}

export function signToken(userId: string): string {
  const secret = getSecret();
  if (!secret) {
    // fallback: generate a transient secret for local dev
    return '';
  }
  const ttlDays = Number(process.env.NF_AUTH_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthPayload = {
    uid: userId,
    iat: now,
    exp: now + Math.max(1, ttlDays) * 24 * 3600
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyToken(token: string): AuthPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  const parts = String(token ?? '').split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body, secret);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf-8')) as AuthPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.uid || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBearerToken(header?: string): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
