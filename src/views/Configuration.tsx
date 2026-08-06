import React from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { getBuilderCatalogLine, getGridCatalogLine } from '../data/catalogLookup';
import { BuilderConfig } from '../components/features/BuilderConfig';
import { GridConfig } from '../components/features/GridConfig';
import { ContractingWorkEditor } from '../components/features/ContractingWorkEditor';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { hasConfiguredContractingWork } from '../services/contractingWork';
import type { ConfigurationProps } from '../types/contracts';

export function Configuration({ onNext, onPrev, onBackToSketch }: ConfigurationProps) {
    const { state } = useQuote();
    const { isRetailer } = useAuth();
    const { selectedLines, builderItems, gridSelections } = state;

    const builderLines = selectedLines.filter((lineId) => getBuilderCatalogLine(lineId) !== null);
    const gridLines = selectedLines.filter((lineId) => getGridCatalogLine(lineId) !== null);

    const hasProductSelections = builderItems.length > 0 || Object.values(gridSelections).some((selection) =>
        Object.keys(selection.items || {}).length > 0 || Object.keys(selection.addons || {}).length > 0
    );
    const showContractingWork = !isRetailer && state.contractingWork?.enabled === true;
    const hasContractingSelections = showContractingWork && hasConfiguredContractingWork(state.contractingWork);
    const hasSelections = hasProductSelections || hasContractingSelections;

    return (
        <div className="mx-auto max-w-[1200px] animate-fade-in pb-[calc(12rem+env(safe-area-inset-bottom))] md:pb-24">
            <PageHeader
                eyebrow="Steg 2 av 4"
                title="Konfigurera offertinnehåll"
                description="Anpassa produkter och beskriv eventuella entreprenadarbeten."
            />

            <div className="mt-6 space-y-10">
                {builderLines.length > 0 && (
                    <section aria-labelledby="builder-configuration-heading">
                        <header className="mb-4">
                            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                Produktkonfiguration
                            </p>
                            <h2 id="builder-configuration-heading" className="mb-0 mt-1 text-xl font-semibold text-text">
                                Standardprodukter
                            </h2>
                        </header>
                        <BuilderConfig />
                    </section>
                )}

                {gridLines.length > 0 && (
                    <section aria-labelledby="grid-configuration-heading">
                        <header className="mb-4">
                            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                Sektionskonfiguration
                            </p>
                            <h2 id="grid-configuration-heading" className="mb-0 mt-1 text-xl font-semibold text-text">
                                Glaspartier och sektioner
                            </h2>
                        </header>
                        {gridLines.map((lineId) => (
                            <GridConfig key={lineId} lineId={lineId} />
                        ))}
                    </section>
                )}

                {showContractingWork && <ContractingWorkEditor />}

                {selectedLines.length > 0 && !hasProductSelections && (
                    <Panel>
                        <p className="m-0 p-8 text-center text-sm text-text-muted">
                            Inga produkter är konfigurerade ännu. Lägg till en produkt eller sektion ovan för att fortsätta.
                        </p>
                    </Panel>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface-raised/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 gap-2 md:grid-cols-3 md:items-center">
                    <Button
                        onClick={onPrev}
                        className="w-full md:w-auto md:justify-self-start"
                    >
                        Tillbaka till offertinnehåll
                    </Button>
                    {onBackToSketch ? (
                        <Button
                            onClick={onBackToSketch}
                            className="w-full md:w-auto md:justify-self-center"
                        >
                            Tillbaka till skiss
                        </Button>
                    ) : (
                        <div className="hidden md:block" aria-hidden="true" />
                    )}
                    <Button
                        onClick={onNext}
                        disabled={!hasSelections}
                        className="w-full md:w-auto md:justify-self-end"
                        variant="primary"
                    >
                        Fortsätt till prissättning
                    </Button>
                </div>
            </div>
        </div>
    );
}
