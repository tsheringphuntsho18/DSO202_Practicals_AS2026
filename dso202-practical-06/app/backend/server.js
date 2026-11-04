const http = require("http");
const { Pool } = require("pg");

const port = Number(process.env.PORT || 3001);
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 10,
  connectionTimeoutMillis: 3000
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function initializeDatabase() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          customer VARCHAR(80) NOT NULL,
          type VARCHAR(10) NOT NULL CHECK (type IN ('CREDIT','PAYMENT')),
          amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
          note VARCHAR(200),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log("Database table is ready");
      return;
    } catch (err) {
      console.error(`Database not ready (attempt ${attempt}/30): ${err.message}`);
      await sleep(2000);
    }
  }
  throw new Error("Could not initialize database after 30 attempts");
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }
  if (req.method === "GET" && req.url === "/api/health") {
    try { await pool.query("SELECT 1"); return send(res, 200, { status: "ok", service: "creditbook-api" }); }
    catch (err) { return send(res, 503, { status: "database-unavailable" }); }
  }
  if (req.method === "GET" && req.url === "/api/transactions") {
    try {
      const result = await pool.query("SELECT id, customer, type, amount, note, created_at FROM transactions ORDER BY id DESC");
      return send(res, 200, result.rows);
    } catch (err) { console.error(err); return send(res, 500, { error: "Could not retrieve transactions" }); }
  }
  if (req.method === "POST" && req.url === "/api/transactions") {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 10000) req.destroy(); });
    req.on("end", async () => {
      try {
        const data = JSON.parse(raw || "{}");
        const customer = String(data.customer || "").trim();
        const type = String(data.type || "");
        const amount = Number(data.amount);
        const note = String(data.note || "").trim().slice(0, 200);
        if (!customer || customer.length > 80 || !["CREDIT", "PAYMENT"].includes(type) || !Number.isFinite(amount) || amount <= 0) {
          return send(res, 400, { error: "Provide a customer, valid transaction type and positive amount." });
        }
        const result = await pool.query(
          "INSERT INTO transactions(customer,type,amount,note) VALUES($1,$2,$3,$4) RETURNING *",
          [customer, type, amount, note]
        );
        return send(res, 201, result.rows[0]);
      } catch (err) {
        console.error(err);
        return send(res, 400, { error: "Invalid request body." });
      }
    });
    return;
  }
  return send(res, 404, { error: "Not found" });
});

initializeDatabase().then(() => {
  server.listen(port, "0.0.0.0", () => console.log(`Credit Book API listening on ${port}`));
}).catch(err => {
  console.error(err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  server.close();
  await pool.end();
});
