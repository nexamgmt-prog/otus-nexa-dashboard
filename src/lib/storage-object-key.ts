/** Safe filename for Supabase Storage keys (no spaces, accents, or punctuation). */
export function storageObjectExt(fileName: string, mimeType?: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (fromName && fromName.length <= 8) return fromName;
  if (mimeType?.includes("png")) return "png";
  if (mimeType?.includes("webp")) return "webp";
  if (mimeType?.includes("gif")) return "gif";
  if (mimeType?.includes("pdf")) return "pdf";
  if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) return "jpg";
  return "bin";
}

export function uniqueStorageFileName(fileName: string, mimeType?: string): string {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${storageObjectExt(fileName, mimeType)}`;
}
