import { useLocation, useNavigate } from 'react-router-dom';
import {
    APP_PATHS,
    APP_ROUTE_IDS,
    getNextLoginRedirectTarget,
    getQuoteStepPath,
    getSketchReturnPath,
    resolveLoginRedirectTarget,
    type QuoteRouteStepId,
    type SketchReturnTarget
} from './routes';

interface NavigateOptions {
    replace?: boolean;
}

export function useAppNavigation() {
    const navigate = useNavigate();
    const location = useLocation();

    const getActiveCrmDealParams = (): URLSearchParams => {
        const currentParams = new URLSearchParams(location.search);
        const crmDealId = currentParams.get('crmDealId')?.trim();
        const params = new URLSearchParams();
        if (!crmDealId) return params;

        params.set('crmDealId', crmDealId);
        const quoteOwnerUid = currentParams.get('quoteOwnerUid')?.trim();
        if (quoteOwnerUid) {
            params.set('quoteOwnerUid', quoteOwnerUid);
        }
        return params;
    };

    const getActiveCrmDealSearch = (): string => {
        const params = getActiveCrmDealParams();
        return params.size > 0 ? `?${params.toString()}` : '';
    };

    return {
        goToDashboard(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.dashboard], options);
        },
        goToQuoteStep(step: QuoteRouteStepId, options?: NavigateOptions) {
            navigate(`${getQuoteStepPath(step)}${getActiveCrmDealSearch()}`, options);
        },
        goToNewQuote(options?: NavigateOptions) {
            navigate(getQuoteStepPath('product-lines'), options);
        },
        goToLinkedQuoteStep(
            step: QuoteRouteStepId,
            crmDealId: string,
            quoteOwnerUid?: string | null,
            options?: NavigateOptions
        ) {
            const normalizedDealId = String(crmDealId || '').trim();
            const params = new URLSearchParams();
            if (normalizedDealId) {
                params.set('crmDealId', normalizedDealId);
            }
            const normalizedOwnerUid = String(quoteOwnerUid || '').trim();
            if (normalizedOwnerUid) {
                params.set('quoteOwnerUid', normalizedOwnerUid);
            }
            const search = params.size > 0 ? `?${params.toString()}` : '';
            navigate(`${getQuoteStepPath(step)}${search}`, options);
        },
        goToQuoteFromDeal(crmDealId: string, options?: NavigateOptions) {
            const normalizedDealId = String(crmDealId || '').trim();
            const search = normalizedDealId ? `?crmDealId=${encodeURIComponent(normalizedDealId)}&start=1` : '';
            navigate(`${getQuoteStepPath('product-lines')}${search}`, options);
        },
        goToHistory(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.quotes], options);
        },
        goToInventory(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.inventory], options);
        },
        goToInventoryLogs(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.inventoryLogs], options);
        },
        goToActivity(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.activity], options);
        },
        goToPlanner(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.planner], options);
        },
        goToCrm(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.crmDashboard], options);
        },
        goToCrmPipeline(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.crmPipeline], options);
        },
        goToCrmCompanies(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.crmCompanies], options);
        },
        goToCrmActivities(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.crmActivities], options);
        },
        goToRetailers(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.retailers], options);
        },
        goToRetailerOrders(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.retailerOrders], options);
        },
        goToRetailerOrderHistory(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory], options);
        },
        goToRetailerDocuments(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.retailerDocuments], options);
        },
        goToSketch(returnTo?: SketchReturnTarget | null, options?: NavigateOptions) {
            const params = getActiveCrmDealParams();
            if (returnTo) {
                params.set('return', returnTo);
            }

            const search = params.size > 0 ? `?${params.toString()}` : '';
            navigate(`${APP_PATHS[APP_ROUTE_IDS.sketch]}${search}`, options);
        },
        goToSketchReturnTarget(returnTo?: SketchReturnTarget | null, options?: NavigateOptions) {
            const crmSearch = returnTo === 'quote-configuration' || returnTo === 'quote-summary'
                ? getActiveCrmDealSearch()
                : '';
            navigate(`${getSketchReturnPath(returnTo)}${crmSearch}`, options);
        },
        goToLogin(next?: string | { pathname: string; search?: string; hash?: string }, options?: NavigateOptions) {
            if (!next) {
                navigate(APP_PATHS[APP_ROUTE_IDS.login], options);
                return;
            }

            if (typeof next === 'string') {
                const safeTarget = resolveLoginRedirectTarget(next);
                navigate(`${APP_PATHS[APP_ROUTE_IDS.login]}?next=${getNextLoginRedirectTarget(safeTarget)}`, options);
                return;
            }

            navigate(
                `${APP_PATHS[APP_ROUTE_IDS.login]}?next=${getNextLoginRedirectTarget(next.pathname, next.search, next.hash)}`,
                options
            );
        }
    };
}
