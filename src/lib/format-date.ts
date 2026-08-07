// The league runs in South Africa, so all dates/times render in SAST (UTC+2).
// Locale and timeZone are both pinned so a "use client" component produces the
// same string on the server and in the browser — otherwise the runtime's
// ambient locale/timeZone hydration-mismatches whenever they differ.
const SAST_TZ = "Africa/Johannesburg";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SAST_TZ,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SAST_TZ,
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SAST_TZ,
  });
}
