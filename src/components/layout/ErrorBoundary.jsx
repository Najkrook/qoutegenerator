import React from 'react';
import { clearPersistedQuoteState } from '../../store/quoteStatePersistence.js';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        clearPersistedQuoteState();
        window.location.href = '/';
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
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">Ett ov&auml;ntat fel uppstod</h2>
                    <p className="text-gray-500 mb-8 max-w-md leading-relaxed">
                        Arbetsytan kraschade p&aring; grund av ett ov&auml;ntat fel. &Aring;terst&auml;ll din session och g&aring; tillbaka till startsidan f&ouml;r att f&ouml;rs&ouml;ka igen.
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                    >
                        &Aring;terst&auml;ll och &aring;terg&aring; till startsidan
                    </button>
                    <p className="text-gray-400 mt-6 text-sm">
                        Osparade &auml;ndringar kan komma att f&ouml;rloras.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
