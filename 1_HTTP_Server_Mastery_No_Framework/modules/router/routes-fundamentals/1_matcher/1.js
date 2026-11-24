function createServer() {
    const routes = [];

    function splitPath(path) {
        return path.split('/').filter(Boolean);
    }

    function add(method, pathname, handler) {
        routes.push({
            method,
            pathname,
            handler,
            segments: splitPath(pathname)
        })
    }
    

    function register(method) {
        return (method, handler) => add(method, pathname, handler)
    }

    function match(method, pathname) {
        const requestedSegments = splitPath(pathname);
        const pathMatches = [];

        for (const route of routes) {
            if (route.segments.length !== requestedSegments.length) continue;

            let score = 0;
            let params = {};
            let valid = true;

            for (let i = 0; i<route.segments.length; i++) {
                const expected = route.segments[i];
                const actual = requestedSegments[i];

                if (expected.startsWith(':')) {
                    params[expected.slice(1)] = actual;
                    score += 1;
                } else if (expected == actual) {
                    score += 10;
                } else {
                    valid = false;
                    break;
                }


            }

            if (valid) {
                pathMatches.push({
                    score,
                    params,
                    route
                })
            }
        }

        // method matches
        const methodMatches = pathMatches.filter(path => path.route.method === method).sort((a,b) => b.score - a.score);

        if (methodMatches) {
            return {
                type: 'match',
                params,
                method: route.method,
                handler: route.handler
            }
        }

        if (pathMatches) {
            return {
                type: 'method-not-allowed'
            }
        }

        return { type: 'not-found' }
    }

    return {
        add,
        get: register('GET'),
        patch: register('PATCH'),
        put: register('PUT'),
        delete: register('DELETE'),
        match
    }
}

module.exports = { createServer }