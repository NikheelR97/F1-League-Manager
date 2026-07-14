export interface OfficialTemplateRow {
  color_hex: string;
  id: string;
  name: string;
  slug: string;
}

// Pure selection logic for the "add all official teams" bulk action: skip any
// template whose slug is already a team in this league, then take only as many
// as the per-league team cap still allows. Kept server-free so it's unit-tested
// without pulling in the service-role client.
export function selectOfficialTeamsToAdd(
  templates: OfficialTemplateRow[],
  existingSlugs: Set<string>,
  existingCount: number,
  cap: number,
): OfficialTemplateRow[] {
  const capacity = Math.max(0, cap - existingCount);
  const notYetAdded = templates.filter((t) => !existingSlugs.has(t.slug));
  return notYetAdded.slice(0, capacity);
}
