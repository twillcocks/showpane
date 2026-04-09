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
    delete process.env.ORG_ID;
  });

  it("returns org id from ORG_ID env var when set and org exists", async () => {
    process.env.ORG_ID = "cloud-org-123";
    mockedPrisma.organization.findUnique.mockResolvedValue({
      id: "cloud-org-123",
    } as never);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBe("cloud-org-123");
    expect(mockedPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "cloud-org-123" },
      select: { id: true },
    });
    expect(mockedPrisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it("returns null when ORG_ID is set but org not in DB", async () => {
    process.env.ORG_ID = "nonexistent-org";
    mockedPrisma.organization.findUnique.mockResolvedValue(null);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBeNull();
    expect(mockedPrisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: "nonexistent-org" },
      select: { id: true },
    });
    expect(mockedPrisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to first org in DB when ORG_ID not set", async () => {
    // ORG_ID is not set (deleted in beforeEach)
    mockedPrisma.organization.findFirst.mockResolvedValue({
      id: "self-hosted-org-1",
    } as never);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBe("self-hosted-org-1");
    expect(mockedPrisma.organization.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    expect(mockedPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when ORG_ID not set and no orgs in DB", async () => {
    mockedPrisma.organization.findFirst.mockResolvedValue(null);

    const result = await resolveDefaultOrganizationId();

    expect(result).toBeNull();
  });
});
