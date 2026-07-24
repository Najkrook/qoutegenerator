import {
    canAccessRetailerDocumentsLevel,
    canAccessQuoteHistoryLevel,
    canAccessSketchLevel,
    canStartQuoteLevel,
    canViewEverythingLevel
} from '../config/accessControl.shared';
import { hasConfiguredContractingWork } from '../services/contractingWork';
import type { AccessLevel, QuoteState } from '../types/contracts';

export const APP_ROUTE_IDS = Object.freeze({
    login: 'login',
    dashboard: 'dashboard',
    quoteProductLines: 'quote-product-lines',
    quoteConfiguration: 'quote-configuration',
    quotePricing: 'quote-pricing',
    quoteSummary: 'quote-summary',
    quotes: 'quotes',
    sketch: 'sketch',
    inventory: 'inventory',
    inventoryLogs: 'inventory-logs',
    activity: 'activity',
    planner: 'planner',
    crmDashboard: 'crm-dashboard',
    crmPipeline: 'crm-pipeline',
    crmCompanies: 'crm-companies',
    crmCompanyDetail: 'crm-company-detail',
    crmContactDetail: 'crm-contact-detail',
    crmDealDetail: 'crm-deal-detail',
    crmActivities: 'crm-activities',
    retailers: 'retailers',
    retailerOrders: 'retailer-orders',
    retailerOrderHistory: 'retailer-order-history',
    retailerDocuments: 'retailer-documents'
} as const);

export type AppRouteId = typeof APP_ROUTE_IDS[keyof typeof APP_ROUTE_IDS];

export const APP_PATHS: Record<AppRouteId, string> = Object.freeze({
    [APP_ROUTE_IDS.login]: '/login',
    [APP_ROUTE_IDS.dashboard]: '/',
    [APP_ROUTE_IDS.quoteProductLines]: '/quote/new/product-lines',
    [APP_ROUTE_IDS.quoteConfiguration]: '/quote/new/configuration',
    [APP_ROUTE_IDS.quotePricing]: '/quote/new/pricing',
    [APP_ROUTE_IDS.quoteSummary]: '/quote/new/summary',
    [APP_ROUTE_IDS.quotes]: '/quotes',
    [APP_ROUTE_IDS.sketch]: '/sketch',
    [APP_ROUTE_IDS.inventory]: '/inventory',
    [APP_ROUTE_IDS.inventoryLogs]: '/inventory/logs',
    [APP_ROUTE_IDS.activity]: '/activity',
    [APP_ROUTE_IDS.planner]: '/planner',
    [APP_ROUTE_IDS.crmDashboard]: '/crm',
    [APP_ROUTE_IDS.crmPipeline]: '/crm/pipeline',
    [APP_ROUTE_IDS.crmCompanies]: '/crm/customers',
    [APP_ROUTE_IDS.crmCompanyDetail]: '/crm/customers/:companyId',
    [APP_ROUTE_IDS.crmContactDetail]: '/crm/contacts/:contactId',
    [APP_ROUTE_IDS.crmDealDetail]: '/crm/deals/:dealId',
    [APP_ROUTE_IDS.crmActivities]: '/crm/activities',
    [APP_ROUTE_IDS.retailers]: '/retailers',
    [APP_ROUTE_IDS.retailerOrders]: '/retailer-orders',
    [APP_ROUTE_IDS.retailerOrderHistory]: '/retailer-order-requests',
    [APP_ROUTE_IDS.retailerDocuments]: '/retailer-documents'
});

export type QuoteRouteStepId = 'product-lines' | 'configuration' | 'pricing' | 'summary';
export type SketchReturnTarget = 'dashboard' | 'quote-configuration' | 'quote-summary';
export type AppRouteAccess = 'public' | 'authenticated' | 'quote' | 'history' | 'sketch' | 'admin' | 'retailer';

const QUOTE_STEP_TO_ROUTE_ID: Record<QuoteRouteStepId, AppRouteId> = {
    'product-lines': APP_ROUTE_IDS.quoteProductLines,
    configuration: APP_ROUTE_IDS.quoteConfiguration,
    pricing: APP_ROUTE_IDS.quotePricing,
    summary: APP_ROUTE_IDS.quoteSummary
};

const QUOTE_STEP_NUMBERS: Record<QuoteRouteStepId, 1 | 2 | 3 | 4> = {
    'product-lines': 1,
    configuration: 2,
    pricing: 3,
    summary: 4
};

const QUOTE_STEP_NUMBER_TO_STEP: Record<1 | 2 | 3 | 4, QuoteRouteStepId> = {
    1: 'product-lines',
    2: 'configuration',
    3: 'pricing',
    4: 'summary'
};

const ROUTE_ACCESS: Record<AppRouteId, AppRouteAccess> = {
    [APP_ROUTE_IDS.login]: 'public',
    [APP_ROUTE_IDS.dashboard]: 'authenticated',
    [APP_ROUTE_IDS.quoteProductLines]: 'quote',
    [APP_ROUTE_IDS.quoteConfiguration]: 'quote',
    [APP_ROUTE_IDS.quotePricing]: 'quote',
    [APP_ROUTE_IDS.quoteSummary]: 'quote',
    [APP_ROUTE_IDS.quotes]: 'history',
    [APP_ROUTE_IDS.sketch]: 'sketch',
    [APP_ROUTE_IDS.inventory]: 'admin',
    [APP_ROUTE_IDS.inventoryLogs]: 'admin',
    [APP_ROUTE_IDS.activity]: 'admin',
    [APP_ROUTE_IDS.planner]: 'admin',
    [APP_ROUTE_IDS.crmDashboard]: 'admin',
    [APP_ROUTE_IDS.crmPipeline]: 'admin',
    [APP_ROUTE_IDS.crmCompanies]: 'admin',
    [APP_ROUTE_IDS.crmCompanyDetail]: 'admin',
    [APP_ROUTE_IDS.crmContactDetail]: 'admin',
    [APP_ROUTE_IDS.crmDealDetail]: 'admin',
    [APP_ROUTE_IDS.crmActivities]: 'admin',
    [APP_ROUTE_IDS.retailers]: 'admin',
    [APP_ROUTE_IDS.retailerOrders]: 'admin',
    [APP_ROUTE_IDS.retailerOrderHistory]: 'retailer',
    [APP_ROUTE_IDS.retailerDocuments]: 'retailer'
};

const PATH_TO_ROUTE_ID = new Map<AppRouteId | string, AppRouteId>(
    Object.entries(APP_PATHS).map(([routeId, path]) => [path, routeId as AppRouteId])
);

function normalizePathname(pathname: string | null | undefined): string {
    const raw = String(pathname || '').trim() || APP_PATHS[APP_ROUTE_IDS.dashboard];
    if (raw.length > 1 && raw.endsWith('/')) {
        return raw.slice(0, -1);
    }

    return raw;
}

function getPathnameFromTarget(target: string): string {
    const [pathname] = String(target || '').split(/[?#]/, 1);
    return normalizePathname(pathname);
}

export function getAppPath(routeId: AppRouteId): string {
    return APP_PATHS[routeId];
}

export function getRequiredAccessForRoute(routeId: AppRouteId): AppRouteAccess {
    return ROUTE_ACCESS[routeId];
}

export function getAppRouteIdFromPath(pathname: string | null | undefined): AppRouteId | null {
    const normalizedPathname = normalizePathname(pathname);
    const exactMatch = PATH_TO_ROUTE_ID.get(normalizedPathname);
    if (exactMatch) {
        return exactMatch;
    }

    if (/^\/crm\/customers\/[^/]+$/.test(normalizedPathname)) {
        return APP_ROUTE_IDS.crmCompanyDetail;
    }
    if (/^\/crm\/contacts\/[^/]+$/.test(normalizedPathname)) {
        return APP_ROUTE_IDS.crmContactDetail;
    }
    if (/^\/crm\/deals\/[^/]+$/.test(normalizedPathname)) {
        return APP_ROUTE_IDS.crmDealDetail;
    }

    return null;
}

export function getCrmCompanyPath(companyId: string): string {
    return APP_PATHS[APP_ROUTE_IDS.crmCompanyDetail].replace(':companyId', encodeURIComponent(companyId));
}

export function getCrmContactPath(contactId: string): string {
    return APP_PATHS[APP_ROUTE_IDS.crmContactDetail].replace(':contactId', encodeURIComponent(contactId));
}

export function getCrmDealPath(dealId: string): string {
    return APP_PATHS[APP_ROUTE_IDS.crmDealDetail].replace(':dealId', encodeURIComponent(dealId));
}

export function getQuoteStepPath(step: QuoteRouteStepId): string {
    return APP_PATHS[QUOTE_STEP_TO_ROUTE_ID[step]];
}

export function getQuoteStepRouteId(step: QuoteRouteStepId): AppRouteId {
    return QUOTE_STEP_TO_ROUTE_ID[step];
}

export function getQuoteStepNumber(step: QuoteRouteStepId): 1 | 2 | 3 | 4 {
    return QUOTE_STEP_NUMBERS[step];
}

export function getQuoteRouteStepFromPath(pathname: string | null | undefined): QuoteRouteStepId | null {
    const routeId = getAppRouteIdFromPath(pathname);
    switch (routeId) {
        case APP_ROUTE_IDS.quoteProductLines:
            return 'product-lines';
        case APP_ROUTE_IDS.quoteConfiguration:
            return 'configuration';
        case APP_ROUTE_IDS.quotePricing:
            return 'pricing';
        case APP_ROUTE_IDS.quoteSummary:
            return 'summary';
        default:
            return null;
    }
}

export function parseSketchReturnTarget(value: unknown): SketchReturnTarget | null {
    if (value === 'dashboard' || value === 'quote-configuration' || value === 'quote-summary') {
        return value;
    }

    return null;
}

export function getSketchReturnPath(target: SketchReturnTarget | null | undefined): string {
    switch (target) {
        case 'quote-configuration':
            return getQuoteStepPath('configuration');
        case 'quote-summary':
            return getQuoteStepPath('summary');
        case 'dashboard':
        default:
            return APP_PATHS[APP_ROUTE_IDS.dashboard];
    }
}

export function getAuthorizedRouteForAccess(routeId: AppRouteId, accessLevel: AccessLevel): string {
    const requiredAccess = getRequiredAccessForRoute(routeId);

    switch (requiredAccess) {
        case 'public':
        case 'authenticated':
            return getAppPath(routeId);
        case 'quote':
            return canStartQuoteLevel(accessLevel)
                ? getAppPath(routeId)
                : APP_PATHS[APP_ROUTE_IDS.dashboard];
        case 'history':
            return canAccessQuoteHistoryLevel(accessLevel)
                ? getAppPath(routeId)
                : APP_PATHS[APP_ROUTE_IDS.dashboard];
        case 'sketch':
            return canAccessSketchLevel(accessLevel)
                ? getAppPath(routeId)
                : APP_PATHS[APP_ROUTE_IDS.dashboard];
        case 'retailer':
            return canAccessRetailerDocumentsLevel(accessLevel)
                ? getAppPath(routeId)
                : APP_PATHS[APP_ROUTE_IDS.dashboard];
        case 'admin':
        default:
            return canViewEverythingLevel(accessLevel)
                ? getAppPath(routeId)
                : APP_PATHS[APP_ROUTE_IDS.dashboard];
    }
}

export function getNextLoginRedirectTarget(
    pathname: string | null | undefined,
    search = '',
    hash = ''
): string {
    return encodeURIComponent(`${normalizePathname(pathname)}${search || ''}${hash || ''}`);
}

export function resolveLoginRedirectTarget(value: string | null | undefined): string {
    const candidate = String(value || '').trim();
    if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
        return APP_PATHS[APP_ROUTE_IDS.dashboard];
    }

    const routeId = getAppRouteIdFromPath(getPathnameFromTarget(candidate));
    if (!routeId || routeId === APP_ROUTE_IDS.login) {
        return APP_PATHS[APP_ROUTE_IDS.dashboard];
    }

    return candidate;
}

export function hasConfiguredQuoteSelections(
    state: Pick<QuoteState, 'builderItems' | 'gridSelections'>
): boolean {
    return (state.builderItems || []).length > 0
        || Object.values(state.gridSelections || {}).some((selection) => (
            Object.keys(selection?.items || {}).length > 0
            || Object.keys(selection?.addons || {}).length > 0
        ));
}

interface QuoteDraftOptions {
    isRetailer?: boolean;
}

type QuoteDraftState = Pick<QuoteState, 'selectedLines' | 'builderItems' | 'gridSelections'>
    & Partial<Pick<QuoteState, 'contractingWork'>>;

export function hasConfiguredQuoteContent(
    state: Pick<QuoteState, 'builderItems' | 'gridSelections'> & Partial<Pick<QuoteState, 'contractingWork'>>,
    options: QuoteDraftOptions = {}
): boolean {
    return hasConfiguredQuoteSelections(state)
        || (!options.isRetailer && hasConfiguredContractingWork(state.contractingWork));
}

export function hasRetailerStartDraftData(
    state: Pick<
        QuoteState,
        'selectedLines' | 'builderItems' | 'gridSelections' | 'customCosts' | 'activeQuoteId' | 'quoteNumber' | 'customerInfo'
    >
): boolean {
    const hasSelectedLines = Array.isArray(state.selectedLines) && state.selectedLines.length > 0;
    const hasSelections = hasConfiguredQuoteSelections(state);
    const hasCustomCosts = Array.isArray(state.customCosts) && state.customCosts.length > 0;
    const hasQuoteIdentity = Boolean(state.activeQuoteId || state.quoteNumber);
    const customerInfo = state.customerInfo;
    const hasCustomerInfo = [
        customerInfo.name,
        customerInfo.company,
        customerInfo.email,
        customerInfo.reference,
        customerInfo.customerReference,
        customerInfo.extraNotes,
        customerInfo.date
    ].some((value) => String(value || '').trim().length > 0);

    return hasSelectedLines || hasSelections || hasCustomCosts || hasQuoteIdentity || hasCustomerInfo;
}

function getQuoteStepFromStateStep(step: QuoteState['step']): QuoteRouteStepId | null {
    if (step === 1 || step === 2 || step === 3 || step === 4) {
        return QUOTE_STEP_NUMBER_TO_STEP[step];
    }

    return null;
}

function getFallbackRetailerResumeQuoteStep(
    state: Pick<QuoteState, 'selectedLines' | 'builderItems' | 'gridSelections' | 'activeQuoteId' | 'quoteNumber' | 'activeQuoteVersion'>
): QuoteRouteStepId {
    const hasSelectedLines = Array.isArray(state.selectedLines) && state.selectedLines.length > 0;
    if (!hasSelectedLines) {
        return 'product-lines';
    }

    const hasSelections = hasConfiguredQuoteSelections(state);
    if (!hasSelections) {
        return 'configuration';
    }

    const hasSavedQuoteIdentity = Boolean(state.activeQuoteId || state.quoteNumber || state.activeQuoteVersion);
    return hasSavedQuoteIdentity ? 'summary' : 'pricing';
}

export function getRetailerResumeQuoteStep(
    state: Pick<
        QuoteState,
        'step' | 'selectedLines' | 'builderItems' | 'gridSelections' | 'activeQuoteId' | 'quoteNumber' | 'activeQuoteVersion'
    >
): QuoteRouteStepId {
    const currentStep = getQuoteStepFromStateStep(state.step);
    if (currentStep) {
        const currentRouteId = getQuoteStepRouteId(currentStep);
        if (!getQuoteDraftGuardRedirect(currentRouteId, state, { isRetailer: true })) {
            return currentStep;
        }
    }

    return getFallbackRetailerResumeQuoteStep(state);
}

export function getQuoteDraftGuardRedirect(
    routeId: AppRouteId,
    state: QuoteDraftState,
    options: QuoteDraftOptions = {}
): string | null {
    if (routeId === APP_ROUTE_IDS.quoteProductLines) {
        return null;
    }

    const hasSelectedLines = Array.isArray(state.selectedLines) && state.selectedLines.length > 0;
    const hasSelectedContractingWork = !options.isRetailer && state.contractingWork?.enabled === true;
    if (!hasSelectedLines && !hasSelectedContractingWork) {
        return getQuoteStepPath('product-lines');
    }

    if (routeId === APP_ROUTE_IDS.quoteConfiguration) {
        return null;
    }

    const hasSelections = hasConfiguredQuoteContent(state, options);
    if (!hasSelections) {
        return getQuoteStepPath('configuration');
    }

    return null;
}
