import "server-only";

import { readServerEnv } from "@/lib/env";
import { generateCsrfToken } from "@/lib/security/csrf";

export async function GET() {
  const { CSRF_SECRET } = readServerEnv();
  return Response.json({ token: generateCsrfToken(CSRF_SECRET) });
}
