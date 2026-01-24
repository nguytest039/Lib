/*!
 * Lite Data
 * Author: DKN(DUC) 
 * © 2026
 */

export const config = {
    baseUrl: "",
    loadingDelay: 600,
    validateResponse: (res) => {
        if (!res) return true;
        if (res.code && (res.code !== "SUCCESS" && res.code !== 200)) return false;
        if (res.status && (res.status === "error" || res.status === "fail")) return false;
        if (res.result === false) return false;
        return true;
    },
    extractData: (res) => {
        if (res && typeof res === 'object') {
            if (res.total !== undefined || res.page !== undefined) {
                return res;
            }
            if (res.data !== undefined) return res.data;
            if (res.result !== undefined) return res.result;
        }
        return res;
    },
    onError: null
};

export const dataStore = new Map();
export const paramCache = new Map();
export const api = {};
export const messageState = { error: null, success: null };

export const interceptors = { before: null, after: null };
export const loadingHooks = { onQueueAdd: null, onQueueEmpty: null };

let activeRequests = 0;
let loadingTimer = null;

export function setup(options) {
    Object.assign(config, options);
}

export function setLoadingHooks({ onQueueAdd, onQueueEmpty }) {
    if (onQueueAdd) loadingHooks.onQueueAdd = onQueueAdd;
    if (onQueueEmpty) loadingHooks.onQueueEmpty = onQueueEmpty;
}

export function hasError() {
    return !!messageState.error;
}

function startLoading() {
    activeRequests++;
    if (loadingTimer) clearTimeout(loadingTimer);

    loadingTimer = setTimeout(() => {
        if (activeRequests > 0 && loadingHooks.onQueueAdd) {
            loadingHooks.onQueueAdd();
        }
    }, config.loadingDelay);
}

function stopLoading() {
    if (activeRequests > 0) activeRequests--;
    if (activeRequests === 0) {
        if (loadingTimer) clearTimeout(loadingTimer);
        if (loadingHooks.onQueueEmpty) loadingHooks.onQueueEmpty();
    }
}

function processUrl(url, params = {}) {
    let finalUrl = config.baseUrl + url;
    const remainingParams = { ...params };

    const matches = finalUrl.match(/:(\w+)/g);
    if (matches) {
        matches.forEach(match => {
            const key = match.substring(1);
            if (remainingParams[key] !== undefined) {
                finalUrl = finalUrl.replace(match, encodeURIComponent(remainingParams[key]));
                delete remainingParams[key];
            }
        });
    }

    const queryString = new URLSearchParams(remainingParams).toString();
    const fullUrl = queryString ? `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}${queryString}` : finalUrl;

    return { fullUrl, remainingParams };
}

function isDeepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

async function request(method, name, url, payload = null, options = {}) {
    messageState.error = null;
    messageState.success = null;

    const isGet = method === 'GET';
    const useCache = options.cache === true;

    const { fullUrl } = processUrl(url, isGet ? payload : options.params);

    if (isGet && useCache) {
        const cached = paramCache.get(name);
        if (cached && isDeepEqual(cached.params, payload)) {
            return cached.data;
        }
    }

    startLoading();
    dataStore.set(name, null);

    try {
        const headers = new Headers();
        if (interceptors.before) {
            await interceptors.before({
                name, method, url: fullUrl, params: payload, headers
            });
        }

        if (!headers.has('Content-Type') && !(payload instanceof FormData)) {
            if (!(payload instanceof URLSearchParams) && typeof payload === 'object' && payload !== null) {
                headers.append('Content-Type', 'application/json');
            }
        }

        let body = undefined;
        if (!isGet && payload) {
            if (payload instanceof FormData || payload instanceof URLSearchParams || typeof payload === 'string' || payload instanceof Blob) {
                body = payload;
            } else {
                body = JSON.stringify(payload);
            }
        }

        const fetchOptions = {
            method,
            headers,
            body
        };

        const response = await fetch(fullUrl, fetchOptions);

        let data;
        const text = await response.text();
        try { data = JSON.parse(text); } catch { data = text; }

        if (interceptors.after) await interceptors.after(data);

        if (!response.ok || !config.validateResponse(data)) {
            const msg = (data && data.message) || (data && data.error) || response.statusText;
            throw new Error(msg || "Request failed");
        }

        const distinctData = config.extractData(data);
        dataStore.set(name, distinctData);

        if (data && data.message) messageState.success = data.message;

        if (isGet && useCache) {
            paramCache.set(name, { params: payload, data: distinctData });
        }

        return distinctData;

    } catch (err) {
        messageState.error = err;
        if (config.onError) config.onError(err);
        throw err;
    } finally {
        stopLoading();
    }
}

function register(method, name, url, defaultOptions = {}) {
    const fn = (payload, callOptions = {}) => {
        const mergedOptions = { ...defaultOptions, ...callOptions };
        if (method === 'GET') {
            return request('GET', name, url, payload, mergedOptions);
        } else {
            return request(method, name, url, payload, { ...mergedOptions, params: callOptions });
        }
    };

    Object.defineProperty(api, name, {
        value: fn,
        writable: false,
        enumerable: true
    });
}

export function get(name, url, options) { return register('GET', name, url, options); }
export function post(name, url, options) { return register('POST', name, url, options); }
export function put(name, url, options) { return register('PUT', name, url, options); }
export function patch(name, url, options) { return register('PATCH', name, url, options); }
export function del(name, url, options) { return register('DELETE', name, url, options); }
