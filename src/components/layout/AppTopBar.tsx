import React from 'react';
import { Link } from 'react-router-dom';
import { APP_PATHS, APP_ROUTE_IDS } from '../../navigation/routes';
import ThemeToggle from '../ThemeToggle';
import { Button } from '../ui/Button';

interface AppTopBarProps {
    accessLabel: string;
    canOpenSettings: boolean;
    email?: string | null;
    menuButtonRef: React.RefObject<HTMLButtonElement | null>;
    menuOpen: boolean;
    onLogout: () => void;
    onOpenSettings: () => void;
    onToggleMenu: () => void;
}

export function AppTopBar({
    accessLabel,
    canOpenSettings,
    email,
    menuButtonRef,
    menuOpen,
    onLogout,
    onOpenSettings,
    onToggleMenu
}: AppTopBarProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-5">
            <div className="flex items-center gap-3">
                <Button
                    ref={menuButtonRef}
                    aria-controls="mobile-app-navigation"
                    aria-expanded={menuOpen}
                    onClick={onToggleMenu}
                    className="lg:hidden"
                    size="sm"
                >
                    Meny
                </Button>
                <Link
                    to={APP_PATHS[APP_ROUTE_IDS.dashboard]}
                    className="rounded-control text-text no-underline"
                >
                    <span className="block text-lg font-semibold tracking-tight">Brixx portal</span>
                    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-text-secondary">
                        {accessLabel}
                    </span>
                </Link>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                {email && (
                    <span
                        className="hidden max-w-[16rem] truncate text-xs text-text-secondary sm:inline"
                        title={email}
                    >
                        {email}
                    </span>
                )}
                {canOpenSettings && (
                    <Button
                        onClick={onOpenSettings}
                        aria-label="Öppna admininställningar"
                        size="sm"
                    >
                        Inställningar
                    </Button>
                )}
                <ThemeToggle />
                <Button
                    onClick={onLogout}
                    size="sm"
                    variant="ghost"
                >
                    Logga ut
                </Button>
            </div>
        </div>
    );
}
