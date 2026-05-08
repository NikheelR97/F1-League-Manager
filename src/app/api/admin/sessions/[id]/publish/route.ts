import { type NextRequest } from "next/server";
import { z } from "zod";

import { withAdminGuard } from "@/lib/admin/api-guard";
import { publishSession } from "@/lib/results/publish-service";

// Points_awarded is intentionally absent — calculated server-side from the points system
const qualifyingSchema = z.object({
  driver_id: z.string().uuid(),
  team_id: z.string().uuid(),
  qualifying_position: z.number().int().positive(),
  is_pole: z.boolean(),
});

const raceResultSchema = z.object({
  driver_id: z.string().uuid(),
  team_id: z.string().uuid(),
  finishing_position: z.number().int().positive().nullable(),
  result_status: z.enum(["classified", "dnf", "dns", "dsq", "ban"]),
  fastest_lap: z.boolean(),
  manual_points_adjustment: z.number().int().default(0),
  penalty_points: z.number().int().min(0).default(0),
  raw_result: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const penaltySchema = z.object({
  driver_id: z.string().uuid(),
  penalty_points: z.number().int().min(0),
  reason: z.string().min(1).max(500),
  status: z.enum(["open", "served", "appealed", "rescinded"]),
  steward_notes: z.string().max(1000).nullable().default(null),
  appeal_notes: z.string().max(1000).nullable().default(null),
});

const publishBodySchema = z.object({
  league_id: z.string().uuid(),
  qualifying: z.array(qualifyingSchema),
  results: z.array(raceResultSchema).min(1),
  penalties: z.array(penaltySchema),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdminGuard(req, async (_req, auth) => {
    const { id: sessionId } = await params;

    let body: z.infer<typeof publishBodySchema>;
    try {
      body = publishBodySchema.parse(await req.json());
    } catch (e) {
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.flatten() }, { status: 422 });
      }
      return Response.json({ error: "Invalid request body" }, { status: 422 });
    }

    const result = await publishSession({
      sessionId,
      leagueId: body.league_id,
      qualifying: body.qualifying,
      results: body.results,
      penalties: body.penalties,
      actorId: auth.user.id,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ sessionId: result.sessionId }, { status: 200 });
  });
}
