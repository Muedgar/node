const http = require('http');

const HOST = "127.0.0.1";
const PORT = 3101;
const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload, null, 2);

    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders
    });
    res.end(body);
}

function sendText(res, statusCode, body, extraHeaders = {}) {
    res.writeHead(statusCode, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      ...extraHeaders,  
    });
    res.end(body);
}

function readRequestBody(req, limitBytes) {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        const chunks = [];

        req.on("data", (chuck) => {
            totalBytes += chunks.length;
            if (totalBytes > limitBytes) {
                const err = new Error("Request body too large");
                err.statusCode = 413;
                err.totalBytes = totalBytes;
                reject(err);
                req.destroy();
                return;
            }

            chunks.push(chunk);
        });

        req.on("end", () => {
            resolve({
                buffer: Buffer.concat(chunks),
                totalBytes,
            })
        })

        req.on("error", reject);
    })
}

function getClientAddress(req) {
    return {
        remoteAddress: req.socket.remoteAddress,
        remotePort: req.socket.remotePort,
        localAddress: req.socket.localAddress,
        localPort: req.socket.localPort
    }
}

function getHeaderBytes(req) {
    return Buffer.byteLength(req.rawHeaders.join("\r\n"), "utf8");
}

async function handleInspect(req, res, startedAt) {
    try {
        const {buffer, totalBytes} = await readRequestBody(req, MAX_BODY_BYTES);
        const finishedAt = process.hrtime.bigint();
        const durationMs = Number(finishedAt - startedAt) / 1_000_000;
        const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

        sendJson(res, 200, {
            ok: true,
            request: {
                method: req.method,
                url: req.url,
                pathname: url.pathname,
                query: Object.fromEntries(url.searchParams.entries()),
                httpVersion: req.httpVersion
            },
            client: getClientAddress(req),
            headers: {
                rawHeaders: req.rawHeaders,
                parsedHeaders: req.headers,
                estimatedHeaderBytes: getHeaderBytes(req)
            },
            body: {
                bytes: totalBytes,
                previewUtf8: buffer.toString("utf8", 0, Math.min(buffer.length, 200)),
                truncatedPreview: buffer.length > 200,
            },
            timing: {
                durationMs: Number(durationMs.toFixed(3)),
                receivedAt: new Date().toISOString()
            }
        })
    } catch (error) {
        const statusCode = err.statusCode || 500;

        sendJson(res, statusCode, {
            ok: false,
            error: err.message,
            limitBytes: MAX_BODY_BYTES,
            receivedBytes: err.totalBytes
        })
    }
}

function handleRoutes(req, res) {
    const startedAt = process.hrtime.bigint();
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === '/health') {
        return sendJson(res, 200, {
            ok: true,
            module: '01-http-server-from-scratch'
        });
    }

    if (url.pathname === "/") {
        return sendText(
            res,
            200,
            [
                "Module 01 - HTTP Server From Scratch",
                "",
                "Routes:",
                "GET /health",
                "ANY /inspect",
                "",
                "Try:",
                "curl -i http://127.0.0.1:3101/health",
                "curl -i -X POST http://127.0.0.1:3101/inspect -H 'Content-Type: text/plain' --data 'hello pure node'"
            ].join("\n")
        );
    }

    if (url.pathname === "/inspect") {
        return handleInspect(req, res, startedAt);
    }

    return sendJson(res, 404, {
        ok: false,
        error: "Not found",
        availableRoutes: ["/", "/health", "/inspect"]
    })
}

const server = http.createServer(handleRoutes);

server.on("clientError", (err, socket) => {
    if (!socket.writable) return;

    socket.end(
        [
            "HTTP/1.1 400 Bad Request",
            "Connection: close",
            "Content-Type: text/plain; charset=utf-8",
            "",
            `Bad request: ${err.code || err.message}`
        ].join("\r\n")
    )
})

server.listen(PORT, HOST, () => {
    console.log("01 - HTTP Server From Scratch");
    console.log()
})