import React, { useState, useMemo, useCallback } from 'react';
import { useQuote } from '../store/QuoteContext';
import {
    computeLayout,
    DOOR_LABEL,
    DOOR_SIZES,
    MIN_DIMENSION_MM,
    SECTION_SIZES,
    STEP_MM
} from '../utils/sectionCalculator';
import { SketchCanvas } from '../components/features/SketchCanvas';
import { SketchConfig } from '../components/features/SketchConfig';
import { SketchBom } from '../components/features/SketchBom';
import { StockComparisonModal } from '../components/features/StockComparisonModal';
import toast from 'react-hot-toast';

const EDGE_LABELS = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};

const EDGE_KEYS = ['front', 'left', 'right', 'back'];
const DEFAULT_CAMERA = { zoom: 1, panX: 0, panY: 0 };

function roundToStep(value) {
    return Math.round(value / STEP_MM) * STEP_MM;
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function nearestFromList(value, list) {
    return list.reduce((best, current) => {
        const bestDiff = Math.abs(best - value);
        const currentDiff = Math.abs(current - value);
        if (currentDiff < bestDiff) return current;
        if (currentDiff === bestDiff && current > best) return current;
        return best;
    }, list[0]);
}

function normalizeDimension(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, MIN_DIMENSION_MM, 50000);
}

function normalizeTarget(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return nearestFromList(clamp(rounded, 700, 2000), SECTION_SIZES);
}

function normalizeDoorSize(rawValue) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : 1000;
    return nearestFromList(base, DOOR_SIZES);
}

function sanitizeConfig(config) {
    const next = { ...config };
    next.width = normalizeDimension(next.width, 7000);
    next.depth = normalizeDimension(next.depth, 2300);
    next.targetLength = normalizeTarget(next.targetLength, 1500);
    next.includeBack = !!next.includeBack;
    next.prioMode = ['symmetrical', 'convenient', 'target'].includes(next.prioMode) ? next.prioMode : 'symmetrical';

    const doors = next.doorEdges instanceof Set ? new Set(next.doorEdges) : new Set(next.doorEdges || []);
    if (!next.includeBack) doors.delete('back');
    next.doorEdges = doors;

    const sourceDoorSizes = next.doorSizeByEdge || {};
    const normalizedDoorSizes = {};
    EDGE_KEYS.forEach((edge) => {
        if (!doors.has(edge)) return;
        normalizedDoorSizes[edge] = normalizeDoorSize(sourceDoorSizes[edge] ?? 1000);
    });
    next.doorSizeByEdge = normalizedDoorSizes;

    return next;
}

function parseDoorSize(section) {
    const match = new RegExp(`${DOOR_LABEL}\\s+(\\d+)`, 'i').exec(String(section));
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function getInitialDensity() {
    if (typeof window === 'undefined') {
        return 'desktop';
    }
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse ? 'touch' : 'desktop';
}

export function SketchTool({ onBack }) {
    const { state, dispatch } = useQuote();

    const [config, setConfig] = useState(() =>
        sanitizeConfig({
            width: 7000,
            depth: 2300,
            includeBack: false,
            prioMode: 'symmetrical',
            targetLength: 1500,
            doorEdges: new Set(),
            doorSizeByEdge: {}
        })
    );

    const [workspace, setWorkspace] = useState(() => ({
        camera: DEFAULT_CAMERA,
        selection: { edgeKey: 'front', segmentIndex: null },
        interactionMode: 'select',
        uiDensity: getInitialDensity()
    }));

    const [showStockModal, setShowStockModal] = useState(false);

    const updateConfig = useCallback((partial) => {
        setConfig((prev) => {
            const merged = {
                ...prev,
                ...partial,
                doorSizeByEdge: {
                    ...(prev.doorSizeByEdge || {}),
                    ...(partial.doorSizeByEdge || {})
                }
            };
            return sanitizeConfig(merged);
        });
    }, []);

    const layout = useMemo(() => computeLayout(config), [config]);

    const invalidEdges = useMemo(
        () => Object.entries(layout.edgeDiagnostics || {}).filter(([, diag]) => !diag.valid),
        [layout.edgeDiagnostics]
    );

    const autoAdjustedEdges = useMemo(
        () => Object.entries(layout.edgeDiagnostics || {}).filter(([, diag]) => diag.valid && diag.autoAdjusted),
        [layout.edgeDiagnostics]
    );

    const criticalWarnings = useMemo(
        () => (layout.layoutWarnings || []).filter((warning) => warning.level === 'critical'),
        [layout.layoutWarnings]
    );

    const warningWarnings = useMemo(
        () => (layout.layoutWarnings || []).filter((warning) => warning.level === 'warning'),
        [layout.layoutWarnings]
    );

    const canExport = layout.allSections.length > 0;

    const handleResize = useCallback(
        (dims) => {
            updateConfig(dims);
        },
        [updateConfig]
    );

    const handleSelectEdge = useCallback((edgeKey) => {
        setWorkspace((prev) => ({
            ...prev,
            selection: { ...prev.selection, edgeKey }
        }));
    }, []);

    const handleCameraChange = useCallback((camera) => {
        setWorkspace((prev) => ({
            ...prev,
            camera
        }));
    }, []);

    const setInteractionMode = useCallback((interactionMode) => {
        setWorkspace((prev) => ({
            ...prev,
            interactionMode
        }));
    }, []);

    const setUiDensity = useCallback((uiDensity) => {
        setWorkspace((prev) => ({
            ...prev,
            uiDensity
        }));
    }, []);

    const resetCamera = useCallback(() => {
        setWorkspace((prev) => ({
            ...prev,
            camera: DEFAULT_CAMERA
        }));
    }, []);

    const applySuggestion = useCallback(
        (suggestionId) => {
            const suggestion = (layout.suggestions || []).find((entry) => entry.id === suggestionId);
            if (!suggestion) return;

            if (suggestion.type === 'setDoorSize') {
                const nextDoors = new Set(config.doorEdges);
                nextDoors.add(suggestion.edge);
                updateConfig({
                    doorEdges: nextDoors,
                    doorSizeByEdge: {
                        ...config.doorSizeByEdge,
                        [suggestion.edge]: suggestion.value
                    }
                });
            } else if (suggestion.type === 'toggleDoor') {
                const nextDoors = new Set(config.doorEdges);
                if (suggestion.value) {
                    nextDoors.add(suggestion.edge);
                } else {
                    nextDoors.delete(suggestion.edge);
                }
                const nextDoorSizeByEdge = { ...config.doorSizeByEdge };
                if (!suggestion.value) {
                    delete nextDoorSizeByEdge[suggestion.edge];
                }
                updateConfig({ doorEdges: nextDoors, doorSizeByEdge: nextDoorSizeByEdge });
            } else if (suggestion.type === 'setDimension') {
                updateConfig({ [suggestion.dimension]: suggestion.value });
            }

            setWorkspace((prev) => ({
                ...prev,
                selection: { ...prev.selection, edgeKey: suggestion.edge }
            }));

            toast.success('Förslag applicerat.');
        },
        [config.doorEdges, config.doorSizeByEdge, layout.suggestions, updateConfig]
    );

    const handleExportClick = () => {
        if (!canExport) {
            toast.error('Ingen layout att exportera ännu.');
            return;
        }

        if (criticalWarnings.length > 0) {
            const warningText = criticalWarnings.map((warning) => `• ${warning.text}`).join('\n');
            const confirmed = window.confirm(
                `Layouten har kritiska varningar:\n\n${warningText}\n\nFortsätt export ändå?`
            );
            if (!confirmed) return;
        }

        setShowStockModal(true);
    };

    const commitExport = () => {
        setShowStockModal(false);

        const newSelectedLines = state.selectedLines.includes('ClickitUP')
            ? [...state.selectedLines]
            : [...state.selectedLines, 'ClickitUP'];

        const gridSelections = { ...state.gridSelections };
        if (!gridSelections.ClickitUP) {
            gridSelections.ClickitUP = { items: {}, addons: {} };
        }

        const cuGrid = {
            items: { ...gridSelections.ClickitUP.items },
            addons: { ...gridSelections.ClickitUP.addons }
        };

        layout.allSections.forEach((section) => {
            const doorSize = parseDoorSize(section);
            const key = doorSize ? `ClickitUp Dörr|${doorSize}` : `ClickitUp Sektion|${section}`;
            if (!cuGrid.items[key]) {
                cuGrid.items[key] = { qty: 0, discountPct: 0 };
            }
            cuGrid.items[key].qty += 1;
        });

        if (layout.slimlineCount > 0) {
            if (!cuGrid.addons.stodben_litet) {
                cuGrid.addons.stodben_litet = { qty: 0, discountPct: 0 };
            }
            cuGrid.addons.stodben_litet.qty += layout.slimlineCount;
        }

        if (layout.stodbenCount > 0) {
            if (!cuGrid.addons.stodben_stort) {
                cuGrid.addons.stodben_stort = { qty: 0, discountPct: 0 };
            }
            cuGrid.addons.stodben_stort.qty += layout.stodbenCount;
        }

        gridSelections.ClickitUP = cuGrid;

        dispatch({ type: 'SET_SELECTED_LINES', payload: newSelectedLines });
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: gridSelections });
        dispatch({ type: 'SET_STEP', payload: 2 });

        if (autoAdjustedEdges.length > 0) {
            const adjusted = autoAdjustedEdges
                .map(
                    ([edge, diag]) =>
                        `${EDGE_LABELS[edge] || edge}: ${diag.requestedDoorSize} -> ${diag.resolvedDoorSize} mm`
                )
                .join(', ');
            toast('Dörrstorlek justerades automatiskt: ' + adjusted, { icon: '⚠️' });
        }

        toast.success('ClickitUP-sektioner exporterade till offerten.');
    };

    const handleExportPdf = () => {
        toast('PDF-export är inte tillgänglig i React-versionen ännu.', { icon: '📄' });
    };

    return (
        <div className="animate-slide-in space-y-6">
            <div className="flex justify-between items-center">
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

            <div className="bg-panel-bg border border-panel-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'select', label: 'Välj' },
                        { id: 'pan', label: 'Panorera' },
                        { id: 'resize', label: 'Skala' }
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setInteractionMode(mode.id)}
                            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                                workspace.interactionMode === mode.id
                                    ? 'bg-primary border-primary text-white'
                                    : 'bg-input-bg border-panel-border text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        onClick={resetCamera}
                        className="px-3 py-1.5 rounded-md text-sm border border-panel-border bg-input-bg text-text-secondary hover:text-text-primary"
                    >
                        Återställ vy
                    </button>

                    {['desktop', 'touch'].map((density) => (
                        <button
                            key={density}
                            onClick={() => setUiDensity(density)}
                            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                                workspace.uiDensity === density
                                    ? 'bg-primary border-primary text-white'
                                    : 'bg-input-bg border-panel-border text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            {density === 'desktop' ? 'Desktop' : 'Touch'}
                        </button>
                    ))}
                </div>
            </div>

            {criticalWarnings.length > 0 && (
                <div className="p-4 rounded-lg border border-danger/40 bg-danger/10 text-danger text-sm">
                    <p className="font-semibold m-0 mb-1">Kritiska varningar ({criticalWarnings.length})</p>
                    <ul className="m-0 pl-5 space-y-1">
                        {criticalWarnings.map((warning) => (
                            <li key={warning.id}>{warning.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            {warningWarnings.length > 0 && (
                <div className="p-4 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-200 text-sm">
                    <p className="font-semibold m-0 mb-1">Rekommendationer ({warningWarnings.length})</p>
                    <ul className="m-0 pl-5 space-y-1">
                        {warningWarnings.map((warning) => (
                            <li key={warning.id}>{warning.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <div className="space-y-6">
                    <SketchConfig
                        config={config}
                        onChange={updateConfig}
                        selectedEdge={workspace.selection.edgeKey}
                        onSelectEdge={handleSelectEdge}
                    />

                    <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
                        <h3 className="text-lg font-semibold text-text-primary m-0 mb-3">Förslag</h3>
                        {layout.suggestions.length === 0 ? (
                            <p className="text-sm text-text-secondary m-0">Inga aktiva förslag just nu.</p>
                        ) : (
                            <div className="space-y-2">
                                {layout.suggestions.slice(0, 8).map((suggestion) => (
                                    <button
                                        key={suggestion.id}
                                        onClick={() => applySuggestion(suggestion.id)}
                                        className="w-full text-left p-3 rounded-lg border border-panel-border bg-input-bg hover:bg-white/5 transition-colors"
                                    >
                                        <span className="block text-sm text-text-primary">{suggestion.text}</span>
                                        <span className="block text-xs text-text-secondary mt-1">
                                            {EDGE_LABELS[suggestion.edge] || suggestion.edge} · prioritet {suggestion.priority}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <SketchBom
                        counts={layout.counts}
                        totalGlassLength={layout.totalGlassLength}
                        slimlineCount={layout.slimlineCount}
                        stodbenCount={layout.stodbenCount}
                        hasInvalidEdges={layout.hasInvalidEdges}
                        invalidEdges={invalidEdges}
                        autoAdjustedEdges={autoAdjustedEdges}
                        onExport={handleExportClick}
                        onExportPdf={handleExportPdf}
                    />
                </div>

                <div className="xl:sticky xl:top-4 xl:self-start space-y-4">
                    <SketchCanvas
                        width={config.width}
                        depth={config.depth}
                        includeBack={config.includeBack}
                        leftEdge={layout.leftEdge}
                        rightEdge={layout.rightEdge}
                        frontEdge={layout.frontEdge}
                        backEdge={layout.backEdge}
                        edgeDiagnostics={layout.edgeDiagnostics}
                        edgeSummaries={layout.edgeSummaries}
                        layoutWarnings={layout.layoutWarnings}
                        suggestions={layout.suggestions}
                        camera={workspace.camera}
                        selection={workspace.selection}
                        interactionMode={workspace.interactionMode}
                        uiDensity={workspace.uiDensity}
                        onSelectEdge={handleSelectEdge}
                        onApplySuggestion={applySuggestion}
                        onCameraChange={handleCameraChange}
                        onResize={handleResize}
                    />

                    <div className="flex flex-wrap justify-center gap-4 text-sm text-text-secondary">
                        <span>
                            Bredd: <b className="text-text-primary">{config.width} mm</b>
                        </span>
                        <span>
                            Djup: <b className="text-text-primary">{config.depth} mm</b>
                        </span>
                        <span>
                            Sektioner: <b className="text-text-primary">{layout.allSections.length} st</b>
                        </span>
                    </div>
                </div>
            </div>

            {showStockModal && (
                <StockComparisonModal
                    allSections={layout.allSections}
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
