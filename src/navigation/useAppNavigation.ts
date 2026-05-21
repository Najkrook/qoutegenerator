import { useNavigate } from 'react-router-dom';
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

    return {
        goToDashboard(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.dashboard], options);
        },
        goToQuoteStep(step: QuoteRouteStepId, options?: NavigateOptions) {
            navigate(getQuoteStepPath(step), options);
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
        goToRetailers(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.retailers], options);
        },
        goToRetailerOrders(options?: NavigateOptions) {
            navigate(APP_PATHS[APP_ROUTE_IDS.retailerOrders], options);
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
