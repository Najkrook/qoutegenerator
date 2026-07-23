import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
    createBrowserRouter,
    Navigate,
    Outlet,
    useLocation,
    useSearchParams,
    type RouteObject
} from 'react-router-dom';
import { Header } from './components/layout/Header';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Dashboard } from './views/Dashboard';
import { ProductLineSelection } from './views/ProductLineSelection';
import { Configuration } from './views/Configuration';
import { Pricing } from './views/Pricing';
import { InventoryLogs } from './views/InventoryLogs';
import { ActivityLogs } from './views/ActivityLogs';
import { Login } from './views/Login';
import { useQuote } from './store/QuoteContext';
import { useAuth } from './store/AuthContext';
import { db, doc, getDoc } from './services/firebase';
import { confirmChoiceAction } from './services/notificationService';
import { cloneInventoryData, createDefaultInventoryData, normalizeStoredInventoryData } from './views/inventoryData';
import {
    APP_PATHS,
    APP_ROUTE_IDS,
    getAppPath,
    getAppRouteIdFromPath,
    getAuthorizedRouteForAccess,
    getNextLoginRedirectTarget,
    getQuoteDraftGuardRedirect,
    getQuoteStepNumber,
    getRetailerResumeQuoteStep,
    hasConfiguredQuoteContent,
    hasRetailerStartDraftData,
    parseSketchReturnTarget,
    resolveLoginRedirectTarget,
    type AppRouteId,
    type QuoteRouteStepId
} from './navigation/routes';
import { useAppNavigation } from './navigation/useAppNavigation';
import type {
    ContractingWorkState,
    GridSelections,
    HistoryOpenQuotePayload
} from './types/contracts';

const SummaryExport = lazy(() => import('./views/SummaryExport').then((module) => ({ default: module.SummaryExport })));
const InventoryManager = lazy(() => import('./views/InventoryManager').then((module) => ({ default: module.InventoryManager })));
const SketchTool = lazy(() => import('./views/SketchTool').then((module) => ({ default: module.SketchTool })));
const Planner = lazy(() => import('./views/Planner').then((module) => ({ default: module.Planner })));
const History = lazy(() => import('./views/History').then((module) => ({ default: module.History })));
const RetailerManager = lazy(() => import('./views/RetailerManager').then((module) => ({ default: module.RetailerManager })));
const RetailerOrderRequests = lazy(() => import('./views/RetailerOrderRequests').then((module) => ({ default: module.RetailerOrderRequests })));
const RetailerOrderHistory = lazy(() => import('./views/RetailerOrderHistory').then((module) => ({ default: module.RetailerOrderHistory })));
const RetailerDocuments = lazy(() => import('./views/RetailerDocuments').then((module) => ({ default: module.RetailerDocuments })));

function ViewLoader() {
    return (
        <div className="min-h-[320px] flex items-center justify-center">
            <p className="text-text-secondary text-sm">Laddar vy...</p>
        </div>
    );
}

function FullScreenLoader() {
    return (
        <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center">
            <p className="text-text-secondary text-sm">Laddar...</p>
        </div>
    );
}

function RouteShell() {
    const location = useLocation();
    const routeId = getAppRouteIdFromPath(location.pathname);
    const isSummaryRoute = routeId === APP_ROUTE_IDS.quoteSummary;
    const isInventoryRoute = routeId === APP_ROUTE_IDS.inventory;

    if (isInventoryRoute) {
        return (
            <div className="min-h-screen bg-bg text-text-primary font-sans antialiased">
                <ErrorBoundary resetHref={APP_PATHS[APP_ROUTE_IDS.dashboard]}>
                    <main>
                        <Suspense fallback={<ViewLoader />}>
                            <Outlet />
                        </Suspense>
                    </main>
                </ErrorBoundary>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg text-text-primary p-4 md:p-8 font-sans antialiased">
            <div className={`${isSummaryRoute ? 'max-w-[1920px]' : 'max-w-[1400px]'} mx-auto relative`}>
                <ErrorBoundary resetHref={APP_PATHS[APP_ROUTE_IDS.dashboard]}>
                    <Header />
                    <main>
                        <Suspense fallback={<ViewLoader />}>
                            <Outlet />
                        </Suspense>
                    </main>
                </ErrorBoundary>
            </div>
        </div>
    );
}

function LoginRouteElement() {
    const { user, loading } = useAuth();
    const [searchParams] = useSearchParams();

    if (loading) {
        return <FullScreenLoader />;
    }

    if (user) {
        return <Navigate to={resolveLoginRedirectTarget(searchParams.get('next'))} replace />;
    }

    return <Login />;
}

function ProtectedAppLayout() {
    const { user, loading } = useAuth();
    const { state, dispatch } = useQuote();
    const location = useLocation();
    const inventoryBootstrappedRef = useRef(false);

    useEffect(() => {
        if (!user || inventoryBootstrappedRef.current) {
            return;
        }

        const hasLoadedInventory =
            (state.inventoryData?.bahama?.length || 0) > 0 ||
            (state.inventoryData?.bahamaV2?.length || 0) > 0 ||
            Object.keys(state.inventoryData?.clickitup || {}).length > 0 ||
            Boolean(state.inventoryData?.notes) ||
            (state.cloudInventoryData?.bahama?.length || 0) > 0 ||
            (state.cloudInventoryData?.bahamaV2?.length || 0) > 0 ||
            Object.keys(state.cloudInventoryData?.clickitup || {}).length > 0 ||
            Boolean(state.cloudInventoryData?.notes);

        if (hasLoadedInventory) {
            inventoryBootstrappedRef.current = true;
            return;
        }

        inventoryBootstrappedRef.current = true;
        let cancelled = false;

        const bootstrapInventory = async () => {
            try {
                const docRef = doc(db, 'stock', 'main_inventory');
                const docSnap = await getDoc(docRef);
                const inventoryData = docSnap.exists()
                    ? normalizeStoredInventoryData(docSnap.data())
                    : createDefaultInventoryData();

                if (cancelled) return;

                dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(inventoryData) });
                dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(inventoryData) });
            } catch (err) {
                console.error('Failed to bootstrap inventory data:', err);
                try {
                    const res = await fetch('/inventory_db.json');
                    if (!res.ok) return;
                    const inventoryData = normalizeStoredInventoryData(await res.json());
                    if (cancelled) return;

                    dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(inventoryData) });
                    dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(inventoryData) });
                } catch (fallbackErr) {
                    console.error('Failed to bootstrap local inventory fallback:', fallbackErr);
                }
            }
        };

        void bootstrapInventory();

        return () => {
            cancelled = true;
        };
    }, [dispatch, state.cloudInventoryData, state.inventoryData, user]);

    if (loading) {
        return <FullScreenLoader />;
    }

    if (!user) {
        return (
            <Navigate
                to={`${APP_PATHS[APP_ROUTE_IDS.login]}?next=${getNextLoginRedirectTarget(
                    location.pathname,
                    location.search,
                    location.hash
                )}`}
                replace
            />
        );
    }

    return <RouteShell />;
}

interface RouteAccessBoundaryProps {
    children: React.ReactNode;
    routeId: AppRouteId;
}

function RouteAccessBoundary({ children, routeId }: RouteAccessBoundaryProps) {
    const { accessLevel } = useAuth();
    const authorizedPath = getAuthorizedRouteForAccess(routeId, accessLevel);

    if (authorizedPath !== getAppPath(routeId)) {
        return <Navigate to={authorizedPath} replace />;
    }

    return <>{children}</>;
}

function QuoteDraftBoundary({ children, routeId }: RouteAccessBoundaryProps) {
    const { state } = useQuote();
    const { isRetailer } = useAuth();
    const redirectPath = getQuoteDraftGuardRedirect(routeId, state, { isRetailer });

    if (redirectPath) {
        return <Navigate to={redirectPath} replace />;
    }

    return <>{children}</>;
}

function DashboardPage() {
    const navigation = useAppNavigation();
    const { state, dispatch } = useQuote();
    const { isRetailer } = useAuth();

    const handleStartQuote = async (): Promise<void> => {
        if (!isRetailer) {
            navigation.goToQuoteStep('product-lines');
            return;
        }

        if (hasRetailerStartDraftData(state)) {
            const choice = await confirmChoiceAction({
                title: 'Starta ny offert?',
                message: 'Det finns redan uppgifter i den nuvarande offerten. Om du fortsätter rensas utkastet och du börjar om från början.',
                confirmText: 'Starta ny offert',
                cancelText: 'Avbryt',
                secondaryText: 'Fortsätt till nuvarande offert',
                tone: 'danger'
            });

            if (choice === 'secondary') {
                navigation.goToQuoteStep(getRetailerResumeQuoteStep(state));
                return;
            }

            if (choice !== 'confirm') {
                return;
            }
        }

        dispatch({ type: 'RESET_STATE' });
        navigation.goToQuoteStep('product-lines');
    };

    return (
        <Dashboard
            onStartQuote={() => {
                void handleStartQuote();
            }}
            onOpenHistory={() => navigation.goToHistory()}
            onOpenInventory={() => navigation.goToInventory()}
            onOpenSketch={() => navigation.goToSketch('dashboard')}
            onOpenPlanner={() => navigation.goToPlanner()}
            onOpenActivity={() => navigation.goToActivity()}
            onOpenRetailers={() => navigation.goToRetailers()}
            onOpenRetailerOrders={() => navigation.goToRetailerOrders()}
            onOpenRetailerOrderHistory={() => navigation.goToRetailerOrderHistory()}
            onOpenRetailerDocuments={() => navigation.goToRetailerDocuments()}
        />
    );
}

function useSyncQuoteRouteStep(step: QuoteRouteStepId) {
    const { state, dispatch } = useQuote();
    const stepNumber = getQuoteStepNumber(step);

    useEffect(() => {
        if (state.step === stepNumber) {
            return;
        }

        dispatch({ type: 'SET_STEP', payload: stepNumber });
    }, [dispatch, state.step, stepNumber]);
}

function ProductLineSelectionPage() {
    const navigation = useAppNavigation();
    useSyncQuoteRouteStep('product-lines');

    return <ProductLineSelection onNext={() => navigation.goToQuoteStep('configuration')} />;
}

function ConfigurationPage() {
    const navigation = useAppNavigation();
    const { canAccessSketch } = useAuth();
    useSyncQuoteRouteStep('configuration');

    return (
        <Configuration
            onNext={() => navigation.goToQuoteStep('pricing')}
            onPrev={() => navigation.goToQuoteStep('product-lines')}
            onBackToSketch={canAccessSketch ? () => navigation.goToSketch('quote-configuration') : undefined}
        />
    );
}

function PricingPage() {
    const navigation = useAppNavigation();
    useSyncQuoteRouteStep('pricing');

    return (
        <Pricing
            onNext={() => navigation.goToQuoteStep('summary')}
            onPrev={() => navigation.goToQuoteStep('configuration')}
        />
    );
}

function SummaryExportPage() {
    const navigation = useAppNavigation();
    const { canAccessSketch } = useAuth();
    useSyncQuoteRouteStep('summary');

    return (
        <SummaryExport
            onPrev={() => navigation.goToQuoteStep('pricing')}
            onBackToSketch={canAccessSketch ? () => navigation.goToSketch('quote-summary') : undefined}
            onOpenRetailerOrderHistory={() => navigation.goToRetailerOrderHistory()}
        />
    );
}

function InventoryManagerPage() {
    const navigation = useAppNavigation();
    return <InventoryManager onBack={() => navigation.goToDashboard()} />;
}

function SketchPage() {
    const navigation = useAppNavigation();
    const [searchParams] = useSearchParams();
    const returnTarget = parseSketchReturnTarget(searchParams.get('return'));

    return (
        <SketchTool
            onBack={() => navigation.goToSketchReturnTarget(returnTarget)}
            onExportToQuoteComplete={() => navigation.goToQuoteStep('configuration')}
        />
    );
}

function PlannerPage() {
    const navigation = useAppNavigation();
    return <Planner onBack={() => navigation.goToDashboard()} />;
}

function HistoryPage() {
    const navigation = useAppNavigation();
    const { dispatch } = useQuote();
    const { isRetailer } = useAuth();

    const handleOpenQuote = (payload: HistoryOpenQuotePayload) => {
        const targetStep = hasConfiguredQuoteContent({
            builderItems: Array.isArray(payload.builderItems) ? payload.builderItems : [],
            gridSelections: payload.gridSelections && typeof payload.gridSelections === 'object'
                ? payload.gridSelections as GridSelections
                : {},
            contractingWork: payload.contractingWork as ContractingWorkState | undefined
        }, { isRetailer }) ? 'summary' : 'product-lines';
        flushSync(() => {
            dispatch({
                type: 'HYDRATE_STATE',
                payload: {
                    ...payload,
                    step: getQuoteStepNumber(targetStep)
                }
            });
        });
        navigation.goToQuoteStep(targetStep);
    };

    return <History onBack={() => navigation.goToDashboard()} onOpenQuote={handleOpenQuote} />;
}

function ActivityLogsPage() {
    const navigation = useAppNavigation();
    return <ActivityLogs onBack={() => navigation.goToDashboard()} />;
}

function InventoryLogsPage() {
    const navigation = useAppNavigation();
    return <InventoryLogs onBack={() => navigation.goToDashboard()} />;
}

function RetailerManagerPage() {
    const navigation = useAppNavigation();
    return <RetailerManager onBack={() => navigation.goToDashboard()} />;
}

function RetailerOrderRequestsPage() {
    const navigation = useAppNavigation();
    return <RetailerOrderRequests onBack={() => navigation.goToDashboard()} />;
}

function RetailerOrderHistoryPage() {
    const navigation = useAppNavigation();
    return <RetailerOrderHistory onBack={() => navigation.goToDashboard()} />;
}

function RetailerDocumentsPage() {
    const navigation = useAppNavigation();
    return <RetailerDocuments onBack={() => navigation.goToDashboard()} />;
}

export const appRoutes: RouteObject[] = [
    {
        path: APP_PATHS[APP_ROUTE_IDS.login],
        element: <LoginRouteElement />
    },
    {
        path: APP_PATHS[APP_ROUTE_IDS.dashboard],
        element: <ProtectedAppLayout />,
        children: [
            {
                index: true,
                element: <DashboardPage />
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.quoteProductLines].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.quoteProductLines}>
                        <ProductLineSelectionPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.quoteConfiguration].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.quoteConfiguration}>
                        <QuoteDraftBoundary routeId={APP_ROUTE_IDS.quoteConfiguration}>
                            <ConfigurationPage />
                        </QuoteDraftBoundary>
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.quotePricing].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.quotePricing}>
                        <QuoteDraftBoundary routeId={APP_ROUTE_IDS.quotePricing}>
                            <PricingPage />
                        </QuoteDraftBoundary>
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.quoteSummary].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.quoteSummary}>
                        <QuoteDraftBoundary routeId={APP_ROUTE_IDS.quoteSummary}>
                            <SummaryExportPage />
                        </QuoteDraftBoundary>
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.quotes].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.quotes}>
                        <HistoryPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.sketch].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.sketch}>
                        <SketchPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.inventory].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.inventory}>
                        <InventoryManagerPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.inventoryLogs].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.inventoryLogs}>
                        <InventoryLogsPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.activity].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.activity}>
                        <ActivityLogsPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.planner].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.planner}>
                        <PlannerPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.retailers].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.retailers}>
                        <RetailerManagerPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.retailerOrders].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.retailerOrders}>
                        <RetailerOrderRequestsPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.retailerOrderHistory}>
                        <RetailerOrderHistoryPage />
                    </RouteAccessBoundary>
                )
            },
            {
                path: APP_PATHS[APP_ROUTE_IDS.retailerDocuments].slice(1),
                element: (
                    <RouteAccessBoundary routeId={APP_ROUTE_IDS.retailerDocuments}>
                        <RetailerDocumentsPage />
                    </RouteAccessBoundary>
                )
            }
        ]
    },
    {
        path: '*',
        element: <Navigate to={APP_PATHS[APP_ROUTE_IDS.dashboard]} replace />
    }
];

export const appRouter = createBrowserRouter(appRoutes);
