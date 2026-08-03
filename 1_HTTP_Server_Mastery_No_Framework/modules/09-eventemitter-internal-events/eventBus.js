const { EventEmitter } = require("events");
const crypto = require("crypto");

function createEventBus() {
  const emitter = new EventEmitter();
  const auditLog = [];

  function record(type, payload) {
    const entry = {
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString(),
    };

    auditLog.push(entry);
    if (auditLog.length > 100) auditLog.shift();

    return entry;
  }

  function emit(type, payload = {}) {
    const event = {
      id: crypto.randomUUID(),
      type,
      payload,
      emittedAt: new Date().toISOString(),
    };

    for (const listener of emitter.listeners(type)) {
      try {
        listener(event);
      } catch (err) {
        record("listener.error", {
          sourceEvent: type,
          message: err.message,
        });
      }
    }

    return event;
  }

  function on(type, listener) {
    emitter.on(type, listener);
  }

  function getAuditLog() {
    return [...auditLog].reverse();
  }

  function wireAuditLog() {
    on("auth.login", (event) => {
      record("auth.login", {
        email: event.payload.email,
        ip: event.payload.ip,
      });
    });

    on("file.uploaded", (event) => {
      record("file.uploaded", {
        fileId: event.payload.fileId,
        name: event.payload.name,
        size: event.payload.size,
      });
    });

    on("file.deleted", (event) => {
      record("file.deleted", {
        fileId: event.payload.fileId,
        name: event.payload.name,
      });
    });

    on("server.error", (event) => {
      record("server.error", {
        route: event.payload.route,
        message: event.payload.message,
      });
    });
  }

  return {
    emit,
    getAuditLog,
    on,
    record,
    wireAuditLog,
  };
}

module.exports = { createEventBus };
