const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/x-pdf": "pdf",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

/** Safe filename for Supabase Storage keys (no spaces, accents, or punctuation). */
export function storageObjectExt(fileName: string, mimeType?: string): string {
  const mime = (mimeType ?? "").toLowerCase();
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  if (mime.includes("pdf")) return "pdf";
  const fromName = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (fromName && fromName.length <= 8) return fromName;
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "bin";
}

export function fileContentType(file: File): string {
  if (file.type.trim()) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export function uniqueStorageFileName(fileName: string, mimeType?: string): string {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${storageObjectExt(fileName, mimeType)}`;
}
