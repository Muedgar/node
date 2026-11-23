const { createMatcher } = require("./01-matcher");
const { runPipeline } = require("./06-middleware");
const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

// Reject configuration mistakes before the server receives requests.
function checkPath(path) {
  if (typeof path !== "string" || !path.startsWith("/"))
    throw new TypeError("Paths must start with /");
}

// A child receives a relative path, but parent handlers must regain their own context.
function mountRouter(child, prefix) {
  return async (req, res, next) => {
    const previous = {
      path: req.path,
      baseUrl: req.baseUrl,
      params: req.params,
      route: req.route,
    };
    req.path = prefix === "/" ? req.path : req.path.slice(prefix.length) || "/";
    req.baseUrl += prefix === "/" ? "" : prefix;
    req.params = { ...req.params };
    try {
      await child.handle(req, res, (error, match) => {
        Object.assign(req, previous);
        return next(error, match);
      });
    } finally {
      Object.assign(req, previous);
    }
  };
}

// Method policy stays outside the matcher you already know: HEAD can reuse GET.
function selectRoute(matcher, method, path) {
  let match = matcher.match(method, path);
  if (method === "HEAD" && match.type !== "match") {
    const get = matcher.match("GET", path);
    if (get.type === "match") match = get;
  }
  if (match.type === "method-not-allowed") {
    const allowed = new Set(match.allowedMethods);
    if (allowed.has("GET")) allowed.add("HEAD");
    allowed.add("OPTIONS");
    match.allowedMethods = [...allowed].sort();
  }
  return match;
}

// Registration stores intent; handle() later turns that intent into executable layers.
function createRouter() {
  const matcher = createMatcher();
  const layers = [];

  // Preserve duplicate registrations as separate groups so next('route') can skip one.
  function add(method, path, ...handlers) {
    checkPath(path);
    handlers = handlers.flat(Infinity);
    if (
      !handlers.length ||
      handlers.some((handler) => typeof handler !== "function")
    )
      throw new TypeError("Routes require handler functions");
    const route = { method: method.toUpperCase(), path, handlers };
    matcher.add(method, path, route);
    layers.push({ route });
    return api;
  }

  // Both middleware and child routers share use(); normalize them to the same layer shape.
  function use(prefix, ...handlers) {
    if (
      typeof prefix === "function" ||
      Array.isArray(prefix) ||
      prefix?.handle
    ) {
      handlers.unshift(prefix);
      prefix = "/";
    }
    checkPath(prefix);
    if (prefix.length > 1 && prefix.endsWith("/")) prefix = prefix.slice(0, -1);
    handlers = handlers.flat(Infinity);
    if (!handlers.length) throw new TypeError("use requires middleware");
    const additions = handlers.map((handler) => {
      if (typeof handler?.handle === "function")
        handler = mountRouter(handler, prefix);
      if (typeof handler !== "function")
        throw new TypeError("Invalid middleware");
      return { prefix, handler };
    });
    layers.push(...additions);
    return api;
  }

  // Match once, collect layers in registration order, and let the pipeline execute them.
  async function handle(req, res, done, initialError) {
    let match = { type: "not-found" };
    let error = initialError;
    try {
      if (!error) match = selectRoute(matcher, req.method, req.path);
    } catch (failure) {
      error = failure;
    }
    const allowed = new Set(match.allowedMethods || []);
    const stack = [];
    for (const layer of layers) {
      if (!layer.route) {
        stack.push(layer);
        continue;
      }
      const { route } = layer;
      if (
        match.type !== "match" ||
        route.method !== match.route.method ||
        route.path !== match.route.path
      )
        continue;
      for (const handler of route.handlers) {
        stack.push({
          handler,
          group: route,
          params: match.params,
          route: match.route,
        });
      }
    }

    // Mounted children may discover the path but reject its method; keep that information.
    function collectMethods(childMatch) {
      for (const method of childMatch.allowedMethods || []) allowed.add(method);
    }

    // Reaching the end is a result, not a response: the application chooses 404/405/OPTIONS.
    function finish(failure) {
      return done(
        failure,
        allowed.size
          ? { type: "method-not-allowed", allowedMethods: [...allowed].sort() }
          : match
      );
    }
    return runPipeline(stack, req, res, finish, collectMethods, error);
  }

  const api = { add, use, handle, listRoutes: matcher.listRoutes };
  for (const method of METHODS)
    api[method] = (path, ...handlers) =>
      add(method.toUpperCase(), path, ...handlers);

  // Route chains reuse the same registration function instead of defining seven methods twice.
  api.route = (path) => {
    checkPath(path);
    const chain = {};
    for (const method of METHODS) {
      chain[method] = (...handlers) => {
        api[method](path, ...handlers);
        return chain;
      };
    }
    return chain;
  };
  return api;
}

module.exports = { createRouter };
