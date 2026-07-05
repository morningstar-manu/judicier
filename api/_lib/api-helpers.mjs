import { bearerUser } from "./auth.mjs";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function jsonResponse(status, body, extraHeaders = {}) {
  return {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export function optionsResponse() {
  return { status: 204, headers: corsHeaders(), body: "" };
}

export async function readJsonBody(req) {
  const raw =
    typeof req.body === "string"
      ? req.body
      : await new Promise((resolve, reject) => {
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks).toString()));
          req.on("error", reject);
        });
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function requireAuth(req) {
  const user = bearerUser(req);
  if (!user) return { error: jsonResponse(401, { error: "Non authentifié" }) };
  return { user };
}

export function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function sendVercel(res, result) {
  for (const [k, v] of Object.entries(result.headers || {})) {
    res.setHeader(k, v);
  }
  res.status(result.status).send(result.body);
}
