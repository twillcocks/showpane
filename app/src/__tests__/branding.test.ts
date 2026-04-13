import { describe, expect, it } from "vitest";

import {
  getBrandLogoUrl,
  getDomainFromWebsite,
  getLogoUrl,
  normalizeWebsiteUrl,
} from "@/lib/branding";

describe("branding helpers", () => {
  it("normalizes bare domains into https URLs", () => {
    expect(normalizeWebsiteUrl("bidgen.io")).toBe("https://bidgen.io/");
    expect(normalizeWebsiteUrl("https://bidgen.io")).toBe("https://bidgen.io/");
  });

  it("extracts hostnames from bare domains and full URLs", () => {
    expect(getDomainFromWebsite("bidgen.io")).toBe("bidgen.io");
    expect(getDomainFromWebsite("https://www.bidgen.io/path")).toBe("www.bidgen.io");
  });

  it("prefers a stored logo URL, then website-derived logos, then initials", () => {
    expect(
      getBrandLogoUrl({
        logoUrl: "https://cdn.example/logo.png",
        websiteUrl: "bidgen.io",
        fallbackName: "Bidgen",
      }),
    ).toBe("https://cdn.example/logo.png");

    expect(
      getBrandLogoUrl({
        websiteUrl: "bidgen.io",
        fallbackName: "Bidgen",
      }),
    ).toBe(getLogoUrl("bidgen.io", "Bidgen"));

    expect(
      getBrandLogoUrl({
        fallbackName: "Bidgen",
      }),
    ).toBe(getLogoUrl("", "Bidgen"));
  });
});
