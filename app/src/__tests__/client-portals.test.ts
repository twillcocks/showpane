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

const mockedPrisma = vi.mocked(prisma);

describe("resolveDefaultOrganizationId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("falls back to first org in DB", async () => {
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "local-org-1",
    } as never);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBe("local-org-1");
    expect(mockedPrisma.organization.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("returns null when no orgs exist in DB", async () => {
    mockedPrisma.organization.findFirst.mockResolvedValue(null);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBeNull();
  });
});
