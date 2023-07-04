import path from "path";
import nock from "nock";

import fetch, {
  Blob,
  blobFrom,
  blobFromSync,
  File,
  fileFrom,
  fileFromSync,
  FormData,
  Headers,
  Request,
  Response,
} from "node-fetch";

const g = globalThis as any;
g.fetch = fetch;
g.Headers = Headers;
g.Request = Request;
g.Response = Response;
g.Blob = Blob;
g.blobFrom = blobFrom;
g.blobFromSync = blobFromSync;
g.File = File;
g.fileFrom = fileFrom;
g.fileFromSync = fileFromSync;
g.FormData = FormData;

import { FileType } from "./types.js";
import { IndexingServer, FileToProcess } from "./indexing.js";

const testPort = 3001;
const folder = path.resolve("./test-files");

const comparer = (a: FileToProcess, b: FileToProcess) => {
  return a.id.localeCompare(b.id);
};

const expectedFiles: FileToProcess[] = [
  {
    path: path.resolve(folder, "Hello.md"),
    id: "/hello.md",
    contentHash: "a2c6c9c65b88ede7d27047e8cfdf64f0",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "delete_this_folder/.keep"),
    id: "/delete_this_folder/.keep",
    contentHash: "d41d8cd98f00b204e9800998ecf8427e",
    fileType: "unknown" as FileType,
  },
  {
    path: path.resolve(folder, "samples/delete_me.md"),
    id: "/samples/delete_me.md",
    contentHash: "ddebcec5e4e68877d75d3e2ea6fe4851",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "samples/CoolStuff.md"),
    id: "/samples/coolstuff.md",
    contentHash: "25236fa95e5ff64e4ee1471acc2f848f",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "samples/foo.xfdf"),
    id: "/samples/foo.xfdf",
    contentHash: "c8c908ccc3082b93ce17f471168c35d9",
    fileType: "xfdf" as FileType,
  },
  {
    path: path.resolve(folder, "samples/markdown.md"),
    id: "/samples/markdown.md",
    contentHash: "05bac749885cd01806a4cb7006ebba71",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "samples/pixel.jpg"),
    id: "/samples/pixel.jpg",
    contentHash: "8c90748342f19b195b9c6b4eff742ded",
    fileType: "image" as FileType,
  },
  {
    path: path.resolve(folder, "samples/rename_me.md"),
    id: "/samples/rename_me.md",
    contentHash: "fcd26664b58eea14a417e9af320c34f9",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "samples/rename_me_TOO.md"),
    id: "/samples/rename_me_too.md",
    contentHash: "9be2b60a54c49e9c8d40c84a8b85912e",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "subdirectory/another.md"),
    id: "/subdirectory/another.md",
    contentHash: "2ddd8ec1cbcd294b5f62dd29ec50de69",
    fileType: "markdown" as FileType,
  },
  {
    path: path.resolve(folder, "samples/Test.pdf"),
    id: "/samples/test.pdf",
    contentHash: "2433f48a4c5bb0c72baa2a64a54f4663",
    fileType: "pdf" as FileType,
  },
].sort(comparer);

test("scan folder", async () => {
  const server = new IndexingServer(
    { port: testPort, folder, indexingEnabled: false, providerId: "local_1" },
    () => {}
  );
  const files = await server.scanFolder("/");
  expect(files.sort(comparer)).toEqual(expectedFiles);
});

test("run indexing", async () => {
  const baseServerUrl = "http://foo.bar";
  process.env["GMN_BASE_URL"] = baseServerUrl;

  nock(baseServerUrl, {
    reqheaders: {
      "x-api-key": "test-key",
      "x-port": testPort.toString(),
      "x-provider-id": "local_1",
    },
  })
    .post("/api/indexing/check", (body) => {
      expect(body.files.sort(comparer)).toEqual(
        expectedFiles.map(({ id, contentHash }) => ({ id, contentHash }))
      );
      return true;
    })
    .reply(200, {
      changedFiles: ["/hello.md", "/samples/pixel.jpg", "/samples/test.pdf"],
    })
    .post("/api/indexing/file", (body) => {
      if (body.id !== "/hello.md") return false;
      expect(body).toEqual({
        id: "/hello.md",
        contentHash: "a2c6c9c65b88ede7d27047e8cfdf64f0",
        fileType: "markdown",
        content: "# Hello\n\nIt's me.\n",
      });
      return true;
    })
    .reply(204)
    .post("/api/indexing/file", (body) => {
      if (body.id !== "/samples/pixel.jpg") return false;
      expect(body).toEqual({
        id: "/samples/pixel.jpg",
        contentHash: "8c90748342f19b195b9c6b4eff742ded",
        fileType: "image",
      });
      return true;
    })
    .reply(204)
    .post("/api/indexing/file", (body) => {
      if (body.id !== "/samples/test.pdf") return false;
      expect(body.contentHash).toEqual("2433f48a4c5bb0c72baa2a64a54f4663");
      expect(body.fileType).toEqual("pdf");
      expect(
        JSON.parse(body.content).map((s: string) => s.replace(/\n/g, "").trim())
      ).toEqual([
        "Test PDF documentThis is the first page.",
        "This is the second page.",
      ]);

      return true;
    })
    .reply(204);

  const server = new IndexingServer(
    {
      port: testPort,
      folder,
      indexingEnabled: true,
      indexingKey: "test-key",
      providerId: "local_1",
    },
    () => {}
  );
  await server.runIndexing();
}, 10000);
