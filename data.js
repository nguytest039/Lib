/*!
 * lib.js
 * © 2026 - DKN
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

function parseUrl(url, params = {}) {
    let finalUrl = url;
    const remainingParams = { ...params };
    const matches = url.match(/:([\w]+)/g);
    if (matches) {
        matches.forEach(match => {
            const key = match.substring(1);
            if (remainingParams[key] !== undefined) {
                finalUrl = finalUrl.replace(match, remainingParams[key]);
                delete remainingParams[key];
            }
        });
    }
    return { finalUrl, remainingParams };
}

function createCacheKey(name, params) {
    return `${name}:${JSON.stringify(params || {})}`;
}

function getCache(name, params) {
    const key = createCacheKey(name, params);
    const item = cacheStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        cacheStore.delete(key);
        return null;
    }
    return item.value;
}

function setCache(name, params, value, ttl = CACHE_CONFIG.ttl) {
    if (cacheStore.size >= CACHE_CONFIG.maxSize) {
        const oldest = cacheStore.keys().next().value;
        cacheStore.delete(oldest);
    }
    const key = createCacheKey(name, params);
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
    if (data.error) return true;
    if (data.success === false) return true;
    if (data.result === false) return true;
    if (data.status === 'error' || data.status === 'fail') return true;
    if (data.code && data.code !== 'SUCCESS' && data.code !== 'success' && data.code !== 200 && data.code !== 0) return true;
    return false;
}

function extractData(data) {
    if (Array.isArray(data)) return data;
    const fields = ['data', 'result', 'results', 'items', 'records', 'content', 'rows', 'list', 'payload', 'body'];
    for (const field of fields) {
        if (data[field] !== undefined) return data[field];
    }
    if (data.response?.data) return data.response.data;
    return data;
}

function getErrorMessage(data) {
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

function onLoading({ start, end }) {
    if (start && end) {
        hooks.start = start;
        hooks.end = end;
    }
}

function setLoadingHooks({ onQueueAdd, onQueueEmpty }) {
    onLoading({ start: onQueueAdd, end: onQueueEmpty });
}

async function request(fn, name, useCache = true, params = null, useSWR = false) {
    const id = `${name}_${Date.now()}_${Math.random()}`;
    const cacheKey = createCacheKey(name, params);
    
    messageState.error = null;
    messageState.success = null;

    if (useCache && params) {
        const cached = getCache(name, params);
        if (cached !== null) {
            if (useSWR) {
                fetchInBackground(fn, name, params);
            }
            return cached;
        }
    }

    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    activeControllers.set(name, controller);
    startLoading(id);

    const promise = (async () => {
        try {
            const response = await fn(controller.signal);
            clearTimeout(timeoutId);
            const data = await response.json();

            if (interceptors.after) interceptors.after(data);

            if (isError(response, data)) {
                throw new Error(getErrorMessage(data));
            }

            const result = extractData(data);
            dataStore.set(name, result);

            if (useCache && params) setCache(name, params, result);
            if (data.message) messageState.success = data.message;

            return result;
        } catch (error) {
            messageState.error = error;
            return null;
        } finally {
            clearTimeout(timeoutId);
            activeControllers.delete(name);
            pendingRequests.delete(cacheKey);
            endLoading(id);
        }
    })();

    pendingRequests.set(cacheKey, promise);
    return promise;
}

async function fetchInBackground(fn, name, params) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
        const response = await fn(controller.signal);
        clearTimeout(timeoutId);
        const data = await response.json();

        if (isError(response, data)) return;

        const result = extractData(data);
        dataStore.set(name, result);
        setCache(name, params, result);
    } catch (e) {}
}

function get(name, url, options = {}) {
    const cacheMode = typeof options === 'string' ? options : options.cache || 'default';
    const swr = typeof options === 'object' ? options.swr || false : false;
    
    Object.defineProperty(api, name, {
        value: async (params, fetchOptions = {}) => {
            const useCache = cacheMode !== 'no-cache';
            return await request(async (signal) => {
                const headers = new Headers();
                if (interceptors.before) await interceptors.before({ params, headers, type: 'GET' });
                const { finalUrl, remainingParams } = parseUrl(url, params);
                const queryString = new URLSearchParams(remainingParams).toString();
                const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;
                return await fetch(fullUrl, { headers, signal, ...fetchOptions });
            }, name, useCache, params, swr);
        },
        writable: false,
        enumerable: true
    });
}

function post(name, url) {
    Object.defineProperty(api, name, {
        value: async (body, params, options = {}) => {
            return await request(async (signal) => {
                const headers = new Headers();
                if (interceptors.before) await interceptors.before({ body, params, headers, type: 'POST' });
                const { finalUrl, remainingParams } = parseUrl(url, params);
                const queryString = new URLSearchParams(remainingParams).toString();
                const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;
                if (body instanceof FormData) {
                    return await fetch(fullUrl, { method: 'POST', body, headers, signal, ...options });
                }
                headers.append('Accept', 'application/json');
                headers.append('Content-Type', 'application/json');
                return await fetch(fullUrl, { method: 'POST', body: JSON.stringify(body), headers, signal, ...options });
            }, name, false);
        },
        writable: false,
        enumerable: true
    });
}

function patch(name, url) {
    Object.defineProperty(api, name, {
        value: async (body, params, options = {}) => {
            return await request(async (signal) => {
                const headers = new Headers();
                if (interceptors.before) await interceptors.before({ body, params, headers, type: 'PATCH' });
                const { finalUrl, remainingParams } = parseUrl(url, params);
                const queryString = new URLSearchParams(remainingParams).toString();
                const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;
                if (body instanceof FormData) {
                    return await fetch(fullUrl, { method: 'PATCH', body, headers, signal, ...options });
                }
                headers.append('Accept', 'application/json');
                headers.append('Content-Type', 'application/json');
                return await fetch(fullUrl, { method: 'PATCH', body: JSON.stringify(body), headers, signal, ...options });
            }, name, false);
        },
        writable: false,
        enumerable: true
    });
}

function put(name, url) {
    Object.defineProperty(api, name, {
        value: async (body, params, options = {}) => {
            return await request(async (signal) => {
                const headers = new Headers();
                if (interceptors.before) await interceptors.before({ body, params, headers, type: 'PUT' });
                const { finalUrl, remainingParams } = parseUrl(url, params);
                const queryString = new URLSearchParams(remainingParams).toString();
                const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;
                if (body instanceof FormData) {
                    return await fetch(fullUrl, { method: 'PUT', body, headers, signal, ...options });
                }
                headers.append('Accept', 'application/json');
                headers.append('Content-Type', 'application/json');
                return await fetch(fullUrl, { method: 'PUT', body: JSON.stringify(body), headers, signal, ...options });
            }, name, false);
        },
        writable: false,
        enumerable: true
    });
}

function del(name, url) {
    Object.defineProperty(api, name, {
        value: async (params, options = {}) => {
            return await request(async (signal) => {
                const headers = new Headers();
                if (interceptors.before) await interceptors.before({ params, headers, type: 'DELETE' });
                const { finalUrl, remainingParams } = parseUrl(url, params);
                const queryString = new URLSearchParams(remainingParams).toString();
                const fullUrl = queryString ? `${finalUrl}?${queryString}` : finalUrl;
                return await fetch(fullUrl, { method: 'DELETE', headers, signal, ...options });
            }, name, false);
        },
        writable: false,
        enumerable: true
    });
}

async function getAll(name, params = {}, options = {}) {
    const { pageSize = 20, maxPages = Infinity, offsetKey = 'offset', limitKey = 'limit', onPage = null } = options;
    if (!api[name]) return [];
    let allData = [];
    let page = 0;
    while (page < maxPages) {
        const result = await api[name]({ ...params, [offsetKey]: page * pageSize, [limitKey]: pageSize });
        if (!result || !Array.isArray(result) || result.length === 0) break;
        allData = [...allData, ...result];
        if (onPage) onPage(result, page);
        if (result.length < pageSize) break;
        page++;
    }
    return allData;
}

async function getCursor(name, params = {}, options = {}) {
    const { cursorKey = 'cursor', dataKey = 'data', nextCursorKey = 'nextCursor', maxPages = Infinity, onPage = null } = options;
    if (!api[name]) return [];
    let allData = [];
    let cursor = null;
    let page = 0;
    while (page < maxPages) {
        const result = await api[name]({ ...params, ...(cursor && { [cursorKey]: cursor }) });
        if (!result) break;
        const items = result[dataKey] || result;
        if (!Array.isArray(items) || items.length === 0) break;
        allData = [...allData, ...items];
        if (onPage) onPage(items, cursor);
        cursor = result[nextCursorKey];
        if (!cursor) break;
        page++;
    }
    return allData;
}

function abort(name) {
    const controller = activeControllers.get(name);
    if (controller) {
        controller.abort();
        activeControllers.delete(name);
    }
}

function abortAll() {
    activeControllers.forEach(controller => controller.abort());
    activeControllers.clear();
}

async function withRetry(fn, options = {}) {
    const { retries = 3, delay = 1000, backoff = 2 } = options;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoff, attempt)));
            }
        }
    }
    throw lastError;
}

function poll(name, params = {}, options = {}) {
    const { interval = 30000, immediate = true, onData = null, onError = null } = options;
    
    if (pollingIntervals.has(name)) {
        clearInterval(pollingIntervals.get(name));
    }

    const fetchData = async () => {
        try {
            const data = await api[name](params);
            if (onData) onData(data);
            return data;
        } catch (error) {
            if (onError) onError(error);
        }
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
    pollingIntervals.forEach(intervalId => clearInterval(intervalId));
    pollingIntervals.clear();
}

function hasError() {
    return messageState.error !== null;
}

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
    api as requestHandlers,
    get as registerGetEndpoint,
    post as registerPostEndpoint,
    patch as registerPatchEndpoint,
    put as registerPutEndpoint,
    del as registerDeleteEndpoint,
    setLoadingHooks,
    paramCache,
    getAll as paginatedGet,
    getCursor as cursorPaginatedGet,
    abort as cancelRequest,
    abortAll as cancelAllRequests,
    clearCache as invalidateCache
};
