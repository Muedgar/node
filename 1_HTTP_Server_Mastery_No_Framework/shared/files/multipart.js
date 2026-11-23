// Compatibility adapter: parsing is taught and implemented in Router fundamentals.
const {
  parseMultipartForm,
} = require("../../modules/router/routes-fundamentals/04-upload-parser");
async function multipartUpload(req, options) {
  const { fields, files } = await parseMultipartForm(req, {
    maxFileBytes: 5_000_000,
    maxBodyBytes: 7_000_000,
    ...options,
  });
  return { fields, files };
}
module.exports = { multipartUpload };
