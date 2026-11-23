const { getErrorStatus } = require("./10-validation");

// A mounted prefix must end at a segment boundary: /api must not match /apix.
function prefixMatches(path, prefix) {
  return prefix === "/" || path === prefix || path.startsWith(prefix + "/");
}

// Walk one request through normal/error handlers without owning routing or responses.
function runPipeline(
  stack,
  req,
  res,
  done,
  onChildMatch = () => {},
  initialError
) {
  let activeGroup;
  // The cursor gives each next() a specific continuation, including async handlers.
  async function dispatch(index, error) {
    if (res.writableEnded || res.destroyed) return;
    if (index === stack.length) return done(error);
    const layer = stack[index];
    const isErrorHandler = layer.handler.length === 4;
    if (Boolean(error) !== isErrorHandler) return dispatch(index + 1, error);
    if (layer.prefix && !prefixMatches(req.path, layer.prefix))
      return dispatch(index + 1, error);
    if (layer.params && (!layer.group || activeGroup !== layer.group)) {
      activeGroup = layer.group;
      Object.assign(req, {
        params: { ...req.params, ...layer.params },
        route: layer.route,
      });
    }

    let called = false;
    let downstream;

    // Continue once, skip the current route, or leave this router; do not run a layer twice.
    function next(nextError, childMatch) {
      if (called) throw new Error("next() called more than once");
      called = true;
      if (childMatch) onChildMatch(childMatch);
      if (nextError === "router") return (downstream = Promise.resolve(done()));
      let nextIndex = index + 1;
      if (nextError === "route") {
        while (layer.group && stack[nextIndex]?.group === layer.group)
          nextIndex++;
        nextError = undefined;
      }
      downstream = dispatch(nextIndex, nextError);
      return downstream;
    }

    try {
      await (error
        ? layer.handler(error, req, res, next)
        : layer.handler(req, res, next));
      if (downstream) await downstream;
    } catch (failure) {
      return dispatch(index + 1, failure);
    }
  }
  return dispatch(0, initialError);
}

// A factory avoids repeating one-off middleware for fixed response metadata.
function setResponseHeader(name, value) {
  return (req, res, next) => {
    res.setHeader(name, value);
    return next();
  };
}

// Once headers are sent we cannot replace the response; otherwise render a safe error.
function errorHandler({ project } = {}) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = getErrorStatus(error);
    const body = {
      error: status < 500 ? error.message : "Internal server error",
    };
    if (project) body.project = project;
    res.status(status).json(body);
  };
}

module.exports = { runPipeline, setResponseHeader, errorHandler };
