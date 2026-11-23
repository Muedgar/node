const http = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function start(app) {
  const server = app.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const request = (
    pathname,
    { method = "GET", body, headers = {}, raw } = {}
  ) =>
    new Promise((resolve, reject) => {
      if (body !== undefined) {
        raw = JSON.stringify(body);
        headers = { "Content-Type": "application/json", ...headers };
      }
      const req = http.request(
        {
          host: "127.0.0.1",
          port: server.address().port,
          path: pathname,
          method,
          headers,
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString();
            let json;
            try {
              json = JSON.parse(text);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              text,
              json,
            });
          });
        }
      );
      req.setTimeout(2000, () => req.destroy(new Error("HTTP test timed out")));
      req.on("error", reject);
      req.end(raw);
    });
  const close = () =>
    new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  return { request, close };
}

async function launch(serverFile, dataFile) {
  const { spawn } = require("node:child_process");
  const child = spawn(process.execPath, [serverFile], {
    env: { ...process.env, PORT: "0", DATA_FILE: dataFile },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  let url;
  try {
    url = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error("Server did not start: " + stderr)),
        5000
      );
      function done(error, address) {
        clearTimeout(timer);
        error ? reject(error) : resolve(address);
      }
      child.once("error", (error) => done(error));
      child.once("exit", (code) =>
        done(new Error(`Server exited (${code}): ${stderr}`))
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
        if (match) done(null, match[0]);
      });
    });
  } catch (error) {
    child.kill();
    await exited;
    throw error;
  }
  return {
    request: async (
      pathname,
      { method = "GET", headers = {}, body, raw } = {}
    ) => {
      if (body !== undefined) {
        raw = JSON.stringify(body);
        headers = { "Content-Type": "application/json", ...headers };
      }
      const response = await fetch(url + pathname, {
        method,
        headers,
        body: raw,
        signal: AbortSignal.timeout(3000),
      });
      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {}
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        text,
        json,
      };
    },
    close: async () => {
      child.kill();
      await exited;
    },
  };
}

async function fixture(t, serverFile) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "router-project-"));
  const dataFile = path.join(directory, "data.json");
  let running;
  try {
    running = await launch(serverFile, dataFile);
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
  t.after(async () => {
    await running.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    dataFile,
    request: (...args) => running.request(...args),
    read: async () => JSON.parse(await fs.readFile(dataFile, "utf8")),
    restart: async () => {
      await running.close();
      running = await launch(serverFile, dataFile);
    },
  };
}
module.exports = { start, fixture };
