const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// Manually parse .env file
function loadEnv() {
  try {
    const envPath = path.join(__dirname, "../../.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim();
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.error("Failed to parse .env file:", e);
  }
}

loadEnv();

async function run() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "tepay",
  });

  try {
    const [companies] = await pool.execute("SELECT id, username, webhook_url FROM companies");
    const [transactions] = await pool.execute("SELECT id, type, order_id, status, company_id FROM transactions ORDER BY id DESC LIMIT 5");
    console.log("DB_STATE:" + JSON.stringify({ companies, transactions }));
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}

run();
