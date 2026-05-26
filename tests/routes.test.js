import { describe, expect, it } from 'vitest';
import { ACCESS_LEVELS } from '../src/config/accessControl.shared';
import {
    APP_PATHS,
    APP_ROUTE_IDS,
    getAppRouteIdFromPath,
    getAuthorizedRouteForAccess,
    getNextLoginRedirectTarget,
    getQuoteDraftGuardRedirect,
    getQuoteStepPath,
    getRetailerResumeQuoteStep,
    getSketchReturnPath,
    hasConfiguredQuoteSelections,
    hasRetailerStartDraftData,
    parseSketchReturnTarget,
    resolveLoginRedirectTarget
} from '../src/navigation/routes';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

describe('navigation routes', () => {
    it('builds semantic quote-step paths', () => {
        expect(getQuoteStepPath('product-lines')).toBe('/quote/new/product-lines');
        expect(getQuoteStepPath('configuration')).toBe('/quote/new/configuration');
        expect(getQuoteStepPath('pricing')).toBe('/quote/new/pricing');
        expect(getQuoteStepPath('summary')).toBe('/quote/new/summary');
    });

    it('maps access-controlled routes back to dashboard when access is missing', () => {
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.inventory, ACCESS_LEVELS.QUOTE_ONLY)).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.sketch, ACCESS_LEVELS.RETAILER)).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.quotes, ACCESS_LEVELS.QUOTE_ONLY)).toBe(APP_PATHS[APP_ROUTE_IDS.quotes]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.retailerOrders, ACCESS_LEVELS.QUOTE_ONLY)).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.retailerOrderHistory, ACCESS_LEVELS.RETAILER)).toBe(APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.retailerOrderHistory, ACCESS_LEVELS.QUOTE_ONLY)).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.retailerDocuments, ACCESS_LEVELS.RETAILER)).toBe(APP_PATHS[APP_ROUTE_IDS.retailerDocuments]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.retailerDocuments, ACCESS_LEVELS.FULL)).toBe(APP_PATHS[APP_ROUTE_IDS.retailerDocuments]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.retailerDocuments, ACCESS_LEVELS.QUOTE_ONLY)).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(getAuthorizedRouteForAccess(APP_ROUTE_IDS.quoteSummary, ACCESS_LEVELS.RETAILER)).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
    });

    it('encodes login next targets and resolves them safely', () => {
        expect(getNextLoginRedirectTarget('/sketch', '?return=quote-summary')).toBe('%2Fsketch%3Freturn%3Dquote-summary');
        expect(resolveLoginRedirectTarget('/sketch?return=quote-summary')).toBe('/sketch?return=quote-summary');
        expect(resolveLoginRedirectTarget('//evil.example.com')).toBe(APP_PATHS.dashboard);
        expect(resolveLoginRedirectTarget('/login')).toBe(APP_PATHS.dashboard);
    });

    it('parses sketch return targets and falls back to dashboard', () => {
        expect(parseSketchReturnTarget('quote-summary')).toBe('quote-summary');
        expect(parseSketchReturnTarget('unknown')).toBeNull();
        expect(getSketchReturnPath('quote-configuration')).toBe(APP_PATHS[APP_ROUTE_IDS.quoteConfiguration]);
        expect(getSketchReturnPath(null)).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
    });

    it('returns the correct quote draft guard redirects for incomplete draft state', () => {
        const emptyState = createInitialQuoteState();
        const selectedLinesOnly = {
            ...createInitialQuoteState(),
            selectedLines: ['BaHaMa']
        };
        const configuredState = {
            ...selectedLinesOnly,
            builderItems: [{
                id: 'item-1',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                discountPct: 0,
                addons: []
            }]
        };

        expect(getQuoteDraftGuardRedirect(APP_ROUTE_IDS.quoteConfiguration, emptyState)).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
        expect(getQuoteDraftGuardRedirect(APP_ROUTE_IDS.quotePricing, selectedLinesOnly)).toBe(APP_PATHS[APP_ROUTE_IDS.quoteConfiguration]);
        expect(getQuoteDraftGuardRedirect(APP_ROUTE_IDS.quoteSummary, configuredState)).toBeNull();
    });

    it('detects configured quote selections', () => {
        const emptyState = createInitialQuoteState();
        const builderState = {
            ...emptyState,
            builderItems: [{
                id: 'item-1',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                discountPct: 0,
                addons: []
            }]
        };
        const gridState = {
            ...emptyState,
            gridSelections: {
                BaHaMa: {
                    items: { Jumbrella: { qty: 1 } },
                    addons: {}
                }
            }
        };

        expect(hasConfiguredQuoteSelections(emptyState)).toBe(false);
        expect(hasConfiguredQuoteSelections({ ...emptyState, selectedLines: ['BaHaMa'] })).toBe(false);
        expect(hasConfiguredQuoteSelections(builderState)).toBe(true);
        expect(hasConfiguredQuoteSelections(gridState)).toBe(true);
    });

    it('resolves the retailer resume quote step from saved step and draft contents', () => {
        const emptyState = createInitialQuoteState();
        const selectedLinesOnly = {
            ...createInitialQuoteState(),
            selectedLines: ['BaHaMa']
        };
        const configuredState = {
            ...selectedLinesOnly,
            builderItems: [{
                id: 'item-1',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                discountPct: 0,
                addons: []
            }]
        };

        expect(getRetailerResumeQuoteStep({ ...configuredState, step: 3 })).toBe('pricing');
        expect(getRetailerResumeQuoteStep({ ...configuredState, step: 4 })).toBe('summary');
        expect(getRetailerResumeQuoteStep({ ...selectedLinesOnly, step: 4 })).toBe('configuration');
        expect(getRetailerResumeQuoteStep({ ...configuredState, step: 0 })).toBe('pricing');
        expect(getRetailerResumeQuoteStep({ ...configuredState, step: 0, activeQuoteId: 'quote-1' })).toBe('summary');
        expect(getRetailerResumeQuoteStep(emptyState)).toBe('product-lines');
    });

    it('detects whether retailer start should warn about draft data', () => {
        const emptyState = createInitialQuoteState();
        const selectedLinesState = {
            ...createInitialQuoteState(),
            selectedLines: ['BaHaMa']
        };
        const customCostsState = {
            ...createInitialQuoteState(),
            customCosts: [{ description: 'Transport', price: 1000, qty: 1, discountPct: 0 }]
        };
        const customerInfoState = {
            ...createInitialQuoteState(),
            customerInfo: {
                ...createInitialQuoteState().customerInfo,
                name: 'Ada'
            }
        };
        const quoteIdentityState = {
            ...createInitialQuoteState(),
            activeQuoteId: 'quote-1'
        };
        const inventoryOnlyState = {
            ...createInitialQuoteState(),
            inventoryData: {
                bahama: [{ model: 'Jumbrella' }],
                clickitup: {}
            }
        };

        expect(hasRetailerStartDraftData(emptyState)).toBe(false);
        expect(hasRetailerStartDraftData(selectedLinesState)).toBe(true);
        expect(hasRetailerStartDraftData(customCostsState)).toBe(true);
        expect(hasRetailerStartDraftData(customerInfoState)).toBe(true);
        expect(hasRetailerStartDraftData(quoteIdentityState)).toBe(true);
        expect(hasRetailerStartDraftData(inventoryOnlyState)).toBe(false);
    });

    it('maps normalized paths back to route ids', () => {
        expect(getAppRouteIdFromPath('/quotes/')).toBe(APP_ROUTE_IDS.quotes);
        expect(getAppRouteIdFromPath('/inventory/logs')).toBe(APP_ROUTE_IDS.inventoryLogs);
        expect(getAppRouteIdFromPath('/retailer-orders')).toBe(APP_ROUTE_IDS.retailerOrders);
        expect(getAppRouteIdFromPath('/retailer-order-requests')).toBe(APP_ROUTE_IDS.retailerOrderHistory);
        expect(getAppRouteIdFromPath('/retailer-documents')).toBe(APP_ROUTE_IDS.retailerDocuments);
        expect(getAppRouteIdFromPath('/missing')).toBeNull();
    });
});
