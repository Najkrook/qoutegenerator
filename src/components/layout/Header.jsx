import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';

export function Header() {
    const { state, dispatch } = useQuote();
    const { user, logout, canViewEverything } = useAuth();
    const { step } = state;

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
        window.location.href = 'login.html';
    };

    return (
        <header className="mb-8">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-3">
                    {(step > 0 || typeof step === 'string') && (
                        <button
                            type="button"
                            onClick={resetToStart}
                            className="bg-danger border border-danger text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-red-600 hover:border-red-600 transition-all shadow-sm flex items-center gap-2 group"
                            title="Varning: Detta kommer att rensa din nuvarande offert!"
                        >
                            <span>🏠</span>
                            <span className="inline-block group-hover:hidden whitespace-nowrap">Start</span>
                            <span className="hidden group-hover:inline-block whitespace-nowrap">Rensa offert</span>
                        </button>
                    )}
                    <h1 className="text-2xl font-semibold m-0">Offertverktyg System</h1>
                </div>

                <div className="flex items-center gap-3">
                    {canViewEverything && (
                        <a href="history.html" className="text-text-primary no-underline font-medium text-sm bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border transition-colors hover:bg-panel-border">
                            Mina Offerter
                        </a>
                    )}

                    {canViewEverything && (
                        <a href="inventory-logs.html" className="text-text-primary no-underline font-medium text-sm bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border transition-colors hover:bg-panel-border">
                            Lagerloggar
                        </a>
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
        </header>
    );
}
