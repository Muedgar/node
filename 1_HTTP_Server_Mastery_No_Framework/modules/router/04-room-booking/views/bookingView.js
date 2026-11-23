function room({ id, name }) {
  return { id, name };
}
function render({ id, roomId, start, end, cancelled }) {
  return { id, roomId, start, end, cancelled };
}

module.exports = { room, render };
