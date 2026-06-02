const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const pool = require("./db/pool");
const {
  createHealthHandlers,
  createRequestContext,
  createRequestLogger,
  createRequestMetrics,
  errorHandler,
  notFoundHandler,
} = require("../../shared/http");
const { version } = require("../package.json");

const SERVICE_NAME = "billing";
const app = express();
const { health, ready } = createHealthHandlers({ serviceName: SERVICE_NAME, pool, version });
const { metricsMiddleware, metricsHandler } = createRequestMetrics({ serviceName: SERVICE_NAME });

app.use(cors());
app.use(express.json());
app.use(createRequestContext());
app.use(metricsMiddleware);
app.use(createRequestLogger({ serviceName: SERVICE_NAME }));

app.get("/health", health);
app.get("/ready", ready);
app.get("/metrics", metricsHandler);
app.use("/billing", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
