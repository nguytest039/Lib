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
const activeControllers = new Map(); // Map<name, Set<AbortController>>
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
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'string') return JSON.stringify(v);
    if (t === 'number' || t === 'boolean') return String(v);
    if (t === 'bigint') return JSON.stringify(v.toString());
    if (t === 'undefined') return 'null';
    if (v instanceof Date) return JSON.stringify(v.toISOString());
    if (Array.isArray(v)) return `[${v.map((x) => walk(x)).join(',')}]`;
    if (t === 'object') {
      if (seen.has(v)) return '"[Circular]"';
      seen.add(v);
      const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
      const parts = keys.map((k) => `${JSON.stringify(k)}:${walk(v[k])}`);
      seen.delete(v);
      return `{${parts.join(',')}}`;
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
    matches.forEach((match) => {
      const key = match.substring(1);
      if (remainingParams[key] !== undefined) {
        finalUrl = finalUrl.replace(match, remainingParams[key]);
        delete remainingParams[key];
      }
    });
  }
  return { finalUrl, remainingParams };
}

function buildQueryString(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
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

function createCacheKey(name, params, meta = '') {
  const metaPart = meta ? `${meta}|` : '';
  return `${name}:${metaPart}${stableStringify(params || {})}`;
}

function getCache(name, params, meta = '') {
  const key = createCacheKey(name, params, meta);
  const item = cacheStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return item.value;
}

function setCache(name, params, value, ttl = CACHE_CONFIG.ttl, meta = '') {
  if (cacheStore.size >= CACHE_CONFIG.maxSize) {
    const oldest = cacheStore.keys().next().value;
    cacheStore.delete(oldest);
  }
  const key = createCacheKey(name, params, meta);
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
  if (data && typeof data === 'object') {
    if (data.error) return true;
    if (data.success === false) return true;
    if (data.result === false) return true;
    if (data.status === 'error' || data.status === 'fail') return true;
    if (
      data.code &&
      data.code !== 'SUCCESS' &&
      data.code !== 'success' &&
      data.code !== 200 &&
      data.code !== 0
    )
      return true;
  }
  return false;
}

function extractData(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return data;
  const fields = ['data', 'result', 'results', 'items', 'records', 'content', 'rows', 'list', 'payload', 'body'];
  for (const field of fields) {
    if (data[field] !== undefined) return data[field];
  }
  if (data.response?.data) return data.response.data;
  return data;
}

function getErrorMessage(data) {
  if (!data) return 'Request failed';
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) return data.error.message;
  if (data.message) return data.message;
  if (data.msg) return data.msg;
  if (data.errors?.length) return data.errors.join(', ');
  return 'Request failed';
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

async function request(fn, name, useCache = true, params = null, useSWR = false, meta = {}) {
  const { method = 'GET', dedupe = true } = meta;

  const id = `${name}_${Date.now()}_${Math.random()}`;
  const cacheKey = createCacheKey(name, params, method);

  messageState.error = null;
  messageState.success = null;

  if (useCache && params) {
    const cached = getCache(name, params, method);
    if (cached !== null) {
      if (useSWR) fetchInBackground(fn, name, params, method);
      return cached;
    }
  }

  if (dedupe && pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  addController(name, controller);
  startLoading(id);

  let promise;
  promise = (async () => {
    try {
      const response = await fn(controller.signal);
      const data = await response.json();

      if (interceptors.after) {
        try {
          const r = interceptors.after(data);
          if (r && typeof r.then === 'function') r.catch(() => {});
        } catch (_) {}
      }

      if (isError(response, data)) throw new Error(getErrorMessage(data));

      const result = extractData(data);
      dataStore.set(name, result);

      if (useCache && params) setCache(name, params, result, CACHE_CONFIG.ttl, method);
      if (data && typeof data === 'object' && data.message) messageState.success = data.message;

      errorByPromise.set(promise, null);
      return result;
    } catch (error) {
      messageState.error = error;
      errorByPromise.set(promise, error);
      return null;
    } finally {
      clearTimeout(timeoutId);
      removeController(name, controller);
      if (dedupe) pendingRequests.delete(cacheKey);
      endLoading(id);
    }
  })();

  if (dedupe) pendingRequests.set(cacheKey, promise);
  return promise;
}

async function fetchInBackground(fn, name, params, method = 'GET') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const response = await fn(controller.signal);
    clearTimeout(timeoutId);

    const data = await response.json();
    if (isError(response, data)) return;

    const result = extractData(data);
    dataStore.set(name, result);
    setCache(name, params, result, CACHE_CONFIG.ttl, method);
  } catch (_) {}
}

function get(name, url, options = {}) {
  const cacheMode = typeof options === 'string' ? options : options.cache || 'default';
  const swr = typeof options === 'object' ? options.swr || false : false;

  Object.defineProperty(api, name, {
    value: async (params, fetchOptions = {}) => {
      const useCache = cacheMode !== 'no-cache';
      return await request(
        async (signal) => {
          const headers = new Headers();
          if (interceptors.before) await interceptors.before({ params, headers, type: 'GET' });

          const { finalUrl, remainingParams } = parseUrl(url, params);
          const queryString = buildQueryString(remainingParams);
          const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

          return await fetch(fullUrl, { headers, signal, ...fetchOptions });
        },
        name,
        useCache,
        params,
        swr,
        { method: 'GET', dedupe: true }
      );
    },
    writable: false,
    enumerable: true,
  });
}

function post(name, url) {
  Object.defineProperty(api, name, {
    value: async (body, params, options = {}) => {
      return await request(
        async (signal) => {
          const headers = new Headers();
          if (interceptors.before) await interceptors.before({ body, params, headers, type: 'POST' });

          const { finalUrl, remainingParams } = parseUrl(url, params);
          const queryString = buildQueryString(remainingParams);
          const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

          if (body instanceof FormData) {
            return await fetch(fullUrl, { method: 'POST', body, headers, signal, ...options });
          }

          headers.append('Accept', 'application/json');
          headers.append('Content-Type', 'application/json');
          return await fetch(fullUrl, {
            method: 'POST',
            body: JSON.stringify(body),
            headers,
            signal,
            ...options,
          });
        },
        name,
        false,
        params,
        false,
        { method: 'POST', dedupe: false }
      );
    },
    writable: false,
    enumerable: true,
  });
}

function patch(name, url) {
  Object.defineProperty(api, name, {
    value: async (body, params, options = {}) => {
      return await request(
        async (signal) => {
          const headers = new Headers();
          if (interceptors.before) await interceptors.before({ body, params, headers, type: 'PATCH' });

          const { finalUrl, remainingParams } = parseUrl(url, params);
          const queryString = buildQueryString(remainingParams);
          const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

          if (body instanceof FormData) {
            return await fetch(fullUrl, { method: 'PATCH', body, headers, signal, ...options });
          }

          headers.append('Accept', 'application/json');
          headers.append('Content-Type', 'application/json');
          return await fetch(fullUrl, {
            method: 'PATCH',
            body: JSON.stringify(body),
            headers,
            signal,
            ...options,
          });
        },
        name,
        false,
        params,
        false,
        { method: 'PATCH', dedupe: false }
      );
    },
    writable: false,
    enumerable: true,
  });
}

function put(name, url) {
  Object.defineProperty(api, name, {
    value: async (body, params, options = {}) => {
      return await request(
        async (signal) => {
          const headers = new Headers();
          if (interceptors.before) await interceptors.before({ body, params, headers, type: 'PUT' });

          const { finalUrl, remainingParams } = parseUrl(url, params);
          const queryString = buildQueryString(remainingParams);
          const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

          if (body instanceof FormData) {
            return await fetch(fullUrl, { method: 'PUT', body, headers, signal, ...options });
          }

          headers.append('Accept', 'application/json');
          headers.append('Content-Type', 'application/json');
          return await fetch(fullUrl, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers,
            signal,
            ...options,
          });
        },
        name,
        false,
        params,
        false,
        { method: 'PUT', dedupe: false }
      );
    },
    writable: false,
    enumerable: true,
  });
}

function del(name, url) {
  Object.defineProperty(api, name, {
    value: async (params, options = {}) => {
      return await request(
        async (signal) => {
          const headers = new Headers();
          if (interceptors.before) await interceptors.before({ params, headers, type: 'DELETE' });

          const { finalUrl, remainingParams } = parseUrl(url, params);
          const queryString = buildQueryString(remainingParams);
          const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;

          return await fetch(fullUrl, { method: 'DELETE', headers, signal, ...options });
        },
        name,
        false,
        params,
        false,
        { method: 'DELETE', dedupe: true }
      );
    },
    writable: false,
    enumerable: true,
  });
}

async function getAll(name, params = {}, options = {}) {
  const {
    pageSize = 20,
    maxPages = Infinity,
    offsetKey = 'offset',
    limitKey = 'limit',
    onPage = null,
    mode: rawMode = 'offset',
    pageBase = 0,
  } = options;

  if (!api[name]) return [];

  const mode = rawMode === 'page' ? 'page' : 'offset';
  const base = Number.isFinite(pageBase) ? pageBase : 0;

  const allData = [];
  let pageIndex = 0;

  while (pageIndex < maxPages) {
    const pagingParams =
      mode === 'page'
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
  const { cursorKey = 'cursor', dataKey = 'data', nextCursorKey = 'nextCursor', maxPages = Infinity, onPage = null } =
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
  set.forEach((controller) => controller.abort());
  activeControllers.delete(name);
}

function abortAll() {
  activeControllers.forEach((set) => set.forEach((controller) => controller.abort()));
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

  if (pollingIntervals.has(name)) clearInterval(pollingIntervals.get(name));

  const fetchData = async () => {
    const p = Promise.resolve(api[name](params));
    const data = await p;

    const err = errorByPromise.get(p);
    if (data === null && err) {
      onError?.(err);
      return null;
    }

    onData?.(data);
    return data;
  };

  if (immediate) fetchData();

  const intervalId = setInterval(fetchData, interval);
  pollingIntervals.set(name, intervalId);

  return () => {
    clearInterval(intervalId);
    pollingIntervals.delete(name);
  };
}

function stopPoll(name) {
  if (pollingIntervals.has(name)) {
    clearInterval(pollingIntervals.get(name));
    pollingIntervals.delete(name);
  }
}

function stopAllPolls() {
  pollingIntervals.forEach((intervalId) => clearInterval(intervalId));
  pollingIntervals.clear();
}

function hasError() {
  return messageState.error !== null;
}

const fixNull = (value, fallback = '') =>
  value == null || value === '' || value === 'null' || value === 'undefined' ? fallback : value;

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
};
