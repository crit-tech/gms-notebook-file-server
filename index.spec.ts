import { execSync } from "child_process";

const baseUrl = "http://localhost:" + process.env.PORT;

afterAll(() => {
  execSync("git restore --source=HEAD --staged --worktree -- ./test-files");
});

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
    contents: "# Markdown\n",
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
