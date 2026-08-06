import React, { Component, type ErrorInfo } from 'react';
import { APP_PATHS, APP_ROUTE_IDS } from '../../navigation/routes';
import { clearPersistedQuoteState } from '../../store/quoteStatePersistence';
import type { ErrorBoundaryProps, ErrorBoundaryState } from '../../types/contracts';
import { Button } from '../ui/Button';

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = (): void => {
        clearPersistedQuoteState(this.props.ownerUid);
        window.location.assign(this.props.resetHref || APP_PATHS[APP_ROUTE_IDS.dashboard]);
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                    <p className="mb-3 rounded-full border border-danger-border bg-danger-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-danger-text">
                        Tekniskt fel
                    </p>
                    <h2 className="mb-3 text-2xl font-semibold text-text">Ett oväntat fel uppstod</h2>
                    <p className="mb-8 max-w-md leading-relaxed text-text-muted">
                        Arbetsytan kraschade på grund av ett oväntat fel. Återställ din session och gå tillbaka till startsidan för att försöka igen.
                    </p>
                    <Button
                        onClick={this.handleReset}
                        size="lg"
                        variant="primary"
                    >
                        Återställ och återgå till startsidan
                    </Button>
                    <p className="mt-6 text-sm text-text-muted">
                        Osparade ändringar kan komma att förloras.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
