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

    const getActiveCrmDealSearch = (): string => {
        const crmDealId = new URLSearchParams(location.search).get('crmDealId')?.trim();
        if (!crmDealId) return '';

        const params = new URLSearchParams({ crmDealId });
        const quoteOwnerUid = new URLSearchParams(location.search).get('quoteOwnerUid')?.trim();
        if (quoteOwnerUid) {
            params.set('quoteOwnerUid', quoteOwnerUid);
        }
        return `?${params.toString()}`;
    };

    return {
        goToDashboard(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.dashboard], options);
        },
        goToQuoteStep(step: QuoteRouteStepId, options?: NavigateOptions) {
            navigate(`${getQuoteStepPath(step)}${getActiveCrmDealSearch()}`, options);
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
            if (returnTo) {
                navigate(`${APP_PATHS[APP_ROUTE_IDS.sketch]}?return=${returnTo}`, options);
                return;
            }

            navigate(APP_PATHS[APP_ROUTE_IDS.sketch], options);
        },
        goToSketchReturnTarget(returnTo?: SketchReturnTarget | null, options?: NavigateOptions) {
            navigate(getSketchReturnPath(returnTo), options);
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
