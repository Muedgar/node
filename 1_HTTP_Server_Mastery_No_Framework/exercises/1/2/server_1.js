const http = require("http");
const { createRouter } = require("./router_1");

const HOST = "127.0.0.1";
const PORT = 3102;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload, null, 2);

    res.writeHead(statusCode, {
        "Content-Type": "spplication/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders
    });
    res.end(body);
}

function parseQuery(searchParams) {
    const query = {};

    for (const [key, value] of searchParams.entries()) {
        if (query[key] === undefined) {
            query[key] = value;
        } else if (Array.isArray(query[key])) {
            query[key].push(value);
        } else {
            query[key] = [query[key], value];
        }
    }

    return query;
}

function createRequestContext(req) {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    return {
        method: req.method,
        url: req.url,
        pathname: url.pathname,
        query: parseQuery(url.searchParams),
        params: {}
    }
}

const router = createRouter();

router.get("/", (req, res) => {
    sendJson(res, 200, {
        module: 'asdf',
        routes: router.listRoutes(),
        examples: [
            "asdf",
            "sf"
        ]
    })
})

router.get("/health", (req, res) => {
    sendJson(res, 200, {
        ok: true,
        module: "asdf"
    })
});

router.get("/users/:userId", (req, res) => {
    sendJson(res, 200, {
        action: "show-user",
        params: req.params,
        query: req.query
    })
});

router.get();