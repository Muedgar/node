// Keep the original combined demo's { handler, params } | null contract.
const {
  createMatcher,
} = require("../../modules/router/routes-fundamentals/01-matcher");
function createRouter() {
  const matcher = createMatcher();
  return {
    add: matcher.add,
    match(method, pathname) {
      const result = matcher.match(method, pathname);
      return result.type === "match"
        ? { handler: result.handler, params: result.params }
        : null;
    },
  };
}
module.exports = { createRouter };
