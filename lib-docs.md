# 📚 Lib.js - Thư viện Utility Frontend

Thư viện JavaScript utility cho các ứng dụng web, bao gồm phân trang, tìm kiếm, xuất Excel và format ngày tháng.

> **Lưu ý**: Thư viện này chỉ cung cấp chức năng JavaScript. Bạn cần tự viết CSS để style các component.

---

## 📦 Cài đặt

```html
<script src="lib.js"></script>
```

---

## � Tùy chỉnh CSS

Thư viện tạo ra các element với class cố định. Bạn cần style các class này theo design của mình.

### Pagination Classes

```css
/* Container chính */
.pagination-wrapper { }

/* Thông tin "Hiển thị 1-10 của 100" */
.pagination-info { }

/* Container các nút trang */
.pagination-pages { }

/* Nút trang (tất cả các nút) */
.pagination-btn { }
.pagination-btn:hover { }
.pagination-btn.active { }      /* Trang hiện tại */
.pagination-btn.disabled { }    /* Nút không khả dụng */

/* Các nút đặc biệt */
.pagination-first { }           /* Nút << (First) */
.pagination-last { }            /* Nút >> (Last) */
.pagination-prev { }            /* Nút < (Previous) */
.pagination-next { }            /* Nút > (Next) */
.pagination-page { }            /* Nút số trang */

/* Dấu ... */
.pagination-ellipsis { }

/* Dropdown số items/trang */
.pagination-per-page { }
.pagination-per-page-label { }
.pagination-per-page-select { }

/* Ô nhập trang */
.pagination-goto { }
.pagination-goto-label { }
.pagination-goto-input { }
.pagination-goto-btn { }

/* Trạng thái */
.pagination-disabled { }        /* Khi pagination bị disable */

/* Variants (thêm class vào container) */
.pagination-wrapper.compact { }
.pagination-wrapper.borderless { }
```

### Search Classes

```css
/* Container */
.search-input-container { }

/* Input tìm kiếm */
.search-input { }
.search-input::placeholder { }
.search-input:focus { }

/* Nút xóa */
.search-clear-btn { }
.search-clear-btn:hover { }

/* Highlight kết quả */
.search-highlight { }
mark.search-highlight { }
```

### Export Classes

```css
/* Nút export đơn */
.export-btn { }
.export-btn:hover { }

/* Dropdown export */
.export-dropdown { }
.export-dropdown-btn { }
.export-dropdown-menu { }
.export-dropdown-menu button { }
.export-dropdown-menu button:hover { }
```

### Ví dụ CSS cơ bản

```css
/* ===== PAGINATION ===== */
.pagination-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
}

.pagination-pages {
    display: flex;
    gap: 4px;
}

.pagination-btn {
    min-width: 36px;
    height: 36px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
}

.pagination-btn:hover:not(.disabled):not(.active) {
    background: #e3f2fd;
    border-color: #2196f3;
}

.pagination-btn.active {
    background: #2196f3;
    color: white;
    border-color: #2196f3;
}

.pagination-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ===== SEARCH ===== */
.search-input-container {
    position: relative;
    display: inline-flex;
    width: 100%;
    max-width: 300px;
}

.search-input {
    width: 100%;
    padding: 8px 40px 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.search-clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: #ddd;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    cursor: pointer;
}

.search-highlight {
    background: yellow;
    padding: 0 2px;
}

/* ===== EXPORT ===== */
.export-btn {
    padding: 8px 16px;
    background: #4caf50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.export-dropdown {
    position: relative;
    display: inline-block;
}

.export-dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 100;
}

.export-dropdown-menu button {
    display: block;
    width: 100%;
    padding: 8px 16px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
}

.export-dropdown-menu button:hover {
    background: #f5f5f5;
}
```

---

## 🎯 Các Class trong thư viện

| Class | Mô tả |
|-------|-------|
| `Pagination` | Phân trang cho Backend API |
| `FrontendPagination` | Phân trang dữ liệu phía Client |
| `SearchHelper` | Tìm kiếm và lọc dữ liệu |
| `ExcelExporter` | Xuất file Excel / CSV |
| `DateFormatter` | Format và parse ngày tháng |

---

## 1. Pagination - Phân trang Backend

Sử dụng khi dữ liệu được phân trang từ server.

```javascript
const pagination = new Pagination({
    container: '#pagination-container',
    totalItems: 100,
    itemsPerPage: 10,
    currentPage: 1,
    maxVisiblePages: 5,
    showInfo: true,
    showPerPageSelector: true,
    showFirstLast: true,
    showGoToPage: true,
    perPageOptions: [10, 20, 50, 100],
    labels: {
        prev: 'Trước',
        next: 'Sau',
        first: 'Đầu',
        last: 'Cuối',
        info: 'Hiển thị {start} - {end} của {total}',
        perPage: 'Mỗi trang:',
        goTo: 'Đi tới:',
        goBtn: 'Đi'
    },
    onPageChange: async (page, itemsPerPage) => {
        const response = await fetch(`/api?page=${page}&limit=${itemsPerPage}`);
        // Render data...
    }
});

// Methods
pagination.goToPage(5);
pagination.setTotalItems(200);
pagination.update({ totalItems: 200, currentPage: 1 });
pagination.getCurrentPage();
pagination.getTotalPages();
pagination.disable();
pagination.enable();
pagination.destroy();
```

---

## 2. FrontendPagination - Phân trang Client

Sử dụng khi dữ liệu đã load sẵn trên client.

```javascript
const pagination = new FrontendPagination({
    container: '#pagination',
    data: myDataArray,
    itemsPerPage: 10,
    renderItems: (items, info) => {
        // info = { currentPage, totalPages, totalItems, startIndex, endIndex }
        document.getElementById('list').innerHTML = items
            .map(item => `<div>${item.name}</div>`)
            .join('');
    }
});

// Methods
pagination.getCurrentPageData();
pagination.setData(newArray);
pagination.addItem(item);
pagination.removeItemAt(index);
pagination.sort((a, b) => a.name.localeCompare(b.name));
pagination.getData();
```

---

## 3. SearchHelper - Tìm kiếm

```javascript
// Tìm kiếm sâu
const results = SearchHelper.deepSearch(data, 'keyword');

// Tìm theo fields
const results = SearchHelper.searchByFields(data, 'john', ['name', 'email']);

// Tìm nhiều từ khóa
const results = SearchHelper.multiTermSearch(data, 'john admin', { operator: 'AND' });

// Fuzzy search
const results = SearchHelper.fuzzySearch(data, 'jhn', ['name'], 0.6);

// Highlight
const html = SearchHelper.highlight('Hello World', 'world');

// Debounce
const handleSearch = SearchHelper.createDebounceSearch((term) => {
    pagination.setData(SearchHelper.deepSearch(originalData, term));
}, 300);

// Tạo search input
const searchBox = SearchHelper.createSearchInput({
    placeholder: 'Tìm kiếm...',
    onSearch: (term) => { }
});
```

---

## 4. ExcelExporter - Xuất Excel/CSV

```javascript
// Xuất CSV
ExcelExporter.toCSV(data, 'filename');

// Xuất Excel
ExcelExporter.toExcel(data, {
    filename: 'report',
    sheetName: 'Data',
    title: 'BÁO CÁO',
    includeTimestamp: true,
    columns: [
        { header: 'Tên', key: 'name', width: 150 },
        { header: 'Email', key: 'email', width: 200 },
        { header: 'Ngày', key: 'createdAt', format: 'date' },
        { header: 'Lương', key: 'salary', format: 'currency' }
    ]
});

// Formats: date, datetime, currency, number, percent, boolean

// Tạo nút export
const btn = ExcelExporter.createExportButton({
    text: 'Xuất Excel',
    getData: () => pagination.getData()
});

// Tạo dropdown
const dropdown = ExcelExporter.createExportDropdown({
    getData: () => pagination.getData()
});
```

---

## 5. DateFormatter - Format ngày tháng

```javascript
// Format
DateFormatter.format(date, 'YYYY-MM-DD');         // 2024-12-14
DateFormatter.format(date, 'DD/MM/YYYY');         // 14/12/2024
DateFormatter.format(date, 'YYYY-MM-DD HH:mm:ss');// 2024-12-14 10:30:00

// Parse từ daterangepicker
const range = DateFormatter.parseRange('01/12/2024 - 31/12/2024');
// => { start: Date, end: Date }

// Format cho API
const params = DateFormatter.parseAndFormat('01/12/2024 - 31/12/2024', {
    format: 'YYYY-MM-DD',
    startKey: 'from',
    endKey: 'to'
});
// => { from: '2024-12-01', to: '2024-12-31' }

// Shortcuts
DateFormatter.today('YYYY-MM-DD');
DateFormatter.now('YYYY-MM-DD HH:mm:ss');
DateFormatter.addDays(date, 7, 'YYYY-MM-DD');
DateFormatter.startOfMonth(date, 'YYYY-MM-DD');
DateFormatter.endOfMonth(date, 'YYYY-MM-DD');

// Preset ranges
const presets = DateFormatter.getPresetRanges('DD/MM/YYYY');

// Utilities
DateFormatter.compare(date1, date2);    // -1, 0, 1
DateFormatter.isBetween(date, start, end);
DateFormatter.diffDays(date1, date2);
DateFormatter.isValid('14/12/2024');
```

---

## 🔗 Ví dụ kết hợp

```javascript
const originalData = [...myData];

// Pagination
const pagination = new FrontendPagination({
    container: '#pagination',
    data: originalData,
    itemsPerPage: 10,
    renderItems: (items) => {
        document.getElementById('table-body').innerHTML = items
            .map(item => `
                <tr>
                    <td>${SearchHelper.highlight(item.name, searchTerm)}</td>
                    <td>${DateFormatter.format(item.createdAt, 'DD/MM/YYYY')}</td>
                </tr>
            `).join('');
    }
});

// Search
let searchTerm = '';
const searchBox = SearchHelper.createSearchInput({
    onSearch: (term) => {
        searchTerm = term;
        pagination.setData(SearchHelper.deepSearch(originalData, term));
    }
});

// Export
const exportBtn = ExcelExporter.createExportButton({
    getData: () => pagination.getData(),
    exportOptions: { filename: 'report' }
});
```

---

## 📝 License

MIT License
