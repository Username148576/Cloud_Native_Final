const { randomUUID } = require("crypto");

const startedAt = new Date();

const escapeLabel = (value) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");

const round = (value) => Math.round(value * 1000) / 1000;

const createRequestContext = () => (req, res, next) => {
  const requestId = req.get("X-Request-Id") || randomUUID();

  req.requestId = requestId;
  req.id = requestId;
  res.set("X-Request-Id", requestId);

  next();
};

const createRequestLogger = ({ serviceName }) => (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;

    console.log(JSON.stringify({
      level: "info",
      service: serviceName,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    }));
  });

  next();
};

const createRequestMetrics = ({ serviceName }) => {
  const requestCounts = new Map();
  let totalRequests = 0;
  let totalDurationMs = 0;

  const metricsMiddleware = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const key = `${req.method}|${res.statusCode}`;

      requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
      totalRequests += 1;
      totalDurationMs += durationMs;
    });

    next();
  };

  const metricsHandler = (_req, res) => {
    const service = escapeLabel(serviceName);
    const lines = [
      "# HELP ordering_service_info Service metadata.",
      "# TYPE ordering_service_info gauge",
      `ordering_service_info{service="${service}"} 1`,
      "# HELP ordering_http_requests_total Total HTTP requests by method and status.",
      "# TYPE ordering_http_requests_total counter",
    ];

    for (const [key, count] of requestCounts.entries()) {
      const [method, status] = key.split("|");
      lines.push(
        `ordering_http_requests_total{service="${service}",method="${escapeLabel(method)}",status="${escapeLabel(status)}"} ${count}`
      );
    }

    lines.push(
      "# HELP ordering_http_request_duration_ms_avg Average HTTP request duration in milliseconds.",
      "# TYPE ordering_http_request_duration_ms_avg gauge",
      `ordering_http_request_duration_ms_avg{service="${service}"} ${round(totalRequests ? totalDurationMs / totalRequests : 0)}`
    );

    res.type("text/plain; version=0.0.4").send(`${lines.join("\n")}\n`);
  };

  return { metricsMiddleware, metricsHandler };
};

const createHealthHandlers = ({ serviceName, pool, version = "1.0.0" }) => {
  const health = (_req, res) => {
    res.json({
      service: serviceName,
      status: "ok",
      version,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: startedAt.toISOString(),
      timestamp: new Date().toISOString(),
    });
  };

  const ready = async (_req, res) => {
    const start = Date.now();

    try {
      await pool.query("SELECT 1");

      res.json({
        service: serviceName,
        status: "ready",
        checks: {
          database: "ok",
        },
        responseTimeMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        service: serviceName,
        status: "not_ready",
        checks: {
          database: "down",
        },
        responseTimeMs: Date.now() - start,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return { health, ready };
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: "Not found",
    code: "not_found",
    path: req.originalUrl,
    requestId: req.requestId,
  });
};

const errorHandler = (err, req, res, _next) => {
  const requestedStatus = Number(err.statusCode || err.status || 500);
  const statusCode = requestedStatus >= 400 && requestedStatus < 600
    ? requestedStatus
    : 500;
  const message = statusCode >= 500
    ? "Internal server error"
    : err.message || "Request failed";

  if (process.env.NODE_ENV !== "test") {
    console.error(JSON.stringify({
      level: "error",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: err.message,
      stack: err.stack,
    }));
  }

  res.status(statusCode).json({
    error: message,
    code: err.code || (statusCode >= 500 ? "internal_server_error" : "request_error"),
    requestId: req.requestId,
  });
};

module.exports = {
  createHealthHandlers,
  createRequestContext,
  createRequestLogger,
  createRequestMetrics,
  errorHandler,
  notFoundHandler,
};
