import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { formatRaceDateTimeSAST } from "@/lib/format-date";
import { resolvePublicLeague } from "@/lib/public/resolve-league";
import { loadRoundSummary } from "@/lib/public/round-summary";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1200;
const C = {
  bg: "#15151e",
  border: "#2a2a35",
  bronze: "#d9884a",
  gold: "#f5c451",
  muted: "#8a8a99",
  red: "#e10600",
  silver: "#cfd3da",
  up: "#3ddc84",
  down: "#ff5a5a",
  white: "#ffffff",
};
const PODIUM = [C.gold, C.silver, C.bronze];

const FONT_DIR = join(process.cwd(), "src/assets/fonts");
const fonts = Promise.all([
  readFile(join(FONT_DIR, "TitilliumWeb-Bold.ttf")),
  readFile(join(FONT_DIR, "JetBrainsMono-Bold.ttf")),
]);

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await resolvePublicLeague(slug);
  if (!league?.season) return new Response("Not found", { status: 404 });
  const seasonId = league.season.id;

  const db = createSupabaseServiceRoleClient();
  const [{ summary, nextSession }, { data: drivers }, { data: teams }, [titillium, mono]] = await Promise.all([
    loadRoundSummary(league.id, seasonId),
    db
      .from("driver_standings")
      .select("position, total_points, drivers(display_name), teams(color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .order("position")
      .limit(10),
    db
      .from("team_standings")
      .select("position, total_points, teams(name, color_hex)")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .order("position")
      .limit(5),
    fonts,
  ]);

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const mono$ = { fontFamily: "Mono" } as const;

  const row = (pos: number, name: string, pts: number, color?: string | null) => (
    <div key={`${pos}-${name}`} style={{ alignItems: "center", display: "flex", fontSize: 26, height: 44 }}>
      <div style={{ display: "flex", ...mono$, color: PODIUM[pos - 1] ?? C.silver, width: 46 }}>{pos}</div>
      <div style={{ display: "flex", background: color ?? "#444", height: 24, marginRight: 12, width: 5 }} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{name}</div>
      <div style={{ display: "flex", ...mono$, color: C.white }}>{pts}</div>
    </div>
  );
  const heading = (text: string) => (
    <div style={{ color: C.muted, display: "flex", fontSize: 18, letterSpacing: 3, marginBottom: 10 }}>{text}</div>
  );

  const image = (
    <div
      style={{
        background: C.bg,
        color: C.white,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Titillium",
        height: SIZE,
        padding: 56,
        width: SIZE,
      }}
    >
      <div style={{ background: C.red, display: "flex", height: 8, marginBottom: 28, width: 140 }} />
      <div style={{ color: C.muted, display: "flex", fontSize: 26, letterSpacing: 4 }}>
        {`${league.name.toUpperCase()} · ${league.season.name.toUpperCase()}`}
      </div>
      <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1, marginTop: 6 }}>
        {summary ? `Round ${summary.roundNumber} · ${summary.roundName}` : "No completed rounds yet"}
      </div>

      {summary ? (
        <>
          <div style={{ display: "flex", gap: 20, marginTop: 40 }}>
            {summary.podium.map((p) => (
              <div
                key={p.position}
                style={{
                  background: "#1c1c26",
                  borderLeft: `8px solid ${PODIUM[p.position - 1]}`,
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  padding: "20px 24px",
                }}
              >
                <div style={{ ...mono$, color: PODIUM[p.position - 1], display: "flex", fontSize: 30 }}>
                  {`P${p.position}`}
                </div>
                <div style={{ display: "flex", fontSize: 36, overflow: "hidden", whiteSpace: "nowrap" }}>
                  {p.driverName}
                </div>
                <div style={{ ...mono$, color: C.muted, display: "flex", fontSize: 22 }}>{`+${p.points} pts`}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flex: 1, gap: 44, marginTop: 44 }}>
            <div style={{ display: "flex", flex: 5, flexDirection: "column" }}>
              {heading("DRIVERS")}
              {(drivers ?? []).map((d) =>
                row(
                  d.position,
                  (d.drivers as unknown as { display_name: string } | null)?.display_name ?? "TBD",
                  d.total_points,
                  (d.teams as unknown as { color_hex: string } | null)?.color_hex,
                ),
              )}
            </div>
            <div style={{ display: "flex", flex: 4, flexDirection: "column" }}>
              {heading("CONSTRUCTORS")}
              {(teams ?? []).map((t) => {
                const team = t.teams as unknown as { name: string; color_hex: string } | null;
                return row(t.position, team?.name ?? "TBD", t.total_points, team?.color_hex);
              })}
              {summary.movers.up.length + summary.movers.down.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
                  {heading("MOVERS")}
                  {[...summary.movers.up, ...summary.movers.down].map((m) => (
                    <div key={m.name} style={{ display: "flex", fontSize: 24, height: 38 }}>
                      <div style={{ display: "flex", ...mono$, color: m.delta > 0 ? C.up : C.down, width: 70 }}>
                        {`${m.delta > 0 ? "▲" : "▼"}${Math.abs(m.delta)}`}
                      </div>
                      <div style={{ display: "flex" }}>{m.name}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flex: 1 }} />
      )}

      <div
        style={{
          borderTop: `2px solid ${C.border}`,
          color: C.muted,
          display: "flex",
          fontSize: 22,
          justifyContent: "space-between",
          paddingTop: 18,
        }}
      >
        <div style={{ display: "flex" }}>
          {nextSession
            ? `Next: ${nextSession.circuit ?? "TBC"} · ${formatRaceDateTimeSAST(nextSession.scheduled_at)}`
            : ""}
        </div>
        <div style={{ ...mono$, display: "flex" }}>{site}</div>
      </div>
    </div>
  );

  return new ImageResponse(image, {
    fonts: [
      { data: titillium, name: "Titillium", weight: 700 },
      { data: mono, name: "Mono", weight: 700 },
    ],
    headers: { "Cache-Control": "public, max-age=60" },
    height: SIZE,
    width: SIZE,
  });
}
