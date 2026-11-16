// // MISTAKE

// function createRouter() {
//     let routes = [];

//     function splitPath(path) {
//         return path.split('/').filter(Boolean);
//     }

//     function add(method, path, handler) {
//         routes.push({
//             method: method.toUpperCase(),
//             pathname: path,
//             handler,
//             segments: splitPath(path)
//         })
//     }

//     function register(method) {
//         return (path, handler) => add(method, path, handler);
//     }

//     function match(method, pathname) {
//         let pathMatches = [];
//         for (const route of routes) {
//             const actual = splitPath(pathname);
//             const expected = route.segments;

//             if (actual.length !== expected.length)   {
//                 continue;
//             }

//             let valid = true;
//             let score = 0;
//             let params = {};

//             for (let i = 0; i<expected.length; i++) {
//                 if (expected[i].includes(':')) {
//                     params[expected[i].slice(1)] = actual[i];

//                     score += 1;
//                 } else if (expected[i] === actual[i]) {
//                     score += 10;
//                 } else {
//                     valid = false
//                 }
//             }

//             if (valid) {
//                 pathMatches.push({
//                     params,
//                     score,
//                     route: {
//                         method: route.method,
//                         pathname: route.pathname
//                     }
//                 })
//             }
//         }

//         let pathMatch = pathMatches.filter(path => path.route.method == method).sort((a, b) => b.score - a.score);

//         if (pathMatch[0]) {
//             return {
//                 type: 'match',
//                 pathname: pathMatch[0].route.pathname,
//                 method: pathMatch[0].route.method,
//                 params: pathMatch[0].params
//             }
//         } else if (!pathMatch.length && pathMatches.length) {
//             return {
//                 type: 'method-not-allowed'
//             }
//         } 

//         return {
//             type: 'route not found'
//         }

//     }

//     return {
//         add,
//         get: register('GET'),
//         post: register('POST'),
//         delete: register('DELETE'),
//         put: register('PUT'),
//         match
//     }
// }

// module.exports = { createRouter };


// SOLUTION
function createRouter() {
    const routes = [];

    function splitPath(path) {
        return path.split('/').filter(Boolean);
    }

    function add(method, path, handler) {
        routers.push({
            method: method.toUpperCase(),
            path,
            handler,
            segments: splitPath(path)
        })
    }

    function match(method, pathname) {
        const requestSegments = splitPath(pathname);
        const pathMatches = [];

        for (const route of routes) {
            if (route.segments.length !== requestSegments.length) {
                continue;
            }

            const params = {};
            let score = 0;
            let valid = true;

            for (let i =0; i<route.segments.length; i++) {
                const expected = route.segments[i];
                const actual = requestSegments[i];

                if (expected.startsWith(':')) {
                    try {
                        params[expected.slice(1)] = decodeURIComponent(actual);
                    } catch {
                        const error = new Error(`Invalid "${expected.slice(1)}"`);
                        error.statusCode = 400;
                        throw error;
                    }

                    score += 1;
                } else if (expected === actual) {
                    score += 10;
                } else {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                pathMatches.push({ route, params, score });
            }
        }

        const methodMatches = pathMatches.filter((item) => item.route.method === method.toUpperCase()).sort((a, b) => b.score - a.score);

        if (methodMatches.length) {
            const { route, params } = methodMatches[0];

            return {
                type: "match",
                handler: route.handler,
                params,
                route: {
                    method: route.method,
                    path: route.path
                }
            }
        }

        if (pathMatches.length) {
            return {
                type: "method-not-allowed",
                allowedMethod: [
                    ... new Set(pathMatches.map((item) => item.route.method))
                ].sort()
            }
        }

        return { type: "not-found" }
    }

    function register(method) {
        return (path, handler) => add(method, path, handler);
    }

    return {
        add,
        get: register('GET'),
        post: register('POST'),
        put: register('PUT'),
        patch: register('PATCH'),
        delete: register('DELETE'),
        match,
        listRoutes: () => routes.map(({method, path}) => ({method, path}))
    }
}

module.exports = { createRouter };