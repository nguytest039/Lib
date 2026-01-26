// fe_pagination.js
/*!
 * Pagination library
 * Author: DKN(DUC) 
 * © 2026
 */

import { Pagination } from './pagination.js';

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

export default FrontendPagination;
