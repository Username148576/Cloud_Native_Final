const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "notification_db",
  user: process.env.DB_USER || "myuser",
  password: process.env.DB_PASSWORD || "mypassword",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
pool.connect((err, client, release) => {
  if (err) console.error("❌ Notification DB failed:", err.message);
  else { console.log("✅ Notification DB connected"); release(); }
});
module.exports = pool;
