import React, { Component, type ErrorInfo } from 'react';
import { APP_PATHS, APP_ROUTE_IDS } from '../../navigation/routes';
import { clearPersistedQuoteState } from '../../store/quoteStatePersistence';
import type { ErrorBoundaryProps, ErrorBoundaryState } from '../../types/contracts';

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
        clearPersistedQuoteState();
        window.location.assign(this.props.resetHref || APP_PATHS[APP_ROUTE_IDS.dashboard]);
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">Ett oväntat fel uppstod</h2>
                    <p className="text-gray-500 mb-8 max-w-md leading-relaxed">
                        Arbetsytan kraschade på grund av ett oväntat fel. Återställ din session och gå tillbaka till startsidan för att försöka igen.
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                    >
                        Återställ och återgå till startsidan
                    </button>
                    <p className="text-gray-400 mt-6 text-sm">
                        Osparade ändringar kan komma att förloras.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
