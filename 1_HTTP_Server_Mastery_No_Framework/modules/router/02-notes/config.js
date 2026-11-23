const path = require("node:path");

const dataFile = process.env.DATA_FILE || path.join(__dirname, "data.json");
const uploadDir = path.join(path.dirname(dataFile), "attachments");

module.exports = { dataFile, uploadDir };
