import React, { useEffect, useState } from 'react';
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
    const { user, loading, canViewEverything, canStartQuote, canAccessSketch } = useAuth();
    const { step } = state;
    const [sketchBackStep, setSketchBackStep] = useState(0);

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
        const isQuoteFlowStep = typeof step === 'number' && step >= 1 && step <= 4;

        if (step === 'inventory' && !canViewEverything) {
            dispatch({ type: 'SET_STEP', payload: 0 });
            return;
        }

        if (step === 'sketch' && !canAccessSketch) {
            dispatch({ type: 'SET_STEP', payload: 0 });
            return;
        }

        if (isQuoteFlowStep && !canStartQuote) {
            dispatch({ type: 'SET_STEP', payload: 0 });
        }
    }, [loading, user, canViewEverything, canStartQuote, canAccessSketch, step, dispatch]);

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
                    {step === 0 && (
                        <Dashboard
                            onStartQuote={canStartQuote ? () => setStep(1) : undefined}
                            onOpenInventory={canViewEverything ? () => setStep('inventory') : undefined}
                            onOpenSketch={
                                canAccessSketch
                                    ? () => {
                                        setSketchBackStep(0);
                                        setStep('sketch');
                                    }
                                    : undefined
                            }
                        />
                    )}
                    {canStartQuote && step === 1 && <ProductLineSelection onNext={() => setStep(2)} />}
                    {canStartQuote && step === 2 && (
                        <Configuration
                            onNext={() => setStep(3)}
                            onPrev={() => setStep(1)}
                            onBackToSketch={
                                canAccessSketch
                                    ? () => {
                                        const cleanedBuilderItems = (state.builderItems || []).filter(
                                            (item) => !(item.source === 'sketch' && item.sourceType === 'parasol')
                                        );
                                        const hasNonSketchBahamaBuilder = cleanedBuilderItems.some(
                                            (item) => item.line === 'BaHaMa'
                                        );
                                        const shouldRemoveBahamaLine = Boolean(state.sketchMeta?.addedBahamaLine) && !hasNonSketchBahamaBuilder;
                                        const cleanedSelectedLines = shouldRemoveBahamaLine
                                            ? (state.selectedLines || []).filter((line) => line !== 'BaHaMa')
                                            : state.selectedLines;

                                        dispatch({ type: 'SET_BUILDER_ITEMS', payload: cleanedBuilderItems });
                                        if (shouldRemoveBahamaLine) {
                                            dispatch({ type: 'SET_SELECTED_LINES', payload: cleanedSelectedLines });
                                        }
                                        dispatch({
                                            type: 'UPDATE_STATE',
                                            payload: {
                                                sketchMeta: {
                                                    ...(state.sketchMeta || {}),
                                                    addedBahamaLine: false
                                                }
                                            }
                                        });
                                        setSketchBackStep(2);
                                        setStep('sketch');
                                    }
                                    : undefined
                            }
                        />
                    )}
                    {canStartQuote && step === 3 && <Pricing onNext={() => setStep(4)} onPrev={() => setStep(2)} />}
                    {canStartQuote && step === 4 && <SummaryExport onPrev={() => setStep(3)} />}
                    {canViewEverything && step === 'inventory' && <InventoryManager onBack={() => setStep(0)} />}
                    {canAccessSketch && step === 'sketch' && <SketchTool onBack={() => setStep(sketchBackStep)} />}
                </main>
            </div>
        </div>
    );
}

export default App;
