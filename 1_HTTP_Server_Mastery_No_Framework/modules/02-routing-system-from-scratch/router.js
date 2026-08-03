function splitPath(pathname) {
  return pathname.split("/").filter(Boolean);
}

function compilePath(pathPattern) {
  return splitPath(pathPattern).map((segment) => {
    if (segment.startsWith(":")) {
      return {
        type: "param",
        name: segment.slice(1),
      };
    }

    return {
      type: "static",
      value: segment,
    };
  });
}

function decodeParam(value, paramName) {
  try {
    return decodeURIComponent(value);
  } catch {
    const err = new Error(`Invalid URL encoding for param "${paramName}"`);
    err.statusCode = 400;
    throw err;
  }
}

function matchSegments(routeSegments, requestSegments) {
  if (routeSegments.length !== requestSegments.length) return null;

  const params = {};
  let score = 0;

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i];
    const requestSegment = requestSegments[i];

    if (routeSegment.type === "static") {
      if (routeSegment.value !== requestSegment) return null;
      score += 10;
      continue;
    }

    params[routeSegment.name] = decodeParam(requestSegment, routeSegment.name);
    score += 1;
  }

  return { params, score };
}

function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    routes.push({
      method: method.toUpperCase(),
      path,
      segments: compilePath(path),
      handler,
      order: routes.length,
    });
  }

  function register(method) {
    return (path, handler) => add(method, path, handler);
  }

  function match(method, pathname) {
    const normalizedMethod = method.toUpperCase();
    const requestSegments = splitPath(pathname);
    const pathMatches = [];

    for (const route of routes) {
      const matched = matchSegments(route.segments, requestSegments);
      if (!matched) continue;

      pathMatches.push({
        route,
        params: matched.params,
        score: matched.score,
      });
    }

    const methodMatches = pathMatches
      .filter((match) => match.route.method === normalizedMethod)
      .sort((a, b) => b.score - a.score || a.route.order - b.route.order);

    if (methodMatches.length > 0) {
      const best = methodMatches[0];
      return {
        type: "match",
        handler: best.route.handler,
        params: best.params,
        route: {
          method: best.route.method,
          path: best.route.path,
        },
      };
    }

    if (pathMatches.length > 0) {
      return {
        type: "method-not-allowed",
        allowedMethods: [...new Set(pathMatches.map((match) => match.route.method))].sort(),
      };
    }

    return {
      type: "not-found",
    };
  }

  function listRoutes() {
    return routes.map((route) => ({
      method: route.method,
      path: route.path,
    }));
  }

  return {
    add,
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    patch: register("PATCH"),
    delete: register("DELETE"),
    match,
    listRoutes,
  };
}

module.exports = { createRouter };
