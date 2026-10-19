import { parentPort, workerData } from "node:worker_threads";
import { htmlToText } from "./url-import.js";
if (typeof workerData !== "string" || Buffer.byteLength(workerData) > 2097152)
  throw Error("HTML input limit");
parentPort?.postMessage(htmlToText(workerData));
