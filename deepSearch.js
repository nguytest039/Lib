/*!
 * Search helper
 * Author: DKN(DUC) 
 * © 2026
 */
export function deepSearch(obj, searchTerm) {
    if (obj == null || searchTerm == null) return false;
    const term = searchTerm.toString().toLowerCase().trim();
    if (!term) return false;
    const visited = new WeakSet();
    const stack = [obj];
    while (stack.length > 0) {
        const current = stack.pop();
        if (typeof current === 'object' && current !== null) {
            if (visited.has(current)) continue;
            visited.add(current);
        }
        for (const key in current) {
            if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
            const value = current[key];
            if (typeof value === 'object' && value !== null) {
                if (!visited.has(value)) {
                    stack.push(value);
                }
            } else if (value != null) {
                if (value.toString().toLowerCase().indexOf(term) > -1) {
                    return true;
                }
            }
        }
    }
    return false;
}
export function filter(dataArray, searchTerm) {
    if (!Array.isArray(dataArray)) return [];
    if (!searchTerm) return dataArray;
    return dataArray.filter(item => deepSearch(item, searchTerm));
}
export default { deepSearch, filter };
