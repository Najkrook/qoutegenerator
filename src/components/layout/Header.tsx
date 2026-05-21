import React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';
import {
    APP_ROUTE_IDS,
    getAppRouteIdFromPath,
    getQuoteRouteStepFromPath,
    getQuoteStepNumber
} from '../../navigation/routes';
import { useAppNavigation } from '../../navigation/useAppNavigation';

export function Header() {
    const { dispatch } = useQuote();
    const { user, logout, canViewEverything, canAccessQuoteHistory } = useAuth();
    const location = useLocation();
    const navigation = useAppNavigation();
    const routeId = getAppRouteIdFromPath(location.pathname);
    const quoteStep = getQuoteRouteStepFromPath(location.pathname);
    const showQuoteStepper = quoteStep !== null;
    const currentStepNumber = quoteStep ? getQuoteStepNumber(quoteStep) : null;

    const steps = [
        { id: 'product-lines', label: '1. Produktlinje' },
        { id: 'configuration', label: '2. Konfiguration' },
        { id: 'pricing', label: '3. Priser & Rabatter' },
        { id: 'summary', label: '4. Offertsammanställning' }
    ] as const;

    const resetToStart = (): void => {
        dispatch({ type: 'RESET_STATE' });
        navigation.goToDashboard();
    };

    const handleLogout = async (): Promise<void> => {
        await logout();
        navigation.goToDashboard({ replace: true });
    };

    return (
        <header className="mb-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-3">
                    {routeId !== APP_ROUTE_IDS.dashboard && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigation.goToDashboard()}
                                className="bg-panel-bg border border-panel-border text-text-primary text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-panel-border transition-colors shadow-sm flex items-center gap-2"
                                title="Tillbaka till startskärmen"
                            >
                                <span aria-hidden="true">🏠</span>
                                <span>Start</span>
                            </button>

                            {showQuoteStepper && (
                                <button
                                    type="button"
                                    onClick={resetToStart}
                                    className="bg-danger border border-danger text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-red-600 hover:border-red-600 transition-all shadow-sm flex items-center gap-2 group"
                                    title="Varning: Detta kommer att rensa din nuvarande offert!"
                                >
                                    <span aria-hidden="true">🗑️</span>
                                    <span>Rensa offert</span>
                                </button>
                            )}
                        </div>
                    )}
                    <h1 className="text-2xl font-semibold m-0">Brixx portal</h1>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {canAccessQuoteHistory && (
                        <button
                            type="button"
                            onClick={() => navigation.goToHistory()}
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                                routeId === APP_ROUTE_IDS.quotes
                                    ? 'bg-panel-border border-panel-border'
                                    : 'bg-panel-bg border-panel-border hover:bg-panel-border'
                            }`}
                        >
                            Mina Offerter
                        </button>
                    )}

                    {canViewEverything && (
                        <button
                            type="button"
                            onClick={() => navigation.goToRetailerOrders()}
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                                routeId === APP_ROUTE_IDS.retailerOrders
                                    ? 'bg-panel-border border-panel-border'
                                    : 'bg-panel-bg border-panel-border hover:bg-panel-border'
                            }`}
                        >
                            Orderförfrågningar
                        </button>
                    )}

                    {canViewEverything && (
                        <button
                            type="button"
                            onClick={() => navigation.goToActivity()}
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                                routeId === APP_ROUTE_IDS.activity
                                    ? 'bg-panel-border border-panel-border'
                                    : 'bg-panel-bg border-panel-border hover:bg-panel-border'
                            }`}
                        >
                            Aktivitetslog
                        </button>
                    )}

                    {canViewEverything && (
                        <button
                            type="button"
                            onClick={() => navigation.goToInventoryLogs()}
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                                routeId === APP_ROUTE_IDS.inventoryLogs
                                    ? 'bg-panel-border border-panel-border'
                                    : 'bg-panel-bg border-panel-border hover:bg-panel-border'
                            }`}
                        >
                            Lagerloggar
                        </button>
                    )}

                    <div className="flex items-center gap-2 bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border text-sm">
                        <span className="text-text-secondary">Användare:</span>
                        <span className="text-text-primary font-medium">{user?.email || '-'}</span>
                        <button
                            type="button"
                            onClick={() => {
                                void handleLogout();
                            }}
                            className="bg-transparent border-none text-text-secondary cursor-pointer text-xs px-2 py-1 border-l border-panel-border ml-1 hover:text-text-primary"
                        >
                            Logga ut
                        </button>
                    </div>
                </div>
            </div>

            {showQuoteStepper && (
                <div className="flex justify-between items-center bg-panel-bg border border-panel-border rounded-lg p-2 overflow-x-auto gap-2">
                    {steps.map((step) => {
                        const stepNumber = getQuoteStepNumber(step.id);
                        const isActive = currentStepNumber === stepNumber;
                        return (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => navigation.goToQuoteStep(step.id)}
                                className={`flex-1 text-center py-2 px-4 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border-none outline-none ${
                                    isActive
                                        ? 'bg-primary text-white'
                                        : 'bg-transparent text-text-secondary hover:bg-panel-border hover:text-text-primary'
                                }`}
                            >
                                {step.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </header>
    );
}
