/**
 * ecosystem.config.js
 * PM2 設定檔 — 管理所有微服務
 *
 * 使用方式：
 *   pm2 start ecosystem.config.js          # 啟動
 *   pm2 restart ecosystem.config.js        # 重啟
 *   pm2 reload ecosystem.config.js         # zero-downtime reload
 *   pm2 stop ecosystem.config.js           # 停止
 *   pm2 delete ecosystem.config.js         # 刪除所有 process
 *   pm2 logs                               # 看所有 log
 *   pm2 logs iam                           # 看特定服務 log
 *   pm2 status                             # 看狀態
 */

const path = require("path");
const ROOT = __dirname;

// 讀取 .env
require("dotenv").config({ path: path.join(ROOT, ".env") });

const commonEnv = {
  NODE_ENV: "production",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_HOST: process.env.RDS_HOST,
  DB_PORT: process.env.RDS_PORT || 5432,
  DB_SSL: process.env.DB_SSL || "false",
};

module.exports = {
  apps: [
    {
      name: "iam",
      script: path.join(ROOT, "iam/index.js"),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      error_file: path.join(ROOT, "logs/iam-error.log"),
      out_file: path.join(ROOT, "logs/iam-out.log"),
      env: {
        ...commonEnv,
        PORT: 3001,
        DB_NAME: "iam_db",
        JWT_EXPIRES_IN: "24h",
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        EMAIL_FROM: process.env.EMAIL_FROM,
        FRONTEND_URL: `http://${process.env.EC2_HOST || "localhost"}:8000/iam`,
      },
    },
    {
      name: "notification",
      script: path.join(ROOT, "notification/index.js"),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "200M",
      error_file: path.join(ROOT, "logs/notification-error.log"),
      out_file: path.join(ROOT, "logs/notification-out.log"),
      env: {
        ...commonEnv,
        PORT: 3002,
        DB_NAME: "notification_db",
      },
    },
    {
      name: "recommendation",
      script: path.join(ROOT, "recommendation/index.js"),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "300M",
      error_file: path.join(ROOT, "logs/recommendation-error.log"),
      out_file: path.join(ROOT, "logs/recommendation-out.log"),
      env: {
        ...commonEnv,
        PORT: 3003,
        DB_NAME: "recommendation_db",
        IAM_SERVICE_URL: "http://localhost:3001",
        ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL,
        MENU_SERVICE_URL: process.env.MENU_SERVICE_URL,
        INTERNAL_ADMIN_EMAIL: process.env.INTERNAL_ADMIN_EMAIL,
        INTERNAL_ADMIN_PASSWORD: process.env.INTERNAL_ADMIN_PASSWORD,
      },
    },
    {
      name: "billing",
      script: path.join(ROOT, "billing/index.js"),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "200M",
      error_file: path.join(ROOT, "logs/billing-error.log"),
      out_file: path.join(ROOT, "logs/billing-out.log"),
      env: {
        ...commonEnv,
        PORT: 3004,
        DB_NAME: "billing_db",
        IAM_SERVICE_URL: "http://localhost:3001",
        ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL,
        INTERNAL_ADMIN_EMAIL: process.env.INTERNAL_ADMIN_EMAIL,
        INTERNAL_ADMIN_PASSWORD: process.env.INTERNAL_ADMIN_PASSWORD,
      },
    },
    {
      name: "appeal-admin",
      script: path.join(ROOT, "appeal-admin/index.js"),
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "200M",
      error_file: path.join(ROOT, "logs/appeal-error.log"),
      out_file: path.join(ROOT, "logs/appeal-out.log"),
      env: {
        ...commonEnv,
        PORT: 3005,
        DB_NAME: "appeal_admin_db",
        ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL,
        MENU_SERVICE_URL: process.env.MENU_SERVICE_URL,
      },
    },
  ],
};
