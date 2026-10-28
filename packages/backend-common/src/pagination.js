"use strict";
/**
 * @workspace/backend-common
 * Centralized Keyset / Cursor Pagination Engine
 *
 * Provides high-performance, O(1) database keyset pagination, robust cursor encoding/decoding,
 * and standard request parameter extraction across all 180workspace modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
exports.extractPaginationParams = extractPaginationParams;
exports.paginateWithCursor = paginateWithCursor;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
/**
 * Encodes cursor payload into an opaque URL-safe base64 string.
 */
function encodeCursor(payload) {
    try {
        const json = JSON.stringify(payload);
        return Buffer.from(json, 'utf8').toString('base64url');
    }
    catch {
        return '';
    }
}
/**
 * Decodes opaque URL-safe base64 cursor string into payload.
 * Gracefully handles malformed or tampered cursors without throwing errors.
 */
function decodeCursor(cursorStr) {
    if (!cursorStr || typeof cursorStr !== 'string')
        return null;
    try {
        const json = Buffer.from(cursorStr, 'base64url').toString('utf8');
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object' || !parsed.id) {
            return null;
        }
        // Auto-convert ISO date strings back into Date objects for Prisma
        if (typeof parsed.sortValue === 'string' && ISO_DATE_REGEX.test(parsed.sortValue)) {
            const parsedDate = new Date(parsed.sortValue);
            if (!isNaN(parsedDate.getTime())) {
                parsed.sortValue = parsedDate;
            }
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Extracts and sanitizes standard pagination parameters from HTTP request queries.
 */
function extractPaginationParams(query = {}) {
    let rawLimit = parseInt(query.limit, 10);
    if (isNaN(rawLimit) || rawLimit <= 0) {
        rawLimit = DEFAULT_PAGE_SIZE;
    }
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);
    const direction = query.direction === 'backward' ? 'backward' : 'forward';
    const sortField = query.sortField && typeof query.sortField === 'string' ? query.sortField : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const cursor = typeof query.cursor === 'string' && query.cursor.trim().length > 0
        ? query.cursor.trim()
        : null;
    let page = undefined;
    if (query.page !== undefined) {
        const parsedPage = parseInt(query.page, 10);
        if (!isNaN(parsedPage) && parsedPage > 0) {
            page = parsedPage;
        }
    }
    return {
        cursor,
        limit,
        direction,
        page,
        sortField,
        sortOrder
    };
}
/**
 * High-performance Keyset/Cursor Pagination Engine.
 * Executes O(1) index seeks rather than O(N) offset scans.
 */
async function paginateWithCursor(modelDelegate, options = {}) {
    const limit = Math.max(1, Math.min(options.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
    const direction = options.direction || 'forward';
    const sortField = options.sortField || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    const isDesc = sortOrder === 'desc';
    const decoded = decodeCursor(options.cursor);
    // Build the Keyset WHERE clause
    const baseWhere = options.where ? { ...options.where } : {};
    let keysetWhere = {};
    if (decoded) {
        const { id, sortValue } = decoded;
        if (direction === 'forward') {
            // Forward: Next items
            if (isDesc) {
                keysetWhere = {
                    OR: [
                        { [sortField]: { lt: sortValue } },
                        { [sortField]: sortValue, id: { lt: id } }
                    ]
                };
            }
            else {
                keysetWhere = {
                    OR: [
                        { [sortField]: { gt: sortValue } },
                        { [sortField]: sortValue, id: { gt: id } }
                    ]
                };
            }
        }
        else {
            // Backward: Previous items
            if (isDesc) {
                keysetWhere = {
                    OR: [
                        { [sortField]: { gt: sortValue } },
                        { [sortField]: sortValue, id: { gt: id } }
                    ]
                };
            }
            else {
                keysetWhere = {
                    OR: [
                        { [sortField]: { lt: sortValue } },
                        { [sortField]: sortValue, id: { lt: id } }
                    ]
                };
            }
        }
    }
    // Combine user where with keyset where
    const combinedWhere = Object.keys(keysetWhere).length > 0
        ? {
            AND: [baseWhere, keysetWhere]
        }
        : baseWhere;
    // Determine query sorting (inverted for backward pagination)
    const querySortOrder = direction === 'backward'
        ? (isDesc ? 'asc' : 'desc')
        : sortOrder;
    const queryArgs = {
        where: combinedWhere,
        orderBy: [
            { [sortField]: querySortOrder },
            { id: querySortOrder }
        ],
        take: limit + 1
    };
    if (options.select) {
        queryArgs.select = options.select;
    }
    else if (options.include) {
        queryArgs.include = options.include;
    }
    // Execute queries in parallel if count requested
    const queries = [
        modelDelegate.findMany(queryArgs),
        options.includeTotalCount
            ? modelDelegate.count({ where: baseWhere })
            : Promise.resolve(undefined)
    ];
    const [rawRows, totalCount] = await Promise.all(queries);
    const hasMore = rawRows.length > limit;
    let items = hasMore ? rawRows.slice(0, limit) : rawRows;
    // Re-orient items if we navigated backward
    if (direction === 'backward') {
        items = items.reverse();
    }
    const hasNextPage = direction === 'forward' ? hasMore : Boolean(decoded);
    const hasPreviousPage = direction === 'forward' ? Boolean(decoded) : hasMore;
    const startCursor = items.length > 0
        ? encodeCursor({
            id: items[0].id,
            sortValue: items[0][sortField]
        })
        : null;
    const endCursor = items.length > 0
        ? encodeCursor({
            id: items[items.length - 1].id,
            sortValue: items[items.length - 1][sortField]
        })
        : null;
    return {
        items,
        pageInfo: {
            hasNextPage,
            hasPreviousPage,
            startCursor,
            endCursor,
            totalCount
        }
    };
}
