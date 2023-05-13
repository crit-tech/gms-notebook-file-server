import path from "path";
import dotenv from "dotenv";
import { startServer } from "./server.js";

dotenv.config();

const port: number = parseInt(process.env.PORT ?? "3001", 10);
const folder: string =
  process.env.LOCAL_FOLDER ?? path.join(__dirname, "test-files");

startServer(port, folder);
