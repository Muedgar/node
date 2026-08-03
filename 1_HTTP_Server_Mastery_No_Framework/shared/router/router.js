// app/router.js
function createRouter() {
  const routes = []; // { method, path, parts, handler }

  function add(method, path, handler) {
    const parts = path.split("/").filter(Boolean);
    routes.push({ method, path, parts, handler });
  }

  function match(method, pathname) {
    const pathParts = pathname.split("/").filter(Boolean);

    for (const r of routes) {
      if (r.method !== method) continue;
      if (r.parts.length !== pathParts.length) continue;

      const params = {};
      let ok = true;

      for (let i = 0; i < r.parts.length; i++) {
        const rp = r.parts[i];
        const pp = pathParts[i];

        if (rp.startsWith(":")) {
          params[rp.slice(1)] = decodeURIComponent(pp);
        } else if (rp !== pp) {
          ok = false;
          break;
        }
      }

      if (ok) return { handler: r.handler, params };
    }

    return null;
  }

  return { add, match };
}

module.exports = { createRouter };