import React from 'react';
import { APP_PATHS, APP_ROUTE_IDS } from '../../navigation/routes';
import { ErrorBoundary } from './ErrorBoundary';
import { Header } from './Header';

export interface AppShellProps {
    children: React.ReactNode;
    ownerUid?: string | null;
    wide?: boolean;
    variant?: 'default' | 'focus';
}

export function AppShell({
    children,
    ownerUid,
    wide = false,
    variant = 'default'
}: AppShellProps) {
    const isFocus = variant === 'focus';

    return (
        <div
            className={isFocus
                ? 'h-dvh min-h-0 overflow-hidden bg-bg p-1 font-sans text-text-primary antialiased sm:p-2'
                : 'min-h-dvh bg-bg p-3 font-sans text-text-primary antialiased md:p-6'}
            data-app-shell={variant}
        >
            <div
                className={isFocus
                    ? 'relative mx-auto flex h-full min-h-0 max-w-[1920px] flex-col overflow-hidden'
                    : `${wide ? 'max-w-[1920px]' : 'max-w-[1400px]'} relative mx-auto`}
            >
                <div
                    className={isFocus
                        ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                        : 'flex min-h-[calc(100dvh-1.5rem)] flex-col md:min-h-[calc(100dvh-3rem)]'}
                >
                    {!isFocus && <Header />}
                    <main
                        id="main-content"
                        className={`flex min-h-0 flex-1 flex-col${isFocus ? ' overflow-hidden' : ''}`}
                    >
                        <ErrorBoundary
                            ownerUid={ownerUid}
                            resetHref={APP_PATHS[APP_ROUTE_IDS.dashboard]}
                        >
                            {children}
                        </ErrorBoundary>
                    </main>
                </div>
            </div>
        </div>
    );
}
