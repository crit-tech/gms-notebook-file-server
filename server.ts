import express, { Express, Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { isNotJunk } from "junk";
import multer from "multer";
import morgan from "morgan";
import slash from "slash";
import { getFileType } from "./filetypes.js";
import { resolveFilePath, pathExists } from "./utils.js";

export type Server = ReturnType<typeof express.application.listen>;

export function startServer(port: number, folder: string): Server {
  const app: Express = express();
  const upload = multer({ dest: "uploads/" });

  if (!folder || !fs.existsSync(folder)) {
    console.error(`⚡️[server]: Folder ${folder} does not exist`);
    process.exit(1);
  }

  app.use(morgan("tiny"));
  app.use(cors());
  app.use("/download", express.static(folder));

  app.get("/", (req: Request, res: Response) => {
    res.send("<h1>GM's Notebook Local File Server</h1>");
  });

  app.get("/api/files", async (req: Request, res: Response) => {
    try {
      const parentFolderPathParamValue =
        req?.query?.parentFolderPath?.toString();
      const parentFolderPath = parentFolderPathParamValue
        ? path.join(folder, parentFolderPathParamValue)
        : folder;

      const files = await fs.promises.readdir(parentFolderPath);
      const filesAndFolders = await Promise.all(
        files.filter(isNotJunk).map(async (file) => {
          const stats = await fs.promises.stat(
            path.join(parentFolderPath, file)
          );
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

      const filePath = await resolveFilePath(
        path.join(folder, filePathParamValue)
      );
      if (!filePath) {
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
        downloadUrl: `http://localhost:${port}/download/${slash(
          path.relative(folder, filePath)
        )}`,
      });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(
    "/api/file",
    upload.array("file", 1),
    async (req: Request, res: Response) => {
      try {
        const filePathParamValue = req?.query?.filePath?.toString();
        if (!filePathParamValue) {
          res.status(400).json({ error: "filePath is required" });
          return;
        }

        if (req?.files?.length !== 1) {
          res.status(400).json({ error: "file is required" });
          return;
        }

        const autorenameParamValue = req?.query?.autorename?.toString();
        const autorename = autorenameParamValue === "true";

        let filePath = await resolveFilePath(
          path.join(folder, filePathParamValue),
          false
        );

        const parentFolderPath = path.dirname(filePath);
        if (!(await pathExists(parentFolderPath))) {
          await fs.promises.mkdir(parentFolderPath, { recursive: true });
        }

        let exists = await pathExists(filePath);
        let counter = 1;
        const ext = path.extname(filePath);
        while (exists && autorename) {
          const base = path.basename(filePath, ext);
          if (/-\d+$/.test(base)) {
            filePath = path.join(
              parentFolderPath,
              base.replace(/-\d+$/, "") + `-${counter}${ext}`
            );
          } else {
            filePath = path.join(parentFolderPath, base + `-${counter}${ext}`);
          }
          counter++;
          exists = await pathExists(filePath);
        }

        const file = (req.files as Express.Multer.File[])[0];
        await fs.promises.copyFile(file.path, filePath);
        await fs.promises.unlink(file.path);

        res.json({ success: true, name: path.basename(filePath) });
      } catch (error: any) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.patch("/api/file", async (req: Request, res: Response) => {
    try {
      const filePathParamValue = req?.query?.filePath?.toString();
      if (!filePathParamValue) {
        res.status(400).json({ error: "filePath is required" });
        return;
      }

      const newName = req?.query?.newName?.toString();
      if (!newName) {
        res.status(400).json({ error: "newName is required" });
        return;
      }

      const filePath = await resolveFilePath(
        path.join(folder, filePathParamValue)
      );
      if (!filePath) {
        res.status(404).json({ error: "no such file or directory" });
        return;
      }

      const newPath = path.join(path.dirname(filePath), newName);
      console.log(newPath);
      await fs.promises.rename(filePath, newPath);

      res.json({ success: true });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/file", async (req: Request, res: Response) => {
    try {
      const filePathParamValue = req?.query?.filePath?.toString();
      if (!filePathParamValue) {
        res.status(400).json({ error: "filePath is required" });
        return;
      }

      const filePath = await resolveFilePath(
        path.join(folder, filePathParamValue)
      );
      if (!filePath) {
        res.status(404).json({ error: "no such file or directory" });
        return;
      }

      const isDirectory = (await fs.promises.stat(filePath)).isDirectory();
      if (!isDirectory) {
        await fs.promises.unlink(filePath);
      } else {
        await fs.promises.rm(filePath, { recursive: true });
      }

      res.json({ success: true });
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

      await fs.promises.mkdir(directoryPath, { recursive: true });
      res.json({ success: true });
    } catch (error: any) {
      console.error(error.message);
      res.status(500).json({ error: error.message });
    }
  });

  const server = app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  });

  return server;
}
