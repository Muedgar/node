// // MISTAKE
// const http = require('http');

// const { createRouter } = require('./5');

// const router = createRouter();

// function handleRequests(req, res) {
//     const matched = router.match(req.headers.method, req.pathname);

//     if (matched.type === 'match') {
//         return matched.
//     }
// }


// SOLUTION

const http = require('http');
const {createRouter} = require('./5');

const HOST = '127.0.0.1';
const PORT = 3102;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload, null, 2);

    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=uft-8",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders
    });

    res.end(body);
}

function parseQuery(searchParams) {
    const query = {};

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
    };
}

const router = createRouter();

router.get('/', (req, res) => {
    sendJson(res, 200, {
        message: 'OK'
    })
})

function handleRequest(req, res) {
    const requestContext = createRequestContext(req);

    try {
        const matched = router.match(req.method, requestContext.pathname);

        if (matched.type === "match") {
            req.params = matched.params;
            req.query = requestContext.query;
            req.path = requestContext.pathname;
            req.route = matched.route;
            return matched.handler(req, res);
        }

        if (matched.type === "method-not-allowed") {
            return sendJson(res, 405, {ok: false})
        }

        return sendJson(res, 404, {
            ok: false
        });

    } catch (error) {
        return sendJson(res, error.statusCode || 500, {ok: false})
    }
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
    console.log('Server up and running...')
});
