import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';
import {
    APP_PATHS,
    APP_ROUTE_IDS,
    getQuoteRouteStepFromPath,
    hasQuoteStartDraftData
} from '../../navigation/routes';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { useQuoteDraftActions } from '../../navigation/useQuoteDraftActions';
import { confirmAction } from '../../services/notificationService';
import { AppTopBar } from './AppTopBar';
import { QuoteContextBar } from './QuoteContextBar';
import { RoleNavigation } from './RoleNavigation';

const AdminSettingsModal = lazy(() => import('../features/AdminSettingsModal').then((module) => ({
    default: module.AdminSettingsModal
})));

function getAccessLabel(accessLevel: string): string {
    switch (accessLevel) {
        case 'full':
            return 'Administration';
        case 'retailer':
            return 'Återförsäljarportal';
        case 'sketch-only':
            return 'Skissverktyg';
        case 'quote-only':
            return 'Offertarbete';
        default:
            return 'Arbetsyta';
    }
}

function getSketchHref(
    quoteStep: ReturnType<typeof getQuoteRouteStepFromPath>,
    currentSearch: string
): string {
    const params = new URLSearchParams();
    params.set('return', quoteStep === 'summary' ? 'quote-summary' : quoteStep ? 'quote-configuration' : 'dashboard');

    if (quoteStep) {
        const currentParams = new URLSearchParams(currentSearch);
        const crmDealId = currentParams.get('crmDealId')?.trim();
        if (crmDealId) {
            params.set('crmDealId', crmDealId);
            const quoteOwnerUid = currentParams.get('quoteOwnerUid')?.trim();
            if (quoteOwnerUid) {
                params.set('quoteOwnerUid', quoteOwnerUid);
            }
        }
    }

    return `${APP_PATHS[APP_ROUTE_IDS.sketch]}?${params.toString()}`;
}

export function Header() {
    const { state, dispatch } = useQuote();
    const {
        accessLevel,
        user,
        logout,
        canStartQuote,
        canViewEverything,
        canAccessSketch,
        canAccessQuoteHistory,
        isRetailer
    } = useAuth();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const location = useLocation();
    const navigation = useAppNavigation();
    const { startQuote } = useQuoteDraftActions();
    const quoteStep = getQuoteRouteStepFromPath(location.pathname);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname, location.search]);

    const closeMobileMenu = useCallback(() => {
        setMobileMenuOpen(false);
        window.requestAnimationFrame(() => {
            menuButtonRef.current?.focus();
        });
    }, []);

    const resetQuote = async (): Promise<void> => {
        if (hasQuoteStartDraftData(state, { isRetailer })) {
            const confirmed = await confirmAction({
                title: 'Rensa offertutkast?',
                message: 'Offertens kund-, produkt- och prisuppgifter rensas. Lagerdata och sparade skisser påverkas inte.',
                confirmText: 'Rensa offert',
                cancelText: 'Behåll utkast',
                tone: 'danger'
            });

            if (!confirmed) {
                return;
            }
        }

        dispatch({ type: 'RESET_QUOTE_DRAFT' });
        navigation.goToDashboard();
    };

    const handleLogout = async (): Promise<void> => {
        await logout();
        navigation.goToDashboard({ replace: true });
    };

    return (
        <header className="relative mb-6 rounded-panel border border-panel-border bg-panel-bg shadow-sm">
            <a
                href="#main-content"
                className="sr-only left-4 top-3 z-[60] rounded-control bg-action px-3 py-2 text-sm font-semibold text-on-action no-underline focus:absolute focus:not-sr-only"
            >
                Hoppa till innehållet
            </a>
            <AppTopBar
                accessLabel={getAccessLabel(accessLevel)}
                canOpenSettings={canViewEverything}
                email={user?.email}
                menuButtonRef={menuButtonRef}
                menuOpen={mobileMenuOpen}
                onLogout={() => {
                    void handleLogout();
                }}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleMenu={() => setMobileMenuOpen((open) => !open)}
            />
            <RoleNavigation
                canAccessQuoteHistory={canAccessQuoteHistory}
                canAccessSketch={canAccessSketch}
                canStartQuote={canStartQuote}
                canViewEverything={canViewEverything}
                isRetailer={isRetailer}
                mobileOpen={mobileMenuOpen}
                onCloseMobile={closeMobileMenu}
                onStartQuote={() => {
                    void startQuote();
                }}
                sketchHref={getSketchHref(quoteStep, location.search)}
            />
            {quoteStep && (
                <QuoteContextBar
                    currentStep={quoteStep}
                    isRetailer={isRetailer}
                    onResetQuote={() => {
                        void resetQuote();
                    }}
                    state={state}
                />
            )}
            {settingsOpen && (
                <Suspense fallback={null}>
                    <AdminSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
                </Suspense>
            )}
        </header>
    );
}
