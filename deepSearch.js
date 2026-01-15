/*!
 * Search helper
 * Author: DKN(DUC) 
 * © 2026
 */

/**
 * SearchHelper - Advanced Search Library
 * 
 * import { SearchHelper } from './search-helper.js';
 * 
 * // Deep search
 * const results = SearchHelper.deepSearch(dataArray, 'keyword');
 * 
 * // Search by fields
 * const results = SearchHelper.searchByFields(dataArray, 'keyword', ['name', 'email']);
 * 
 * // Combine with FrontendPagination
 * const pagination = new FrontendPagination({ data: myData, ... });
 * const originalData = pagination.getData();
 * 
 * const handleSearch = SearchHelper.createDebounceSearch((term) => {
 *     const filtered = SearchHelper.deepSearch(originalData, term);
 *     pagination.setData(filtered);
 * }, 300);
 * 
 * searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
 */

export class SearchHelper {
    /**
     * Deep search in array of objects (recursively)
     * @param {Array} data - Data array
     * @param {string} searchTerm - Search keyword
     * @param {Object} options - { caseSensitive, exactMatch }
     * @returns {Array}
     */
    static deepSearch(data, searchTerm, options = {}) {
        if (!searchTerm || searchTerm.toString().trim() === '') return data;

        const { caseSensitive = false, exactMatch = false } = options;
        const term = caseSensitive ? searchTerm.toString().trim() : searchTerm.toString().toLowerCase().trim();

        return data.filter(item => this._deepMatch(item, term, caseSensitive, exactMatch));
    }

    /**
     * Check recursive match in object (with circular reference detection)
     */
    static _deepMatch(obj, term, caseSensitive, exactMatch) {
        const stack = [obj];
        const visited = new WeakSet();

        while (stack.length > 0) {
            const current = stack.pop();
            
            if (typeof current === 'object' && current !== null) {
                if (visited.has(current)) continue;
                visited.add(current);
            }

            for (const key in current) {
                if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
                
                const value = current[key];
                const type = Object.prototype.toString.call(value);

                if (type === '[object Object]') {
                    if (!visited.has(value)) stack.push(value);
                } else if (type === '[object Array]') {
                    for (let i = 0; i < value.length; i++) {
                        const item = value[i];
                        if (typeof item === 'object' && item !== null) {
                            if (!visited.has(item)) stack.push(item);
                        } else {
                            if (this._matchValue(item, term, caseSensitive, exactMatch)) return true;
                        }
                    }
                } else {
                    if (this._matchValue(value, term, caseSensitive, exactMatch)) return true;
                }
            }
        }
        return false;
    }

    /**
     * Compare value with search term
     */
    static _matchValue(value, term, caseSensitive, exactMatch) {
        if (value == null) return false;
        
        const strValue = caseSensitive 
            ? value.toString().trim() 
            : value.toString().toLowerCase().trim();

        return exactMatch ? strValue === term : strValue.indexOf(term) > -1;
    }

    /**
     * Search by specific fields
     * @param {Array} data - Data array
     * @param {string} searchTerm - Keyword
     * @param {Array} fields - Field names ['name', 'email', 'user.address']
     * @param {Object} options - { caseSensitive, exactMatch, matchAll }
     * @returns {Array}
     */
    static searchByFields(data, searchTerm, fields, options = {}) {
        if (!searchTerm || searchTerm.toString().trim() === '') return data;

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
        return path.split('.').reduce((current, key) => 
            current && current[key] !== undefined ? current[key] : null
        , obj);
    }

    /**
     * Multi-term search (AND or OR)
     * @param {Array} data - Data array
     * @param {string} searchTerms - Keywords (space separated)
     * @param {Object} options - { operator: 'AND'|'OR', fields: [], caseSensitive }
     * @returns {Array}
     */
    static multiTermSearch(data, searchTerms, options = {}) {
        if (!searchTerms || searchTerms.toString().trim() === '') return data;

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
        if (!searchTerm || searchTerm.toString().trim() === '') return data;

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
     * @param {string} highlightClass - CSS class (default: 'search-highlight')
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
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                searchFn(searchTerm);
            }, delay);
        };
    }

    /**
     * Create search input component
     * @param {Object} options - { placeholder, onSearch, debounceDelay, showClearButton, className }
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
        
        container.destroy = () => {
            const newInput = input.cloneNode(false);
            const newClearBtn = clearBtn.cloneNode(false);
            input.replaceWith(newInput);
            clearBtn.replaceWith(newClearBtn);
            container.remove();
        };

        return container;
    }
}

export default SearchHelper;
