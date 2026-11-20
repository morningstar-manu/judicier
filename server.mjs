/**
 * Serveur de production GestiPers (Judicier) — hors Vercel.
 * Sert le build Vite (dist/) + /api/v1 + /api/storage.
 * Écoute 0.0.0.0:$PORT (contrat Docker / Proxmox Bangui).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleV1NodeRequest } from "./api/_lib/v1-router.mjs";
import { handleStorageRequest } from "./api/_lib/handlers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const joined = path.normalize(path.join(root, decoded));
  if (!joined.startsWith(root)) return null;
  return joined;
}

async function handleStorage(req, res) {
  let body = "";
  if (req.method === "PUT") {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }
  const result = await handleStorageRequest(req.method, req.url || "/api/storage", body, {
    headers: req.headers || {},
  });
  for (const [k, v] of Object.entries(result.headers || {})) {
    res.setHeader(k, v);
  }
  res.statusCode = result.status;
  res.end(result.body);
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  try {
    if (url.startsWith("/api/v1")) {
      await handleV1NodeRequest(req, res);
      return;
    }
    if (url.startsWith("/api/storage")) {
      await handleStorage(req, res);
      return;
    }
    if (url === "/api/health" || url.startsWith("/api/health?")) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, service: "gestipers" }));
      return;
    }

    const candidate = safeJoin(DIST, url === "/" ? "/index.html" : url);
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      sendFile(res, candidate);
      return;
    }

    const index = path.join(DIST, "index.html");
    if (fs.existsSync(index)) {
      res.statusCode = 200;
      sendFile(res, index);
      return;
    }

    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Build manquant (dist/). Lancez npm run build." }));
  } catch (err) {
    console.error("[server]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err.message || "Erreur serveur" }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[gestipers] http://${HOST}:${PORT}`);
});
