import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { handleStorageRequest } from "./api/_lib/handlers.mjs";
import { handleV1NodeRequest } from "./api/_lib/v1-router.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
  resolve: {
    alias: {
      "@gestipers/shared": path.resolve(__dirname, "packages/shared"),
    },
  },
  plugins: [
    react(),
    {
      name: "api-dev",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || "";
          if (!url.startsWith("/api/")) return next();

          if (url.startsWith("/api/v1")) {
            try {
              await handleV1NodeRequest(req, res);
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          if (!url.startsWith("/api/storage")) return next();
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
};
});
