import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module under test
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    clientPortal: {
      findFirst: vi.fn(),
    },
  },
}));

import { resolveDefaultOrganizationId } from "@/lib/client-portals";
import { prisma } from "@/lib/db";

const mockedFindFirst = vi.mocked(prisma.organization.findFirst);

describe("resolveDefaultOrganizationId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("falls back to first org in DB", async () => {
    mockedFindFirst.mockResolvedValue({
      id: "local-org-1",
    } as never);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBe("local-org-1");
    expect(mockedFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns null when no orgs exist in DB", async () => {
    mockedFindFirst.mockResolvedValue(null);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBeNull();
  });
});
