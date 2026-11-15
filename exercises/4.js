// MISTAKE

// const http = require("http");

// const PORT = 3000;
// const HOST = 'localhost';

// function cleanRequest(req) {
//     try {
//         req.pathname = new URL(`http://${HOST}:${PORT}${req.pathname}`)
//     } catch (error) {
//         throw new Error(error.message)
//     };

//     return req;
// }

// const router = require('./3');

// const useRouter = router();

// router.get('/', (req, res) => {
//     res.end({
//         message: 'server up and running...',
//         pathname: req.pathname
//     })
// })

// function handleRequest(req, res) {
//     const requestContext = cleanRequest(req);

//     if (requestContext) {}
// }

// SOLUTION
const http = require("http");
const { createRouter } = require("./3");

const HOST = "127.0.0.1";
const PORT = 3102;

function createRequestContext(req) {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    return {
        method: req.method,
        url: req.url,
        pathname: url.pathname,
        query: url.searchParams,
        params: {}
    };
}

const router = createRouter();

router.get("/", (req, res) => {
    // do things
})

function handleRequest(req, res) {
    const requestContext = createRequestContext(req);

    try {
        
    } catch (err) {

    }
}