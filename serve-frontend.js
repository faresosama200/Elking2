const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 5500;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const server = http.createServer((req, res) => {
  let pathname = url.parse(req.url).pathname;

  // Root redirect
  if (pathname === "/" || pathname === "") {
    res.writeHead(302, { Location: "/login/login.html" });
    res.end();
    return;
  }

  const filePath = path.join(ROOT, pathname);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", MIME[ext] || "text/plain");
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found: " + pathname);
    }
  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("=====================================");
  console.log("  TalentHub Frontend Server");
  console.log("=====================================");
  console.log("  http://127.0.0.1:" + PORT + "/login/login.html");
  console.log("=====================================");
});
