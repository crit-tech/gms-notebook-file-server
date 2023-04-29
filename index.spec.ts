import { execSync } from "child_process";
import { EOL } from "os";
import fs from "fs";

const baseUrl = "http://localhost:" + process.env.PORT;
const newDirectory = "./test-files/new-directory";
const newFile = "./test-files/samples/new-file.md";

function cleanup() {
  execSync("git restore --source=HEAD --staged --worktree -- ./test-files");
  execSync("git clean -f -d -- ./test-files");
}

beforeAll(cleanup);
afterAll(cleanup);

test("index page", async () => {
  const response = await fetch(baseUrl + "/");
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toContain("GM's Notebook Local File Server");
});

test("download markdown file", async () => {
  const response = await fetch(baseUrl + "/download/hello.md");
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toContain("# Hello");
});

test("get root directory", async () => {
  const response = await fetch(baseUrl + "/api/files");
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual([
    { name: "hello.md", type: "file" },
    { name: "samples", type: "directory" },
    { name: "subdirectory", type: "directory" },
  ]);
});

test("get subdirectory", async () => {
  const response = await fetch(
    baseUrl + "/api/files?parentFolderPath=subdirectory"
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual([{ name: "another.md", type: "file" }]);
});

test("get markdown file", async () => {
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fmarkdown.md"
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({
    name: "markdown.md",
    type: "file",
    fileType: "markdown",
    contents: "# Markdown" + EOL,
    downloadUrl:
      "http://localhost:" + process.env.PORT + "/download/samples/markdown.md",
  });
});

test("get xfdf file", async () => {
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Ffoo.xfdf"
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({
    name: "foo.xfdf",
    type: "file",
    fileType: "xfdf",
    contents: "XML GOES HERE!",
    downloadUrl:
      "http://localhost:" + process.env.PORT + "/download/samples/foo.xfdf",
  });
});

test("get jpg file", async () => {
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fpixel.jpg"
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({
    name: "pixel.jpg",
    type: "file",
    fileType: "image",
    contents: undefined,
    downloadUrl:
      "http://localhost:" + process.env.PORT + "/download/samples/pixel.jpg",
  });
});

test("get non-existent file", async () => {
  const response = await fetch(baseUrl + "/api/file?filePath=does-not-exist");
  expect(response.status).toBe(404);
  const json = await response.json();
  expect(json).toEqual({ error: "no such file or directory" });
});

test("create directory", async () => {
  expect(fs.existsSync(newDirectory)).toBe(false);

  const response = await fetch(
    baseUrl + "/api/create-directory?directoryPath=new-directory",
    {
      method: "PUT",
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ success: true });

  expect(fs.existsSync(newDirectory)).toBe(true);
});

test("upload a new file", async () => {
  const formData = new FormData();
  const data = new Blob(["Hello, World!"], { type: "text/plain" });
  formData.append("file", data, "foo.txt");
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fnew-file.md",
    {
      method: "POST",
      body: formData,
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ success: true });

  const contents = fs.readFileSync("./test-files/samples/new-file.md", "utf8");
  expect(contents).toBe("Hello, World!");
});

test("rename a file", async () => {
  expect(fs.existsSync("./test-files/samples/rename_me.md")).toBe(true);

  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Frename_me.md&newName=renamed.md",
    {
      method: "PATCH",
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ success: true });

  expect(fs.existsSync("./test-files/samples/rename_me.md")).toBe(false);
  expect(fs.existsSync("./test-files/samples/renamed.md")).toBe(true);
});
