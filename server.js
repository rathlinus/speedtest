const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Backend endpoints ──

  // garbage.php replacement — sends random data for download test
  if (pathname === "/backend/garbage.php" || pathname === "/garbage.php") {
    const ckSize = parseInt(parsed.query.ckSize) || 100;
    // Cap at 100 MB to prevent abuse
    const bytes = Math.min(ckSize, 100) * 1048576;
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Description": "File Transfer",
      "Content-Disposition": "attachment; filename=random.dat",
      "Content-Transfer-Encoding": "binary",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    });
    // Stream in 1MB chunks
    const chunkSize = 1048576;
    let remaining = bytes;
    function sendChunk() {
      if (remaining <= 0) {
        res.end();
        return;
      }
      const size = Math.min(chunkSize, remaining);
      const buf = crypto.randomBytes(size);
      remaining -= size;
      if (!res.write(buf)) {
        res.once("drain", sendChunk);
      } else {
        setImmediate(sendChunk);
      }
    }
    sendChunk();
    return;
  }

  // empty.php replacement — accepts uploads, returns empty for ping
  if (pathname === "/backend/empty.php" || pathname === "/empty.php") {
    if (req.method === "POST") {
      // Consume body
      req.on("data", () => {});
      req.on("end", () => {
        res.writeHead(200, {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
        });
        res.end();
      });
    } else {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      });
      res.end();
    }
    return;
  }

  // getIP.php replacement
  if (pathname === "/backend/getIP.php" || pathname === "/getIP.php") {
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    // Clean up IPv6-mapped IPv4
    if (ip.startsWith("::ffff:")) ip = ip.substring(7);
    if (ip === "::1") ip = "127.0.0.1";
    const isp = parsed.query.isp === "true" ? " - Local Server" : "";
    const distance = parsed.query.distance ? " (0 km)" : "";
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    });
    res.end(ip + isp + distance);
    return;
  }

  // ── Static files ──
  if (pathname === "/") pathname = "/custom.html";

  const filePath = path.join(ROOT, pathname);
  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + pathname);
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Speedtest running at: http://localhost:${PORT}\n`);
});
