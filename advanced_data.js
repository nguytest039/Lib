/*!
 * data.js
 * data processing and synchronization library
 *
 * Author: DKN(DUC)
 * © 2026
 */

const dataStore = new Map();
const paramCache = new Map();
const cacheStore = new Map();
const activeControllers = new Map();
const pendingRequests = new Map();
const pollingIntervals = new Map();

const CACHE_CONFIG = { ttl: 5 * 60 * 1000, maxSize: 100 };
const DEFAULT_TIMEOUT = 30000;

const loadingState = { active: new Set(), debounceTimer: null, isShowing: false };
const hooks = { start: null, end: null };
const messageState = { error: null, success: null };
const interceptors = { before: null, after: null };
const api = {};

const errorByPromise = new WeakMap();

function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null) return "null";
    const t = typeof v;
    if (t === "string") return JSON.stringify(v);
    if (t === "number" || t === "boolean") return String(v);
    if (t === "bigint") return JSON.stringify(v.toString());
    if (t === "undefined") return "null";
    if (v instanceof Date) return JSON.stringify(v.toISOString());
    if (Array.isArray(v)) return `[${v.map((x) => walk(x)).join(",")}]`;
    if (t === "object") {
      if (seen.has(v)) return '"[Circular]"';
      seen.add(v);
      const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
      const parts = keys.map((k) => `${JSON.stringify(k)}:${walk(v[k])}`);
      seen.delete(v);
      return `{${parts.join(",")}}`;
    }
    return JSON.stringify(String(v));
  };
  return walk(value);
}

function parseUrl(url, params = {}) {
  let finalUrl = url;
  const remainingParams = { ...params };
  const matches = url.match(/:([\w]+)/g);
  if (matches) {
    for (const match of matches) {
      const key = match.substring(1);
      if (remainingParams[key] !== undefined) {
        finalUrl = finalUrl.replace(match, encodeURIComponent(String(remainingParams[key])));
        delete remainingParams[key];
      }
    }
  }
  return { finalUrl, remainingParams };
}

function buildQueryString(params) {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return "";
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const usp = new URLSearchParams();
  for (const [k, v] of entries) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        usp.append(k, String(item));
      }
      continue;
    }
    usp.append(k, String(v));
  }
  return usp.toString();
}

function makeKey({ name, method, fullUrl, params }) {
  if (fullUrl) return `${method}::${name}::${fullUrl}`;
  return `${method}::${name}::${stableStringify(params || {})}`;
}

function cacheGet(key) {
  const item = cacheStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cacheStore.delete(key);
    return null;
  }
  cacheStore.delete(key);
  cacheStore.set(key, item);
  return item.value;
}

function cacheSet(key, value, ttl = CACHE_CONFIG.ttl) {
  if (cacheStore.size >= CACHE_CONFIG.maxSize) {
    const oldest = cacheStore.keys().next().value;
    if (oldest !== undefined) cacheStore.delete(oldest);
  }
  cacheStore.set(key, { value, expiry: Date.now() + ttl });
}

function clearCache(pattern) {
  if (!pattern) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) cacheStore.delete(key);
  }
}

function isError(response, data) {
  if (!response.ok) return true;
  if (data && typeof data === "object") {
    if (data.error) return true;
    if (data.success === false) return true;
    if (data.result === false) return true;
    if (data.status === "error" || data.status === "fail") return true;
    if (
      data.code &&
      data.code !== "SUCCESS" &&
      data.code !== "success" &&
      data.code !== 200 &&
      data.code !== 0
    )
      return true;
  }
  return false;
}

function extractData(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return data;
  const fields = ["data", "result", "results", "items", "records", "content", "rows", "list", "payload", "body"];
  for (const field of fields) {
    if (data[field] !== undefined) return data[field];
  }
  if (data.response?.data) return data.response.data;
  return data;
}

function getByPath(obj, path) {
  if (!path) return obj;
  const parts = String(path).split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function extractPaged({ itemsKey = "data", totalKey = "total" } = {}) {
  return (json) => {
    if (Array.isArray(json)) return { items: json, total: json.length };
    const items = getByPath(json, itemsKey);
    const total = getByPath(json, totalKey);
    return {
      items: Array.isArray(items) ? items : [],
      total: Number.isFinite(Number(total)) ? Number(total) : 0,
    };
  };
}

function applyExtract(json, extract) {
  if (extract === undefined) return extractData(json);
  if (extract === "raw") return json;
  if (typeof extract !== "function") throw new TypeError("extract must be a function (or 'raw' for legacy)");
  return extract(json);
}

function getErrorMessage(data) {
  if (!data) return "Request failed";
  if (typeof data === "string") return data;
  if (typeof data.error === "string") return data.error;
  if (data.error?.message) return data.error.message;
  if (data.message) return data.message;
  if (data.msg) return data.msg;
  if (data.errors?.length) return data.errors.join(", ");
  return "Request failed";
}

function startLoading(id) {
  loadingState.active.add(id);
  clearTimeout(loadingState.debounceTimer);
  loadingState.debounceTimer = setTimeout(() => {
    if (loadingState.active.size > 0 && !loadingState.isShowing) {
      loadingState.isShowing = true;
      hooks.start?.();
    }
  }, 100);
}

function endLoading(id) {
  loadingState.active.delete(id);
  if (loadingState.active.size === 0) {
    clearTimeout(loadingState.debounceTimer);
    if (loadingState.isShowing) {
      loadingState.isShowing = false;
      hooks.end?.();
    }
  }
}

function onLoading({ start, end } = {}) {
  if (start) hooks.start = start;
  if (end) hooks.end = end;
}

function setLoadingHooks({ onQueueAdd, onQueueEmpty }) {
  onLoading({ start: onQueueAdd, end: onQueueEmpty });
}

function addController(name, controller) {
  let set = activeControllers.get(name);
  if (!set) {
    set = new Set();
    activeControllers.set(name, set);
  }
  set.add(controller);
}

function removeController(name, controller) {
  const set = activeControllers.get(name);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) activeControllers.delete(name);
}

async function parseResponse(response, parse) {
  if (typeof parse === "function") return await parse(response);
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  if (parse === "text") return text;
  if (parse === "json") return JSON.parse(text);

  const ct = response.headers.get("content-type") || "";
  if (ct.includes("application/json") || ct.includes("+json")) {
    return JSON.parse(text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(fn, name, useCache = true, params = null, useSWR = false, meta = {}) {
  const {
    method = "GET",
    dedupe = true,
    extract = undefined,
    parse = undefined,
    timeout = DEFAULT_TIMEOUT,
    cacheKey = undefined,
    cacheTTL = CACHE_CONFIG.ttl,
  } = meta;

  const id = `${name}_${Date.now()}_${Math.random()}`;
  const key = cacheKey || makeKey({ name, method, params });

  messageState.error = null;
  messageState.success = null;

  if (useCache) {
    const cached = cacheGet(key);
    if (cached !== null) {
      if (useSWR) fetchInBackground(fn, name, key, { method, extract, parse, timeout, cacheTTL });
      return cached;
    }
  }

  if (dedupe && pendingRequests.has(key)) return pendingRequests.get(key);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  addController(name, controller);
  startLoading(id);

  let promise;
  promise = (async () => {
    try {
      const response = await fn(controller.signal);
      const data = await parseResponse(response, parse);

      if (interceptors.after) {
        try {
          const r = interceptors.after(data);
          if (r && typeof r.then === "function") r.catch(() => {});
        } catch {}
      }

      if (isError(response, data)) throw new Error(getErrorMessage(data));

      const result = applyExtract(data, extract);
      dataStore.set(name, result);

      if (useCache) cacheSet(key, result, cacheTTL);
      if (data && typeof data === "object" && data.message) messageState.success = data.message;

      errorByPromise.set(promise, null);
      return result;
    } catch (error) {
      messageState.error = error;
      errorByPromise.set(promise, error);
      return null;
    } finally {
      clearTimeout(timeoutId);
      removeController(name, controller);
      if (dedupe) pendingRequests.delete(key);
      endLoading(id);
    }
  })();

  if (dedupe) pendingRequests.set(key, promise);
  return promise;
}

async function fetchInBackground(fn, name, key, meta = {}) {
  const { extract = undefined, parse = undefined, timeout = DEFAULT_TIMEOUT, cacheTTL = CACHE_CONFIG.ttl } = meta;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fn(controller.signal);
    clearTimeout(timeoutId);

    const data = await parseResponse(response, parse);
    if (isError(response, data)) return;

    const result = applyExtract(data, extract);
    dataStore.set(name, result);
    cacheSet(key, result, cacheTTL);
  } catch {}
}

function defineEndpoint(name, fn) {
  Object.defineProperty(api, name, { value: fn, writable: false, enumerable: true });
}

function normalizeGetOptions(options) {
  if (typeof options === "string") return { cache: options };
  if (options && typeof options === "object") return options;
  return {};
}

function get(name, url, options = {}) {
  const opt = normalizeGetOptions(options);
  const cacheMode = opt.cache || "default";
  const swr = Boolean(opt.swr);
  const extract = opt.extract;
  const parse = opt.parse;
  const timeout = opt.timeout ?? DEFAULT_TIMEOUT;
  const dedupe = opt.dedupe ?? true;
  const cacheTTL = opt.cacheTTL ?? CACHE_CONFIG.ttl;

  defineEndpoint(name, async (params, fetchOptions = {}) => {
    const headers = new Headers();
    const p = params || {};
    if (interceptors.before) await interceptors.before({ params: p, headers, type: "GET" });

    const { finalUrl, remainingParams } = parseUrl(url, p);
    const queryString = buildQueryString(remainingParams);
    const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

    const useCache = cacheMode !== "no-cache";
    const cacheKey = makeKey({ name, method: "GET", fullUrl, params: p });

    return await request(
      async (signal) => await fetch(fullUrl, { headers, signal, ...fetchOptions }),
      name,
      useCache,
      p,
      swr,
      { method: "GET", dedupe, extract, parse, timeout, cacheKey, cacheTTL }
    );
  });
}

function writeJsonHeaders(headers) {
  headers.append("Accept", "application/json");
  headers.append("Content-Type", "application/json");
}

function makeWriteMethod(method) {
  return function (name, url, defineOptions = {}) {
    const extract = defineOptions.extract;
    const parse = defineOptions.parse;
    const timeout = defineOptions.timeout ?? DEFAULT_TIMEOUT;

    defineEndpoint(name, async (body, params, options = {}) => {
      const headers = new Headers();
      const p = params || {};
      if (interceptors.before) await interceptors.before({ body, params: p, headers, type: method });

      const { finalUrl, remainingParams } = parseUrl(url, p);
      const queryString = buildQueryString(remainingParams);
      const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

      const isForm = typeof FormData !== "undefined" && body instanceof FormData;

      return await request(
        async (signal) => {
          if (isForm) return await fetch(fullUrl, { method, body, headers, signal, ...options });
          writeJsonHeaders(headers);
          return await fetch(fullUrl, { method, body: JSON.stringify(body), headers, signal, ...options });
        },
        name,
        false,
        p,
        false,
        { method, dedupe: false, extract, parse, timeout }
      );
    });
  };
}

const post = makeWriteMethod("POST");
const put = makeWriteMethod("PUT");
const patch = makeWriteMethod("PATCH");

function del(name, url, defineOptions = {}) {
  const extract = defineOptions.extract;
  const parse = defineOptions.parse;
  const timeout = defineOptions.timeout ?? DEFAULT_TIMEOUT;
  const dedupe = defineOptions.dedupe ?? true;

  defineEndpoint(name, async (params, options = {}) => {
    const headers = new Headers();
    const p = params || {};
    if (interceptors.before) await interceptors.before({ params: p, headers, type: "DELETE" });

    const { finalUrl, remainingParams } = parseUrl(url, p);
    const queryString = buildQueryString(remainingParams);
    const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

    const cacheKey = makeKey({ name, method: "DELETE", fullUrl, params: p });

    return await request(
      async (signal) => await fetch(fullUrl, { method: "DELETE", headers, signal, ...options }),
      name,
      false,
      p,
      false,
      { method: "DELETE", dedupe, extract, parse, timeout, cacheKey }
    );
  });
}

async function getAll(name, params = {}, options = {}) {
  const {
    pageSize = 20,
    maxPages = Infinity,
    offsetKey = "offset",
    limitKey = "limit",
    onPage = null,
    mode: rawMode = "offset",
    pageBase = 0,
  } = options;

  if (!api[name]) return [];

  const mode = rawMode === "page" ? "page" : "offset";
  const base = Number.isFinite(pageBase) ? pageBase : 0;

  const allData = [];
  let pageIndex = 0;

  while (pageIndex < maxPages) {
    const pagingParams =
      mode === "page"
        ? { [offsetKey]: base + pageIndex, [limitKey]: pageSize }
        : { [offsetKey]: pageIndex * pageSize, [limitKey]: pageSize };

    const result = await api[name]({ ...params, ...pagingParams });
    if (!Array.isArray(result) || result.length === 0) break;

    allData.push(...result);
    onPage?.(result, pageIndex);

    if (result.length < pageSize) break;
    pageIndex++;
  }

  return allData;
}

async function getCursor(name, params = {}, options = {}) {
  const { cursorKey = "cursor", dataKey = "data", nextCursorKey = "nextCursor", maxPages = Infinity, onPage = null } =
    options;
  if (!api[name]) return [];

  const allData = [];
  let cursor = null;
  let page = 0;

  while (page < maxPages) {
    const result = await api[name]({ ...params, ...(cursor && { [cursorKey]: cursor }) });
    if (!result) break;

    const items = result[dataKey] || result;
    if (!Array.isArray(items) || items.length === 0) break;

    allData.push(...items);
    onPage?.(items, cursor);

    cursor = result[nextCursorKey];
    if (!cursor) break;

    page++;
  }

  return allData;
}

function abort(name) {
  const set = activeControllers.get(name);
  if (!set) return;
  for (const controller of set) controller.abort();
  activeControllers.delete(name);
}

function abortAll() {
  for (const set of activeControllers.values()) {
    for (const controller of set) controller.abort();
  }
  activeControllers.clear();
}

async function withRetry(fn, options = {}) {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const p = Promise.resolve(fn());
      const result = await p;

      const err = errorByPromise.get(p);
      if (result === null && err) throw err;

      return result;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(backoff, attempt)));
      }
    }
  }

  throw lastError;
}

function poll(name, params = {}, options = {}) {
  const { interval = 30000, immediate = true, onData = null, onError = null } = options;

  const prev = pollingIntervals.get(name);
  if (prev?.intervalId) clearInterval(prev.intervalId);

  const state = { intervalId: null, inFlight: false };
  pollingIntervals.set(name, state);

  const fetchData = async () => {
    if (state.inFlight) return null;
    state.inFlight = true;
    try {
      const p = Promise.resolve(api[name](params));
      const data = await p;

      const err = errorByPromise.get(p);
      if (data === null && err) {
        onError?.(err);
        return null;
      }

      onData?.(data);
      return data;
    } finally {
      state.inFlight = false;
    }
  };

  if (immediate) fetchData();

  state.intervalId = setInterval(fetchData, interval);

  return () => stopPoll(name);
}

function stopPoll(name) {
  const state = pollingIntervals.get(name);
  if (!state) return;
  if (state.intervalId) clearInterval(state.intervalId);
  pollingIntervals.delete(name);
}

function stopAllPolls() {
  for (const state of pollingIntervals.values()) {
    if (state?.intervalId) clearInterval(state.intervalId);
  }
  pollingIntervals.clear();
}

function hasError() {
  return messageState.error !== null;
}

const fixNull = (value, fallback = "") =>
  value == null || value === "" || value === "null" || value === "undefined" ? fallback : value;

export {
  api,
  dataStore,
  get,
  post,
  patch,
  put,
  del,
  getAll,
  getCursor,
  abort,
  abortAll,
  onLoading,
  interceptors,
  messageState,
  hasError,
  clearCache,
  withRetry,
  poll,
  stopPoll,
  stopAllPolls,
  setLoadingHooks,
  paramCache,
  fixNull,
  extractPaged,
};
