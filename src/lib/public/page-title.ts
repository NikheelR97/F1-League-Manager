// Shared tab-title suffix so every public page reads as part of one product
// instead of 13 near-identical literals drifting out of sync.
export const SITE_NAME = "F1 Esports League Manager";

export function pageTitle(pageSpecific: string): string {
  return `${pageSpecific} | ${SITE_NAME}`;
}
