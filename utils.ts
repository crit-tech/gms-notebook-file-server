import fs from "fs";
import { glob } from "glob";

// Helps with case-sensitive file systems
export const resolveFilePath = async (
  filePath: string,
  mustExist: boolean = true
): Promise<string> => {
  let notFound = false;
  try {
    await fs.promises.stat(filePath);
  } catch {
    notFound = true;
  }

  if (notFound) {
    const caseInsensitivePossibleFilePaths = await glob(filePath + "*", {
      nocase: true,
    });
    if (caseInsensitivePossibleFilePaths.length >= 1) {
      const match = caseInsensitivePossibleFilePaths.find(
        (p) => p.toLowerCase() === filePath.toLowerCase()
      );
      if (match) {
        filePath = match;
        notFound = false;
      }
    }
  }

  if (notFound && mustExist) {
    return "";
  }

  return filePath;
};
