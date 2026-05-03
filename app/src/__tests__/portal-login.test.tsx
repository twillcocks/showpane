import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("PortalLogin", () => {
  it("labels generated slug credentials plainly and keeps password reveal focusable", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/portal-login.tsx"),
      "utf8"
    );

    expect(source).toContain(">Username</label>");
    expect(source).toContain("Usually your portal slug.");
    expect(source).not.toContain("tabIndex={-1}");
    expect(source).not.toContain(">Company Name</label>");
  });
});
