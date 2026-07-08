import { createHmac, timingSafeEqual } from "node:crypto";

import { CSRF_HEADER_NAME } from "@/lib/constants";

const CSRF_TOKEN_VALIDITY_MS = 60 * 60 * 1000; // 1 hour
const mutatingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export function isMutatingMethod(method: string): boolean {
  return mutatingMethods.has(method.trim().toUpperCase());
}

function sign(secret: string, timestamp: string): string {
  return createHmac("sha256", secret).update(timestamp).digest("hex");
}

export function generateCsrfToken(secret: string): string {
  const timestamp = Date.now().toString();
  return `${timestamp}.${sign(secret, timestamp)}`;
}

export function verifyCsrfToken(request: Request, secret: string): boolean {
  if (!isMutatingMethod(request.method)) return true;

  const token = request.headers.get(CSRF_HEADER_NAME);
  if (!token || !secret) return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  const timestamp = token.slice(0, dotIndex);
  const hmac = token.slice(dotIndex + 1);
  if (!timestamp || !hmac) return false;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > CSRF_TOKEN_VALIDITY_MS) return false;

  const expected = sign(secret, timestamp);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(hmac, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
