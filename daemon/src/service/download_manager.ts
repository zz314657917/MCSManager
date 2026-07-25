import axios from "axios";
import dns from "dns";
import { createWriteStream } from "fs";
import fs from "fs-extra";
import http from "http";
import https from "https";
import net from "net";
import path from "path";
import { Throttle } from "stream-throttle";
import { getCommonHeaders } from "../common/network";
import { globalConfiguration } from "../entity/config";

export const DOWNLOAD_STATUS = {
  DOWNLOADING: 0,
  COMPLETED: 1,
  ERROR: 2
};

const MAX_REDIRECTS = 5;

function isUnsafeAddress(address: string) {
  const normalized = address.toLowerCase();
  if (net.isIP(normalized) === 4) {
    const parts = normalized.split(".").map(Number);
    const [first, second] = parts;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19 || second === 51)) ||
      (first === 203 && second === 0) ||
      first >= 224
    );
  }

  if (net.isIP(normalized) === 6) {
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      if (net.isIP(mapped) === 4) return isUnsafeAddress(mapped);
    }
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }

  return true;
}

async function assertSafeUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https download URLs are allowed.");
  }
  if (parsed.username || parsed.password) throw new Error("Download URL credentials are not allowed.");

  const records = await dns.promises.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isUnsafeAddress(record.address))) {
    throw new Error(`Download target resolves to a private or reserved address: ${parsed.hostname}`);
  }
  return parsed;
}

const safeLookup: any = (hostname: string, _options: any, callback: Function) => {
  dns.promises
    .lookup(hostname, { all: true, verbatim: true })
    .then((records) => {
      const record = records.find((item) => !isUnsafeAddress(item.address));
      if (!record) throw new Error("Download target resolved to a private or reserved address.");
      callback(null, record.address, record.family);
    })
    .catch((error) => callback(error));
};

interface DownloadTask {
  id: string;
  path: string;
  total: number;
  current: number;
  status: number;
  error?: string;
  controller: AbortController;
}

class DownloadManager {
  public tasks: DownloadTask[] = [];

  public get downloadingCount() {
    return this.tasks.length;
  }

  public async downloadFromUrl(
    url: string,
    targetPath: string,
    fallbackUrl?: string
  ): Promise<void> {
    const taskId = Math.random().toString(36).substring(2, 15);
    const controller = new AbortController();
    const task: DownloadTask = {
      id: taskId,
      path: targetPath,
      total: 0,
      current: 0,
      status: DOWNLOAD_STATUS.DOWNLOADING,
      controller
    };
    this.tasks.push(task);

    try {
      // Ensure directory exists
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirpSync(dir);

      const response = await this.requestWithRetry(url, controller);
      const total = parseInt(response.headers["content-length"] || "0");
      const maxBytes = Number(globalConfiguration.config.maxRemoteDownloadBytes) || 0;
      if (maxBytes > 0 && total > maxBytes) {
        throw new Error(`Remote download exceeds the ${maxBytes} byte limit.`);
      }
      let current = 0;
      const stream = response.data;
      const writeStream = createWriteStream(targetPath);

      task.total = total;

      return new Promise((resolve, reject) => {
        const onError = (err: Error) => {
          stream.destroy();
          writeStream.destroy();
          fs.remove(targetPath).catch(() => {});
          const activeTask = this.tasks.find((t) => t.id === taskId);
          if (activeTask) {
            activeTask.status = DOWNLOAD_STATUS.ERROR;
            activeTask.error = err.message;
          }
          setTimeout(() => {
            this.tasks = this.tasks.filter((t) => t.id !== taskId);
          }, 1000);

          if (err.name === "CanceledError") {
            resolve();
            return;
          }
          reject(err);
        };

        const onFinish = () => {
          const activeTask = this.tasks.find((t) => t.id === taskId);
          if (activeTask) {
            activeTask.status = DOWNLOAD_STATUS.COMPLETED;
            if (total > 0) activeTask.current = total;
          }
          setTimeout(() => {
            this.tasks = this.tasks.filter((t) => t.id !== taskId);
          }, 1000);
          resolve();
        };

        stream.on("data", (chunk: any) => {
          current += chunk.length;
          if (maxBytes > 0 && current > maxBytes) {
            stream.destroy(new Error(`Remote download exceeds the ${maxBytes} byte limit.`));
            return;
          }
          const activeTask = this.tasks.find((t) => t.id === taskId);
          if (!activeTask) return;
          activeTask.current = current;
        });

        stream.on("error", onError);
        writeStream.on("error", onError);
        writeStream.on("finish", onFinish);

        const speedLimit = globalConfiguration.config.uploadSpeedRate;
        if (speedLimit <= 0) {
          stream.pipe(writeStream);
          return;
        }
        const throttleStream = new Throttle({ rate: speedLimit * 64 * 1024 });
        throttleStream.on("error", onError);
        stream.pipe(throttleStream).pipe(writeStream);
      });
    } catch (err: any) {
      if (fallbackUrl && !controller.signal.aborted) {
        this.tasks = this.tasks.filter((t) => t.id !== taskId);
        return await this.downloadFromUrl(fallbackUrl, targetPath);
      }

      if (err.name === "CanceledError") {
        this.tasks = this.tasks.filter((t) => t.id !== taskId);
        return;
      }

      const activeTask = this.tasks.find((t) => t.id === taskId);
      if (activeTask) {
        activeTask.status = DOWNLOAD_STATUS.ERROR;
        activeTask.error = err.message;
      }
      setTimeout(() => {
        this.tasks = this.tasks.filter((t) => t.id !== taskId);
      }, 1000);
      throw err;
    }
  }

  public stop(targetPath: string) {
    const task = this.tasks.find((t) => t.path === targetPath);
    if (!task) return false;

    task.controller.abort();
    this.tasks = this.tasks.filter((t) => t.id !== task.id);
    setTimeout(() => {
      fs.remove(task.path).catch(() => {});
    }, 1000);
    return true;
  }

  public stopById(taskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.controller.abort();
    this.tasks = this.tasks.filter((t) => t.id !== task.id);
    setTimeout(() => {
      fs.remove(task.path).catch(() => {});
    }, 1000);
    return true;
  }

  private async requestWithRetry(
    url: string,
    controller: AbortController,
    retries = 2,
    redirects = 0,
    visited = new Set<string>()
  ): Promise<any> {
    try {
      const safeUrl = await assertSafeUrl(url);
      const normalizedUrl = safeUrl.toString();
      if (visited.has(normalizedUrl)) throw new Error("Download redirect loop detected.");
      visited.add(normalizedUrl);

      const response = await axios({
        method: "get",
        url: normalizedUrl,
        responseType: "stream",
        timeout: 60000,
        headers: getCommonHeaders(normalizedUrl),
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        httpAgent: new http.Agent({ lookup: safeLookup }),
        httpsAgent: new https.Agent({ lookup: safeLookup }),
        signal: controller.signal
      });

      if (response.status >= 300) {
        const location = response.headers.location;
        if (!location || redirects >= MAX_REDIRECTS) {
          throw new Error("Download redirect limit exceeded or location is missing.");
        }
        response.data?.destroy();
        return await this.requestWithRetry(
          new URL(location, safeUrl).toString(),
          controller,
          retries,
          redirects + 1,
          visited
        );
      }
      return response;
    } catch (err: any) {
      if (controller.signal.aborted) throw err;

      const isNetworkError =
        !err.response &&
        (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ECONNABORTED");
      const isRetryableStatus = [500, 502, 503, 504].includes(err.response?.status);

      if (retries > 0 && (isNetworkError || isRetryableStatus)) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return await this.requestWithRetry(url, controller, retries - 1);
      }
      if (err.response?.status === 403) {
        throw new Error(
          `Access denied (403) for ${url}. This might be a premium plugin or Cloudflare protection.`
        );
      }
      throw err;
    }
  }
}

const downloadManager = new DownloadManager();

export default downloadManager;
