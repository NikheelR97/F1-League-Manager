import { getDefaultPathForRole, getSafeNextPath } from "@/lib/auth/redirects";

describe("auth redirect helpers", () => {
  it("accepts same-site relative next paths", () => {
    expect(getSafeNextPath("/admin")).toBe("/admin");
    expect(getSafeNextPath("/garage?tab=setups#top")).toBe("/garage?tab=setups#top");
  });

  it("rejects unsafe next paths", () => {
    expect(getSafeNextPath("https://example.com/admin")).toBeNull();
    expect(getSafeNextPath("//example.com/admin")).toBeNull();
    expect(getSafeNextPath("admin")).toBeNull();
    expect(getSafeNextPath(null)).toBeNull();
  });

  it("maps known roles to default destinations", () => {
    expect(getDefaultPathForRole("admin")).toBe("/admin");
    expect(getDefaultPathForRole("super_admin")).toBe("/admin");
    expect(getDefaultPathForRole("racer")).toBe("/garage");
    expect(getDefaultPathForRole("guest")).toBe("/");
  });
});
