import { timingSafeEqual } from "node:crypto";

import { CSRF_HEADER_NAME } from "@/lib/constants";

const mutatingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export function isMutatingMethod(method: string): boolean {
  const normalizedMethod = method.trim().toUpperCase();

  return mutatingMethods.has(normalizedMethod);
}

export function verifyCsrfToken(request: Request, expectedToken: string): boolean {
  if (!isMutatingMethod(request.method)) {
    return true;
  }

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken || !expectedToken) {
    return false;
  }

  const headerBuffer = Buffer.from(headerToken);
  const expectedBuffer = Buffer.from(expectedToken);
  if (headerBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(headerBuffer, expectedBuffer);
}
