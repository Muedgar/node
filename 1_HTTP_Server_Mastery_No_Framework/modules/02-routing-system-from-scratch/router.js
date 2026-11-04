
function createRouter() {
  const routes = [];

  function splitPath(path) {
    return path.split("/").filter(Boolean);
  }

  function add(method, path, handler) {
    routes.push({
      method: method.toUpperCase(),
      path,
      handler,
      segments: splitPath(path),
    });
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
            const error = new Error(
              `Invalid URL encoding for param "${expected.slice(1)}"`
            );
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

    const methodMatches = pathMatches
      .filter((item) => item.route.method === method.toUpperCase())
      .sort((a, b) => b.score - a.score);

    if (methodMatches.length) {
      const { route, params } = methodMatches[0];

      return {
        type: "match",
        handler: route.handler,
        params,
        route: {
          method: route.method,
          path: route.path,
        },
      };
    }

    if (pathMatches.length) {
      return {
        type: "method-not-allowed",
        allowedMethods: [
          ...new Set(pathMatches.map((item) => item.route.method)),
        ].sort(),
      };
    }

    return { type: "not-found" };
  }

  function register(method) {
    return (path, handler) => add(method, path, handler);
  }

  return {
    add,
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    patch: register("PATCH"),
    delete: register("DELETE"),
    match,
    listRoutes: () =>
      routes.map(({ method, path }) => ({ method, path })),
  };
}

module.exports = { createRouter };
