const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  "svg",
  "svgz",
  "html",
  "htm",
  "xhtml",
  "xml",
  "js",
  "mjs",
  "cjs",
]);

const ALLOWED_UPLOAD_EXTENSIONS = new Set(Object.keys(EXTENSION_CONTENT_TYPES));

const INLINE_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
]);

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function sanitizeFilename(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
  return sanitized || "file";
}

export function hasSafePathSegments(segments: string[]): boolean {
  return (
    segments.length > 0 &&
    segments.every(
      (segment) =>
        Boolean(segment) &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("/") &&
        !segment.includes("\\") &&
        !segment.includes("\0")
    )
  );
}

export function isBlockedUploadFilename(filename: string): boolean {
  return BLOCKED_UPLOAD_EXTENSIONS.has(getFileExtension(filename));
}

export function isAllowedUploadFilename(filename: string): boolean {
  const extension = getFileExtension(filename);
  return ALLOWED_UPLOAD_EXTENSIONS.has(extension) && !BLOCKED_UPLOAD_EXTENSIONS.has(extension);
}

export function sniffUploadContentType(
  filename: string,
  bytes: Buffer,
  clientContentType?: string
): string {
  if (bytes.length >= 4) {
    if (bytes.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
      return "application/pdf";
    }
    if (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ) {
      return "image/png";
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
  }

  const extension = getFileExtension(filename);
  if (extension in EXTENSION_CONTENT_TYPES) {
    return EXTENSION_CONTENT_TYPES[extension];
  }

  return clientContentType || "application/octet-stream";
}

export function getServedFileMetadata(
  filename: string,
  storedContentType?: string | null
): { contentType: string; disposition: "inline" | "attachment" } {
  const extension = getFileExtension(filename);

  if (BLOCKED_UPLOAD_EXTENSIONS.has(extension) || storedContentType === "image/svg+xml") {
    return {
      contentType: "application/octet-stream",
      disposition: "attachment",
    };
  }

  const contentType =
    (extension && EXTENSION_CONTENT_TYPES[extension]) ||
    storedContentType ||
    "application/octet-stream";

  return {
    contentType,
    disposition: INLINE_CONTENT_TYPES.has(contentType) ? "inline" : "attachment",
  };
}
