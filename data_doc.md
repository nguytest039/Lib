````md
# data.js

A lightweight browser-side data request + sync helper:
- Endpoint registry (`get/post/put/patch/del`)
- Cache (TTL + max size), optional SWR refresh for GET
- Request dedupe for GET/DELETE
- Abort (per endpoint name)
- Pagination helpers (`getAll`, `getCursor`)
- Retry wrapper (`withRetry`)
- Polling (`poll`)
- Loading hooks (`onLoading`, `setLoadingHooks`)
- Interceptors (`interceptors.before/after`)
- Shared state (`messageState`, `dataStore`)

---

## Import

```js
import {
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
  fixNull
} from './data.js';
````

---

## Quick start

### Register endpoints

```js
get('listRooms', '/api/rooms');
get('roomDetail', '/api/rooms/:id');

post('createRoom', '/api/rooms');
put('updateRoom', '/api/rooms/:id');
patch('patchRoom', '/api/rooms/:id');
del('deleteRoom', '/api/rooms/:id');
```

### Call endpoints

```js
const rooms = await api.listRooms({ building: 'A1', limit: 20 });

const detail = await api.roomDetail({ id: 123 });

const created = await api.createRoom({ name: 'R101' });

const updated = await api.updateRoom({ name: 'R102' }, { id: 123 });

await api.deleteRoom({ id: 123 });
```

---

## Core concepts

### Path params + query params

`url` supports `:param` placeholders. Matching keys are injected into the path; the remaining keys become query string.

```js
get('docDetail', '/api/docs/:docId');

await api.docDetail({ docId: 10, lang: 'vi', include: ['a', 'b'] });
// => /api/docs/10?lang=vi&include=a&include=b
```

Rules:

* `null/undefined` query values are omitted
* arrays become repeated query keys (`k=a&k=b`)

### Return value + errors

Handlers return:

* `result` on success
* `null` on failure (no throw by default)

Error state:

* `messageState.error` is set on failure
* `hasError()` checks if `messageState.error` exists

```js
const data = await api.listRooms({ limit: 10 });
if (data === null && hasError()) {
  console.error(messageState.error);
}
```

### Data extraction

Response JSON is normalized by extracting from common fields (first match):
`data, result, results, items, records, content, rows, list, payload, body`
Fallback: `response.data`, else raw JSON.

### Error detection

A response is treated as error when:

* HTTP status is not OK, or
* JSON contains one of:

  * `error` (truthy)
  * `success === false`
  * `result === false`
  * `status` is `error` / `fail`
  * `code` exists and is not one of: `SUCCESS`, `success`, `200`, `0`

Error message is taken from (first match):
`error` (string), `error.message`, `message`, `msg`, `errors[]`, else `"Request failed"`.

---

## Endpoint registration API

### `get(name, url, options?)`

```js
get('listDocs', '/api/docs', { cache: 'default', swr: false });
```

* `options.cache`:

  * `'default'` (default): enable cache for requests with `params`
  * `'no-cache'`: disable cache
* `options.swr`:

  * `true`: if cached result exists, return it immediately and refresh in background

Notes:

* GET requests are deduped by `(name + params)` while in-flight (same call returns same promise).

### `post(name, url)`

### `put(name, url)`

### `patch(name, url)`

```js
post('createDoc', '/api/docs');
put('updateDoc', '/api/docs/:id');
patch('patchDoc', '/api/docs/:id');
```

Call signature:

```js
await api.createDoc(body, params?, fetchOptions?);
await api.updateDoc(body, params?, fetchOptions?);
```

Notes:

* POST/PUT/PATCH are NOT deduped (avoids mixing different bodies).

### `del(name, url)`

```js
del('deleteDoc', '/api/docs/:id');
await api.deleteDoc({ id: 123 });
```

Notes:

* DELETE is deduped by `(name + params)` while in-flight.

---

## Interceptors

### `interceptors.before`

Runs before each request, can modify headers or inspect params/body.

```js
interceptors.before = async ({ type, params, body, headers }) => {
  headers.set('Authorization', `Bearer ${token}`);
};
```

### `interceptors.after`

Runs after parsing JSON (non-blocking). If it returns a Promise, rejection is swallowed to avoid unhandled errors.

```js
interceptors.after = (json) => {
  if (json?.newToken) token = json.newToken;
};
```

---

## Loading hooks

Use one time globally (typical), or overwrite per page/module if needed.

### `onLoading({ start, end })`

```js
onLoading({
  start: () => showLoader(),
  end: () => hideLoader()
});
```

### `setLoadingHooks({ onQueueAdd, onQueueEmpty })`

Alias for `onLoading`.

```js
setLoadingHooks({
  onQueueAdd: () => showLoader(),
  onQueueEmpty: () => hideLoader()
});
```

Behavior:

* Loader start is debounced (100ms) to reduce flicker
* Loader ends when all active requests finish

---

## Cache

Cache is keyed by `(endpoint name + params + method)` using stable serialization.

### Clear cache

```js
clearCache();           // clear all
clearCache('listDocs'); // clear keys containing substring
```

Notes:

* Cache is only used for GET when `options.cache !== 'no-cache'` and `params` is provided.

---

## Abort

Abort active requests by endpoint name.

```js
abort('listDocs');
abortAll();
```

Notes:

* If multiple requests are running under the same name, `abort(name)` aborts all of them.

---

## Pagination helpers

### `getAll(name, params?, options?)`

Fetches pages until empty page, or page smaller than `pageSize`, or `maxPages` reached.

```js
const all = await getAll('listDocs', { q: 'abc' }, {
  pageSize: 50,
  maxPages: 10,
  offsetKey: 'offset',
  limitKey: 'limit',
  mode: 'offset'
});
```

Options:

* `pageSize` (default 20)
* `maxPages` (default Infinity)
* `offsetKey` (default `'offset'`)
* `limitKey` (default `'limit'`)
* `mode`:

  * `'offset'` (default): sends `{ [offsetKey]: pageIndex * pageSize, [limitKey]: pageSize }`
  * `'page'`: sends `{ [offsetKey]: pageBase + pageIndex, [limitKey]: pageSize }`
* `pageBase` (default 0): used only when `mode: 'page'` (0-based or 1-based)
* `onPage(items, pageIndex)`

Examples:

Offset/limit:

```js
await getAll('listDocs', {}, {
  mode: 'offset',
  offsetKey: 'offset',
  limitKey: 'limit',
  pageSize: 20
});
```

Page/size 0-based:

```js
await getAll('listDocs', {}, {
  mode: 'page',
  offsetKey: 'page',
  limitKey: 'size',
  pageBase: 0,
  pageSize: 20
});
```

Page/size 1-based:

```js
await getAll('listDocs', {}, {
  mode: 'page',
  offsetKey: 'page',
  limitKey: 'size',
  pageBase: 1,
  pageSize: 20
});
```

### `getCursor(name, params?, options?)`

Accumulates items until `nextCursor` missing or pages exhausted.

```js
const all = await getCursor('listDocsCursor', { limit: 50 }, {
  cursorKey: 'cursor',
  dataKey: 'data',
  nextCursorKey: 'nextCursor',
  maxPages: 10,
  onPage: (items, cursor) => console.log(items.length, cursor)
});
```

---

## Retry

### `withRetry(fn, options?)`

Retries when `fn()` results in `null` AND that call had a captured error.

```js
const data = await withRetry(() => api.listDocs({ q: 'a' }), {
  retries: 3,
  delay: 500,
  backoff: 2
});
```

Options:

* `retries` (default 3)
* `delay` (default 1000 ms)
* `backoff` (default 2)

Notes:

* Safe for concurrent retries: retry decision is based on per-call error tracking, not global state.

---

## Polling

### `poll(name, params?, options?)`

```js
const stop = poll('listDocs', { q: 'a' }, {
  interval: 15000,
  immediate: true,
  onData: (data) => console.log(data),
  onError: (err) => console.error(err)
});

// later
stop();
```

Options:

* `interval` (default 30000 ms)
* `immediate` (default true)
* `onData(data)`
* `onError(error)`

Stop helpers:

* `stopPoll(name)`
* `stopAllPolls()`

---

## Utilities

### `fixNull(value, fallback = '')`

```js
fixNull(null, '-');        // '-'
fixNull('null', '-');      // '-'
fixNull('undefined', '-'); // '-'
fixNull('', '-');          // '-'
fixNull('ok', '-');        // 'ok'
```

---

## Exports

* `api`
* `dataStore`
* `get`, `post`, `patch`, `put`, `del`
* `getAll`, `getCursor`
* `abort`, `abortAll`
* `onLoading`, `setLoadingHooks`
* `interceptors`
* `messageState`, `hasError`
* `clearCache`
* `withRetry`
* `poll`, `stopPoll`, `stopAllPolls`
* `paramCache`
* `fixNull`
