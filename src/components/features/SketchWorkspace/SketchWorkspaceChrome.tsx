import {
    IconAlertTriangle,
    IconArrowLeft,
    IconCheck,
    IconChevronDown,
    IconCloudCheck,
    IconCube,
    IconDownload,
    IconDots,
    IconFileExport,
    IconLoader2,
    IconX
} from '@tabler/icons-react';
import {
    useEffect,
    useId,
    useRef,
    useState,
    type ReactNode
} from 'react';

export type SketchPanelTab = 'drawing' | 'properties' | 'material';
export type SketchSaveStatus = 'saving' | 'saved';

interface SketchHeaderAction {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

export interface SketchOverflowAction extends SketchHeaderAction {
    icon?: ReactNode;
    tone?: 'default' | 'danger';
}

interface SketchReadiness {
    label: string;
    tone: 'success' | 'warning' | 'danger';
    onClick: () => void;
}

interface SketchWorkspaceHeaderProps {
    modeToggleNode: ReactNode;
    onBack: () => void;
    overflowActions: SketchOverflowAction[];
    primaryAction: SketchHeaderAction;
    readiness: SketchReadiness;
    saveStatus: SketchSaveStatus;
    prototypeAction?: SketchHeaderAction;
    secondaryAction?: SketchHeaderAction;
}

const readinessClasses: Record<SketchReadiness['tone'], string> = {
    success: 'border-success-border bg-success-bg text-success-text',
    warning: 'border-warning-border bg-warning-bg text-warning-text',
    danger: 'border-danger-border bg-danger-bg text-danger-text'
};

export function SketchWorkspaceHeader({
    modeToggleNode,
    onBack,
    overflowActions,
    primaryAction,
    readiness,
    saveStatus,
    prototypeAction,
    secondaryAction
}: SketchWorkspaceHeaderProps) {
    return (
        <header className="z-30 flex-none border-b border-panel-border bg-panel-bg">
            <a
                href="#sketch-workspace-canvas"
                className="sr-only left-3 top-3 z-[70] rounded-control bg-action px-3 py-2 text-sm font-semibold text-on-action no-underline focus:absolute focus:not-sr-only"
            >
                Hoppa till ritytan
            </a>

            <div className="flex min-h-14 flex-wrap items-center gap-2 px-2 py-2 sm:px-3 lg:flex-nowrap lg:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                        type="button"
                        aria-label="Tillbaka"
                        onClick={onBack}
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-control border border-control-border bg-surface-raised px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                        <IconArrowLeft aria-hidden="true" size={18} stroke={1.8} />
                        <span className="hidden sm:inline">Tillbaka</span>
                    </button>

                    <div className="min-w-0 border-l border-border pl-3">
                        <div className="flex min-w-0 items-baseline gap-2">
                            <span className="hidden shrink-0 text-sm font-semibold text-text xl:inline">Brixx portal</span>
                            <span className="hidden text-text-muted xl:inline" aria-hidden="true">/</span>
                            <h1 className="truncate text-base font-semibold text-text sm:text-lg">Rita uteservering</h1>
                        </div>
                    </div>
                </div>

                <div className="order-3 flex w-full items-center justify-between gap-2 border-t border-border pt-2 lg:order-none lg:w-auto lg:border-0 lg:pt-0">
                    {modeToggleNode}
                    <div
                        aria-live="polite"
                        className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-text-muted"
                    >
                        {saveStatus === 'saving' ? (
                            <>
                                <IconLoader2 aria-hidden="true" className="animate-spin" size={16} stroke={1.8} />
                                Sparar…
                            </>
                        ) : (
                            <>
                                <IconCloudCheck aria-hidden="true" size={16} stroke={1.8} />
                                Sparad lokalt
                            </>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {prototypeAction ? (
                        <button
                            type="button"
                            onClick={prototypeAction.onClick}
                            disabled={prototypeAction.disabled}
                            className="hidden min-h-10 items-center gap-2 rounded-control border border-control-border bg-surface-raised px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 lg:inline-flex"
                        >
                            <IconCube aria-hidden="true" size={18} stroke={1.8} />
                            {prototypeAction.label}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={readiness.onClick}
                        className={`hidden min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:brightness-110 xl:inline-flex ${readinessClasses[readiness.tone]}`}
                    >
                        {readiness.tone === 'success' ? (
                            <IconCheck aria-hidden="true" size={15} stroke={2} />
                        ) : (
                            <IconAlertTriangle aria-hidden="true" size={15} stroke={2} />
                        )}
                        {readiness.label}
                    </button>

                    {secondaryAction ? (
                        <button
                            type="button"
                            onClick={secondaryAction.onClick}
                            disabled={secondaryAction.disabled}
                            className="hidden min-h-10 items-center gap-2 rounded-control border border-control-border bg-surface-raised px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
                        >
                            <IconDownload aria-hidden="true" size={18} stroke={1.8} />
                            {secondaryAction.label}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        aria-label={primaryAction.label}
                        onClick={primaryAction.onClick}
                        disabled={primaryAction.disabled}
                        className="inline-flex min-h-10 items-center gap-2 rounded-control border border-action bg-action px-3 text-sm font-semibold text-on-action transition-colors hover:border-action-hover hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                    >
                        {secondaryAction ? (
                            <IconFileExport aria-hidden="true" size={18} stroke={1.8} />
                        ) : (
                            <IconDownload aria-hidden="true" size={18} stroke={1.8} />
                        )}
                        <span className="hidden sm:inline">{primaryAction.label}</span>
                        <span className="sm:hidden">{secondaryAction ? 'Överför' : 'Ladda ner'}</span>
                    </button>

                    <SketchOverflowMenu actions={overflowActions} />
                </div>
            </div>
        </header>
    );
}

function SketchOverflowMenu({ actions }: { actions: SketchOverflowAction[] }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            window.requestAnimationFrame(() => buttonRef.current?.focus());
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-controls={menuId}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="Fler skissåtgärder"
                onClick={() => {
                    setOpen((current) => {
                        const next = !current;
                        if (next) {
                            window.requestAnimationFrame(() => {
                                menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
                            });
                        }
                        return next;
                    });
                }}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-control border border-control-border bg-surface-raised text-text transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
                <IconDots aria-hidden="true" size={19} stroke={1.8} />
            </button>

            {open ? (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-56 overflow-hidden rounded-control border border-panel-border bg-panel-bg p-1 shadow-panel"
                >
                    {actions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            role="menuitem"
                            disabled={action.disabled}
                            onClick={() => {
                                setOpen(false);
                                action.onClick();
                                window.requestAnimationFrame(() => buttonRef.current?.focus());
                            }}
                            className={`flex min-h-10 w-full items-center gap-2 rounded-control px-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                action.tone === 'danger'
                                    ? 'text-danger-text hover:bg-danger-bg'
                                    : 'text-text hover:bg-surface-hover'
                            }`}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

const PANEL_TABS: Array<{ id: SketchPanelTab; label: string }> = [
    { id: 'drawing', label: 'Ritning' },
    { id: 'properties', label: 'Egenskaper' },
    { id: 'material', label: 'Material' }
];

interface SketchPanelTabsProps {
    activeTab: SketchPanelTab;
    materialCount?: number;
    onChange: (tab: SketchPanelTab) => void;
}

export function SketchPanelTabs({
    activeTab,
    materialCount = 0,
    onChange
}: SketchPanelTabsProps) {
    return (
        <div
            role="tablist"
            aria-label="Skisspanel"
            className="grid flex-none grid-cols-3 border-b border-panel-border"
        >
            {PANEL_TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`relative min-h-12 px-2 text-xs font-semibold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus-ring sm:text-sm ${
                        activeTab === tab.id
                            ? 'text-text'
                            : 'text-text-muted hover:bg-surface-hover hover:text-text'
                    }`}
                >
                    {tab.label}
                    {tab.id === 'material' && materialCount > 0 ? (
                        <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] text-warning-text">
                            {materialCount}
                        </span>
                    ) : null}
                    {activeTab === tab.id ? (
                        <span className="absolute inset-x-3 bottom-0 h-0.5 bg-action" aria-hidden="true" />
                    ) : null}
                </button>
            ))}
        </div>
    );
}

interface SketchResponsivePanelProps {
    activeTab: SketchPanelTab;
    children: ReactNode;
    materialCount?: number;
    onTabChange: (tab: SketchPanelTab) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SketchResponsivePanel({
    activeTab,
    children,
    materialCount,
    onTabChange,
    open,
    onOpenChange
}: SketchResponsivePanelProps) {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            onOpenChange(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onOpenChange, open]);

    return (
        <>
            {!open ? (
                <button
                    ref={triggerRef}
                    type="button"
                    aria-expanded="false"
                    onClick={() => onOpenChange(true)}
                    className="absolute bottom-3 right-3 z-30 inline-flex min-h-11 items-center gap-2 rounded-control border border-control-border bg-panel-bg px-3 text-sm font-semibold text-text shadow-panel transition-colors hover:bg-surface-hover xl:hidden"
                >
                    <IconChevronDown aria-hidden="true" className="-rotate-180 md:-rotate-90" size={18} stroke={1.8} />
                    Öppna panel
                </button>
            ) : null}

            {open ? (
                <button
                    type="button"
                    aria-label="Stäng panelen"
                    onClick={() => {
                        onOpenChange(false);
                        window.requestAnimationFrame(() => triggerRef.current?.focus());
                    }}
                    className="absolute inset-0 z-40 bg-black/15 xl:hidden"
                />
            ) : null}

            <aside
                ref={panelRef}
                aria-label="Skissinställningar"
                className={`${open ? 'flex' : 'hidden'} relative z-50 h-[52%] w-full flex-none flex-col overflow-hidden rounded-t-2xl border border-panel-border bg-panel-bg shadow-panel md:absolute md:inset-y-0 md:left-auto md:right-0 md:h-auto md:max-h-none md:w-[360px] md:rounded-none md:border-y-0 md:border-r-0 xl:static xl:flex xl:h-auto xl:min-h-0 xl:w-[360px] xl:flex-none xl:border-y-0 xl:border-r-0 xl:shadow-none`}
            >
                <div className="relative flex flex-none items-center justify-center border-b border-panel-border py-2 md:justify-end md:px-2 xl:hidden">
                    <span className="h-1 w-12 rounded-full bg-border md:hidden" aria-hidden="true" />
                    <button
                        type="button"
                        aria-label="Minimera panelen"
                        onClick={() => {
                            onOpenChange(false);
                            window.requestAnimationFrame(() => triggerRef.current?.focus());
                        }}
                        className="absolute right-2 top-1.5 inline-flex min-h-9 min-w-9 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                    >
                        <IconX aria-hidden="true" size={19} stroke={1.8} />
                    </button>
                </div>
                <SketchPanelTabs
                    activeTab={activeTab}
                    materialCount={materialCount}
                    onChange={onTabChange}
                />
                <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-5">
                    {children}
                </div>
            </aside>
        </>
    );
}
