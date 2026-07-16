import { requireAdminContext } from "@/lib/auth/admin";
import { sanitizeError } from "@/lib/security/errors";
import { createSupabaseAdminAuthReader } from "@/lib/supabase/admin-reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const authResult = await requireAdminContext(
      createSupabaseAdminAuthReader(supabase),
    );

    if (!authResult.ok) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    return Response.json({ ok: true, role: authResult.role });
  } catch (error) {
    const body = sanitizeError(error, process.env.NODE_ENV === "production");

    return Response.json(body, { status: 500 });
  }
}
