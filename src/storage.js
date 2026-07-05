const DB_NAME = "gestion-personnel";
const STORE = "kv";
const API_URL = import.meta.env.VITE_API_URL || "/api/storage";
const USE_LOCAL = import.meta.env.VITE_STORAGE === "local";
const SYNC_CHANNEL = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gestipers-data") : null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function apiRequest(method, key, value) {
  const url = `${API_URL}?key=${encodeURIComponent(key)}&_=${Date.now()}`;
  const opts = { method, headers: { "Cache-Control": "no-cache" } };
  if (method === "PUT") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify({ value });
  }
  const res = await fetch(url, opts);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (method === "GET") return res.json();
  return true;
}

async function remoteGet(key) {
  return apiRequest("GET", key);
}

async function remoteSet(key, value) {
  await apiRequest("PUT", key, value);
}

async function remoteDelete(key) {
  await apiRequest("DELETE", key);
}

function notifyPeers(key) {
  try { SYNC_CHANNEL?.postMessage({ key, t: Date.now() }); } catch { /* ignore */ }
}

window.storage = {
  async get(key, { preferRemote = false } = {}) {
    if (USE_LOCAL) {
      const value = await idbGet(key);
      return value == null ? null : { key, value };
    }
    if (preferRemote) {
      try {
        const remote = await remoteGet(key);
        if (remote?.value != null) await idbSet(key, remote.value).catch(() => {});
        return remote;
      } catch (err) {
        console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
        const value = await idbGet(key);
        return value == null ? null : { key, value };
      }
    }
    try {
      return await remoteGet(key);
    } catch (err) {
      console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      const value = await idbGet(key);
      return value == null ? null : { key, value };
    }
  },
  async set(key, value) {
    if (USE_LOCAL) {
      await idbSet(key, value);
      notifyPeers(key);
      return;
    }
    try {
      await remoteSet(key, value);
      await idbSet(key, value).catch(() => {});
      notifyPeers(key);
    } catch (err) {
      console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      await idbSet(key, value);
      notifyPeers(key);
    }
  },
  async delete(key) {
    if (USE_LOCAL) {
      await idbDelete(key);
      notifyPeers(key);
      return;
    }
    try {
      await remoteDelete(key);
      await idbDelete(key).catch(() => {});
      notifyPeers(key);
    } catch (err) {
      console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      await idbDelete(key);
      notifyPeers(key);
    }
  },
  subscribe(fn) {
    if (!SYNC_CHANNEL) return () => {};
    const handler = (e) => fn(e.data);
    SYNC_CHANNEL.addEventListener("message", handler);
    return () => SYNC_CHANNEL.removeEventListener("message", handler);
  },
};
