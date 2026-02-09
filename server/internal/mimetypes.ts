import { parse } from "file-type-mime";

export const IMAGE_EXTENSIONS = [
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "heic",
  "png",
  "tiff",
];

export const IMAGE_MIME_TYPES = [
  "image/bmp",
  "image/gif",
  "image/x-icon",
  "image/jpeg",
  "image/heic",
  "image/png",
  "image/tiff",
];

export function isImageMimeType(file: ArrayBuffer) {
  const fileType = parse(new Uint8Array(file).buffer);
  if (!fileType || !IMAGE_MIME_TYPES.indexOf(fileType.mime)) {
    return false;
  }
  return true;
}
