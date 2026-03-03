import React, { useState, useMemo, useCallback } from 'react';
import { useQuote } from '../store/QuoteContext';
import { computeLayout } from '../utils/sectionCalculator';
import { SketchCanvas } from '../components/features/SketchCanvas';
import { SketchConfig } from '../components/features/SketchConfig';
import { SketchBom } from '../components/features/SketchBom';
import { StockComparisonModal } from '../components/features/StockComparisonModal';
import toast from 'react-hot-toast';

export function SketchTool({ onBack }) {
    const { state, dispatch } = useQuote();

    const [config, setConfig] = useState({
        width: 7000,
        depth: 2300,
        includeBack: false,
        prioMode: 'symmetrical',
        targetLength: 1500,
        doorEdges: new Set(),
        doorSize: 1000
    });

    const [showStockModal, setShowStockModal] = useState(false);

    const updateConfig = useCallback((partial) => {
        setConfig(prev => ({ ...prev, ...partial }));
    }, []);

    // Compute layout whenever config changes
    const layout = useMemo(() => computeLayout(config), [config]);

    // Handle resize from drag handles
    const handleResize = useCallback((dims) => {
        setConfig(prev => ({ ...prev, ...dims }));
    }, []);

    // Export to quote
    const handleExportClick = () => {
        setShowStockModal(true);
    };

    const commitExport = () => {
        setShowStockModal(false);

        // Ensure ClickitUP is selected
        const newSelectedLines = state.selectedLines.includes('ClickitUP')
            ? [...state.selectedLines]
            : [...state.selectedLines, 'ClickitUP'];

        // Build grid selections
        const gridSelections = { ...state.gridSelections };
        if (!gridSelections['ClickitUP']) {
            gridSelections['ClickitUP'] = { items: {}, addons: {} };
        }

        const cuGrid = {
            items: { ...gridSelections['ClickitUP'].items },
            addons: { ...gridSelections['ClickitUP'].addons }
        };

        layout.allSections.forEach(item => {
            let key = '';
            if (String(item).includes('Dörr')) {
                key = `ClickitUp Dörr|${config.doorSize}`;
            } else {
                key = `ClickitUp Sektion|${item}`;
            }
            if (!cuGrid.items[key]) {
                cuGrid.items[key] = { qty: 0, discountPct: 0 };
            }
            cuGrid.items[key].qty += 1;
        });

        // Addon: Slimline for doors
        if (layout.slimlineCount > 0) {
            if (!cuGrid.addons['stodben_litet']) {
                cuGrid.addons['stodben_litet'] = { qty: 0, discountPct: 0 };
            }
            cuGrid.addons['stodben_litet'].qty += layout.slimlineCount;
        }

        // Addon: Stödben 45° for open ends
        if (layout.stodbenCount > 0) {
            if (!cuGrid.addons['stodben_stort']) {
                cuGrid.addons['stodben_stort'] = { qty: 0, discountPct: 0 };
            }
            cuGrid.addons['stodben_stort'].qty += layout.stodbenCount;
        }

        gridSelections['ClickitUP'] = cuGrid;

        dispatch({ type: 'SET_SELECTED_LINES', payload: newSelectedLines });
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: gridSelections });
        dispatch({ type: 'SET_STEP', payload: 2 }); // Go to Configuration

        toast.success('ClickitUP-sektioner exporterade till offerten!');
    };

    const handleExportPdf = () => {
        toast('PDF-export är inte tillgänglig i React-versionen ännu.', { icon: '📄' });
    };

    return (
        <div className="animate-slide-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-semibold text-text-primary m-0">Rita Uteservering</h2>
                    <p className="text-text-secondary mt-1 m-0">
                        Skissa en rektangel och beräkna optimala ClickitUP-sektioner automatiskt.
                    </p>
                </div>
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5"
                >
                    ← Tillbaka
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
                {/* Sidebar: Config + BOM */}
                <div className="space-y-6">
                    <SketchConfig config={config} onChange={updateConfig} />
                    <SketchBom
                        counts={layout.counts}
                        totalGlassLength={layout.totalGlassLength}
                        slimlineCount={layout.slimlineCount}
                        stodbenCount={layout.stodbenCount}
                        onExport={handleExportClick}
                        onExportPdf={handleExportPdf}
                    />
                </div>

                {/* Main canvas */}
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <SketchCanvas
                        width={config.width}
                        depth={config.depth}
                        includeBack={config.includeBack}
                        leftEdge={layout.leftEdge}
                        rightEdge={layout.rightEdge}
                        frontEdge={layout.frontEdge}
                        backEdge={layout.backEdge}
                        onResize={handleResize}
                    />

                    {/* Dimension readout */}
                    <div className="flex justify-center gap-8 mt-4 text-sm text-text-secondary">
                        <span>Bredd: <b className="text-text-primary">{config.width} mm</b></span>
                        <span>Djup: <b className="text-text-primary">{config.depth} mm</b></span>
                        <span>Sektioner: <b className="text-text-primary">{layout.allSections.length} st</b></span>
                    </div>
                </div>
            </div>

            {/* Stock comparison modal */}
            {showStockModal && (
                <StockComparisonModal
                    allSections={layout.allSections}
                    doorSize={config.doorSize}
                    slimlineCount={layout.slimlineCount}
                    stodbenCount={layout.stodbenCount}
                    clickitupStock={state.inventoryData?.clickitup || {}}
                    onConfirm={commitExport}
                    onCancel={() => setShowStockModal(false)}
                />
            )}
        </div>
    );
}
