import { execSync } from "child_process";
import fs from "fs";

const baseUrl = "http://localhost:" + process.env.PORT;
const newDirectory = "./test-files/new-directory";

interface FileItem {
  name: string;
  type: string;
}

const comparer = (a: FileItem, b: FileItem) => {
  if (a.type === "directory" && b.type === "file") return -1;
  if (a.type === "file" && b.type === "directory") return 1;
  return a.name.localeCompare(b.name);
};

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
  const response = await fetch(baseUrl + "/download/Hello.md");
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toContain("# Hello");
});

test("get root directory", async () => {
  const response = await fetch(baseUrl + "/api/files");
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json.sort(comparer)).toEqual(
    [
      { name: "Hello.md", type: "file" },
      { name: "delete_this_folder", type: "directory" },
      { name: "samples", type: "directory" },
      { name: "subdirectory", type: "directory" },
    ].sort(comparer)
  );
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
  json.contents = json.contents.replace(/\r\n/g, "\n");
  expect(json).toEqual({
    name: "markdown.md",
    type: "file",
    fileType: "markdown",
    contents: "# Markdown\n",
    downloadUrl:
      "http://localhost:" + process.env.PORT + "/download/samples/markdown.md",
  });
});

test("get markdown file, case insensitive filename", async () => {
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fcoolstuff.md"
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  json.contents = json.contents.replace(/\r\n/g, "\n");
  expect(json).toEqual({
    name: "CoolStuff.md",
    type: "file",
    fileType: "markdown",
    contents: "# Cool Stuff\n",
    downloadUrl:
      "http://localhost:" + process.env.PORT + "/download/samples/CoolStuff.md",
  });
});

test("get markdown file, case insensitive filename, root", async () => {
  const response = await fetch(baseUrl + "/api/file?filePath=hello.md");
  expect(response.status).toBe(200);
  const json = await response.json();
  json.contents = json.contents.replace(/\r\n/g, "\n");
  expect(json).toEqual({
    name: "Hello.md",
    type: "file",
    fileType: "markdown",
    contents: "# Hello\n\nIt's me.\n",
    downloadUrl: "http://localhost:" + process.env.PORT + "/download/Hello.md",
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
  expect(json).toEqual({ name: "new-file.md", success: true });

  const contents = fs.readFileSync("./test-files/samples/new-file.md", "utf8");
  expect(contents).toBe("Hello, World!");
});

test("upload a new file, non-existant folder", async () => {
  const formData = new FormData();
  const data = new Blob(["Hello, World!"], { type: "text/plain" });
  formData.append("file", data, "foo.txt");
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fnew-folder%2Fnew-file.md",
    {
      method: "POST",
      body: formData,
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ name: "new-file.md", success: true });

  const contents = fs.readFileSync(
    "./test-files/samples/new-folder/new-file.md",
    "utf8"
  );
  expect(contents).toBe("Hello, World!");
});

test("upload a new file, with autorename", async () => {
  const formData = new FormData();
  const data = new Blob(["Hello, World!"], { type: "text/plain" });
  formData.append("file", data, "markdown.md");
  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fmarkdown.md&autorename=true",
    {
      method: "POST",
      body: formData,
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ name: "markdown-1.md", success: true });

  const contents = fs.readFileSync(
    "./test-files/samples/markdown-1.md",
    "utf8"
  );
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

test("rename a file, case insensitive", async () => {
  expect(fs.existsSync("./test-files/samples/rename_me_TOO.md")).toBe(true);

  const response = await fetch(
    baseUrl +
      "/api/file?filePath=samples%2Frename_me_too.md&newName=renamed.md",
    {
      method: "PATCH",
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ success: true });

  expect(fs.existsSync("./test-files/samples/rename_me_TOO.md")).toBe(false);
  expect(fs.existsSync("./test-files/samples/renamed.md")).toBe(true);
});

test("delete a file", async () => {
  expect(fs.existsSync("./test-files/samples/delete_me.md")).toBe(true);

  const response = await fetch(
    baseUrl + "/api/file?filePath=samples%2Fdelete_me.md",
    {
      method: "DELETE",
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ success: true });

  expect(fs.existsSync("./test-files/samples/delete_me.md")).toBe(false);
});

test("delete a folder", async () => {
  expect(fs.existsSync("./test-files/delete_this_folder")).toBe(true);

  const response = await fetch(
    baseUrl + "/api/file?filePath=delete_this_folder",
    {
      method: "DELETE",
    }
  );
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toEqual({ success: true });

  expect(fs.existsSync("./test-files/delete_this_folder")).toBe(false);
});
