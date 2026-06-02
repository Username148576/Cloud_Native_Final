const { randomUUID } = require("crypto");
const path = require("path");

const loadPackage = (name) => {
  const searchPaths = [
    require.main?.filename ? path.dirname(require.main.filename) : null,
    process.cwd(),
    __dirname,
  ].filter(Boolean);

  return require(require.resolve(name, { paths: searchPaths }));
};

const client = loadPackage("prom-client");
const pino = loadPackage("pino");
const pinoHttp = loadPackage("pino-http");

const startedAt = new Date();

const normalizeRoutePath = (routePath) => {
  if (Array.isArray(routePath)) return normalizeRoutePath(routePath[0]);
  if (routePath instanceof RegExp) return routePath.toString();
  return routePath ? String(routePath) : "";
};

const getRouteTemplate = (req) => {
  if (!req.route) return "unmatched";

  const basePath = req.baseUrl || "";
  const routePath = normalizeRoutePath(req.route.path);

  if (!routePath || routePath === "/") return basePath || "/";
  return `${basePath}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
};

const createRequestContext = () => (req, res, next) => {
  const requestId = req.get("X-Request-Id") || randomUUID();

  req.requestId = requestId;
  req.id = requestId;
  res.set("X-Request-Id", requestId);

  next();
};

const createRequestLogger = ({ serviceName }) => {
  if (process.env.NODE_ENV === "test") {
    return (_req, _res, next) => next();
  }

  return pinoHttp({
    logger: pino({
      base: { service: serviceName },
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    genReqId: (req, res) => {
      const requestId = req.requestId || req.get("X-Request-Id") || randomUUID();
      req.requestId = requestId;
      req.id = requestId;
      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
    customProps: (req, res) => ({
      requestId: req.requestId,
      method: req.method,
      route: getRouteTemplate(req),
      statusCode: res.statusCode,
    }),
    customSuccessMessage: () => "request_completed",
    customErrorMessage: () => "request_failed",
  });
};

const createRequestMetrics = ({ serviceName }) => {
  const registry = new client.Registry();

  client.collectDefaultMetrics({ register: registry });

  const serviceInfo = new client.Gauge({
    name: "ordering_service_info",
    help: "Service metadata.",
    labelNames: ["service"],
    registers: [registry],
  });

  const httpRequests = new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests.",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  const httpDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds.",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  serviceInfo.set({ service: serviceName }, 1);

  const metricsMiddleware = (req, res, next) => {
    const endTimer = httpDuration.startTimer();

    res.on("finish", () => {
      const labels = {
        method: req.method,
        route: getRouteTemplate(req),
        status_code: String(res.statusCode),
      };

      httpRequests.inc(labels);
      endTimer(labels);
    });

    next();
  };

  const metricsHandler = async (_req, res, next) => {
    try {
      res.set("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      next(err);
    }
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
