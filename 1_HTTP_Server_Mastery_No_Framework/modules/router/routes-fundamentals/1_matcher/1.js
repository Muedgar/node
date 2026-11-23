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

    function match() {}

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