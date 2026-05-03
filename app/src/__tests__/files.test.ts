import { describe, expect, it } from "vitest";
import { getContentDispositionHeader } from "@/lib/files";

describe("file response headers", () => {
  it("uses a sanitized fallback and RFC 5987 filename", () => {
    expect(getContentDispositionHeader("attachment", 'bad"\r\nname (final).pdf')).toBe(
      "attachment; filename=\"bad___name__final_.pdf\"; filename*=UTF-8''bad%22%0D%0Aname%20%28final%29.pdf"
    );
  });
});
