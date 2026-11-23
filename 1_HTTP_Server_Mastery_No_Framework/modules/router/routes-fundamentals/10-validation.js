// Carry an HTTP status with expected failures without making models depend on a response object.
function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

// Guard clauses keep invalid input out of the main success path.
function assertInput(condition, statusCode, message) {
  if (!condition) throw httpError(statusCode, message);
}

// Models also accept direct calls, so string validation must not depend on HTTP middleware.
function nonEmptyString(value, field) {
  assertInput(
    typeof value === "string" && value.trim(),
    422,
    `${field} must be a non-empty string`
  );
  return value;
}

// Route middleware validates required text fields before controllers access req.body.
function requireFields(...names) {
  return (req, res, next) => {
    assertInput(
      req.body && typeof req.body === "object" && !Array.isArray(req.body),
      422,
      "JSON object required"
    );
    for (const name of names) nonEmptyString(req.body[name], name);
    return next();
  };
}

// Missing records are expected client errors, not TypeErrors from reading undefined.
function findById(records, id, resourceName) {
  const record = records.find((item) => item.id === id);
  assertInput(record, 404, `${resourceName} not found`);
  return record;
}

// A bad error status must not turn a failure into HTTP 200 or crash response writing.
function getErrorStatus(error) {
  const status = error?.statusCode;
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 500;
}

module.exports = {
  httpError,
  assertInput,
  nonEmptyString,
  requireFields,
  findById,
  getErrorStatus,
};
