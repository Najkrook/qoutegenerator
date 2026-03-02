// features/utils.js — Pure utility functions shared across step modules

import { state } from '../services/stateManager.js';

/**
 * Parse a localized float string (supports Swedish comma decimals)
 * @param {string|number} value
 * @returns {number}
 */
export function parseLocalFloat(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    let cleaned = value.toString().replace(/,/g, '.').replace(/[^\d.-]/g, '');
    let parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a number as a Swedish-locale string
 * @param {string|number} value
 * @returns {string}
 */
export function formatLocalFloat(value) {
    let parsed = parseLocalFloat(value);
    return parsed.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
}

/**
 * Convert a catalog price to SEK based on the product line's currency.
 * Uses window.catalogData (loaded globally from data.js) and state.exchangeRate.
 * @param {number} eurPrice - The base price
 * @param {string} line - Product line key (e.g. 'BaHaMa')
 * @returns {number}
 */
export function getUnitSekPrice(eurPrice, line) {
    if (catalogData[line].currency === 'EUR') {
        return eurPrice * state.exchangeRate;
    }
    return eurPrice;
}
