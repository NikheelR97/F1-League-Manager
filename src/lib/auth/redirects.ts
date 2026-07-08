import { profileRoleSchema, type ProfileRole } from "@/lib/auth/roles";

export function getSafeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  try {
    const parsed = new URL(trimmed, "http://local.test");
    if (parsed.origin !== "http://local.test") return null;

    if (!isAllowedProtectedPath(parsed.pathname)) return null;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getDefaultPathForRole(role: unknown): string {
  const roleResult = profileRoleSchema.safeParse(role);
  if (!roleResult.success) return "/";

  return getDefaultPathForProfileRole(roleResult.data);
}

function getDefaultPathForProfileRole(role: ProfileRole): string {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "racer") return "/garage";

  return "/";
}

function isAllowedProtectedPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/garage" ||
    pathname.startsWith("/garage/")
  );
}
