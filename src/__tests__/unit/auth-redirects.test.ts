import { getDefaultPathForRole, getSafeNextPath } from "@/lib/auth/redirects";

describe("auth redirect helpers", () => {
  it("accepts protected same-site relative next paths", () => {
    expect(getSafeNextPath("/admin")).toBe("/admin");
    expect(getSafeNextPath("/admin/leagues?tab=open")).toBe(
      "/admin/leagues?tab=open",
    );
    expect(getSafeNextPath("/garage/new")).toBe("/garage/new");
    expect(getSafeNextPath("/garage?tab=setups#top")).toBe("/garage?tab=setups#top");
  });

  it("rejects unsafe next paths", () => {
    expect(getSafeNextPath("https://example.com/admin")).toBeNull();
    expect(getSafeNextPath("//example.com/admin")).toBeNull();
    expect(getSafeNextPath("admin")).toBeNull();
    expect(getSafeNextPath(null)).toBeNull();
  });

  it("rejects safe relative paths outside protected auth areas", () => {
    expect(getSafeNextPath("/")).toBeNull();
    expect(getSafeNextPath("/leagues/informal")).toBeNull();
    expect(getSafeNextPath("/login")).toBeNull();
    expect(getSafeNextPath("/api/admin/health")).toBeNull();
  });

  it("maps known roles to default destinations", () => {
    expect(getDefaultPathForRole("admin")).toBe("/admin");
    expect(getDefaultPathForRole("super_admin")).toBe("/admin");
    expect(getDefaultPathForRole("racer")).toBe("/garage");
    expect(getDefaultPathForRole("guest")).toBe("/");
  });
});
