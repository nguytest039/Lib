/*!
 * Pagination library
 * Author: DKN(DUC) 
 * © 2026
 */

/**
 * Backend Pagination Library
 * 
 * import { Pagination } from './pagination.js';
 * 
 * const pagination = new Pagination({
 *     container: '#pagination',
 *     totalItems: 100,
 *     itemsPerPage: 10,
 *     currentPage: 1,
 *     maxVisiblePages: 5,
 *     onPageChange: async (page, itemsPerPage) => {
 *         const response = await fetch(`/api/items?page=${page}&limit=${itemsPerPage}`);
 *         const data = await response.json();
 *         // Update UI
 *     }
 * });
 */

export class Pagination {
    constructor(options = {}) {
        this.options = {
            container: options.container || '#pagination-container',
            totalItems: options.totalItems || 0,
            itemsPerPage: options.itemsPerPage || 10,
            currentPage: options.currentPage || 1,
            maxVisiblePages: options.maxVisiblePages || 5,
            onPageChange: options.onPageChange || null,
            showInfo: options.showInfo ?? true,
            showPerPageSelector: options.showPerPageSelector ?? true,
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
            showFirstLast: options.showFirstLast ?? true,
            showGoToPage: options.showGoToPage ?? true,
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
        
        if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);

        const pages = [];
        const half = Math.floor(max / 2);
        let start = Math.max(1, current - half);
        let end = Math.min(total, start + max - 1);

        if (end === total) start = Math.max(1, end - max + 1);

        if (start > 1) {
            pages.push(1);
            if (start > 2) pages.push('...');
        }

        for (let i = start; i <= end; i++) pages.push(i);

        if (end < total) {
            if (end < total - 1) pages.push('...');
            pages.push(total);
        }

        return pages;
    }

    getInfoText() {
        const start = (this.currentPage - 1) * this.options.itemsPerPage + 1;
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

        if (this.options.showInfo && this.options.totalItems > 0) {
            const info = document.createElement('div');
            info.className = 'pagination-info';
            info.textContent = this.getInfoText();
            wrapper.appendChild(info);
        }

        const pagesContainer = document.createElement('div');
        pagesContainer.className = 'pagination-pages';

        if (this.options.showFirstLast) {
            const firstBtn = this.createButton('«', this.options.labels.first, () => this.goToPage(1));
            firstBtn.classList.add('pagination-first');
            if (this.currentPage === 1) firstBtn.classList.add('disabled');
            pagesContainer.appendChild(firstBtn);
        }

        const prevBtn = this.createButton('‹', this.options.labels.prev, () => this.goToPage(this.currentPage - 1));
        prevBtn.classList.add('pagination-prev');
        if (this.currentPage === 1) prevBtn.classList.add('disabled');
        pagesContainer.appendChild(prevBtn);

        this.getVisiblePages().forEach(page => {
            if (page === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagesContainer.appendChild(ellipsis);
            } else {
                const pageBtn = this.createButton(page.toString(), `Page ${page}`, () => this.goToPage(page));
                pageBtn.classList.add('pagination-page');
                if (page === this.currentPage) pageBtn.classList.add('active');
                pagesContainer.appendChild(pageBtn);
            }
        });

        const nextBtn = this.createButton('›', this.options.labels.next, () => this.goToPage(this.currentPage + 1));
        nextBtn.classList.add('pagination-next');
        if (this.currentPage === this.totalPages || this.totalPages === 0) nextBtn.classList.add('disabled');
        pagesContainer.appendChild(nextBtn);

        if (this.options.showFirstLast) {
            const lastBtn = this.createButton('»', this.options.labels.last, () => this.goToPage(this.totalPages));
            lastBtn.classList.add('pagination-last');
            if (this.currentPage === this.totalPages || this.totalPages === 0) lastBtn.classList.add('disabled');
            pagesContainer.appendChild(lastBtn);
        }

        wrapper.appendChild(pagesContainer);

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
                if (option === this.options.itemsPerPage) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', e => this.setItemsPerPage(parseInt(e.target.value, 10)));
            perPageContainer.appendChild(select);
            wrapper.appendChild(perPageContainer);
        }

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
            input.addEventListener('keypress', e => e.key === 'Enter' && handleGoTo());

            goToContainer.appendChild(input);
            goToContainer.appendChild(goBtn);
            wrapper.appendChild(goToContainer);
        }

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        if (this.options.disabled) wrapper.classList.add('pagination-disabled');
    }

    createButton(text, title, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pagination-btn';
        btn.textContent = text;
        btn.title = title;
        
        if (!this.options.disabled) {
            btn.addEventListener('click', e => {
                e.preventDefault();
                if (!btn.classList.contains('disabled') && !btn.classList.contains('active')) {
                    onClick();
                }
            });
        }

        return btn;
    }

    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;

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

    update(options = {}) {
        if (options.totalItems !== undefined) this.options.totalItems = options.totalItems;
        if (options.currentPage !== undefined) this.currentPage = options.currentPage;
        if (options.itemsPerPage !== undefined) this.options.itemsPerPage = options.itemsPerPage;
        if (options.disabled !== undefined) this.options.disabled = options.disabled;
        this.render();
    }

    setTotalItems(total) {
        this.options.totalItems = total;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages || 1;
        this.render();
    }

    getCurrentPage() { return this.currentPage; }
    getItemsPerPage() { return this.options.itemsPerPage; }
    getTotalPages() { return this.totalPages; }

    disable() {
        this.options.disabled = true;
        this.render();
    }

    enable() {
        this.options.disabled = false;
        this.render();
    }

    destroy() {
        if (this.container) {
            const clone = this.container.cloneNode(false);
            if (this.container.parentNode) {
                this.container.parentNode.replaceChild(clone, this.container);
            }
            this.container = null;
        }
        this.options.onPageChange = null;
    }

    static getParams(page, itemsPerPage) {
        const skip = (page - 1) * itemsPerPage;
        return { page, limit: itemsPerPage, skip, offset: skip };
    }
}

/**
 * Frontend Pagination - Client-side
 * 
 * import { FrontendPagination } from './pagination.js';
 * 
 * const frontPagination = new FrontendPagination({
 *     container: '#pagination',
 *     data: myDataArray,
 *     itemsPerPage: 10,
 *     renderItems: (items) => {
 *         const list = document.getElementById('my-list');
 *         list.innerHTML = items.map(item => `<div>${item.name}</div>`).join('');
 *     }
 * });
 */

export class FrontendPagination extends Pagination {
    constructor(options = {}) {
        const data = options.data || [];
        
        super({
            ...options,
            totalItems: data.length,
            onPageChange: null
        });

        this.data = data;
        this.renderItems = options.renderItems || null;
        this.onPageChangeCallback = options.onPageChange || null;

        this.renderCurrentPage();
    }

    getCurrentPageData() {
        const start = (this.currentPage - 1) * this.options.itemsPerPage;
        const end = start + this.options.itemsPerPage;
        return this.data.slice(start, end);
    }

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

    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;

        this.currentPage = page;
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

    setData(data, resetPage = true) {
        this.data = data || [];
        this.options.totalItems = this.data.length;
        
        if (resetPage) {
            this.currentPage = 1;
        } else if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
        }
        
        this.render();
        this.renderCurrentPage();
    }

    addItem(item) {
        this.data.push(item);
        this.options.totalItems = this.data.length;
        this.render();
    }

    addItems(items) {
        this.data.push(...items);
        this.options.totalItems = this.data.length;
        this.render();
    }

    removeItemAt(index) {
        if (index >= 0 && index < this.data.length) {
            this.data.splice(index, 1);
            this.options.totalItems = this.data.length;
            
            if (this.currentPage > this.totalPages && this.totalPages > 0) {
                this.currentPage = this.totalPages;
            }
            
            this.render();
            this.renderCurrentPage();
        }
    }

    removeItemWhere(predicate) {
        const index = this.data.findIndex(predicate);
        if (index !== -1) this.removeItemAt(index);
    }

    filter(predicate) {
        const filteredData = this.data.filter(predicate);
        return new FrontendPagination({
            ...this.options,
            data: filteredData,
            renderItems: this.renderItems,
            onPageChange: this.onPageChangeCallback
        });
    }

    search(predicate) {
        const filteredData = this.data.filter(predicate);
        this.setData(filteredData);
    }

    resetSearch(originalData) {
        this.setData(originalData);
    }

    sort(compareFn) {
        this.data.sort(compareFn);
        this.renderCurrentPage();
    }

    getData() { return this.data; }
    getDataLength() { return this.data.length; }
}

export default { Pagination, FrontendPagination };
