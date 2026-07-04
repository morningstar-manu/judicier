import {
  deleteFile,
  getFile,
  loadState,
  saveState,
  setFile,
} from "./sync.mjs";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function handleStorageRequest(method, url, bodyText) {
  const { searchParams } = new URL(url, "http://localhost");
  const key = searchParams.get("key");

  if (method === "OPTIONS") {
    return { status: 204, headers: corsHeaders(), body: "" };
  }

  if (!key) {
    return {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Paramètre key requis" }),
    };
  }

  try {
    if (key === "ghr:data") {
      if (method === "GET") {
        const state = await loadState();
        if (!state) {
          return {
            status: 404,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ error: "not_found" }),
          };
        }
        return {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: JSON.stringify(state) }),
        };
      }
      if (method === "PUT") {
        const { value } = JSON.parse(bodyText || "{}");
        if (!value) {
          return {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ error: "value requis" }),
          };
        }
        await saveState(JSON.parse(value));
        return {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true }),
        };
      }
    }

    if (key.startsWith("ghr:doc:")) {
      if (method === "GET") {
        const contenu = await getFile(key);
        if (contenu == null) {
          return {
            status: 404,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ error: "not_found" }),
          };
        }
        return {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: contenu }),
        };
      }
      if (method === "PUT") {
        const { value } = JSON.parse(bodyText || "{}");
        await setFile(key, value);
        return {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true }),
        };
      }
      if (method === "DELETE") {
        await deleteFile(key);
        return {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ok: true }),
        };
      }
    }

    return {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Clé non supportée" }),
    };
  } catch (err) {
    console.error("[storage]", err);
    return {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err.message || "Erreur serveur",
      }),
    };
  }
}
