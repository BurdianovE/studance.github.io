const SESSION_COOKIE = 'studance_session';

export function readSessionToken(cookieHeader: string | null): string {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(';').map((x) => x.trim());
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx);
    if (key !== SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(idx + 1));
  }
  return '';
}

export function sessionCookie(token: string, expiresAt: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}
