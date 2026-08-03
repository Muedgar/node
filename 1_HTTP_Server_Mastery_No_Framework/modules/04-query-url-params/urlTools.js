function splitPath(pathname) {
  return pathname.split("/").filter(Boolean);
}

function matchPath(pattern, pathname) {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(pathname);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      const name = patternPart.slice(1);

      try {
        params[name] = decodeURIComponent(pathPart);
      } catch {
        const err = new Error(`Invalid URL encoding for param "${name}"`);
        err.statusCode = 400;
        throw err;
      }

      continue;
    }

    if (patternPart !== pathPart) return null;
  }

  return params;
}

function normalizeQuery(searchParams) {
  const query = {};

  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }

  return query;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parsePositiveInteger(value, field, defaultValue) {
  if (value === undefined || value === "") return defaultValue;

  if (Array.isArray(value)) {
    const err = new Error(`Query param "${field}" must appear once`);
    err.statusCode = 400;
    throw err;
  }

  if (!/^\d+$/.test(value)) {
    const err = new Error(`Query param "${field}" must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    const err = new Error(`Query param "${field}" must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }

  return parsed;
}

function parseEnum(value, field, allowedValues, defaultValue) {
  if (value === undefined || value === "") return defaultValue;

  if (Array.isArray(value)) {
    const err = new Error(`Query param "${field}" must appear once`);
    err.statusCode = 400;
    throw err;
  }

  if (!allowedValues.includes(value)) {
    const err = new Error(`Query param "${field}" must be one of: ${allowedValues.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  return value;
}

function parseBoolean(value, field, defaultValue) {
  if (value === undefined || value === "") return defaultValue;

  if (Array.isArray(value)) {
    const err = new Error(`Query param "${field}" must appear once`);
    err.statusCode = 400;
    throw err;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  const err = new Error(`Query param "${field}" must be true or false`);
  err.statusCode = 400;
  throw err;
}

function parseFileSearchQuery(query) {
  const page = parsePositiveInteger(query.page, "page", 1);
  const limit = parsePositiveInteger(query.limit, "limit", 5);

  if (limit > 20) {
    const err = new Error('Query param "limit" cannot be greater than 20');
    err.statusCode = 400;
    throw err;
  }

  return {
    page,
    limit,
    sort: parseEnum(query.sort, "sort", ["name", "size", "createdAt"], "name"),
    order: parseEnum(query.order, "order", ["asc", "desc"], "asc"),
    archived: parseBoolean(query.archived, "archived", false),
    q: typeof query.q === "string" ? query.q.trim().toLowerCase() : "",
    tags: asArray(query.tag).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
  };
}

module.exports = {
  matchPath,
  normalizeQuery,
  parseFileSearchQuery,
};
