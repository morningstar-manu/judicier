import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleStorageRequest } from "./api/_lib/handlers.mjs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "api-storage-dev",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/storage")) return next();
          const method = req.method || "GET";
          let body = "";
          if (method === "PUT") {
            body = await new Promise((resolve, reject) => {
              const chunks = [];
              req.on("data", (c) => chunks.push(c));
              req.on("end", () => resolve(Buffer.concat(chunks).toString()));
              req.on("error", reject);
            });
          }
          try {
            const result = await handleStorageRequest(method, req.url, body, {
              headers: req.headers || {},
            });
            for (const [k, v] of Object.entries(result.headers || {})) {
              res.setHeader(k, v);
            }
            res.statusCode = result.status;
            res.end(result.body);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
});
