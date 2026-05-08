export interface PublicRaceResultSortRow {
  finishing_position: number | null;
  raw_result?: string | null;
  result_status: string;
}

interface SortKey {
  bucket: number;
  ordinal: number;
  position: number;
  raw: string;
}

const FALLBACK_ORDER = 99;

function parseNumber(value: string | undefined): number {
  if (!value) return FALLBACK_ORDER;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : FALLBACK_ORDER;
}

function getSortKey(row: PublicRaceResultSortRow): SortKey {
  const raw = row.raw_result?.trim() ?? "";
  const status = row.result_status.toLowerCase();
  const lapDown = raw.match(/^(\d+)\s+laps?\s*-\s*(\d+)$/i);
  const dnf = raw.match(/^dnf\s*-\s*(\d+)$/i);

  if (status === "classified") {
    if (lapDown) {
      return {
        bucket: 1,
        ordinal: parseNumber(lapDown[1]) * 100 + parseNumber(lapDown[2]),
        position: row.finishing_position ?? FALLBACK_ORDER,
        raw,
      };
    }

    return {
      bucket: 0,
      ordinal: row.finishing_position ?? FALLBACK_ORDER,
      position: row.finishing_position ?? FALLBACK_ORDER,
      raw,
    };
  }

  if (status === "dnf") {
    return {
      bucket: 2,
      ordinal: parseNumber(dnf?.[1]),
      position: row.finishing_position ?? FALLBACK_ORDER,
      raw,
    };
  }

  if (status === "dsq") {
    return { bucket: 3, ordinal: 0, position: FALLBACK_ORDER, raw };
  }

  if (status === "ban") {
    return { bucket: 4, ordinal: 0, position: FALLBACK_ORDER, raw };
  }

  return { bucket: 5, ordinal: 0, position: row.finishing_position ?? FALLBACK_ORDER, raw };
}

export function comparePublicRaceResults(
  a: PublicRaceResultSortRow,
  b: PublicRaceResultSortRow,
): number {
  const aKey = getSortKey(a);
  const bKey = getSortKey(b);

  if (aKey.bucket !== bKey.bucket) return aKey.bucket - bKey.bucket;
  if (aKey.ordinal !== bKey.ordinal) return aKey.ordinal - bKey.ordinal;
  if (aKey.position !== bKey.position) return aKey.position - bKey.position;
  return aKey.raw.localeCompare(bKey.raw);
}
