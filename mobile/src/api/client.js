import Constants from "expo-constants";

function resolveApiUrl() {
  const extraFromExpoConfig = Constants.expoConfig?.extra?.apiUrl;
  const extraFromManifest = Constants.manifest?.extra?.apiUrl;
  const extraFromManifest2 =
    Constants.manifest2?.extra?.expoClient?.extra?.apiUrl ||
    Constants.manifest2?.extra?.apiUrl;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;

  return (
    extraFromExpoConfig ||
    extraFromManifest ||
    extraFromManifest2 ||
    fromEnv ||
    "https://www.gestipers.org/api/v1"
  );
}

const DEFAULT_URL = resolveApiUrl();

let token = null;

export function setToken(t) {
  token = t;
}

export function getToken() {
  return token;
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${DEFAULT_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`Connexion API impossible (${DEFAULT_URL})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request("/health", { auth: false }),
  login: (identifiant, motDePasse) =>
    request("/auth/login", { method: "POST", auth: false, body: { identifiant, motDePasse } }),
  me: () => request("/auth/me"),
  verifyCard: (raw, code = "") =>
    request("/verify/card", { method: "POST", body: { raw, code } }),
  verifyId: (payload) => request("/verify/id", { method: "POST", body: payload }),
  parseMrz: (text) => request("/verify/parse-mrz", { method: "POST", body: { text } }),
  scanMrz: (dataUrl) => request("/verify/scan-mrz", { method: "POST", body: { dataUrl } }),
  verifyOfficial: (payload) => request("/verify/official", { method: "POST", body: payload }),
  listVisiteurs: (date) => request(`/visiteurs?date=${date || ""}`),
  createVisiteur: (payload) => request("/visiteurs", { method: "POST", body: payload }),
  uploadScan: (dataUrl, nomFichier) =>
    request("/scans", { method: "POST", body: { dataUrl, nomFichier } }),
  listBagages: (date) => request(`/bagages?date=${date || ""}`),
  createBagage: (payload) => request("/bagages", { method: "POST", body: payload }),
};

export { DEFAULT_URL as API_URL };
