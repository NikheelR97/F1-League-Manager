import { z } from "zod";

export const profileRoleSchema = z.enum(["racer", "admin", "super_admin"]);

export type ProfileRole = z.infer<typeof profileRoleSchema>;

export function isAdminRole(role: ProfileRole): boolean {
  profileRoleSchema.parse(role);

  return role === "admin" || role === "super_admin";
}
