import fs from "fs";
import { glob } from "glob";

// Helps with case-(in)sensitive file systems
export const resolveFilePath = async (
  filePath: string,
  mustExist: boolean = true
): Promise<string> => {
  let notFound = true;
  const caseInsensitivePossibleFilePaths = await glob(filePath + "*", {
    nocase: true,
    windowsPathsNoEscape: true,
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

  if (notFound && mustExist) {
    return "";
  }

  return filePath;
};

export const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.stat(filePath);
  } catch (error) {
    return false;
  }
  return true;
};
