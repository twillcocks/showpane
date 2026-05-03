import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/client-auth", () => ({
  getAuthenticatedPortal: vi.fn(),
}));

import { getAuthenticatedPortal } from "@/lib/client-auth";
import { middleware } from "@/middleware";

const mockedGetAuthenticatedPortal = vi.mocked(getAuthenticatedPortal);

function request(pathname: string) {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

describe("middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows the built-in example portal without authentication", async () => {
    const response = await middleware(request("/client/example"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockedGetAuthenticatedPortal).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated client portal pages to login", async () => {
    mockedGetAuthenticatedPortal.mockResolvedValue(null);

    const response = await middleware(request("/client/acme"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/client?portal=acme");
  });
});
