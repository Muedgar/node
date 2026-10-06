const http = require('http')


const server = http.createServer()

server.on('request', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({
        data: 'Hello world'
    }));
})

server.listen(3000, '127.0.0.1', () => {
    console.log('app listening on port 3000...')
})