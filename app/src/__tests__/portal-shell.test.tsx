import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("PortalShell", () => {
  it("connects tab controls to the active tab panel id", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/portal-shell.tsx"),
      "utf8"
    );

    expect(source).toContain("aria-controls={`tabpanel-${tab.id}`}");
    expect(source).toContain("id={`tabpanel-${activeTab}`}");
    expect(source).toContain("aria-labelledby={`tab-${activeTab}`}");
    expect(source).toContain("document.getElementById(`tabpanel-${activeTab}`)");
  });

  it("allows public portals to disable authenticated share and event endpoints", () => {
    const shellSource = readFileSync(
      path.join(process.cwd(), "src/components/portal-shell.tsx"),
      "utf8"
    );
    const exampleSource = readFileSync(
      path.join(process.cwd(), "src/app/(portal)/client/example/example-client.tsx"),
      "utf8"
    );

    expect(shellSource).toContain("shareEndpoint?: string | null");
    expect(shellSource).toContain("eventsEndpoint?: string | null");
    expect(shellSource).toContain("if (!eventsEndpoint) return");
    expect(shellSource).toContain("{resolvedShareEndpoint && (");
    expect(exampleSource).toContain("shareEndpoint={null}");
    expect(exampleSource).toContain("eventsEndpoint={null}");
  });
});
