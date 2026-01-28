# advanced_data.js - tài liệu sử dụng (chi tiết có ví dụ)

## Mục tiêu
`advanced_data.js` là thư viện xử lý và đồng bộ data cho frontend. Module này cung cấp:
- Khai báo endpoint API (GET/POST/PUT/PATCH/DELETE)
- Cache theo key có TTL + LRU (giới hạn maxSize)
- Dedupe request (tránh gọi trùng)
- Parse/Extract data thống nhất
- Quản lý loading state + hook hiển thị/kết thúc
- Abort request, retry, polling
- Tiện ích paging và cursor

---

## 1) Khái niệm chính
- `api`: object lưu các endpoint đã khai báo. Gọi `api[name](...)` để thực hiện request.
- `dataStore`: Map lưu kết quả cuối cùng theo `name`.
- `cacheStore`: Map cache in-memory (TTL + LRU).
- `paramCache`: Map lưu tham số tuỳ ý (module có thể dùng ở nơi khác).
- `interceptors`: { before, after } can thiệp request/response.
- `messageState`: { error, success } lưu thông điệp sau mỗi request.
- `loading hooks`: hook start/end để show/hide loading indicator.

---

## 2) Khai báo endpoint

### 2.1 GET
```
get(name, url, options?)
```
- `options.cache`: "default" | "no-cache" | string bất kỳ (tương đương default)
- `options.swr`: true => trả cache trước, tự fetch lại background
- `options.extract`: function (json) => data
- `options.parse`: "json" | "text" | function(response) => any
- `options.timeout`: ms
- `options.dedupe`: true/false
- `options.cacheTTL`: ms

**Ví dụ 1: GET cơ bản**
```
get("userList", "/api/users");
const users = await api.userList({ page: 1 });
```

**Ví dụ 2: GET có path param + query**
```
get("userDetail", "/api/users/:id");
const detail = await api.userDetail({ id: 10, view: "full" });
// URL cuối: /api/users/10?view=full
```

**Ví dụ 3: cache + swr**
```
get("stats", "/api/stats", { cacheTTL: 60000, swr: true });
const data = await api.stats();
// Lần sau: trả cache ngay, rồi fetch background cập nhật cache
```

**Ví dụ 4: tắt cache + tắt dedupe**
```
get("search", "/api/search", { cache: "no-cache", dedupe: false });
const result = await api.search({ q: "abc" });
```

**Ví dụ 5: parse/ extract tuỳ chỉnh**
```
get("report", "/api/report", {
  parse: "json",
  extract: (json) => json.payload.items
});
const items = await api.report({ month: "2026-01" });
```

### 2.2 POST/PUT/PATCH
```
post(name, url, defineOptions?)
put(name, url, defineOptions?)
patch(name, url, defineOptions?)
```
- `defineOptions.extract`, `defineOptions.parse`, `defineOptions.timeout`
- Khi gọi: `api[name](body, params?, fetchOptions?)`
- Nếu `body` là `FormData` => gửi form, không set JSON headers.

**Ví dụ 1: POST JSON**
```
post("createUser", "/api/users");
await api.createUser({ name: "An" });
```

**Ví dụ 2: PUT có params + body**
```
put("updateUser", "/api/users/:id");
await api.updateUser({ name: "An" }, { id: 10, notify: true });
// URL: /api/users/10?notify=true
```

**Ví dụ 3: PATCH với extract**
```
patch("patchUser", "/api/users/:id", {
  extract: (json) => json.data
});
const u = await api.patchUser({ active: true }, { id: 10 });
```

**Ví dụ 4: upload FormData**
```
post("uploadAvatar", "/api/users/:id/avatar");
const fd = new FormData();
fd.append("file", fileInput.files[0]);
await api.uploadAvatar(fd, { id: 10 });
```

### 2.3 DELETE
```
del(name, url, defineOptions?)
```
- Khi gọi: `api[name](params?, fetchOptions?)`

**Ví dụ: DELETE theo id**
```
del("deleteUser", "/api/users/:id");
await api.deleteUser({ id: 123 });
```

---

## 3) Cache & Dedupe (nhiều mode/trường hợp)

### 3.1 Cache default
- Mặc định GET sẽ cache theo key (name + method + params/fullUrl).

**Ví dụ**
```
get("products", "/api/products");
await api.products({ page: 1 }); // cache
await api.products({ page: 1 }); // trả cache nếu còn TTL
```

### 3.2 Cache có TTL riêng
```
get("products", "/api/products", { cacheTTL: 120000 });
```

### 3.3 Không cache
```
get("products", "/api/products", { cache: "no-cache" });
```

### 3.4 SWR (stale-while-revalidate)
- Trả cache trước, rồi fetch background cập nhật cache.
```
get("products", "/api/products", { swr: true });
```

### 3.5 Dedupe
- Bật mặc định, nhiều call cùng key sẽ dùng chung Promise.
```
get("products", "/api/products", { dedupe: true });
```

---

## 4) Parse & Extract (nhiều trường hợp)

### 4.1 Parse tự động
- Nếu response có content-type JSON, tự parse JSON.

### 4.2 Parse kiểu text
```
get("logText", "/api/log", { parse: "text" });
const text = await api.logText();
```

### 4.3 Parse custom
```
get("binary", "/api/file", {
  parse: async (res) => await res.arrayBuffer()
});
```

### 4.4 Extract mặc định
- Mặc định tự tìm trong các field: `data/result/items/...`

### 4.5 Extract custom
```
get("stats", "/api/stats", { extract: (json) => json.payload.summary });
```

### 4.6 Extract raw (legacy)
```
get("rawApi", "/api/raw", { extract: "raw" });
```

### 4.7 Helper extractPaged
```
get("pagedUsers", "/api/users", {
  extract: extractPaged({ itemsKey: "data.items", totalKey: "data.total" })
});
const { items, total } = await api.pagedUsers({ page: 1 });
```

---

## 5) Loading hooks
```
onLoading({ start, end })
setLoadingHooks({ onQueueAdd, onQueueEmpty })
```
**Ví dụ**
```
onLoading({
  start: () => showSpinner(),
  end: () => hideSpinner()
});
```
- Có debounce 100ms, chỉ fire khi có request active.

---

## 6) Error handling
- `isError` kiểm tra response.ok và các field thông dụng (error/success/status/code...)
- `messageState.error` lưu error object, `messageState.success` lưu message nếu có.
- `hasError()` => true nếu có lỗi.

**Ví dụ**
```
await api.userList();
if (hasError()) {
  console.error(messageState.error);
}
```

---

## 7) Abort request
**Abort theo endpoint**
```
abort("userList");
```

**Abort tất cả**
```
abortAll();
```

---

## 8) Retry
```
withRetry(fn, { retries = 3, delay = 1000, backoff = 2 })
```
**Ví dụ**
```
const data = await withRetry(() => api.userList(), {
  retries: 2,
  delay: 500,
  backoff: 2
});
```

---

## 9) Polling (nhiều trường hợp)
```
poll(name, params?, { interval=30000, immediate=true, onData, onError })
```

**Ví dụ 1: Poll đơn giản**
```
const stop = poll("stats", {}, {
  interval: 10000,
  onData: (data) => renderStats(data)
});
```

**Ví dụ 2: Poll có onError**
```
const stop = poll("stats", {}, {
  interval: 10000,
  onError: (err) => console.error(err)
});
```

**Dừng poll**
```
stop();
stopPoll("stats");
stopAllPolls();
```

---

## 10) Paging (nhiều mode)

### 10.1 getAll - mode offset (mặc định)
```
const all = await getAll("userList", { status: "active" }, {
  pageSize: 50,
  offsetKey: "offset",
  limitKey: "limit",
  mode: "offset"
});
```

### 10.2 getAll - mode page
```
const all = await getAll("userList", {}, {
  pageSize: 20,
  mode: "page",
  pageBase: 1 // nếu backend dùng page bắt đầu từ 1
});
```

### 10.3 getAll với onPage
```
const all = await getAll("userList", {}, {
  onPage: (items, pageIndex) => console.log(pageIndex, items.length)
});
```

---

## 11) Cursor pagination
```
const all = await getCursor("logList", { type: "system" }, {
  cursorKey: "cursor",
  dataKey: "data",
  nextCursorKey: "nextCursor",
  maxPages: 10,
  onPage: (items, cursor) => console.log(cursor, items.length)
});
```

---

## 12) Interceptors (nhiều trường hợp)

### 12.1 Trước request (before)
```
interceptors.before = async ({ body, params, headers, type }) => {
  headers.append("Authorization", "Bearer " + token);
};
```

### 12.2 Sau response (after)
```
interceptors.after = (data) => {
  if (data && data.code === "TOKEN_EXPIRED") {
    redirectToLogin();
  }
};
```

---

## 13) Các tiện ích khác

### 13.1 clearCache
```
clearCache();           // xoá toàn bộ cache
clearCache("userList"); // xoá cache theo pattern
```

### 13.2 fixNull
```
const name = fixNull(user.name, "Chưa có tên");
```

---

## 14) Danh sách export
```
api, dataStore, get, post, patch, put, del,
getAll, getCursor, abort, abortAll, onLoading,
interceptors, messageState, hasError, clearCache,
withRetry, poll, stopPoll, stopAllPolls, setLoadingHooks,
paramCache, fixNull, extractPaged
```

---

## 15) Lưu ý
- `request()` trả `null` khi có lỗi; kiểm tra `messageState.error` hoặc `hasError()`.
- `get()` có thể truyền `cacheKey` hoặc `cacheTTL` qua `options` nếu cần.
- `buildQueryString` tự động support array (append nhiều giá trị cùng key).

---
Tài liệu này mô tả các mode/trường hợp chính của module. Nếu muốn thêm ví dụ theo API thực tế (ví dụ trong `api.js`), hãy cho mình biết endpoint cụ thể.
