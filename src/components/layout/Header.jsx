import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';

export function Header() {
    const { state, dispatch } = useQuote();
    const { user, logout, canViewEverything, canAccessQuoteHistory } = useAuth();
    const { step } = state;
    const showQuoteStepper = typeof step === 'number' && step >= 1 && step <= 4;

    const steps = [
        '1. Produktlinje',
        '2. Konfiguration',
        '3. Priser & Rabatter',
        '4. Offertsammanställning'
    ];

    const resetToStart = () => {
        dispatch({ type: 'RESET_STATE' });
    };

    const handleLogout = async () => {
        await logout();
        dispatch({ type: 'SET_STEP', payload: 0 });
    };

    return (
        <header className="mb-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-3">
                    {(step > 0 || typeof step === 'string') && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => dispatch({ type: 'SET_STEP', payload: 0 })}
                                className="bg-panel-bg border border-panel-border text-text-primary text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-panel-border transition-colors shadow-sm flex items-center gap-2"
                                title="Tillbaka till startskärmen"
                            >
                                <span>🏠</span>
                                <span>Start</span>
                            </button>
                            
                            {showQuoteStepper && (
                                <button
                                    type="button"
                                    onClick={resetToStart}
                                    className="bg-danger border border-danger text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-red-600 hover:border-red-600 transition-all shadow-sm flex items-center gap-2 group"
                                    title="Varning: Detta kommer att rensa din nuvarande offert!"
                                >
                                    <span>🗑️</span>
                                    <span>Rensa offert</span>
                                </button>
                            )}
                        </div>
                    )}
                    <h1 className="text-2xl font-semibold m-0">Brixx portal</h1>
                </div>

                <div className="flex items-center gap-3">
                    {canAccessQuoteHistory && (
                        <button 
                            type="button" 
                            onClick={() => dispatch({ type: 'SET_STEP', payload: 'history' })} 
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${step === 'history' ? 'bg-panel-border border-panel-border' : 'bg-panel-bg border-panel-border hover:bg-panel-border'}`}
                        >
                            Mina Offerter
                        </button>
                    )}

                    {canViewEverything && (
                        <button 
                            type="button" 
                            onClick={() => dispatch({ type: 'SET_STEP', payload: 'activity-logs' })} 
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${step === 'activity-logs' ? 'bg-panel-border border-panel-border' : 'bg-panel-bg border-panel-border hover:bg-panel-border'}`}
                        >
                            Aktivitetslog
                        </button>
                    )}

                    {canViewEverything && (
                        <button 
                            type="button" 
                            onClick={() => dispatch({ type: 'SET_STEP', payload: 'inventory-logs' })} 
                            className={`text-text-primary no-underline font-medium text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${step === 'inventory-logs' ? 'bg-panel-border border-panel-border' : 'bg-panel-bg border-panel-border hover:bg-panel-border'}`}
                        >
                            Lagerloggar
                        </button>
                    )}

                    <div className="flex items-center gap-2 bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border text-sm">
                        <span className="text-text-secondary">Användare:</span>
                        <span className="text-text-primary font-medium">{user?.email || '-'}</span>
                        <button
                            onClick={handleLogout}
                            className="bg-transparent border-none text-text-secondary cursor-pointer text-xs px-2 py-1 border-l border-panel-border ml-1 hover:text-text-primary"
                        >
                            Logga ut
                        </button>
                    </div>
                </div>
            </div>

            {showQuoteStepper && (
                <div className="flex justify-between items-center bg-panel-bg border border-panel-border rounded-lg p-2 overflow-x-auto gap-2">
                    {steps.map((label, index) => {
                        const stepNumber = index + 1;
                        const isActive = step === stepNumber;
                        return (
                            <div
                                key={label}
                                className={`flex-1 text-center py-2 px-4 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-primary text-white' : 'text-text-secondary'}`}
                            >
                                {label}
                            </div>
                        );
                    })}
                </div>
            )}
        </header>
    );
}

