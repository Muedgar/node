function createRouter() {
    const routes = [];

    function splitPath(path) {
        return path.split('/').filter(Boolean)
    }

    function add(method, path, handler) {
        routes.push({
            method: method,
            path,
            handler,
            segments: splitPath(path)
        })
    }

    function register(method) {
        return (path, handler) => add(method, path, handler)
    }

    function match(method, path) {
        const requestSegments = splitPath(path);
        const pathMatches = [];

        for (const route of routes) {
            if (route.segments.length !== requestSegments.length) {
                continue;
            } 

            let valid = true;
            let score = 0;
            let params = {}

            for (let i =0; i<requestSegments.length; i++) {
                const actual = requestSegments[i];
                const expected = route.segments[i];
                
                if (expected.startsWith(':')) {
                    params[expected.slice(1)] = decodeURIComponent(actual);

                    score += 1
                } else if (actual == expected) {
                    score += 10
                } else {
                    valid = false
                }
            }

            if (valid == true) {
                pathMatches.push({
                    score,
                    params,
                    route
                })
            }
        } 

        const methodMatches = pathMatches.filter(path => path.route.method === method.toUpperCase()).sort((a, b) => b.score - a.score);

        if (methodMatches.length) {
            return {
                type: 'match',
                method: methodMatches[0].route.method,
                path: methodMatches[0].route.path,
                params: methodMatches[0].params,
                handler: methodMatches[0].handler
            }
        }

        if (pathMatches.length) {
            return {
                type: 'method-not-allowed',
            }
        } 

        return { type: 'route not found' }
    }

    return {
        add,
        get: register('GET'),
        post: register('POST'),
        patch: register('PATCH'),
        put: register('PUT'),
        delete: register('DELETE'),
        match
    }

}

module.exports = { createRouter }

