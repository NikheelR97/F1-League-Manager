import "server-only";

import { readServerEnv } from "@/lib/env";

export async function GET() {
  const { CSRF_SECRET } = readServerEnv();
  return Response.json({ token: CSRF_SECRET });
}
