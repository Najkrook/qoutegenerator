import React from 'react';

export function AdvancedSketchSidebar() {
    return (
        <aside className="w-80 flex-none flex flex-col bg-panel-bg/95 backdrop-blur-sm border-l border-panel-border overflow-y-auto">
            <div className="p-5 flex flex-col gap-6">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">
                        Inspektör (Friform)
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                        Klicka på en vägg eller en nod i ritytan för att se dess egenskaper. Sidopanelen anpassar sig efter ditt val.
                    </p>
                </div>
                
                {/* Placeholder for selected edge or node properties */}
                <div className="bg-panel-hover p-4 rounded-lg border border-panel-border border-dashed flex flex-col items-center justify-center min-h-[120px]">
                    <span className="text-xs text-text-muted">Inget markerat</span>
                </div>
            </div>
        </aside>
    );
}
