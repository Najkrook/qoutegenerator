import React, { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { APP_PATHS, APP_ROUTE_IDS } from '../../navigation/routes';
import { Button } from '../ui/Button';

interface RoleNavigationProps {
    canAccessQuoteHistory: boolean;
    canAccessSketch: boolean;
    canStartQuote: boolean;
    canViewEverything: boolean;
    isRetailer: boolean;
    mobileOpen: boolean;
    onCloseMobile: () => void;
    onStartQuote: () => void;
    sketchHref: string;
}

type NavigationItem =
    | {
        end?: boolean;
        kind: 'link';
        label: string;
        to: string;
    }
    | {
        id: 'new-quote';
        kind: 'action';
        label: string;
    };

interface NavigationGroup {
    label: string;
    items: NavigationItem[];
}

type NavigationSurface = 'desktop' | 'panel' | 'mobile';

function getNavigationGroups({
    canAccessQuoteHistory,
    canAccessSketch,
    canStartQuote,
    canViewEverything,
    isRetailer,
    sketchHref
}: Pick<
    RoleNavigationProps,
    'canAccessQuoteHistory' | 'canAccessSketch' | 'canStartQuote' | 'canViewEverything' | 'isRetailer' | 'sketchHref'
>): NavigationGroup[] {
    const groups: NavigationGroup[] = [{
        label: 'Översikt',
        items: [{
            kind: 'link',
            label: 'Hem',
            to: APP_PATHS[APP_ROUTE_IDS.dashboard],
            end: true
        }]
    }];

    const salesItems: NavigationItem[] = [];
    if (canStartQuote) {
        salesItems.push({
            id: 'new-quote',
            kind: 'action',
            label: 'Ny offert'
        });
    }
    if (canAccessQuoteHistory) {
        salesItems.push({
            kind: 'link',
            label: 'Offerter',
            to: APP_PATHS[APP_ROUTE_IDS.quotes]
        });
    }
    if (canViewEverything) {
        salesItems.push(
            {
                kind: 'link',
                label: 'CRM',
                to: APP_PATHS[APP_ROUTE_IDS.crmDashboard]
            },
            {
                kind: 'link',
                label: 'Orderförfrågningar',
                to: APP_PATHS[APP_ROUTE_IDS.retailerOrders]
            }
        );
    }
    if (salesItems.length > 0) {
        groups.push({ label: 'Försäljning', items: salesItems });
    }

    const operationsItems: NavigationItem[] = [];
    if (canAccessSketch) {
        operationsItems.push({
            kind: 'link',
            label: 'Skiss',
            to: sketchHref
        });
    }
    if (canViewEverything) {
        operationsItems.push(
            {
                end: true,
                kind: 'link',
                label: 'Lager',
                to: APP_PATHS[APP_ROUTE_IDS.inventory]
            },
            {
                kind: 'link',
                label: 'Planering',
                to: APP_PATHS[APP_ROUTE_IDS.planner]
            }
        );
    }
    if (operationsItems.length > 0) {
        groups.push({ label: 'Drift', items: operationsItems });
    }

    const partnerItems: NavigationItem[] = [];
    if (canViewEverything) {
        partnerItems.push({
            kind: 'link',
            label: 'Återförsäljare',
            to: APP_PATHS[APP_ROUTE_IDS.retailers]
        });
    }
    if (isRetailer) {
        partnerItems.push({
            kind: 'link',
            label: 'Mina ordrar',
            to: APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory]
        });
    }
    if (isRetailer || canViewEverything) {
        partnerItems.push({
            kind: 'link',
            label: 'Dokument',
            to: APP_PATHS[APP_ROUTE_IDS.retailerDocuments]
        });
    }
    if (partnerItems.length > 0) {
        groups.push({ label: 'Partners', items: partnerItems });
    }

    if (canViewEverything) {
        groups.push({
            label: 'Administration',
            items: [
                {
                    kind: 'link',
                    label: 'Aktiviteter',
                    to: APP_PATHS[APP_ROUTE_IDS.activity]
                },
                {
                    kind: 'link',
                    label: 'Lagerloggar',
                    to: APP_PATHS[APP_ROUTE_IDS.inventoryLogs]
                }
            ]
        });
    }

    return groups;
}

function getPrimaryItemLabels({
    canAccessSketch,
    canViewEverything,
    isRetailer
}: Pick<RoleNavigationProps, 'canAccessSketch' | 'canViewEverything' | 'isRetailer'>): Set<string> {
    const labels = new Set(['Hem', 'Ny offert', 'Offerter', 'CRM']);

    if (!canViewEverything && canAccessSketch) {
        labels.add('Skiss');
    }
    if (isRetailer) {
        labels.add('Mina ordrar');
        labels.add('Dokument');
    }

    return labels;
}

function isLinkActive(item: Extract<NavigationItem, { kind: 'link' }>, pathname: string): boolean {
    const [targetPath] = item.to.split(/[?#]/, 1);
    if (item.end || targetPath === APP_PATHS[APP_ROUTE_IDS.dashboard]) {
        return pathname === targetPath;
    }

    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function linkClasses(isActive: boolean, surface: NavigationSurface): string {
    return [
        'rounded-control text-sm font-medium no-underline transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        surface === 'desktop'
            ? 'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap px-3 py-2'
            : 'block w-full px-3 py-2.5 text-left',
        isActive
            ? 'bg-action-soft text-action-soft-text'
            : 'text-text-muted hover:bg-surface-hover hover:text-text'
    ].join(' ');
}

function actionClasses(surface: NavigationSurface): string {
    return [
        'rounded-control bg-action text-on-action text-sm font-semibold transition-colors hover:bg-action-hover',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        surface === 'desktop'
            ? 'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap px-3 py-2'
            : 'block w-full px-3 py-2.5 text-left'
    ].join(' ');
}

function disclosureClasses(active: boolean): string {
    return [
        'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-control border px-3 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        active
            ? 'border-action/40 bg-action-soft text-action-soft-text'
            : 'border-control-border bg-surface-raised text-text hover:bg-surface-hover'
    ].join(' ');
}

export function RoleNavigation({
    mobileOpen,
    onCloseMobile,
    onStartQuote,
    sketchHref,
    ...accessProps
}: RoleNavigationProps) {
    const groups = getNavigationGroups({ ...accessProps, sketchHref });
    const primaryItemLabels = getPrimaryItemLabels(accessProps);
    const primaryItems = groups.flatMap((group) => (
        group.items.filter((item) => primaryItemLabels.has(item.label))
    ));
    const secondaryGroups = groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !primaryItemLabels.has(item.label))
        }))
        .filter((group) => group.items.length > 0);
    const location = useLocation();
    const activeSecondaryItem = secondaryGroups
        .flatMap((group) => group.items)
        .find((item) => item.kind === 'link' && isLinkActive(item, location.pathname));
    const [moreOpen, setMoreOpen] = useState(false);
    const drawerRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const desktopNavigationRef = useRef<HTMLElement | null>(null);
    const moreButtonRef = useRef<HTMLButtonElement | null>(null);
    const morePanelRef = useRef<HTMLDivElement | null>(null);
    const morePanelId = useId();

    useEffect(() => {
        setMoreOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (!moreOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node
                && !desktopNavigationRef.current?.contains(event.target)
            ) {
                setMoreOpen(false);
            }
        };
        const handleFocusIn = (event: FocusEvent) => {
            if (
                event.target instanceof Node
                && !desktopNavigationRef.current?.contains(event.target)
            ) {
                setMoreOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }

            event.preventDefault();
            setMoreOpen(false);
            window.requestAnimationFrame(() => {
                moreButtonRef.current?.focus();
            });
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [moreOpen]);

    useEffect(() => {
        if (!mobileOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseMobile();
                return;
            }

            if (event.key !== 'Tab' || !drawerRef.current) {
                return;
            }

            const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [mobileOpen, onCloseMobile]);

    const renderItem = (
        item: NavigationItem,
        surface: NavigationSurface
    ) => {
        if (item.kind === 'action') {
            return (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                        if (surface === 'mobile') {
                            onCloseMobile();
                        }
                        setMoreOpen(false);
                        onStartQuote();
                    }}
                    className={actionClasses(surface)}
                >
                    {item.label}
                </button>
            );
        }

        return (
            <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => {
                    if (surface === 'mobile') {
                        onCloseMobile();
                    }
                    if (surface === 'panel') {
                        setMoreOpen(false);
                    }
                }}
                className={({ isActive }) => linkClasses(isActive, surface)}
            >
                {item.label}
            </NavLink>
        );
    };

    const renderMobileGroups = () => (
        <div className="space-y-6">
            {groups.map((group) => (
                <section key={group.label}>
                    <h2 className="mb-2 mt-0 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                        {group.label}
                    </h2>
                    <div className="space-y-1">
                        {group.items.map((item) => renderItem(item, 'mobile'))}
                    </div>
                </section>
            ))}
        </div>
    );

    return (
        <>
            <nav
                ref={desktopNavigationRef}
                aria-label="Huvudnavigation"
                className="relative hidden border-b border-border lg:block"
            >
                <div className="flex min-w-0 items-center gap-1 px-4 py-2 md:px-5">
                    {primaryItems.map((item) => renderItem(item, 'desktop'))}
                    {secondaryGroups.length > 0 && (
                        <div className="relative shrink-0">
                            <button
                                ref={moreButtonRef}
                                type="button"
                                aria-controls={morePanelId}
                                aria-expanded={moreOpen}
                                aria-haspopup="true"
                                aria-label={activeSecondaryItem
                                    ? `Mer, aktuell sida: ${activeSecondaryItem.label}`
                                    : 'Mer'}
                                className={disclosureClasses(Boolean(activeSecondaryItem))}
                                onClick={() => setMoreOpen((open) => !open)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'ArrowDown') {
                                        return;
                                    }

                                    event.preventDefault();
                                    setMoreOpen(true);
                                    window.requestAnimationFrame(() => {
                                        morePanelRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
                                    });
                                }}
                            >
                                Mer
                            </button>

                            {moreOpen && (
                                <div
                                    ref={morePanelRef}
                                    id={morePanelId}
                                    role="region"
                                    aria-label="Fler destinationer"
                                    className="absolute left-0 top-full z-50 mt-2 max-h-[calc(100vh-7rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-panel border border-panel-border bg-surface-raised p-2 shadow-panel"
                                >
                                    <div className="divide-y divide-border">
                                        {secondaryGroups.map((group) => (
                                            <section
                                                key={group.label}
                                                className="min-w-0 py-2 first:pt-0 last:pb-0"
                                            >
                                                <p className="mb-1 mt-0 px-3 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                                                    {group.label}
                                                </p>
                                                <div className="space-y-1">
                                                    {group.items.map((item) => renderItem(item, 'panel'))}
                                                </div>
                                            </section>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            {mobileOpen && (
                <div className="fixed inset-0 z-[9990] lg:hidden">
                    <button
                        type="button"
                        aria-label="Stäng meny"
                        className="absolute inset-0 h-full w-full bg-canvas/80"
                        onClick={onCloseMobile}
                    />
                    <aside
                        ref={drawerRef}
                        id="mobile-app-navigation"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Meny"
                        className="absolute inset-y-0 left-0 w-[min(88vw,22rem)] overflow-y-auto border-r border-border bg-surface-raised p-4 shadow-panel"
                    >
                        <div className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-4">
                            <div>
                                <p className="m-0 text-base font-semibold text-text-primary">Brixx portal</p>
                                <p className="m-0 mt-1 text-xs text-text-secondary">Navigering</p>
                            </div>
                            <Button
                                ref={closeButtonRef}
                                onClick={onCloseMobile}
                                size="sm"
                            >
                                Stäng
                            </Button>
                        </div>
                        <nav aria-label="Mobil huvudnavigation">
                            {renderMobileGroups()}
                        </nav>
                    </aside>
                </div>
            )}
        </>
    );
}
