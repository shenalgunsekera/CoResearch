import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";

const host = process.env.SELENIUM_HOST || "127.0.0.1";
const port = process.env.SELENIUM_PORT || "3000";
const baseUrl = process.env.SELENIUM_BASE_URL || `http://${host}:${port}`;
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

function waitForServer(url, timeoutMs = 60000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 1000);
      });

      request.setTimeout(3000, () => {
        request.destroy();
      });
    };

    check();
  });
}

function isServerReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(true);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function stopProcessTree(child) {
  if (!child.pid || child.killed) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // The dev server may have exited on its own, for example after a port lock error.
    }
    return;
  }

  child.kill("SIGTERM");
}

async function main() {
  let server;

  if (await isServerReady(baseUrl)) {
    console.log(`Using existing server at ${baseUrl}`);
  } else {
    server = spawn(process.execPath, [nextBin, "dev", "-H", host, "-p", port], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    server.stdout.on("data", (chunk) => process.stdout.write(chunk));
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  }

  try {
    await waitForServer(baseUrl);

    const result = spawn(
      process.execPath,
      ["--test", path.join("tests", "selenium", "app.test.mjs")],
      {
        env: { ...process.env, SELENIUM_BASE_URL: baseUrl },
        stdio: "inherit",
      },
    );

    const code = await new Promise((resolve) => result.on("exit", resolve));
    process.exitCode = code || 0;
  } finally {
    if (server) {
      stopProcessTree(server);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
