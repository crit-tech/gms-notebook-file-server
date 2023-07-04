import crypto from "crypto";
import fs from "fs";
import path from "path";
import { isNotJunk } from "junk";
import slash from "slash";
import Queue from "queue";
import pdf2text from "@crit-tech/pdf2text";

import { ServerOptions, FileType, getFileType } from "./types.js";

export type FileToProcess = {
  path: string;
  id: string;
  contentHash: string;
  fileType: FileType;
};

const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

function getChecksum(fullPath: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    const hash = crypto.createHash("md5");
    const input = fs.createReadStream(fullPath);

    input.on("error", reject);

    input.on("data", function (chunk) {
      hash.update(chunk);
    });

    input.on("close", function () {
      resolve(hash.digest("hex"));
    });
  });
}

export class IndexingServer {
  private baseUrl: string;
  private port: number;
  private folder: string;
  private indexingKey?: string;
  private lastFullIndex?: Date;
  private lastFullIndexTime: number;
  private providerId?: string;

  constructor(
    options: ServerOptions,
    log: (message: string, type: string) => void
  ) {
    this.baseUrl = process.env["GMN_BASE_URL"] ?? "https://gmsnotebook.com";
    this.port = options.port;
    this.folder = options.folder;
    this.indexingKey = options.indexingKey;
    this.lastFullIndex = options.lastFullIndex;
    this.lastFullIndexTime = this.lastFullIndex?.getTime() ?? 0;
    this.providerId = options.providerId;
  }

  async scanFolder(startPath: string): Promise<FileToProcess[]> {
    const result: FileToProcess[] = [];

    const parentFolderPath = path.join(this.folder, startPath);
    const files = await fs.promises.readdir(parentFolderPath);
    await Promise.all(
      files.filter(isNotJunk).map(async (file) => {
        const fullPath = path.join(parentFolderPath, file);
        const stats = await fs.promises.stat(fullPath);
        if (stats.isDirectory()) {
          const subFiles = await this.scanFolder(path.join(startPath, file));
          result.push(...subFiles);
        } else {
          result.push({
            path: fullPath,
            id: slash(fullPath.replace(this.folder, "")).toLowerCase(),
            contentHash: await getChecksum(fullPath),
            fileType: getFileType(fullPath),
          });
        }
      })
    );

    return result;
  }

  async getFileContents(file: FileToProcess): Promise<string | undefined> {
    if (file.fileType === "markdown") {
      const contents = await fs.promises.readFile(file.path, "utf8");
      return contents.replace(/\r\n/g, "\n");
    } else if (file.fileType === "pdf") {
      return JSON.stringify(await pdf2text(file.path));
    } else {
      return undefined;
    }
  }

  async indexFile(file: FileToProcess) {
    const response = await fetch(`${this.baseUrl}/api/indexing/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.indexingKey ?? "",
        "x-port": this.port.toString(),
        "x-provider-id": this.providerId ?? "",
      },
      body: JSON.stringify({
        id: file.id,
        contentHash: file.contentHash,
        fileType: file.fileType,
        content: await this.getFileContents(file),
      }),
    });

    if (response.status !== 204) {
      throw new Error(
        `Error indexing file ${file.id}: ${response.status} ${response.statusText}`
      );
    }
  }

  async runIndexing() {
    const files = await this.scanFolder("/");
    const filesToCheck = files.map((file) => ({
      id: file.id,
      contentHash: file.contentHash,
    }));
    const response = await fetch(`${this.baseUrl}/api/indexing/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.indexingKey ?? "",
        "x-port": this.port.toString(),
        "x-provider-id": this.providerId ?? "",
      },
      body: JSON.stringify({ files: filesToCheck }),
    });

    if (response.status !== 200) {
      throw new Error(
        `Error running indexing: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();
    const changedFiles = json.changedFiles as string[];
    const filesToIndex = files.filter((file) => changedFiles.includes(file.id));

    const q = new Queue({ concurrency: 10 });
    for (const file of filesToIndex) {
      q.push(() => this.indexFile(file));
    }
    await new Promise((resolve, reject) => {
      q.start((err) => {
        if (err) reject(err);
        else resolve(null);
      });
    });

    this.lastFullIndexTime = Date.now();
  }

  async checkTimer() {
    const targetTime = this.lastFullIndexTime + TWELVE_HOURS;
    if (this.lastFullIndexTime === 0 || Date.now() >= targetTime) {
      await this.runIndexing();
    }
    setTimeout(() => {
      this.checkTimer();
    }, targetTime - this.lastFullIndexTime);
  }
}
