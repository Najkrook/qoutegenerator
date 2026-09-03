import React, { useEffect, useRef } from 'react';
import {
    IconActivity,
    IconBriefcase,
    IconBuildingStore,
    IconCalendarWeek,
    IconClipboardList,
    IconCube,
    IconFileText,
    IconFilePlus,
    IconFiles,
    IconFolder,
    IconHistory,
    IconHome2,
    IconListSearch,
    IconPackage,
    IconPencil,
    IconQrcode,
    IconScan,
    IconShoppingCart,
    IconUmbrella,
    type TablerIcon
} from '@tabler/icons-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    APP_PATHS,
    APP_ROUTE_IDS,
    getQuoteRouteStepFromPath
} from '../../navigation/routes';
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
        href: string;
        id: 'bahama-configurator' | 'masse-kladd' | 'pure-model-viewer';
        kind: 'external-link';
        label: string;
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

type NavigationSurface = 'desktop-primary' | 'desktop-secondary' | 'mobile';

interface NavigationVisual {
    colorClassName: string;
    icon: TablerIcon;
}

const NAVIGATION_VISUALS: Record<string, NavigationVisual> = {
    'new-quote': { icon: IconFilePlus, colorClassName: 'text-emerald-500' },
    [APP_PATHS[APP_ROUTE_IDS.dashboard]]: { icon: IconHome2, colorClassName: 'text-sky-500' },
    [APP_PATHS[APP_ROUTE_IDS.priceList]]: { icon: IconListSearch, colorClassName: 'text-cyan-500' },
    [APP_PATHS[APP_ROUTE_IDS.quotes]]: { icon: IconFiles, colorClassName: 'text-violet-500' },
    [APP_PATHS[APP_ROUTE_IDS.crmDashboard]]: { icon: IconBriefcase, colorClassName: 'text-amber-500' },
    [APP_PATHS[APP_ROUTE_IDS.retailerOrders]]: { icon: IconClipboardList, colorClassName: 'text-rose-500' },
    [APP_PATHS[APP_ROUTE_IDS.sketch]]: { icon: IconPencil, colorClassName: 'text-cyan-500' },
    [APP_PATHS[APP_ROUTE_IDS.qrScanner]]: { icon: IconScan, colorClassName: 'text-lime-500' },
    [APP_PATHS[APP_ROUTE_IDS.inventory]]: { icon: IconPackage, colorClassName: 'text-orange-500' },
    [APP_PATHS[APP_ROUTE_IDS.planner]]: { icon: IconCalendarWeek, colorClassName: 'text-indigo-500' },
    [APP_PATHS[APP_ROUTE_IDS.retailers]]: { icon: IconBuildingStore, colorClassName: 'text-fuchsia-500' },
    [APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory]]: { icon: IconShoppingCart, colorClassName: 'text-teal-500' },
    [APP_PATHS[APP_ROUTE_IDS.retailerDocuments]]: { icon: IconFolder, colorClassName: 'text-blue-500' },
    [APP_PATHS[APP_ROUTE_IDS.activity]]: { icon: IconActivity, colorClassName: 'text-yellow-500' },
    [APP_PATHS[APP_ROUTE_IDS.inventoryLogs]]: { icon: IconHistory, colorClassName: 'text-slate-400' },
    [APP_PATHS[APP_ROUTE_IDS.inventoryQr]]: { icon: IconQrcode, colorClassName: 'text-pink-500' },
    'bahama-configurator': { icon: IconUmbrella, colorClassName: 'text-amber-500' },
    'masse-kladd': { icon: IconFileText, colorClassName: 'text-cyan-500' },
    'pure-model-viewer': { icon: IconCube, colorClassName: 'text-violet-500' }
};

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
        salesItems.push({
            kind: 'link',
            label: 'Prislista',
            to: APP_PATHS[APP_ROUTE_IDS.priceList]
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
                kind: 'link',
                label: 'Skanna parasoll',
                to: APP_PATHS[APP_ROUTE_IDS.qrScanner]
            },
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
                },
                {
                    kind: 'link',
                    label: 'QR-etiketter',
                    to: APP_PATHS[APP_ROUTE_IDS.inventoryQr]
                },
                {
                    href: 'https://masse-kladd.web.app',
                    id: 'masse-kladd',
                    kind: 'external-link',
                    label: 'Masse Kladd'
                },
                {
                    href: 'https://pure-model-viewer-najk.web.app/',
                    id: 'pure-model-viewer',
                    kind: 'external-link',
                    label: 'PURE modellvisare'
                },
                {
                    href: 'https://bahama-konfigurator-najk.web.app/',
                    id: 'bahama-configurator',
                    kind: 'external-link',
                    label: 'BaHaMa konfigurator'
                }
            ]
        });
    }

    return groups;
}

function getPrimaryItemLabels(): Set<string> {
    return new Set(['Hem', 'Ny offert', 'Prislista', 'Offerter', 'CRM']);
}

function linkClasses(isActive: boolean, surface: NavigationSurface): string {
    return [
        'rounded-control font-medium no-underline transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        surface === 'desktop-primary'
            ? 'inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 text-sm'
            : surface === 'desktop-secondary'
                ? 'inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap px-1 py-1.5 text-[11px] xl:gap-1.5 xl:px-2 xl:text-xs'
                : 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
        isActive
            ? 'bg-action-soft text-action-soft-text'
            : 'text-text-muted hover:bg-surface-hover hover:text-text'
    ].join(' ');
}

function actionClasses(isActive: boolean, surface: NavigationSurface): string {
    return [
        'rounded-control font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        surface === 'desktop-primary'
            ? 'inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 text-sm'
            : surface === 'desktop-secondary'
                ? 'inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap px-1 py-1.5 text-[11px] xl:gap-1.5 xl:px-2 xl:text-xs'
                : 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
        isActive
            ? 'bg-action-soft text-action-soft-text'
            : 'text-text-muted hover:bg-surface-hover hover:text-text'
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
    const primaryItemLabels = getPrimaryItemLabels();
    const primaryItems = groups.flatMap((group) => (
        group.items.filter((item) => primaryItemLabels.has(item.label))
    ));
    const secondaryItems = groups.flatMap((group) => (
        group.items.filter((item) => !primaryItemLabels.has(item.label))
    ));
    const secondaryInlineItems = secondaryItems.filter((item) => item.kind !== 'external-link');
    const secondaryExternalItems = secondaryItems.filter((item) => item.kind === 'external-link');
    const location = useLocation();
    const isQuoteRoute = getQuoteRouteStepFromPath(location.pathname) !== null;
    const drawerRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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
        const visualKey = item.kind === 'action'
            ? item.id
            : item.kind === 'external-link'
                ? item.id
                : item.to.split(/[?#]/, 1)[0];
        const visual = NAVIGATION_VISUALS[visualKey];
        const NavigationIcon = visual.icon;
        const icon = (
            <NavigationIcon
                aria-hidden="true"
                className={`shrink-0 ${visual.colorClassName}`}
                size={surface === 'desktop-secondary' ? 15 : 17}
                stroke={1.9}
            />
        );

        if (item.kind === 'action') {
            return (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                        if (surface === 'mobile') {
                            onCloseMobile();
                        }
                        onStartQuote();
                    }}
                    className={actionClasses(isQuoteRoute, surface)}
                >
                    {icon}
                    <span>{item.label}</span>
                </button>
            );
        }

        if (item.kind === 'external-link') {
            return (
                <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                        if (surface === 'mobile') {
                            onCloseMobile();
                        }
                    }}
                    className={linkClasses(false, surface)}
                >
                    {icon}
                    <span>{item.label}</span>
                </a>
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
                }}
                className={({ isActive }) => linkClasses(isActive, surface)}
            >
                {icon}
                <span>{item.label}</span>
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
                aria-label="Huvudnavigation"
                className="hidden border-b border-border lg:block"
            >
                <div
                    role="group"
                    aria-label="Primära funktioner"
                    className="flex min-w-0 items-center gap-1 px-4 py-2 md:px-5"
                >
                    {primaryItems.map((item) => renderItem(item, 'desktop-primary'))}
                </div>
                {secondaryItems.length > 0 && (
                    <div
                        role="group"
                        aria-label="Övriga funktioner"
                        className="flex min-w-0 items-center gap-2 border-t border-border/70 bg-surface/50 px-3 py-1.5 xl:px-5"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                            {secondaryInlineItems.map((item) => renderItem(item, 'desktop-secondary'))}
                        </div>
                        {secondaryExternalItems.length > 0 && (
                            <div className="flex shrink-0 items-center gap-1 border-l border-border/70 pl-2">
                                {secondaryExternalItems.map((item) => renderItem(item, 'desktop-secondary'))}
                            </div>
                        )}
                    </div>
                )}
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
