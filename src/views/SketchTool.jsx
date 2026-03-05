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
import { downloadBlob, saveBlobWithPicker } from '../utils/fileUtils';
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

function normalizeDepth(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, 0, 50000);
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
    next.width = normalizeDimension(next.width, 8000);
    next.equalDepth = next.equalDepth !== false; // default true

    const primaryDepth = normalizeDepth(next.depth ?? next.depthLeft ?? next.depthRight, 4000);
    const normalizedDepthLeft = normalizeDepth(next.depthLeft, primaryDepth);
    const normalizedDepthRight = normalizeDepth(next.depthRight, primaryDepth);

    if (next.equalDepth) {
        const sharedDepth = primaryDepth;
        next.depth = sharedDepth;
        next.depthLeft = sharedDepth;
        next.depthRight = sharedDepth;
    } else {
        next.depthLeft = normalizedDepthLeft;
        next.depthRight = normalizedDepthRight;
        next.depth = Math.max(normalizedDepthLeft, normalizedDepthRight); // keep for backwards compat
    }

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
            width: 8000,
            depth: 4000,
            depthLeft: 4000,
            depthRight: 4000,
            equalDepth: true,
            includeBack: false,
            prioMode: 'symmetrical',
            targetLength: 1500,
            doorEdges: new Set(),
            doorSizeByEdge: {},
            manualSectionsByEdge: {}
        })
    );

    const [workspace, setWorkspace] = useState(() => ({
        camera: DEFAULT_CAMERA,
        selection: { edgeKey: 'front', segmentIndex: null },
        uiDensity: getInitialDensity()
    }));

    const [showStockModal, setShowStockModal] = useState(false);
    const [dragPreview, setDragPreview] = useState(null);

    const updateConfig = useCallback((partial) => {
        setConfig((prev) => {
            const merged = {
                ...prev,
                ...partial,
                doorSizeByEdge: {
                    ...(prev.doorSizeByEdge || {}),
                    ...(partial.doorSizeByEdge || {})
                },
                manualSectionsByEdge: {
                    ...(prev.manualSectionsByEdge || {}),
                    ...(partial.manualSectionsByEdge || {})
                }
            };
            return sanitizeConfig(merged);
        });
    }, []);

    const setManualPin = useCallback((edgeKey, segmentIndex, size) => {
        setConfig((prev) => {
            const prevPins = (prev.manualSectionsByEdge || {})[edgeKey] || [];
            const filtered = prevPins.filter((p) => p.index !== segmentIndex);
            const nextPins = size !== null
                ? [...filtered, { index: segmentIndex, size }]
                : filtered;
            return {
                ...prev,
                manualSectionsByEdge: {
                    ...(prev.manualSectionsByEdge || {}),
                    [edgeKey]: nextPins
                }
            };
        });
    }, []);

    const clearManualPins = useCallback((edgeKey) => {
        setConfig((prev) => {
            const next = { ...(prev.manualSectionsByEdge || {}) };
            delete next[edgeKey];
            return { ...prev, manualSectionsByEdge: next };
        });
    }, []);

    const layout = useMemo(() => computeLayout(config), [config]);
    const previewConfig = useMemo(() => {
        if (!dragPreview) return config;
        return sanitizeConfig({
            ...config,
            ...dragPreview,
            doorSizeByEdge: config.doorSizeByEdge,
            manualSectionsByEdge: config.manualSectionsByEdge
        });
    }, [config, dragPreview]);
    const previewLayout = useMemo(
        () => (dragPreview ? computeLayout(previewConfig) : layout),
        [dragPreview, previewConfig, layout]
    );

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

    const handleResizePreview = useCallback((dims) => {
        if (!dims || Object.keys(dims).length === 0) {
            setDragPreview(null);
            return;
        }

        setDragPreview((prev) => {
            const base = prev || {};
            const merged = { ...base, ...dims };
            const changed = Object.entries(dims).some(([key, value]) => base[key] !== value);
            return changed ? merged : base;
        });
    }, []);

    const handleResizeCommit = useCallback(
        (dims) => {
            setDragPreview(null);
            if (dims && Object.keys(dims).length > 0) {
                updateConfig(dims);
            }
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
                let nextDimensionUpdate = { [suggestion.dimension]: suggestion.value };
                if (suggestion.dimension === 'depth') {
                    nextDimensionUpdate = config.equalDepth
                        ? { depth: suggestion.value }
                        : suggestion.edge === 'left'
                            ? { depthLeft: suggestion.value }
                            : suggestion.edge === 'right'
                                ? { depthRight: suggestion.value }
                                : { depth: suggestion.value };
                }
                updateConfig(nextDimensionUpdate);
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

    const handleExportImage = async () => {
        if (typeof window.html2canvas !== 'function') {
            toast.error('Bildexport är inte tillgänglig just nu. Ladda om sidan och försök igen.');
            return;
        }

        const element = document.getElementById('sketchCanvasContainer');
        if (!element) {
            toast.error('Kan inte hitta skissen att exportera.');
            return;
        }

        // Temporarily hide drag handles
        const handles = element.querySelectorAll('.sketch-drag-handle');
        handles.forEach(h => h.style.display = 'none');

        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#0b1220';

        const toastId = toast.loading('Genererar bild...');
        const fileName = `Uteservering_Skiss_${config.width}x${config.depthLeft}.png`;

        try {
            const canvas = await window.html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#0b1220'
            });

            canvas.toBlob(async (blob) => {
                handles.forEach(h => h.style.display = '');
                element.style.backgroundColor = originalBg;

                const pickerResult = await saveBlobWithPicker(blob, fileName);

                if (pickerResult === 'saved') {
                    toast.success(`Skiss sparad: ${fileName}`, { id: toastId });
                } else if (pickerResult === 'canceled') {
                    toast.dismiss(toastId);
                    toast('Bildexport avbröts.', { icon: '!' });
                } else {
                    if (pickerResult === 'failed') {
                        toast('Kunde inte öppna spara-dialog. Använder nedladdning istället.', { icon: '!' });
                    }
                    downloadBlob(blob, fileName);
                    toast.success(`Skiss nedladdad: ${fileName}`, { id: toastId });
                }
            }, 'image/png');
        } catch (err) {
            handles.forEach(h => h.style.display = '');
            element.style.backgroundColor = originalBg;
            toast.error('Kunde inte skapa bild: ' + (err?.message || 'okänt fel'), { id: toastId });
        }
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
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <button
                            onClick={resetCamera}
                            className="px-3 py-2 rounded-lg text-sm border border-panel-border bg-input-bg text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Återställ vy
                        </button>

                        <div className="flex rounded-lg border border-panel-border overflow-hidden bg-input-bg">
                            {['desktop', 'touch'].map((density) => (
                                <button
                                    key={density}
                                    onClick={() => setUiDensity(density)}
                                    className={`px-4 py-2 text-sm transition-colors ${workspace.uiDensity === density
                                        ? 'bg-primary text-white font-medium'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                        }`}
                                >
                                    {density === 'desktop' ? 'Desktop' : 'Touch'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={onBack}
                        className="px-5 py-2 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5 shadow-sm"
                    >
                        ← Tillbaka
                    </button>
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
                        selectedSegmentIndex={workspace.selection.segmentIndex}
                        onSelectEdge={handleSelectEdge}
                        onSetManualPin={setManualPin}
                        onClearManualPins={clearManualPins}
                        edgeSummaries={layout.edgeSummaries}
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
                        onExportImage={handleExportImage}
                    />
                </div>

                <div className="xl:sticky xl:top-4 xl:self-start space-y-4">
                    <SketchCanvas
                        width={previewConfig.width}
                        depth={previewConfig.depth}
                        depthLeft={previewConfig.depthLeft}
                        depthRight={previewConfig.depthRight}
                        equalDepth={previewConfig.equalDepth}
                        includeBack={previewConfig.includeBack}
                        leftEdge={previewLayout.leftEdge}
                        rightEdge={previewLayout.rightEdge}
                        frontEdge={previewLayout.frontEdge}
                        backEdge={previewLayout.backEdge}
                        edgeDiagnostics={previewLayout.edgeDiagnostics}
                        edgeSummaries={previewLayout.edgeSummaries}
                        layoutWarnings={previewLayout.layoutWarnings}
                        suggestions={previewLayout.suggestions}
                        camera={workspace.camera}
                        selection={workspace.selection}
                        uiDensity={workspace.uiDensity}
                        onSelectEdge={handleSelectEdge}
                        onSelectSection={(edgeKey, segmentIndex) => {
                            setWorkspace((prev) => ({
                                ...prev,
                                selection: { edgeKey, segmentIndex }
                            }));
                        }}
                        onApplySuggestion={applySuggestion}
                        onCameraChange={handleCameraChange}
                        onResizePreview={handleResizePreview}
                        onResizeCommit={handleResizeCommit}
                    />

                    <div className="flex flex-wrap justify-center gap-4 text-sm text-text-secondary">
                        <span>
                            Bredd: <b className="text-text-primary">{config.width} mm</b>
                        </span>
                        {config.equalDepth ? (
                            <span>Djup: <b className="text-text-primary">{config.depth} mm</b></span>
                        ) : (
                            <>
                                <span>Vänster: <b className="text-text-primary">{config.depthLeft} mm</b></span>
                                <span>Höger: <b className="text-text-primary">{config.depthRight} mm</b></span>
                            </>
                        )}
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
