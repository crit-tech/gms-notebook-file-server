import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { isNotJunk } from "junk";
import { getFileType } from "./filetypes.js";

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

const folder = process.env.LOCAL_FOLDER;
if (!folder || !fs.existsSync(folder)) {
  console.error(`⚡️[server]: Folder ${folder} does not exist`);
  process.exit(1);
}

app.use("/download", express.static(folder));

app.get("/", (req: Request, res: Response) => {
  res.send("<h1>GM's Notebook Local File Server</h1>");
});

app.get("/api/files", async (req: Request, res: Response) => {
  try {
    const parentFolderPathParamValue = req?.query?.parentFolderPath?.toString();
    const parentFolderPath = parentFolderPathParamValue
      ? path.join(folder, parentFolderPathParamValue)
      : folder;
    console.log(`GET /files parentFolderPath=${parentFolderPath}`);
    const files = await fs.promises.readdir(parentFolderPath);
    const filesAndFolders = await Promise.all(
      files.filter(isNotJunk).map(async (file) => {
        const stats = await fs.promises.stat(path.join(parentFolderPath, file));
        return {
          name: file,
          type: stats.isDirectory() ? "directory" : "file",
        };
      })
    );
    res.json(filesAndFolders);
  } catch (error: any) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/file", async (req: Request, res: Response) => {
  try {
    const filePathParamValue = req?.query?.filePath?.toString();
    if (!filePathParamValue) {
      res.status(400).json({ error: "filePath is required" });
      return;
    }

    const filePath = path.join(folder, filePathParamValue);
    console.log(`GET /file filePath=${filePath}`);

    try {
      await fs.promises.stat(filePath);
    } catch {
      res.status(404).json({ error: "no such file or directory" });
      return;
    }

    const fileType = getFileType(filePath);
    const isText = ["markdown", "xfdf"].includes(fileType);
    res.json({
      name: path.basename(filePath),
      type: "file",
      fileType,
      contents: isText
        ? await fs.promises.readFile(filePath, "utf8")
        : undefined,
      downloadUrl: `http://localhost:${port}/download/${filePathParamValue}`,
    });
  } catch (error: any) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/create-directory", async (req: Request, res: Response) => {
  try {
    const directoryPathParamValue = req?.query?.directoryPath?.toString();
    if (!directoryPathParamValue) {
      res.status(400).json({ error: "directoryPath is required" });
      return;
    }

    const directoryPath = path.join(folder, directoryPathParamValue);
    console.log(`PUT /create-directory directoryPath=${directoryPath}`);

    await fs.promises.mkdir(directoryPath, { recursive: true });
    res.json({ success: true });
  } catch (error: any) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
