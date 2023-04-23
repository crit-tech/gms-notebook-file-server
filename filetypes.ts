export type FileType = "markdown" | "image" | "pdf" | "xfdf" | "unknown";

const markdownExtensions = ["md", "mdx"];
const imageExtensions = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "apng",
  "avif",
  "svg",
  "webp",
  "jfif",
  "pjpeg",
  "pjp",
  "bmp",
  "ico",
  "cur",
];
const pdfExtensions = ["pdf"];

function getFileExtension(path: string): string {
  return path.split(".").pop() ?? "";
}

function isFileMarkdown(path: string) {
  return markdownExtensions.includes(getFileExtension(path));
}

function isFileAnnotations(path: string) {
  return getFileExtension(path) === "xfdf";
}

function isFileImage(path: string) {
  return imageExtensions.includes(getFileExtension(path));
}

function isFilePdf(path: string) {
  return pdfExtensions.includes(getFileExtension(path));
}

export function getFileType(name: string): FileType {
  return isFileImage(name)
    ? "image"
    : isFilePdf(name)
    ? "pdf"
    : isFileMarkdown(name)
    ? "markdown"
    : isFileAnnotations(name)
    ? "xfdf"
    : "unknown";
}
