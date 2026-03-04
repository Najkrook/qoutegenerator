import React, { useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Dashboard } from './views/Dashboard';
import { ProductLineSelection } from './views/ProductLineSelection';
import { Configuration } from './views/Configuration';
import { Pricing } from './views/Pricing';
import { SummaryExport } from './views/SummaryExport';
import { InventoryManager } from './views/InventoryManager';
import { SketchTool } from './views/SketchTool';
import { useQuote } from './store/QuoteContext';
import { useAuth } from './store/AuthContext';

function App() {
    const { state, dispatch } = useQuote();
    const { user, loading, canViewEverything } = useAuth();
    const { step } = state;

    const setStep = (newStep) => {
        dispatch({ type: 'SET_STEP', payload: newStep });
    };

    useEffect(() => {
        if (!loading && !user) {
            window.location.replace('login.html');
        }
    }, [loading, user]);

    useEffect(() => {
        if (loading || !user) return;
        if (!canViewEverything && (step === 'inventory' || step === 'sketch')) {
            dispatch({ type: 'SET_STEP', payload: 0 });
        }
    }, [loading, user, canViewEverything, step, dispatch]);

    if (loading) {
        return (
            <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center">
                <p className="text-text-secondary text-sm">Laddar...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center">
                <p className="text-text-secondary text-sm">Omdirigerar till inloggning...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg text-text-primary p-4 md:p-8 font-sans antialiased">
            <div className="max-w-[1400px] mx-auto relative">
                <Header currentStep={step} />

                <main>
                    {step === 0 && <Dashboard onStartQuote={() => setStep(1)} onOpenInventory={canViewEverything ? () => setStep('inventory') : undefined} onOpenSketch={canViewEverything ? () => setStep('sketch') : undefined} />}
                    {step === 1 && <ProductLineSelection onNext={() => setStep(2)} />}
                    {step === 2 && <Configuration onNext={() => setStep(3)} onPrev={() => setStep(1)} />}
                    {step === 3 && <Pricing onNext={() => setStep(4)} onPrev={() => setStep(2)} />}
                    {step === 4 && <SummaryExport onPrev={() => setStep(3)} />}
                    {canViewEverything && step === 'inventory' && <InventoryManager onBack={() => setStep(0)} />}
                    {canViewEverything && step === 'sketch' && <SketchTool onBack={() => setStep(0)} />}
                </main>
            </div>
        </div>
    );
}

export default App;
