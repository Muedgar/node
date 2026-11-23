const { createMatcher } = require("./01-matcher");
const { assertInput } = require("./10-validation");

// A query key can occur more than once; keep every value instead of losing data.
function parseQuery(searchParams) {
  const query = Object.create(null);
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return query;
}

// Scalar options such as page must reject ?page=1&page=2 rather than guess.
function singleValue(value, field, fallback) {
  assertInput(
    !Array.isArray(value),
    400,
    `Query param "${field}" must appear once`
  );
  return value === undefined || value === "" ? fallback : value;
}

// Query strings contain text; accept only safe, positive whole-number values.
function parsePositiveInteger(value, field, fallback) {
  value = singleValue(value, field, undefined);
  if (value === undefined) return fallback;
  const number = Number(value);
  assertInput(
    /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0,
    400,
    `Query param "${field}" must be a positive integer`
  );
  return number;
}

// Whitelist options such as sort/status so unexpected values cannot reach domain logic.
function parseEnum(value, field, choices, fallback) {
  value = singleValue(value, field, undefined);
  if (value === undefined) return fallback;
  assertInput(
    choices.includes(value),
    400,
    `Query param "${field}" must be one of: ${choices.join(", ")}`
  );
  return value;
}

// Boolean("false") is true; parse the two accepted strings explicitly instead.
function parseBoolean(value, field, fallback) {
  value = singleValue(value, field, undefined);
  if (value === undefined) return fallback;
  assertInput(
    value === "true" || value === "false",
    400,
    `Query param "${field}" must be true or false`
  );
  return value === "true";
}

// UTC and a round trip prevent machine timezones or dates like February 30 changing input.
function parseUtcTimestamp(value) {
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  assertInput(
    typeof value === "string" && pattern.test(value),
    422,
    "Valid UTC start < end required"
  );
  const time = Date.parse(value);
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  assertInput(
    Number.isFinite(time) && new Date(time).toISOString() === canonical,
    422,
    "Valid UTC start < end required"
  );
  return time;
}

// A booking needs an ordered pair of instants, not merely two valid dates.
function parseUtcInterval(startValue, endValue) {
  const start = parseUtcTimestamp(startValue);
  const end = parseUtcTimestamp(endValue);
  assertInput(start < end, 422, "Valid UTC start < end required");
  return { start, end };
}

// Keep the original URL demo compatible without reimplementing your memorized matcher.
function matchPath(pattern, pathname) {
  const matcher = createMatcher();
  matcher.get(pattern, () => {});
  const result = matcher.match("GET", pathname);
  return result.type === "match" ? result.params : null;
}

// Translate the original file-search demo's raw query into one validated contract.
function parseFileSearchQuery(query) {
  const limit = parsePositiveInteger(query.limit, "limit", 5);
  assertInput(
    limit <= 20,
    400,
    'Query param "limit" cannot be greater than 20'
  );
  const tags = query.tag === undefined ? [] : [].concat(query.tag);
  return {
    page: parsePositiveInteger(query.page, "page", 1),
    limit,
    sort: parseEnum(query.sort, "sort", ["name", "size", "createdAt"], "name"),
    order: parseEnum(query.order, "order", ["asc", "desc"], "asc"),
    archived: parseBoolean(query.archived, "archived", false),
    q: singleValue(query.q, "q", "").trim().toLowerCase(),
    tags: tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
  };
}

module.exports = {
  parseQuery,
  normalizeQuery: parseQuery,
  singleValue,
  parsePositiveInteger,
  parseEnum,
  parseBoolean,
  parseUtcInterval,
  matchPath,
  parseFileSearchQuery,
};
