import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { Dashboard } from './views/Dashboard';
import { ProductLineSelection } from './views/ProductLineSelection';
import { Configuration } from './views/Configuration';
import { Pricing } from './views/Pricing';
import { InventoryLogs } from './views/InventoryLogs';
import { ActivityLogs } from './views/ActivityLogs';
import { Login } from './views/Login';
import { useQuote } from './store/QuoteContext';
import { useAuth } from './store/AuthContext';
import { getAuthorizedStepForAccess } from './config/accessControl.shared.js';

const SummaryExport = lazy(() => import('./views/SummaryExport').then((module) => ({ default: module.SummaryExport })));
const InventoryManager = lazy(() => import('./views/InventoryManager').then((module) => ({ default: module.InventoryManager })));
const SketchTool = lazy(() => import('./views/SketchTool').then((module) => ({ default: module.SketchTool })));
const Planner = lazy(() => import('./views/Planner').then((module) => ({ default: module.Planner })));
const History = lazy(() => import('./views/History').then((module) => ({ default: module.History })));
const RetailerManager = lazy(() => import('./views/RetailerManager').then((module) => ({ default: module.RetailerManager })));

function ViewLoader() {
    return (
        <div className="min-h-[320px] flex items-center justify-center">
            <p className="text-text-secondary text-sm">Laddar vy...</p>
        </div>
    );
}

function App() {
    const { state, dispatch } = useQuote();
    const { user, loading, accessLevel, canViewEverything, canStartQuote, canAccessSketch, canAccessQuoteHistory } = useAuth();
    const { step } = state;
    const [sketchBackStep, setSketchBackStep] = useState(0);

    const setStep = (newStep) => {
        dispatch({ type: 'SET_STEP', payload: newStep });
    };

    useEffect(() => {
        // Auth state changes are handled reactively by rendering <Login /> when !user
    }, [loading, user]);

    useEffect(() => {
        if (loading || !user) return;
        const authorizedStep = getAuthorizedStepForAccess(step, accessLevel);
        if (authorizedStep !== step) {
            dispatch({ type: 'SET_STEP', payload: authorizedStep });
        }
    }, [loading, user, accessLevel, step, dispatch]);

    if (loading) {
        return (
            <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center">
                <p className="text-text-secondary text-sm">Laddar...</p>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <div className="min-h-screen bg-bg text-text-primary p-4 md:p-8 font-sans antialiased">
            <div className={`${step === 4 ? 'max-w-[1920px]' : 'max-w-[1400px]'} mx-auto relative`}>
                <Header currentStep={step} />

                <main>
                    <Suspense fallback={<ViewLoader />}>
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
                            onOpenPlanner={canViewEverything ? () => setStep('planner') : undefined}
                            onOpenActivity={canViewEverything ? () => setStep('activity-logs') : undefined}
                            onOpenRetailers={canViewEverything ? () => setStep('retailers') : undefined}
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
                                            (item) => !(item.source === 'sketch' && (item.sourceType === 'parasol' || item.sourceType === 'fiesta'))
                                        );
                                        const hasNonSketchBahamaBuilder = cleanedBuilderItems.some(
                                            (item) => item.line === 'BaHaMa'
                                        );
                                        const hasNonSketchFiestaBuilder = cleanedBuilderItems.some(
                                            (item) => item.line === 'Fiesta'
                                        );
                                        const shouldRemoveBahamaLine = Boolean(state.sketchMeta?.addedBahamaLine) && !hasNonSketchBahamaBuilder;
                                        const shouldRemoveFiestaLine = Boolean(state.sketchMeta?.addedFiestaLine) && !hasNonSketchFiestaBuilder;
                                        const cleanedSelectedLines = (state.selectedLines || []).filter((line) => {
                                            if (shouldRemoveBahamaLine && line === 'BaHaMa') return false;
                                            if (shouldRemoveFiestaLine && line === 'Fiesta') return false;
                                            return true;
                                        });

                                        dispatch({ type: 'SET_BUILDER_ITEMS', payload: cleanedBuilderItems });
                                        if (shouldRemoveBahamaLine || shouldRemoveFiestaLine) {
                                            dispatch({ type: 'SET_SELECTED_LINES', payload: cleanedSelectedLines });
                                        }
                                        dispatch({
                                            type: 'UPDATE_STATE',
                                            payload: {
                                                sketchMeta: {
                                                    ...(state.sketchMeta || {}),
                                                    addedBahamaLine: false,
                                                    addedFiestaLine: false
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
                    {canStartQuote && step === 4 && (
                        <SummaryExport 
                            onPrev={() => setStep(3)}
                            onBackToSketch={
                                canAccessSketch
                                    ? () => {
                                        setSketchBackStep(4);
                                        setStep('sketch');
                                    }
                                    : undefined
                            }
                        />
                    )}
                    {canViewEverything && step === 'inventory' && <InventoryManager onBack={() => setStep(0)} />}
                    {canAccessSketch && step === 'sketch' && <SketchTool onBack={() => setStep(sketchBackStep)} />}
                    {canViewEverything && step === 'planner' && <Planner onBack={() => setStep(0)} />}
                    {canAccessQuoteHistory && step === 'history' && (
                        <History 
                            onBack={() => setStep(0)} 
                            onOpenQuote={(payload) => {
                                dispatch({ type: 'HYDRATE_STATE', payload: { ...payload, step: 1 } });
                            }} 
                        />
                    )}
                    {canViewEverything && step === 'activity-logs' && <ActivityLogs onBack={() => setStep(0)} />}
                    {canViewEverything && step === 'inventory-logs' && <InventoryLogs onBack={() => setStep(0)} />}
                    {canViewEverything && step === 'retailers' && <RetailerManager onBack={() => setStep(0)} />}
                    </Suspense>
                </main>
            </div>
        </div>
    );
}

export default App;
