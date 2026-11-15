// MISTAKE.
// function router() {
//     const routes = [];
    
//     function splitPath(pathname) {
//         return pathname.split('/').filter(Boolean);
//     }

//     function add(method, handler) {
//         const route = {
//             method: method,
//             pathname: req.pathname,
//             segments: splitPath(req.pathname)
//         }

//         routes.push(route);
//     }

//     function match(method, pathname) {
//         const requestSegments = splitPath(pathname);

//         const matches = []

//         for (const route of routes) {
//             const params = {};
//             let score = 0;
//             const routeSegments = route.segments;

//             if (routeSegments.length != requestSegments.length) {
//                 continue;
//             } 

//             for (let i=0; i<requestSegments.length; i++) {
//                 if (routeSegments.includes(':')) {

//                     params[routeSegments.slice(1)] = requestSegments[i]

//                     score += 1;
//                 } else if (routeSegments === requestSegments[i]) {
//                     score += 10;
//                 } else {
//                     break;
//                 }
//             }

//             matches.push({params, score, route})

//         }

//         matches.sort((a, b) => b.score - a.score)

//         if (matches[0]) {
//             return matches[0]
//         } else if(!matches.length) {
//             return 'method not allowed'
//         } else {
//             return 'route not found'
//         }
//     }

//     function register(method) {
//         return (method, handler) => add(method, handler)
//     }

//     return {
//         add,
//         get: register('GET'),
//         post: register('POST'),
//         put: register('PUT'),
//         delete: register('DELETE'),
//     }
// }

// module.exports  = { router };

// SOLUTION
function createRouter() {
    const routes = [];

    function splitPath(path) {
        return path.split("/").filter(Boolean);
    }

    function add(method, path, handler) {
        routers.push({
            method: method.toUpperCase(),
            path,
            handler,
            segments: slipPath(path)
        });
    }

    function register(method) {
        return (path, handler) => add(method, path, handler)
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

            for (let i = 0; i < route.segments.length; i++) {
                const expected = route.segments[i];
                const actual = requestSegments[i];

                if (expected.startsWith(":")) {
                    try {
                        params[expected.slice(1)] = decodeURIComponent(actual);
                    } catch {
                        const error = new Error(`Invalid URL encoding for param "${expected.slice(1)}"`);
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
                pathMatches.push({ route, params, score })
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
                allowedMethods: [
                    ...new Set(pathMatches.map((item) => item.route.method))
                ].sort()
            }
        }

        return { type: "not-found" }
    }

    return {
        add,
        get: register("GET"),
        post: register("POST"),
        put: register("PUT"),
        patch: register("PATCH"),
        delete: register("DELETE"),
        match,
        listRoutes: () => routes.map(( method, path ) => ({ method, path }))
    }
}


module.exports = { createRouter }