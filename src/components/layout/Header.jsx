import React from 'react';
import { useQuote } from '../../store/QuoteContext';

export function Header() {
    const { state, dispatch } = useQuote();
    const { step } = state;

    const steps = [
        "1. Produktlinje",
        "2. Konfiguration",
        "3. Priser & Rabatter",
        "4. Offertsammanställning"
    ];

    const resetToStart = () => {
        if (window.confirm("Är du säker på att du vill rensa aktuell offert och gå tillbaka till start?")) {
            localStorage.removeItem('offertverktyg_state');
            dispatch({ type: 'RESET_STATE' });
        }
    };

    return (
        <header className="mb-8">
            <div className="flex justify-center items-center gap-4 flex-wrap mb-6">
                <h1 className="text-2xl font-semibold m-0">Offertverktyg System</h1>
                <a href="history.html" className="text-text-primary no-underline font-medium text-sm bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border transition-colors hover:bg-panel-border">
                    Mina Offerter
                </a>
                <a href="inventory-logs.html" className="text-text-primary no-underline font-medium text-sm bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border transition-colors hover:bg-panel-border">
                    Lagerloggar
                </a>
                <button
                    onClick={resetToStart}
                    className="bg-danger border-danger text-white text-xs px-3 py-1.5 rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                    title="Rensar aktuell offert och återgår till startmenyn"
                >
                    &#x1F3E0; Tillbaka till Start
                </button>

                {/* User Badge Placeholder */}
                <div className="hidden items-center gap-2 bg-panel-bg px-3 py-1.5 rounded-md border border-panel-border text-sm">
                    <span className="text-text-secondary">&#x1F464;</span>
                    <span className="text-text-primary font-medium user-email">user@example.com</span>
                    <button className="bg-transparent border-none text-text-secondary cursor-pointer text-xs px-2 py-1 border-l border-panel-border ml-1 hover:text-text-primary">
                        Logga ut
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center bg-panel-bg border border-panel-border rounded-lg p-2 overflow-x-auto gap-2">
                {steps.map((label, index) => {
                    const stepNumber = index + 1;
                    const isActive = step === stepNumber;
                    return (
                        <div
                            key={label}
                            className={`flex-1 text-center py-2 px-4 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-primary text-white' : 'text-text-secondary'
                                }`}
                        >
                            {label}
                        </div>
                    );
                })}
            </div>
        </header>
    );
}
