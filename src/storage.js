const DB_NAME = "gestion-personnel";
const STORE = "kv";
const API_URL = import.meta.env.VITE_API_URL || "/api/storage";
const USE_LOCAL = import.meta.env.VITE_STORAGE === "local";
const SYNC_CHANNEL = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gestipers-data") : null;

const REMOTE_MIN_INTERVAL_MS = 45_000;
const VERSION_CHECK_MS = 20_000;

const memoryCache = new Map();

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

function getCache(key) {
  return memoryCache.get(key) || null;
}

function setCache(key, value, version = "") {
  const now = Date.now();
  memoryCache.set(key, { value, version: String(version || ""), at: now, versionAt: now });
}

function touchCache(key) {
  const entry = memoryCache.get(key);
  if (entry) entry.at = Date.now();
}

function bumpVersionCheck(key) {
  const entry = memoryCache.get(key);
  if (entry) entry.versionAt = Date.now();
}

function invalidateCache(key) {
  memoryCache.delete(key);
}

async function apiRequest(method, key, value, { meta, ifNoneMatch, bust } = {}) {
  const params = new URLSearchParams({ key });
  if (meta) params.set("meta", meta);
  if (bust) params.set("_", String(Date.now()));
  const url = `${API_URL}?${params}`;
  const opts = { method, headers: {} };
  if (ifNoneMatch) opts.headers["If-None-Match"] = ifNoneMatch;
  if (method === "PUT") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify({ value });
  }
  const res = await fetch(url, opts);
  if (res.status === 404) return { res, data: null };
  if (res.status === 304) return { res, data: { unchanged: true } };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = method === "GET" ? await res.json() : await res.json().catch(() => ({}));
  return { res, data };
}

async function remoteGetVersion(key) {
  const { res, data } = await apiRequest("GET", key, null, { meta: "version" });
  if (!data) return null;
  return {
    version: String(data.version ?? ""),
    etag: res.headers.get("ETag") || `"${data.version}"`,
  };
}

async function remoteGetFull(key, { ifNoneMatch, bust = true } = {}) {
  const { res, data } = await apiRequest("GET", key, null, { ifNoneMatch, bust });
  if (data?.unchanged) {
    return { unchanged: true, etag: res.headers.get("ETag") || ifNoneMatch };
  }
  if (!data) return null;
  const version = String(data.version ?? res.headers.get("ETag")?.replace(/"/g, "") ?? "");
  return { key: data.key, value: data.value, version, etag: res.headers.get("ETag") };
}

function notifyPeers(key, version) {
  try { SYNC_CHANNEL?.postMessage({ key, version, t: Date.now() }); } catch { /* ignore */ }
}

async function readLocal(key) {
  const value = await idbGet(key);
  return value == null ? null : { key, value };
}

window.storage = {
  async get(key, { preferRemote = false, force = false } = {}) {
    if (USE_LOCAL) {
      return readLocal(key);
    }

    const cached = getCache(key);
    const now = Date.now();

    if (!preferRemote && !force) {
      if (cached?.value != null) return { key, value: cached.value, version: cached.version };
      try {
        const remote = await remoteGetFull(key, { bust: false });
        if (remote?.value != null) {
          setCache(key, remote.value, remote.version);
          await idbSet(key, remote.value).catch(() => {});
          return { key: remote.key, value: remote.value, version: remote.version };
        }
      } catch (err) {
        console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      }
      return readLocal(key);
    }

    if (preferRemote && !force && cached?.value != null) {
      if (now - cached.at < REMOTE_MIN_INTERVAL_MS) {
        return { key, value: cached.value, version: cached.version };
      }
      if (now - cached.versionAt >= VERSION_CHECK_MS) {
        try {
          const remoteV = await remoteGetVersion(key);
          bumpVersionCheck(key);
          if (remoteV && remoteV.version === cached.version) {
            touchCache(key);
            return { key, value: cached.value, version: cached.version };
          }
        } catch (err) {
          console.warn("[storage] Vérification version échouée:", err.message);
        }
      } else {
        return { key, value: cached.value, version: cached.version };
      }
    }

    try {
      const etag = cached?.version ? `"${cached.version}"` : undefined;
      const remote = await remoteGetFull(key, { ifNoneMatch: etag, bust: force });
      if (remote?.unchanged && cached?.value != null) {
        touchCache(key);
        return { key, value: cached.value, version: cached.version };
      }
      if (remote?.value != null) {
        setCache(key, remote.value, remote.version);
        await idbSet(key, remote.value).catch(() => {});
        return { key: remote.key, value: remote.value, version: remote.version };
      }
      return readLocal(key);
    } catch (err) {
      console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      if (cached?.value != null) return { key, value: cached.value, version: cached.version };
      return readLocal(key);
    }
  },

  async set(key, value) {
    const version = String(Date.now());
    setCache(key, value, version);

    if (USE_LOCAL) {
      await idbSet(key, value);
      notifyPeers(key, version);
      return;
    }

    try {
      const { data } = await apiRequest("PUT", key, value);
      const serverVersion = data?.version ? String(data.version) : version;
      setCache(key, value, serverVersion);
      await idbSet(key, value).catch(() => {});
      notifyPeers(key, serverVersion);
    } catch (err) {
      console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      await idbSet(key, value);
      notifyPeers(key, version);
    }
  },

  async delete(key) {
    invalidateCache(key);

    if (USE_LOCAL) {
      await idbDelete(key);
      notifyPeers(key, "");
      return;
    }

    try {
      await apiRequest("DELETE", key);
      await idbDelete(key).catch(() => {});
      notifyPeers(key, "");
    } catch (err) {
      console.warn("[storage] API indisponible, repli IndexedDB:", err.message);
      await idbDelete(key);
      notifyPeers(key, "");
    }
  },

  subscribe(fn) {
    if (!SYNC_CHANNEL) return () => {};
    const handler = (e) => fn(e.data);
    SYNC_CHANNEL.addEventListener("message", handler);
    return () => SYNC_CHANNEL.removeEventListener("message", handler);
  },

  stale(key) {
    const entry = memoryCache.get(key);
    if (entry) entry.versionAt = 0;
  },
};
