const http = require("http");



function sendJson(res, statusCode, payload, extraHeaders) {
    const body = JSON.stringify(payload, null, 2);

    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.length(body.length),
        extraHeaders
    });
    res.end(body)
}

function sendText(res, statusCode, payload, extraHeaders) {
    res.writeHead(statusCode, {
        'Content-Type': 'text/plain, charset-utf8',
        extraHeaders
    });
    res.end(payload)
}

function inspectRequest(req, res) {
    return sendJson(res, 200, {
        address: req.socket.clientAddress
    })
}

function route(req, res) {
    if (req.path == '/inspect') {
        return inspectRequest(req, res)
    }

    if (req.path == '/health') {
        return sendText(res, 200, 'alive');
    }

    // return sendJson()
}

const server = new http.Server(route);

server.listen(3000, '127.0.0.1', () => {
    console.log('server up and running.')
})