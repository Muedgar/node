function attachment({ field, originalName, savedAs, size, contentType }) {
  return { field, originalName, savedAs, size, contentType };
}

function render({ id, title, text, attachments }) {
  return { id, title, text, attachments: attachments.map(attachment) };
}

module.exports = { render, attachment };
