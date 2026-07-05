import { handleStorageRequest } from "./_lib/handlers.mjs";

export default async function handler(req, res) {
  const body =
    req.method === "PUT"
      ? await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks).toString()));
          req.on("error", reject);
        })
      : "";

  const url = req.url || "/api/storage";
  const result = await handleStorageRequest(req.method, url, body, {
    headers: req.headers || {},
  });

  for (const [k, v] of Object.entries(result.headers || {})) {
    res.setHeader(k, v);
  }
  res.status(result.status).send(result.body);
}
