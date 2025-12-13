/**
 * Frontend Pagination Library for Backend API
 * 
 * Usage:
 * const pagination = new Pagination({
 *     container: '#pagination-container',
 *     totalItems: 100,
 *     itemsPerPage: 10,
 *     currentPage: 1,
 *     maxVisiblePages: 5,
 *     onPageChange: async (page, itemsPerPage) => {
 *         // Call backend API here
 *         const response = await fetch(`/api/items?page=${page}&limit=${itemsPerPage}`);
 *         const data = await response.json();
 *         // Update UI with data
 *     },
 *     showInfo: true,
 *     showPerPageSelector: true,
 *     perPageOptions: [10, 20, 50, 100],
 *     labels: {
 *         prev: 'Previous',
 *         next: 'Next',
 *         info: 'Showing {start} - {end} of {total}',
 *         perPage: 'Per page:'
 *     }
 * });
 */

class Pagination {
    constructor(options = {}) {
        this.options = {
            container: options.container || '#pagination-container',
            totalItems: options.totalItems || 0,
            itemsPerPage: options.itemsPerPage || 10,
            currentPage: options.currentPage || 1,
            maxVisiblePages: options.maxVisiblePages || 5,
            onPageChange: options.onPageChange || null,
            showInfo: options.showInfo !== undefined ? options.showInfo : true,
            showPerPageSelector: options.showPerPageSelector !== undefined ? options.showPerPageSelector : true,
            perPageOptions: options.perPageOptions || [10, 20, 50, 100],
            labels: {
                prev: options.labels?.prev || 'Previous',
                next: options.labels?.next || 'Next',
                first: options.labels?.first || 'First',
                last: options.labels?.last || 'Last',
                info: options.labels?.info || 'Showing {start} - {end} of {total}',
                perPage: options.labels?.perPage || 'Per page:',
                goTo: options.labels?.goTo || 'Go to:',
                goBtn: options.labels?.goBtn || 'Go'
            },
            showFirstLast: options.showFirstLast !== undefined ? options.showFirstLast : true,
            showGoToPage: options.showGoToPage !== undefined ? options.showGoToPage : true,
            disabled: options.disabled || false
        };

        this.container = null;
        this.init();
    }

    init() {
        this.container = typeof this.options.container === 'string' 
            ? document.querySelector(this.options.container) 
            : this.options.container;

        if (!this.container) {
            console.error('Pagination: Container not found');
            return;
        }

        this.render();
    }

    get totalPages() {
        return Math.ceil(this.options.totalItems / this.options.itemsPerPage);
    }

    get currentPage() {
        return Math.min(Math.max(1, this.options.currentPage), this.totalPages || 1);
    }

    set currentPage(page) {
        this.options.currentPage = Math.min(Math.max(1, page), this.totalPages || 1);
    }

    getVisiblePages() {
        const total = this.totalPages;
        const current = this.currentPage;
        const max = this.options.maxVisiblePages;
        
        if (total <= max) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        const pages = [];
        const half = Math.floor(max / 2);
        let start = current - half;
        let end = current + half;

        if (start < 1) {
            start = 1;
            end = max;
        }

        if (end > total) {
            end = total;
            start = total - max + 1;
        }

        // Always show first page
        if (start > 1) {
            pages.push(1);
            if (start > 2) {
                pages.push('...');
            }
        }

        // Add middle pages
        for (let i = start; i <= end; i++) {
            if (i > 0 && i <= total && !pages.includes(i)) {
                pages.push(i);
            }
        }

        // Always show last page
        if (end < total) {
            if (end < total - 1) {
                pages.push('...');
            }
            pages.push(total);
        }

        return pages;
    }

    getInfoText() {
        const start = ((this.currentPage - 1) * this.options.itemsPerPage) + 1;
        const end = Math.min(this.currentPage * this.options.itemsPerPage, this.options.totalItems);
        
        return this.options.labels.info
            .replace('{start}', start)
            .replace('{end}', end)
            .replace('{total}', this.options.totalItems)
            .replace('{page}', this.currentPage)
            .replace('{pages}', this.totalPages);
    }

    render() {
        if (!this.container) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'pagination-wrapper';

        // Info section
        if (this.options.showInfo && this.options.totalItems > 0) {
            const info = document.createElement('div');
            info.className = 'pagination-info';
            info.textContent = this.getInfoText();
            wrapper.appendChild(info);
        }

        // Pages container
        const pagesContainer = document.createElement('div');
        pagesContainer.className = 'pagination-pages';

        // First button
        if (this.options.showFirstLast) {
            const firstBtn = this.createButton('\u00AB', this.options.labels.first, () => this.goToPage(1));
            firstBtn.classList.add('pagination-first');
            if (this.currentPage === 1) firstBtn.classList.add('disabled');
            pagesContainer.appendChild(firstBtn);
        }

        // Previous button
        const prevBtn = this.createButton('\u2039', this.options.labels.prev, () => this.goToPage(this.currentPage - 1));
        prevBtn.classList.add('pagination-prev');
        if (this.currentPage === 1) prevBtn.classList.add('disabled');
        pagesContainer.appendChild(prevBtn);

        // Page numbers
        const visiblePages = this.getVisiblePages();
        visiblePages.forEach(page => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagesContainer.appendChild(ellipsis);
            } else {
                const pageBtn = this.createButton(page.toString(), `Page ${page}`, () => this.goToPage(page));
                pageBtn.classList.add('pagination-page');
                if (page === this.currentPage) {
                    pageBtn.classList.add('active');
                }
                pagesContainer.appendChild(pageBtn);
            }
        });

        // Next button
        const nextBtn = this.createButton('\u203A', this.options.labels.next, () => this.goToPage(this.currentPage + 1));
        nextBtn.classList.add('pagination-next');
        if (this.currentPage === this.totalPages || this.totalPages === 0) nextBtn.classList.add('disabled');
        pagesContainer.appendChild(nextBtn);

        // Last button
        if (this.options.showFirstLast) {
            const lastBtn = this.createButton('\u00BB', this.options.labels.last, () => this.goToPage(this.totalPages));
            lastBtn.classList.add('pagination-last');
            if (this.currentPage === this.totalPages || this.totalPages === 0) lastBtn.classList.add('disabled');
            pagesContainer.appendChild(lastBtn);
        }

        wrapper.appendChild(pagesContainer);

        // Per page selector
        if (this.options.showPerPageSelector) {
            const perPageContainer = document.createElement('div');
            perPageContainer.className = 'pagination-per-page';

            const label = document.createElement('span');
            label.className = 'pagination-per-page-label';
            label.textContent = this.options.labels.perPage;
            perPageContainer.appendChild(label);

            const select = document.createElement('select');
            select.className = 'pagination-per-page-select';
            this.options.perPageOptions.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                if (option === this.options.itemsPerPage) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });

            select.addEventListener('change', (e) => {
                this.setItemsPerPage(parseInt(e.target.value, 10));
            });

            perPageContainer.appendChild(select);
            wrapper.appendChild(perPageContainer);
        }

        // Go to page input
        if (this.options.showGoToPage && this.totalPages > 1) {
            const goToContainer = document.createElement('div');
            goToContainer.className = 'pagination-goto';

            const label = document.createElement('span');
            label.className = 'pagination-goto-label';
            label.textContent = this.options.labels.goTo;
            goToContainer.appendChild(label);

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'pagination-goto-input';
            input.min = 1;
            input.max = this.totalPages;
            input.placeholder = this.currentPage;
            input.title = `1 - ${this.totalPages}`;

            const goBtn = document.createElement('button');
            goBtn.type = 'button';
            goBtn.className = 'pagination-goto-btn';
            goBtn.textContent = this.options.labels.goBtn;

            const handleGoTo = () => {
                const page = parseInt(input.value, 10);
                if (!isNaN(page) && page >= 1 && page <= this.totalPages) {
                    this.goToPage(page);
                } else {
                    input.value = '';
                    input.focus();
                }
            };

            goBtn.addEventListener('click', handleGoTo);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleGoTo();
                }
            });

            goToContainer.appendChild(input);
            goToContainer.appendChild(goBtn);
            wrapper.appendChild(goToContainer);
        }

        // Clear and add to container
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        // Add disabled state if needed
        if (this.options.disabled) {
            wrapper.classList.add('pagination-disabled');
        }
    }

    createButton(text, title, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pagination-btn';
        btn.textContent = text;
        btn.title = title;
        
        if (!this.options.disabled) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!btn.classList.contains('disabled') && !btn.classList.contains('active')) {
                    onClick();
                }
            });
        }

        return btn;
    }

    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }

        this.currentPage = page;
        this.render();

        if (typeof this.options.onPageChange === 'function') {
            try {
                await this.options.onPageChange(this.currentPage, this.options.itemsPerPage);
            } catch (error) {
                console.error('Pagination: Error in onPageChange callback', error);
            }
        }
    }

    async setItemsPerPage(itemsPerPage) {
        this.options.itemsPerPage = itemsPerPage;
        // Reset to first page when changing items per page
        this.currentPage = 1;
        this.render();

        if (typeof this.options.onPageChange === 'function') {
            try {
                await this.options.onPageChange(this.currentPage, this.options.itemsPerPage);
            } catch (error) {
                console.error('Pagination: Error in onPageChange callback', error);
            }
        }
    }

    // Public API methods
    update(options = {}) {
        if (options.totalItems !== undefined) {
            this.options.totalItems = options.totalItems;
        }
        if (options.currentPage !== undefined) {
            this.currentPage = options.currentPage;
        }
        if (options.itemsPerPage !== undefined) {
            this.options.itemsPerPage = options.itemsPerPage;
        }
        if (options.disabled !== undefined) {
            this.options.disabled = options.disabled;
        }
        this.render();
    }

    setTotalItems(total) {
        this.options.totalItems = total;
        // Ensure current page is valid
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
        }
        this.render();
    }

    getCurrentPage() {
        return this.currentPage;
    }

    getItemsPerPage() {
        return this.options.itemsPerPage;
    }

    getTotalPages() {
        return this.totalPages;
    }

    disable() {
        this.options.disabled = true;
        this.render();
    }

    enable() {
        this.options.disabled = false;
        this.render();
    }

    destroy() {
        // Clean up event listeners by replacing container content
        if (this.container) {
            // Clone and replace to remove all event listeners
            const clone = this.container.cloneNode(false);
            if (this.container.parentNode) {
                this.container.parentNode.replaceChild(clone, this.container);
            }
            this.container = null;
        }
        // Clear options to help garbage collection
        this.options.onPageChange = null;
    }

    // Helper static method to calculate pagination params for API
    static getParams(page, itemsPerPage) {
        const skip = (page - 1) * itemsPerPage;
        return {
            page,
            limit: itemsPerPage,
            skip,
            offset: skip
        };
    }
}

/**
 * Frontend Pagination - Client-side Pagination
 * 
 * Use when data is already loaded on the client and pagination is needed without API calls.
 * 
 * Usage:
 * const frontPagination = new FrontendPagination({
 *     container: '#pagination-container',
 *     data: myDataArray,           // Pre-loaded data array
 *     itemsPerPage: 10,
 *     renderItems: (items) => {    // Callback to render data to UI
 *         const list = document.getElementById('my-list');
 *         list.innerHTML = items.map(item => `<div>${item.name}</div>`).join('');
 *     },
 *     labels: {
 *         prev: 'Previous',
 *         next: 'Next',
 *         goTo: 'Go to:',
 *         goBtn: 'Go'
 *     }
 * });
 * 
 * // Update with new data
 * frontPagination.setData(newDataArray);
 * 
 * // Get current page data
 * const currentItems = frontPagination.getCurrentPageData();
 */

class FrontendPagination extends Pagination {
    constructor(options = {}) {
        // Calculate totalItems from data array
        const data = options.data || [];
        
        super({
            ...options,
            totalItems: data.length,
            onPageChange: null // Override - will handle separately
        });

        this.data = data;
        this.renderItems = options.renderItems || null;
        this.onPageChangeCallback = options.onPageChange || null;

        // Initial render
        this.renderCurrentPage();
    }

    /**
     * Get current page data
     */
    getCurrentPageData() {
        const start = (this.currentPage - 1) * this.options.itemsPerPage;
        const end = start + this.options.itemsPerPage;
        return this.data.slice(start, end);
    }

    /**
     * Render current page data
     */
    renderCurrentPage() {
        const pageData = this.getCurrentPageData();
        
        if (typeof this.renderItems === 'function') {
            this.renderItems(pageData, {
                currentPage: this.currentPage,
                totalPages: this.totalPages,
                totalItems: this.data.length,
                startIndex: (this.currentPage - 1) * this.options.itemsPerPage,
                endIndex: Math.min(this.currentPage * this.options.itemsPerPage, this.data.length)
            });
        }
    }

    /**
     * Override goToPage to handle frontend pagination
     */
    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }

        this.currentPage = page;
        this.render();
        this.renderCurrentPage();

        // Call callback if exists
        if (typeof this.onPageChangeCallback === 'function') {
            try {
                await this.onPageChangeCallback(this.getCurrentPageData(), {
                    currentPage: this.currentPage,
                    totalPages: this.totalPages,
                    itemsPerPage: this.options.itemsPerPage
                });
            } catch (error) {
                console.error('FrontendPagination: Error in onPageChange callback', error);
            }
        }
    }

    /**
     * Override setItemsPerPage to re-render data
     */
    async setItemsPerPage(itemsPerPage) {
        this.options.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.render();
        this.renderCurrentPage();

        if (typeof this.onPageChangeCallback === 'function') {
            try {
                await this.onPageChangeCallback(this.getCurrentPageData(), {
                    currentPage: this.currentPage,
                    totalPages: this.totalPages,
                    itemsPerPage: this.options.itemsPerPage
                });
            } catch (error) {
                console.error('FrontendPagination: Error in onPageChange callback', error);
            }
        }
    }

    /**
     * Update with new data (full reload)
     */
    setData(data, resetPage = true) {
        this.data = data || [];
        this.options.totalItems = this.data.length;
        
        if (resetPage) {
            this.currentPage = 1;
        } else {
            // Ensure current page is valid
            if (this.currentPage > this.totalPages) {
                this.currentPage = this.totalPages || 1;
            }
        }
        
        this.render();
        this.renderCurrentPage();
    }

    /**
     * Add item to end of data
     */
    addItem(item) {
        this.data.push(item);
        this.options.totalItems = this.data.length;
        this.render();
        // Don't re-render current page since new item is at the end
    }

    /**
     * Add multiple items to end of data
     */
    addItems(items) {
        this.data.push(...items);
        this.options.totalItems = this.data.length;
        this.render();
    }

    /**
     * Remove item by index from entire data
     */
    removeItemAt(index) {
        if (index >= 0 && index < this.data.length) {
            this.data.splice(index, 1);
            this.options.totalItems = this.data.length;
            
            // Adjust current page if needed
            if (this.currentPage > this.totalPages && this.totalPages > 0) {
                this.currentPage = this.totalPages;
            }
            
            this.render();
            this.renderCurrentPage();
        }
    }

    /**
     * Remove item by condition
     */
    removeItemWhere(predicate) {
        const index = this.data.findIndex(predicate);
        if (index !== -1) {
            this.removeItemAt(index);
        }
    }

    /**
     * Filter data (creates copy, does not modify original data)
     */
    filter(predicate) {
        const filteredData = this.data.filter(predicate);
        return new FrontendPagination({
            ...this.options,
            data: filteredData,
            renderItems: this.renderItems,
            onPageChange: this.onPageChangeCallback
        });
    }

    /**
     * Search data and update pagination
     */
    search(predicate) {
        const filteredData = this.data.filter(predicate);
        this.setData(filteredData);
    }

    /**
     * Reset to original data (if searching/filtering)
     */
    resetSearch(originalData) {
        this.setData(originalData);
    }

    /**
     * Sort data
     */
    sort(compareFn) {
        this.data.sort(compareFn);
        this.renderCurrentPage();
    }

    /**
     * Get all data
     */
    getData() {
        return this.data;
    }

    /**
     * Get item count
     */
    getDataLength() {
        return this.data.length;
    }
}

/**
 * SearchHelper - Advanced Search Library
 * 
 * Usage:
 * // Deep search in objects
 * const results = SearchHelper.deepSearch(dataArray, 'keyword');
 * 
 * // Search by specific fields
 * const results = SearchHelper.searchByFields(dataArray, 'keyword', ['name', 'email']);
 * 
 * // Combine with FrontendPagination
 * const pagination = new FrontendPagination({
 *     data: myData,
 *     container: '#pagination',
 *     renderItems: (items) => { ... }
 * });
 * 
 * // Handle search with debounce
 * const originalData = pagination.getData();
 * const handleSearch = SearchHelper.createDebounceSearch((term) => {
 *     const filtered = SearchHelper.deepSearch(originalData, term);
 *     pagination.setData(filtered);
 * }, 300);
 * 
 * searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
 */

class SearchHelper {
    /**
     * Deep search in array of objects (recursively through nested objects/arrays)
     * @param {Array} data - Data array to search
     * @param {string} searchTerm - Search keyword
     * @param {Object} options - Options { caseSensitive, exactMatch }
     * @returns {Array} - Results array
     */
    static deepSearch(data, searchTerm, options = {}) {
        if (!searchTerm || searchTerm.toString().trim() === '') {
            return data;
        }

        const { caseSensitive = false, exactMatch = false } = options;
        const term = caseSensitive ? searchTerm.toString().trim() : searchTerm.toString().toLowerCase().trim();

        return data.filter(item => this._deepMatch(item, term, caseSensitive, exactMatch));
    }

    /**
     * Check recursive match in object (optimized with circular reference detection)
     */
    static _deepMatch(obj, term, caseSensitive, exactMatch) {
        const stack = [obj];
        const visited = new WeakSet(); // Avoid circular references

        while (stack.length > 0) {
            const current = stack.pop();
            
            // Skip if already visited (circular reference)
            if (typeof current === 'object' && current !== null) {
                if (visited.has(current)) continue;
                visited.add(current);
            }

            for (const key in current) {
                if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
                
                const value = current[key];
                const type = Object.prototype.toString.call(value);

                if (type === '[object Object]') {
                    if (!visited.has(value)) {
                        stack.push(value);
                    }
                } else if (type === '[object Array]') {
                    for (let i = 0; i < value.length; i++) {
                        const item = value[i];
                        if (typeof item === 'object' && item !== null) {
                            if (!visited.has(item)) {
                                stack.push(item);
                            }
                        } else {
                            // Primitive in array - early exit if match found
                            if (this._matchValue(item, term, caseSensitive, exactMatch)) {
                                return true;
                            }
                        }
                    }
                } else {
                    // Early exit when match found
                    if (this._matchValue(value, term, caseSensitive, exactMatch)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Compare value with search term
     */
    static _matchValue(value, term, caseSensitive, exactMatch) {
        if (value === null || value === undefined) return false;
        
        const strValue = caseSensitive 
            ? value.toString().trim() 
            : value.toString().toLowerCase().trim();

        if (exactMatch) {
            return strValue === term;
        }
        return strValue.indexOf(term) > -1;
    }

    /**
     * Search by specific fields
     * @param {Array} data - Data array
     * @param {string} searchTerm - Keyword
     * @param {Array} fields - Field names to search ['name', 'email', 'user.address']
     * @param {Object} options - Options
     * @returns {Array}
     */
    static searchByFields(data, searchTerm, fields, options = {}) {
        if (!searchTerm || searchTerm.toString().trim() === '') {
            return data;
        }

        const { caseSensitive = false, exactMatch = false, matchAll = false } = options;
        const term = caseSensitive ? searchTerm.toString().trim() : searchTerm.toString().toLowerCase().trim();

        return data.filter(item => {
            const matches = fields.map(field => {
                const value = this._getNestedValue(item, field);
                return this._matchValue(value, term, caseSensitive, exactMatch);
            });

            return matchAll ? matches.every(Boolean) : matches.some(Boolean);
        });
    }

    /**
     * Get nested value (supports 'user.profile.name')
     */
    static _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * Multi-term search (AND or OR)
     * @param {Array} data - Data array
     * @param {string} searchTerms - Keywords (space separated)
     * @param {Object} options - { operator: 'AND' | 'OR', fields: [] }
     * @returns {Array}
     */
    static multiTermSearch(data, searchTerms, options = {}) {
        if (!searchTerms || searchTerms.toString().trim() === '') {
            return data;
        }

        const { operator = 'AND', fields = null, caseSensitive = false } = options;
        const terms = searchTerms.toString().trim().split(/\s+/).filter(t => t.length > 0);

        if (terms.length === 0) return data;

        return data.filter(item => {
            const termMatches = terms.map(term => {
                if (fields && fields.length > 0) {
                    return fields.some(field => {
                        const value = this._getNestedValue(item, field);
                        return this._matchValue(value, caseSensitive ? term : term.toLowerCase(), caseSensitive, false);
                    });
                } else {
                    return this._deepMatch(item, caseSensitive ? term : term.toLowerCase(), caseSensitive, false);
                }
            });

            return operator === 'AND' ? termMatches.every(Boolean) : termMatches.some(Boolean);
        });
    }

    /**
     * Fuzzy search (allows minor typos)
     * @param {Array} data - Data array
     * @param {string} searchTerm - Search term
     * @param {Array} fields - Fields to search
     * @param {number} threshold - Match threshold (0-1, default 0.6)
     * @returns {Array}
     */
    static fuzzySearch(data, searchTerm, fields, threshold = 0.6) {
        if (!searchTerm || searchTerm.toString().trim() === '') {
            return data;
        }

        const term = searchTerm.toString().toLowerCase().trim();

        return data.filter(item => {
            return fields.some(field => {
                const value = this._getNestedValue(item, field);
                if (!value) return false;
                
                const strValue = value.toString().toLowerCase();
                const similarity = this._calculateSimilarity(term, strValue);
                return similarity >= threshold;
            });
        }).sort((a, b) => {
            // Sort by similarity
            const simA = Math.max(...fields.map(f => {
                const v = this._getNestedValue(a, f);
                return v ? this._calculateSimilarity(term, v.toString().toLowerCase()) : 0;
            }));
            const simB = Math.max(...fields.map(f => {
                const v = this._getNestedValue(b, f);
                return v ? this._calculateSimilarity(term, v.toString().toLowerCase()) : 0;
            }));
            return simB - simA;
        });
    }

    /**
     * Calculate similarity between two strings (Levenshtein-based)
     */
    static _calculateSimilarity(str1, str2) {
        // Return 1 if substring found
        if (str2.indexOf(str1) > -1) return 1;
        if (str1.indexOf(str2) > -1) return 1;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;

        const editDistance = this._levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
    static _levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Highlight search term in text
     * @param {string} text - Original text
     * @param {string} searchTerm - Term to highlight
     * @param {string} highlightClass - CSS class for highlight (default: 'search-highlight')
     * @returns {string} - HTML with highlight
     */
    static highlight(text, searchTerm, highlightClass = 'search-highlight') {
        if (!text || !searchTerm) return text;

        const regex = new RegExp(`(${this._escapeRegex(searchTerm)})`, 'gi');
        return text.toString().replace(regex, `<mark class="${highlightClass}">$1</mark>`);
    }

    /**
     * Escape special regex characters
     */
    static _escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Create debounce search function
     * @param {Function} searchFn - Search function
     * @param {number} delay - Delay in ms (default 300)
     * @returns {Function}
     */
    static createDebounceSearch(searchFn, delay = 300) {
        let timeoutId = null;

        return function(searchTerm) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                searchFn(searchTerm);
            }, delay);
        };
    }

    /**
     * Create search input component
     * @param {Object} options - Options
     * @returns {HTMLElement}
     */
    static createSearchInput(options = {}) {
        const {
            placeholder = 'Search...',
            onSearch = null,
            debounceDelay = 300,
            showClearButton = true,
            className = ''
        } = options;

        const container = document.createElement('div');
        container.className = `search-input-container ${className}`.trim();

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'search-input';
        input.placeholder = placeholder;

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'search-clear-btn';
        clearBtn.innerHTML = '×';
        clearBtn.style.display = 'none';

        container.appendChild(input);
        if (showClearButton) {
            container.appendChild(clearBtn);
        }

        // Event handlers
        const debouncedSearch = this.createDebounceSearch((term) => {
            if (typeof onSearch === 'function') {
                onSearch(term);
            }
        }, debounceDelay);

        input.addEventListener('input', (e) => {
            const term = e.target.value;
            clearBtn.style.display = term ? 'block' : 'none';
            debouncedSearch(term);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            if (typeof onSearch === 'function') {
                onSearch('');
            }
            input.focus();
        });

        // Expose methods
        container.getValue = () => input.value;
        container.setValue = (value) => {
            input.value = value;
            clearBtn.style.display = value ? 'block' : 'none';
        };
        container.clear = () => {
            input.value = '';
            clearBtn.style.display = 'none';
        };
        container.focus = () => input.focus();
        
        // Cleanup method to prevent memory leaks
        container.destroy = () => {
            // Clone and replace to remove all event listeners
            const newInput = input.cloneNode(false);
            const newClearBtn = clearBtn.cloneNode(false);
            input.replaceWith(newInput);
            clearBtn.replaceWith(newClearBtn);
            container.remove();
        };

        return container;
    }
}

/**
 * ExcelExporter - Excel/CSV Export Library
 * 
 * Usage:
 * // Simple CSV export
 * ExcelExporter.toCSV(data, 'filename');
 * 
 * // Excel export with custom columns
 * ExcelExporter.toExcel(data, {
 *     filename: 'report',
 *     sheetName: 'Data',
 *     columns: [
 *         { header: 'Name', key: 'name', width: 20 },
 *         { header: 'Email', key: 'email', width: 30 },
 *         { header: 'Created At', key: 'createdAt', width: 15, format: 'date' }
 *     ],
 *     title: 'DATA REPORT',
 *     includeTimestamp: true
 * });
 * 
 * // Combine with FrontendPagination
 * const pagination = new FrontendPagination({ data: myData, ... });
 * document.getElementById('export-btn').onclick = () => {
 *     ExcelExporter.toExcel(pagination.getData(), { filename: 'export' });
 * };
 */

class ExcelExporter {
    /**
     * Export data to CSV file
     * @param {Array} data - Data array
     * @param {string} filename - Filename (without .csv)
     * @param {Object} options - { columns, delimiter, includeHeader }
     */
    static toCSV(data, filename = 'export', options = {}) {
        if (!data || data.length === 0) {
            console.warn('ExcelExporter: No data to export');
            return;
        }

        const {
            columns = null,
            delimiter = ',',
            includeHeader = true,
            encoding = 'utf-8'
        } = options;

        // Determine columns
        const cols = columns || this._autoDetectColumns(data);
        
        // Create CSV content
        let csvContent = '';

        // Header row
        if (includeHeader) {
            csvContent += cols.map(col => this._escapeCSV(col.header || col.key)).join(delimiter) + '\n';
        }

        // Data rows
        data.forEach(row => {
            const values = cols.map(col => {
                const value = this._getNestedValue(row, col.key);
                const formatted = this._formatValue(value, col.format);
                return this._escapeCSV(formatted);
            });
            csvContent += values.join(delimiter) + '\n';
        });

        // Download file
        this._downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=' + encoding);
    }

    /**
     * Export data to Excel file (.xlsx)
     * Uses XML spreadsheet format to create Excel file
     * @param {Array} data - Data array
     * @param {Object} options - Options
     */
    static toExcel(data, options = {}) {
        if (!data || data.length === 0) {
            console.warn('ExcelExporter: No data to export');
            return;
        }

        const {
            filename = 'export',
            sheetName = 'Sheet1',
            columns = null,
            title = null,
            includeTimestamp = false,
            headerStyle = { bold: true, background: '#4472C4', color: '#FFFFFF' },
            dateFormat = 'DD/MM/YYYY'
        } = options;

        // Determine columns
        const cols = columns || this._autoDetectColumns(data);

        // Create Excel XML
        let xml = this._createExcelXML(data, cols, {
            sheetName,
            title,
            includeTimestamp,
            headerStyle,
            dateFormat
        });

        // Download file
        this._downloadFile(xml, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    /**
     * Create Excel XML content
     */
    static _createExcelXML(data, columns, options) {
        const { sheetName, title, includeTimestamp, headerStyle, dateFormat } = options;

        let startRow = 1;
        let rows = '';

        // Title row
        if (title) {
            rows += `<Row ss:Height="30">
                <Cell ss:StyleID="title" ss:MergeAcross="${columns.length - 1}">
                    <Data ss:Type="String">${this._escapeXML(title)}</Data>
                </Cell>
            </Row>`;
            startRow++;
        }

        // Timestamp row
        if (includeTimestamp) {
            const timestamp = new Date().toLocaleString();
            rows += `<Row>
                <Cell ss:StyleID="timestamp" ss:MergeAcross="${columns.length - 1}">
                    <Data ss:Type="String">Exported at: ${timestamp}</Data>
                </Cell>
            </Row>`;
            startRow++;
        }

        // Empty row after title/timestamp
        if (title || includeTimestamp) {
            rows += '<Row></Row>';
            startRow++;
        }

        // Header row
        rows += '<Row ss:Height="25">';
        columns.forEach(col => {
            rows += `<Cell ss:StyleID="header">
                <Data ss:Type="String">${this._escapeXML(col.header || col.key)}</Data>
            </Cell>`;
        });
        rows += '</Row>';

        // Data rows
        data.forEach(item => {
            rows += '<Row>';
            columns.forEach(col => {
                const value = this._getNestedValue(item, col.key);
                const { type, formatted } = this._getExcelType(value, col.format, dateFormat);
                rows += `<Cell ss:StyleID="data">
                    <Data ss:Type="${type}">${this._escapeXML(formatted)}</Data>
                </Cell>`;
            });
            rows += '</Row>';
        });

        // Column widths
        let colWidths = '';
        columns.forEach(col => {
            const width = col.width || 100;
            colWidths += `<Column ss:Width="${width}"/>`;
        });

        // Complete XML
        return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Styles>
        <Style ss:ID="Default">
            <Font ss:FontName="Arial" ss:Size="10"/>
        </Style>
        <Style ss:ID="title">
            <Font ss:FontName="Arial" ss:Size="16" ss:Bold="1"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
        </Style>
        <Style ss:ID="timestamp">
            <Font ss:FontName="Arial" ss:Size="9" ss:Italic="1"/>
            <Alignment ss:Horizontal="Right"/>
        </Style>
        <Style ss:ID="header">
            <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="${headerStyle.color}"/>
            <Interior ss:Color="${headerStyle.background}" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
            <Borders>
                <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
            </Borders>
        </Style>
        <Style ss:ID="data">
            <Font ss:FontName="Arial" ss:Size="10"/>
            <Alignment ss:Vertical="Center"/>
            <Borders>
                <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
            </Borders>
        </Style>
    </Styles>
    <Worksheet ss:Name="${this._escapeXML(sheetName)}">
        <Table>
            ${colWidths}
            ${rows}
        </Table>
    </Worksheet>
</Workbook>`;
    }

    /**
     * Auto detect columns from data
     */
    static _autoDetectColumns(data) {
        if (!data || data.length === 0) return [];

        const firstItem = data[0];
        const columns = [];

        const extractKeys = (obj, prefix = '') => {
            for (const key in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];

                if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                    extractKeys(value, fullKey);
                } else {
                    columns.push({
                        header: this._formatHeader(key),
                        key: fullKey,
                        width: this._estimateWidth(key, value)
                    });
                }
            }
        };

        extractKeys(firstItem);
        return columns;
    }

    /**
     * Format header from key (camelCase -> Title Case)
     */
    static _formatHeader(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/[_-]/g, ' ')
            .replace(/^\w/, c => c.toUpperCase())
            .trim();
    }

    /**
     * Estimate column width
     */
    static _estimateWidth(key, sampleValue) {
        const keyLength = key.length * 8;
        let valueLength = 80;

        if (sampleValue !== null && sampleValue !== undefined) {
            valueLength = String(sampleValue).length * 7;
        }

        return Math.min(Math.max(keyLength, valueLength, 60), 300);
    }

    /**
     * Get nested value
     */
    static _getNestedValue(obj, path) {
        if (!path) return obj;
        
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : '';
        }, obj);
    }

    /**
     * Format value by type
     */
    static _formatValue(value, format) {
        if (value === null || value === undefined) return '';

        switch (format) {
            case 'date':
                if (value instanceof Date) {
                    return value.toLocaleDateString();
                }
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                    return new Date(value).toLocaleDateString();
                }
                return value;

            case 'datetime':
                if (value instanceof Date) {
                    return value.toLocaleString();
                }
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                    return new Date(value).toLocaleString();
                }
                return value;

            case 'currency':
                if (typeof value === 'number') {
                    return new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'USD' 
                    }).format(value);
                }
                return value;

            case 'number':
                if (typeof value === 'number') {
                    return new Intl.NumberFormat('en-US').format(value);
                }
                return value;

            case 'percent':
                if (typeof value === 'number') {
                    return (value * 100).toFixed(2) + '%';
                }
                return value;

            case 'boolean':
                return value ? 'Yes' : 'No';

            default:
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                return String(value);
        }
    }

    /**
     * Determine type for Excel
     */
    static _getExcelType(value, format, dateFormat) {
        if (value === null || value === undefined || value === '') {
            return { type: 'String', formatted: '' };
        }

        if (typeof value === 'number') {
            if (format === 'percent') {
                return { type: 'String', formatted: (value * 100).toFixed(2) + '%' };
            }
            return { type: 'Number', formatted: String(value) };
        }

        if (typeof value === 'boolean') {
            return { type: 'String', formatted: value ? 'Yes' : 'No' };
        }

        if (value instanceof Date) {
            return { type: 'String', formatted: value.toLocaleDateString() };
        }

        if (format === 'date' && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
            return { type: 'String', formatted: new Date(value).toLocaleDateString() };
        }

        if (Array.isArray(value)) {
            return { type: 'String', formatted: value.join(', ') };
        }

        return { type: 'String', formatted: String(value) };
    }

    /**
     * Escape value for CSV
     */
    static _escapeCSV(value) {
        if (value === null || value === undefined) return '';
        
        let str = String(value);
        
        // If contains comma, newline or double quote -> wrap in quotes
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            str = '"' + str.replace(/"/g, '""') + '"';
        }
        
        return str;
    }

    /**
     * Escape value for XML
     */
    static _escapeXML(value) {
        if (value === null || value === undefined) return '';
        
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Download file
     */
    static _downloadFile(content, filename, mimeType) {
        const blob = new Blob(['\ufeff' + content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Create export button
     * @param {Object} options - Options
     * @returns {HTMLElement}
     */
    static createExportButton(options = {}) {
        const {
            text = 'Export Excel',
            className = '',
            icon = '📥',
            getData = null,
            exportOptions = {}
        } = options;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `export-btn ${className}`.trim();
        btn.innerHTML = `${icon} ${text}`;

        btn.addEventListener('click', () => {
            if (typeof getData === 'function') {
                const data = getData();
                if (data && data.length > 0) {
                    this.toExcel(data, exportOptions);
                } else {
                    console.warn('ExcelExporter: No data to export');
                }
            }
        });

        return btn;
    }

    /**
     * Create export dropdown (Excel + CSV)
     * @param {Object} options - Options
     * @returns {HTMLElement}
     */
    static createExportDropdown(options = {}) {
        const {
            className = '',
            getData = null,
            exportOptions = {}
        } = options;

        const container = document.createElement('div');
        container.className = `export-dropdown ${className}`.trim();

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'export-dropdown-btn';
        btn.innerHTML = '📥 Export Data ▾';

        const menu = document.createElement('div');
        menu.className = 'export-dropdown-menu';
        menu.style.display = 'none';

        const excelOption = document.createElement('button');
        excelOption.type = 'button';
        excelOption.innerHTML = '📊 Excel (.xlsx)';
        excelOption.onclick = () => {
            if (typeof getData === 'function') {
                this.toExcel(getData(), exportOptions);
            }
            menu.style.display = 'none';
        };

        const csvOption = document.createElement('button');
        csvOption.type = 'button';
        csvOption.innerHTML = '📄 CSV (.csv)';
        csvOption.onclick = () => {
            if (typeof getData === 'function') {
                this.toCSV(getData(), exportOptions.filename || 'export', exportOptions);
            }
            menu.style.display = 'none';
        };

        menu.appendChild(excelOption);
        menu.appendChild(csvOption);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });

        container.appendChild(btn);
        container.appendChild(menu);

        return container;
    }
}

/**
 * DateFormatter - Date Formatting Library
 * 
 * Use with DateRangePicker or any date input.
 * 
 * Supported formats:
 * - 'YYYY-MM-DD'           -> 2024-12-14
 * - 'YYYY/MM/DD'           -> 2024/12/14
 * - 'DD/MM/YYYY'           -> 14/12/2024
 * - 'DD-MM-YYYY'           -> 14-12-2024
 * - 'YYYY-MM-DD HH:mm:ss'  -> 2024-12-14 10:30:00
 * - 'YYYY/MM/DD HH:mm:ss'  -> 2024/12/14 10:30:00
 * - 'DD/MM/YYYY HH:mm:ss'  -> 14/12/2024 10:30:00
 * - 'HH:mm:ss'             -> 10:30:00
 * - 'HH:mm'                -> 10:30
 * - 'api'                  -> ISO 8601 for API
 * - 'display'              -> Display by locale
 * 
 * Usage:
 * // Single format
 * DateFormatter.format(date, 'YYYY-MM-DD');
 * 
 * // Parse from daterangepicker
 * const { start, end } = DateFormatter.parseRange('01/12/2024 - 31/12/2024');
 * 
 * // Format range for API
 * const params = DateFormatter.formatRangeForAPI(startDate, endDate);
 * // => { startDate: '2024-12-01', endDate: '2024-12-31' }
 */

class DateFormatter {
    // Supported formats
    static FORMATS = {
        'YYYY-MM-DD': 'YYYY-MM-DD',
        'YYYY/MM/DD': 'YYYY/MM/DD',
        'DD/MM/YYYY': 'DD/MM/YYYY',
        'DD-MM-YYYY': 'DD-MM-YYYY',
        'MM/DD/YYYY': 'MM/DD/YYYY',
        'YYYY-MM-DD HH:mm:ss': 'YYYY-MM-DD HH:mm:ss',
        'YYYY/MM/DD HH:mm:ss': 'YYYY/MM/DD HH:mm:ss',
        'DD/MM/YYYY HH:mm:ss': 'DD/MM/YYYY HH:mm:ss',
        'DD-MM-YYYY HH:mm:ss': 'DD-MM-YYYY HH:mm:ss',
        'HH:mm:ss': 'HH:mm:ss',
        'HH:mm': 'HH:mm',
        'api': 'api',
        'display': 'display'
    };

    /**
     * Format date according to specified format
     * @param {Date|string|number} date - Date to format
     * @param {string} format - Output format
     * @returns {string}
     */
    static format(date, format = 'YYYY-MM-DD') {
        const d = this._toDate(date);
        if (!d || isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        switch (format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            
            case 'YYYY/MM/DD':
                return `${year}/${month}/${day}`;
            
            case 'DD/MM/YYYY':
                return `${day}/${month}/${year}`;
            
            case 'DD-MM-YYYY':
                return `${day}-${month}-${year}`;
            
            case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
            
            case 'YYYY-MM-DD HH:mm:ss':
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
            case 'YYYY/MM/DD HH:mm:ss':
                return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
            
            case 'DD/MM/YYYY HH:mm:ss':
                return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
            
            case 'DD-MM-YYYY HH:mm:ss':
                return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
            
            case 'HH:mm:ss':
                return `${hours}:${minutes}:${seconds}`;
            
            case 'HH:mm':
                return `${hours}:${minutes}`;
            
            case 'api':
            case 'ISO':
                return d.toISOString();
            
            case 'display':
                return d.toLocaleString();
            
            case 'date-display':
                return d.toLocaleDateString();
            
            case 'time-display':
                return d.toLocaleTimeString();
            
            default:
                // Custom format với placeholders
                return format
                    .replace('YYYY', year)
                    .replace('MM', month)
                    .replace('DD', day)
                    .replace('HH', hours)
                    .replace('mm', minutes)
                    .replace('ss', seconds);
        }
    }

    /**
     * Parse date string from daterangepicker
     * @param {string} rangeString - Range string (e.g.: "01/12/2024 - 31/12/2024")
     * @param {string} separator - Separator (default: " - ")
     * @param {string} inputFormat - Input format (default auto-detect)
     * @returns {{ start: Date, end: Date, startStr: string, endStr: string }}
     */
    static parseRange(rangeString, separator = ' - ', inputFormat = null) {
        if (!rangeString || typeof rangeString !== 'string') {
            return { start: null, end: null, startStr: '', endStr: '' };
        }

        const parts = rangeString.split(separator);
        if (parts.length !== 2) {
            return { start: null, end: null, startStr: '', endStr: '' };
        }

        const startStr = parts[0].trim();
        const endStr = parts[1].trim();

        const start = this._parseDate(startStr, inputFormat);
        const end = this._parseDate(endStr, inputFormat);

        return { start, end, startStr, endStr };
    }

    /**
     * Format range for API
     * @param {Date|string} startDate 
     * @param {Date|string} endDate 
     * @param {Object} options - { format, keys: { start, end } }
     * @returns {Object}
     */
    static formatRangeForAPI(startDate, endDate, options = {}) {
        const {
            format = 'YYYY-MM-DD',
            startKey = 'startDate',
            endKey = 'endDate',
            includeTime = false,
            startOfDay = true,
            endOfDay = true
        } = options;

        let start = this._toDate(startDate);
        let end = this._toDate(endDate);

        if (startOfDay && start) {
            start.setHours(0, 0, 0, 0);
        }
        if (endOfDay && end) {
            end.setHours(23, 59, 59, 999);
        }

        const formatToUse = includeTime ? format.replace('YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss') : format;

        return {
            [startKey]: start ? this.format(start, formatToUse) : '',
            [endKey]: end ? this.format(end, formatToUse) : ''
        };
    }

    /**
     * Parse from daterangepicker and format for API
     * @param {string} rangeString - "01/12/2024 - 31/12/2024"
     * @param {Object} options 
     * @returns {Object}
     */
    static parseAndFormat(rangeString, options = {}) {
        const { start, end } = this.parseRange(rangeString, options.separator);
        return this.formatRangeForAPI(start, end, options);
    }

    /**
     * Get today with format
     * @param {string} format 
     * @returns {string}
     */
    static today(format = 'YYYY-MM-DD') {
        return this.format(new Date(), format);
    }

    /**
     * Get current datetime
     * @param {string} format 
     * @returns {string}
     */
    static now(format = 'YYYY-MM-DD HH:mm:ss') {
        return this.format(new Date(), format);
    }

    /**
     * Add/subtract days
     * @param {Date|string} date 
     * @param {number} days - Number of days (negative to subtract)
     * @param {string} format 
     * @returns {string|Date}
     */
    static addDays(date, days, format = null) {
        const d = this._toDate(date);
        if (!d) return null;

        d.setDate(d.getDate() + days);
        return format ? this.format(d, format) : d;
    }

    /**
     * Add/subtract months
     * @param {Date|string} date 
     * @param {number} months 
     * @param {string} format 
     * @returns {string|Date}
     */
    static addMonths(date, months, format = null) {
        const d = this._toDate(date);
        if (!d) return null;

        d.setMonth(d.getMonth() + months);
        return format ? this.format(d, format) : d;
    }

    /**
     * Get first day of month
     * @param {Date|string} date 
     * @param {string} format 
     * @returns {string|Date}
     */
    static startOfMonth(date = new Date(), format = null) {
        const d = this._toDate(date);
        if (!d) return null;

        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return format ? this.format(d, format) : d;
    }

    /**
     * Get last day of month
     * @param {Date|string} date 
     * @param {string} format 
     * @returns {string|Date}
     */
    static endOfMonth(date = new Date(), format = null) {
        const d = this._toDate(date);
        if (!d) return null;

        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        d.setHours(23, 59, 59, 999);
        return format ? this.format(d, format) : d;
    }

    /**
     * Get first day of week (Monday)
     * @param {Date|string} date 
     * @param {string} format 
     * @returns {string|Date}
     */
    static startOfWeek(date = new Date(), format = null) {
        const d = this._toDate(date);
        if (!d) return null;

        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return format ? this.format(d, format) : d;
    }

    /**
     * Get last day of week (Sunday)
     * @param {Date|string} date 
     * @param {string} format 
     * @returns {string|Date}
     */
    static endOfWeek(date = new Date(), format = null) {
        const start = this.startOfWeek(date);
        if (!start) return null;

        const d = new Date(start);
        d.setDate(d.getDate() + 6);
        d.setHours(23, 59, 59, 999);
        return format ? this.format(d, format) : d;
    }

    /**
     * Create preset ranges for daterangepicker
     * @param {string} format - Format for output
     * @returns {Object}
     */
    static getPresetRanges(format = 'DD/MM/YYYY') {
        const today = new Date();
        
        return {
            'Today': {
                start: this.format(today, format),
                end: this.format(today, format)
            },
            'Yesterday': {
                start: this.format(this.addDays(today, -1), format),
                end: this.format(this.addDays(today, -1), format)
            },
            'Last 7 days': {
                start: this.format(this.addDays(today, -6), format),
                end: this.format(today, format)
            },
            'Last 30 days': {
                start: this.format(this.addDays(today, -29), format),
                end: this.format(today, format)
            },
            'This month': {
                start: this.format(this.startOfMonth(today), format),
                end: this.format(this.endOfMonth(today), format)
            },
            'Last month': {
                start: this.format(this.startOfMonth(this.addMonths(today, -1)), format),
                end: this.format(this.endOfMonth(this.addMonths(today, -1)), format)
            },
            'This week': {
                start: this.format(this.startOfWeek(today), format),
                end: this.format(this.endOfWeek(today), format)
            }
        };
    }

    /**
     * Compare 2 dates
     * @param {Date|string} date1 
     * @param {Date|string} date2 
     * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
     */
    static compare(date1, date2) {
        const d1 = this._toDate(date1);
        const d2 = this._toDate(date2);

        if (!d1 || !d2) return null;

        const t1 = d1.getTime();
        const t2 = d2.getTime();

        if (t1 < t2) return -1;
        if (t1 > t2) return 1;
        return 0;
    }

    /**
     * Check if date is between range
     * @param {Date|string} date 
     * @param {Date|string} startDate 
     * @param {Date|string} endDate 
     * @returns {boolean}
     */
    static isBetween(date, startDate, endDate) {
        const d = this._toDate(date);
        const start = this._toDate(startDate);
        const end = this._toDate(endDate);

        if (!d || !start || !end) return false;

        return d >= start && d <= end;
    }

    /**
     * Calculate number of days between 2 dates
     * @param {Date|string} date1 
     * @param {Date|string} date2 
     * @returns {number}
     */
    static diffDays(date1, date2) {
        const d1 = this._toDate(date1);
        const d2 = this._toDate(date2);

        if (!d1 || !d2) return null;

        const diff = Math.abs(d2.getTime() - d1.getTime());
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    /**
     * Validate date format
     * @param {string} dateString 
     * @param {string} format 
     * @returns {boolean}
     */
    static isValid(dateString, format = null) {
        const d = this._parseDate(dateString, format);
        return d !== null && !isNaN(d.getTime());
    }

    /**
     * Convert Date to object
     */
    static _toDate(value) {
        if (!value) return null;
        if (value instanceof Date) return new Date(value.getTime());
        if (typeof value === 'number') return new Date(value);
        if (typeof value === 'string') return this._parseDate(value);
        return null;
    }

    /**
     * Parse date string to Date object
     */
    static _parseDate(str, format = null) {
        if (!str) return null;

        // If ISO format or timestamp
        const isoDate = new Date(str);
        if (!isNaN(isoDate.getTime()) && str.includes('-') && str.length >= 10) {
            return isoDate;
        }

        // Auto-detect format
        let year, month, day, hours = 0, minutes = 0, seconds = 0;

        // Split date and time parts
        const parts = str.trim().split(/[\sT]+/);
        const datePart = parts[0];
        const timePart = parts[1] || '';

        // Parse time
        if (timePart) {
            const timeParts = timePart.split(':');
            hours = parseInt(timeParts[0] || 0, 10);
            minutes = parseInt(timeParts[1] || 0, 10);
            seconds = parseInt(timeParts[2] || 0, 10);
        }

        // Try different date formats
        // DD/MM/YYYY or DD-MM-YYYY
        let match = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (match) {
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            year = parseInt(match[3], 10);
            return new Date(year, month, day, hours, minutes, seconds);
        }

        // YYYY/MM/DD or YYYY-MM-DD
        match = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (match) {
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            day = parseInt(match[3], 10);
            return new Date(year, month, day, hours, minutes, seconds);
        }

        // MM/DD/YYYY (US format - requires format specification)
        if (format === 'MM/DD/YYYY') {
            match = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (match) {
                month = parseInt(match[1], 10) - 1;
                day = parseInt(match[2], 10);
                year = parseInt(match[3], 10);
                return new Date(year, month, day, hours, minutes, seconds);
            }
        }

        // Fallback to native parsing
        const fallback = new Date(str);
        return isNaN(fallback.getTime()) ? null : fallback;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Pagination, FrontendPagination, SearchHelper, ExcelExporter, DateFormatter };
}
