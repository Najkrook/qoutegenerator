import React from 'react';
import { useQuote } from '../store/QuoteContext';
import { getBuilderCatalogLine, getGridCatalogLine } from '../data/catalogLookup';
import { BuilderConfig } from '../components/features/BuilderConfig';
import { GridConfig } from '../components/features/GridConfig';
import type { ConfigurationProps } from '../types/contracts';

export function Configuration({ onNext, onPrev, onBackToSketch }: ConfigurationProps) {
    const { state } = useQuote();
    const { selectedLines, builderItems, gridSelections } = state;

    const builderLines = selectedLines.filter((lineId) => getBuilderCatalogLine(lineId) !== null);
    const gridLines = selectedLines.filter((lineId) => getGridCatalogLine(lineId) !== null);

    const hasSelections = builderItems.length > 0 || Object.values(gridSelections).some((selection) =>
        Object.keys(selection.items || {}).length > 0 || Object.keys(selection.addons || {}).length > 0
    );

    return (
        <div className="max-w-[1200px] mx-auto animate-fade-in pb-20">
            <div className="mb-8">
                <h2 className="text-2xl font-bold m-0 text-text-primary">Konfigurera Produkter</h2>
                <p className="text-text-secondary text-sm mt-1">Anpassa modeller, storlekar och tillval för dina valda produktlinjer.</p>
            </div>

            <div className="space-y-12">
                {builderLines.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-primary/20 text-primary p-2 rounded-lg font-bold text-xs uppercase tracking-wider">Builder Flow</div>
                            <h3 className="text-xl font-bold m-0 border-l-4 border-primary pl-3">Standardkonfiguration</h3>
                        </div>
                        <BuilderConfig />
                    </section>
                )}

                {gridLines.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-secondary/20 text-secondary p-2 rounded-lg font-bold text-xs uppercase tracking-wider">Grid Flow</div>
                            <h3 className="text-xl font-bold m-0 border-l-4 border-secondary pl-3">Sektionsval (Grid)</h3>
                        </div>
                        {gridLines.map((lineId) => (
                            <GridConfig key={lineId} lineId={lineId} />
                        ))}
                    </section>
                )}

                {!hasSelections && (
                    <div className="bg-panel-bg border border-panel-border border-dashed rounded-xl p-12 text-center">
                        <div className="text-4xl mb-4 text-text-secondary opacity-20" aria-hidden="true">📦</div>
                        <p className="text-text-secondary font-medium">Inga produkter valda ännu. Lägg till en rad ovan för att börja.</p>
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-panel-bg/80 backdrop-blur-md border-t border-panel-border p-4 z-50">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 gap-2 md:grid-cols-3 md:items-center">
                    <button
                        type="button"
                        onClick={onPrev}
                        className="w-full md:w-auto md:justify-self-start px-6 py-2.5 rounded-md font-medium text-text-primary bg-panel-bg border border-panel-border hover:bg-panel-border transition-colors flex items-center justify-center gap-2"
                    >
                        &laquo; Tillbaka till Produktlinjer
                    </button>
                    {onBackToSketch ? (
                        <button
                            type="button"
                            onClick={onBackToSketch}
                            className="w-full md:w-auto md:justify-self-center px-6 py-2.5 rounded-md font-medium text-text-primary bg-panel-bg border border-panel-border hover:bg-panel-border transition-colors flex items-center justify-center gap-2"
                        >
                            &laquo; Tillbaka till Rita
                        </button>
                    ) : (
                        <div className="hidden md:block" aria-hidden="true" />
                    )}
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!hasSelections}
                        className={`w-full md:w-auto md:justify-self-end px-8 py-2.5 rounded-md font-bold text-base transition-all shadow shadow-primary/20 ${!hasSelections
                            ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                            : 'bg-primary hover:bg-primary-hover text-white scale-105 shadow-lg shadow-primary/30'
                        }`}
                    >
                        Fortsätt till Prissättning &raquo;
                    </button>
                </div>
            </div>
        </div>
    );
}
