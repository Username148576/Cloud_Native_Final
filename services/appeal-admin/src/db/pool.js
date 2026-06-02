const { Pool } = require("pg");

const SERVICE_NAME = "appeal-admin";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "appeal_admin_db",
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypassword",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.connect((err, _client, release) => {
  if (process.env.NODE_ENV === "test") {
    if (release) release();
    return;
  }

  if (err) {
    console.error(JSON.stringify({
      level: "error",
      service: SERVICE_NAME,
      message: "database_connection_failed",
      error: err.message,
    }));
    return;
  }

  console.log(JSON.stringify({
    level: "info",
    service: SERVICE_NAME,
    message: "database_connected",
  }));
  release();
});

module.exports = pool;
