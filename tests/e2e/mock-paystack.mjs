// Minimal local stand-in for Paystack, used ONLY by the e2e suite.
// Implements the two endpoints the app calls plus a fake hosted-checkout page.
import http from "node:http";

const PORT = Number(process.env.MOCK_PAYSTACK_PORT ?? 3300);
const txns = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const json = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (!String(req.headers.authorization ?? "").startsWith("Bearer sk_test_")) return json(401, { status: false, message: "Invalid key" });

  if (req.method === "POST" && url.pathname === "/transaction/initialize") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const b = JSON.parse(raw);
      if (!b.email || !Number.isInteger(b.amount) || !b.reference || !b.callback_url) return json(400, { status: false, message: "bad request" });
      txns.set(b.reference, { amount: b.amount, currency: b.currency ?? "NGN", callback: b.callback_url, paid: false });
      json(200, { status: true, data: { authorization_url: `http://localhost:${PORT}/checkout/${b.reference}`, reference: b.reference } });
    });
    return;
  }
  const verify = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
  if (req.method === "GET" && verify) {
    const t = txns.get(decodeURIComponent(verify[1]));
    if (!t) return json(404, { status: false, message: "Transaction reference not found" });
    return json(200, { status: true, data: { status: t.paid ? "success" : "abandoned", reference: decodeURIComponent(verify[1]), amount: t.amount, currency: t.currency, id: 900001 } });
  }
  json(404, { status: false });
});

// Browser-facing fake checkout: marks the transaction paid and returns to the merchant's callback URL.
const checkout = http.createServer((req, res) => {
  const m = new URL(req.url, "http://x").pathname.match(/^\/checkout\/(.+)$/);
  const t = m && txns.get(decodeURIComponent(m[1]));
  if (!t) { res.writeHead(404); return res.end("unknown"); }
  t.paid = !new URL(req.url, "http://x").searchParams.has("fail");
  const back = new URL(t.callback);
  back.searchParams.set("reference", decodeURIComponent(m[1]));
  res.writeHead(302, { Location: back.toString() });
  res.end();
});

// One port serves both: API calls carry Authorization, browser navigations do not.
http.createServer((req, res) => (req.headers.authorization ? server : checkout).emit("request", req, res)).listen(PORT, () => console.log(`mock paystack on ${PORT}`));
