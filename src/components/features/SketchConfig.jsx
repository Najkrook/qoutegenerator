import React, { useState, useEffect } from 'react';
import { DOOR_SIZES, MIN_DIMENSION_MM, SECTION_SIZES, STEP_MM } from '../../utils/sectionCalculator';
import { PARASOL_PRESETS } from '../../utils/parasolGeometry';

const PRIO_DESCRIPTIONS = {
    target: 'Fördelar sektioner så nära målstorleken som möjligt med standardstorlekar.',
    convenient: 'Använder större sektioner för färre totala delar.',
    symmetrical: 'Prioriterar jämn sektionstorlek för symmetri.'
};

const EDGE_META = [
    { key: 'front', label: 'Fram', dimension: 'width' },
    { key: 'left', label: 'Vänster', dimension: 'depth' },
    { key: 'right', label: 'Höger', dimension: 'depth' },
    { key: 'back', label: 'Bak', dimension: 'width' }
];

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
    // Allow 0mm for depth only
    return clamp(rounded, 0, 50000);
}

function normalizeTarget(rawValue, fallback) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    const clamped = clamp(rounded, 700, 2000);
    return nearestFromList(clamped, SECTION_SIZES);
}

function normalizeDoorSize(rawValue) {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : 1000;
    return nearestFromList(base, DOOR_SIZES);
}

function DelayedInput({ value, min, step, onValueCommit, className }) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (String(localValue) !== String(value)) {
            onValueCommit(localValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    return (
        <input
            type="number"
            value={localValue}
            step={step}
            min={min}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={className}
        />
    );
}

export function SketchConfig({
    config,
    onChange,
    selectedEdge,
    selectedSegmentIndex,
    onSelectEdge,
    onSetManualPin,
    onClearManualPins,
    edgeSummaries,
    onDeleteParasol
}) {
    const {
        activeMode = 'clickitup',
        parasols = [],
        selectedParasolId = null,
        selectedParasolPresetId = 'parasol_3x3',
        width,
        depth,
        depthLeft,
        depthRight,
        equalDepth,
        includeBack,
        prioMode,
        targetLength,
        doorEdges,
        doorSizeByEdge = {},
        manualSectionsByEdge = {}
    } = config;

    const visibleEdges = EDGE_META.filter(({ key }) => key !== 'back' || includeBack);

    const toggleDoor = (edge) => {
        const newDoors = new Set(doorEdges);
        const nextDoorSizeByEdge = { ...doorSizeByEdge };

        if (newDoors.has(edge)) {
            newDoors.delete(edge);
            delete nextDoorSizeByEdge[edge];
        } else {
            newDoors.add(edge);
            nextDoorSizeByEdge[edge] = normalizeDoorSize(nextDoorSizeByEdge[edge] ?? 1000);
        }

        onChange({ doorEdges: newDoors, doorSizeByEdge: nextDoorSizeByEdge });
    };

    const visibleDoorEdges = visibleEdges.filter(({ key }) => doorEdges.has(key));

    // Determine selected segment if any
    const selectedEdgeSummary = edgeSummaries?.[selectedEdge];
    const selectedSegment = (selectedSegmentIndex !== null && selectedSegmentIndex !== undefined)
        ? selectedEdgeSummary?.segments?.find((s) => s.index === selectedSegmentIndex && !s.isDoor)
        : null;

    // Current manual pin for the selected segment (null = auto)
    const existingPin = (manualSectionsByEdge[selectedEdge] || []).find((p) => p.index === selectedSegmentIndex);
    const currentPinSize = existingPin?.size ?? null;
    const hasAnyPins = (manualSectionsByEdge[selectedEdge] || []).length > 0;
    const selectedParasol = selectedParasolId
        ? parasols.find((parasol) => parasol.id === selectedParasolId) || null
        : null;

    if (activeMode === 'parasol') {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-xl p-5 space-y-5">
                <h3 className="text-lg font-semibold text-text-primary m-0">⛱️ Parasollkonfiguration</h3>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Lägg till parasoll</label>
                    <select
                        value={selectedParasolPresetId}
                        onChange={(e) => onChange({ selectedParasolPresetId: e.target.value })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    >
                        {PARASOL_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {preset.label} ({preset.widthMm}x{preset.depthMm} mm)
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">Klicka i den ritade ytan för att placera ett parasoll med denna storlek.</p>
                </div>

                {selectedParasolId && (
                    <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-amber-400 uppercase">Valt Parasoll</span>
                        </div>
                        <p className="text-xs text-text-secondary m-0">
                            Storlek: <b className="text-text-primary">{selectedParasol?.label || 'Okänd'}</b>
                        </p>
                        <button
                            onClick={() => onDeleteParasol?.(selectedParasolId)}
                            className="w-full px-3 py-1.5 rounded-md text-xs border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            Ta bort markerat parasoll
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5 space-y-5">
            <h3 className="text-lg font-semibold text-text-primary m-0">⚙️ Konfiguration</h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Bredd (mm)</label>
                    <DelayedInput
                        value={width}
                        step={STEP_MM}
                        min={MIN_DIMENSION_MM}
                        onValueCommit={(val) => onChange({ width: normalizeDimension(val, width) })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    />
                </div>
                {equalDepth ? (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Djup (mm)</label>
                        <DelayedInput
                            value={depth}
                            step={STEP_MM}
                            min={0}
                            onValueCommit={(val) => onChange({ depth: normalizeDepth(val, depth), depthLeft: normalizeDepth(val, depth), depthRight: normalizeDepth(val, depth) })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                ) : (
                    <div />
                )}
            </div>

            {/* Lika djup toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${equalDepth ? 'bg-primary' : 'bg-gray-600'}`}
                    onClick={() => onChange({ equalDepth: !equalDepth })}
                >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${equalDepth ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-text-primary">Lika djup</span>
            </label>

            {!equalDepth && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Vänster djup (mm)</label>
                        <DelayedInput
                            value={depthLeft}
                            step={STEP_MM}
                            min={0}
                            onValueCommit={(val) => onChange({ depthLeft: normalizeDepth(val, depthLeft) })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Höger djup (mm)</label>
                        <DelayedInput
                            value={depthRight}
                            step={STEP_MM}
                            min={0}
                            onValueCommit={(val) => onChange({ depthRight: normalizeDepth(val, depthRight) })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={includeBack}
                    onChange={(e) => {
                        const newBack = e.target.checked;
                        if (!newBack) {
                            const newDoors = new Set(doorEdges);
                            newDoors.delete('back');
                            const nextDoorSizeByEdge = { ...doorSizeByEdge };
                            delete nextDoorSizeByEdge.back;
                            onChange({ includeBack: false, doorEdges: newDoors, doorSizeByEdge: nextDoorSizeByEdge });
                        } else {
                            onChange({ includeBack: true });
                        }
                    }}
                    className="accent-primary w-4 h-4"
                />
                <span className="text-sm text-text-primary">Inkludera bakvägg</span>
            </label>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Prioritering</label>
                <select
                    value={prioMode}
                    onChange={(e) => onChange({ prioMode: e.target.value })}
                    className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                >
                    <option value="symmetrical">Symmetrisk</option>
                    <option value="convenient">Bekväm (färre delar)</option>
                    <option value="target">Målstorlek</option>
                </select>
                <p className="text-xs text-text-secondary m-0">{PRIO_DESCRIPTIONS[prioMode]}</p>
            </div>

            {prioMode === 'target' && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Målstorlek (mm)</label>
                    <select
                        value={targetLength}
                        onChange={(e) => onChange({ targetLength: normalizeTarget(e.target.value, targetLength) })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    >
                        {SECTION_SIZES.map((size) => (
                            <option key={size} value={size}>
                                {size} mm
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* === Section override panel — shown when a pane is clicked === */}
            {selectedSegment && (
                <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-amber-400 uppercase">Manuell sektion</span>
                        {currentPinSize !== null && (
                            <button
                                onClick={() => onSetManualPin?.(selectedEdge, selectedSegmentIndex, null)}
                                className="text-xs text-amber-400 hover:text-amber-300 underline"
                            >
                                ↺ Auto
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-text-secondary m-0">
                        Sektion {selectedSegmentIndex + 1} &bull; Nuvarande: <b className="text-text-primary">{currentPinSize ?? selectedSegment.length} mm</b>
                        {currentPinSize !== null && <span className="text-amber-400 ml-1">(Låst)</span>}
                    </p>
                    <select
                        value={currentPinSize ?? selectedSegment.length}
                        onChange={(e) => onSetManualPin?.(selectedEdge, selectedSegmentIndex, Number(e.target.value))}
                        className="w-full bg-input-bg border border-amber-500/40 text-text-primary p-2.5 rounded-lg outline-none focus:border-amber-400 text-sm"
                    >
                        {SECTION_SIZES.map((size) => (
                            <option key={size} value={size}>{size} mm</option>
                        ))}
                    </select>
                    {hasAnyPins && (
                        <button
                            onClick={() => onClearManualPins?.(selectedEdge)}
                            className="w-full px-3 py-1.5 rounded-md text-xs border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                            Återställ alla manuella på denna kant
                        </button>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-secondary uppercase">Dörrplacering</label>
                <div className="flex flex-wrap gap-3">
                    {visibleEdges.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={doorEdges.has(key)}
                                onChange={() => toggleDoor(key)}
                                className="accent-primary w-4 h-4"
                            />
                            <span className="text-sm text-text-primary">{label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {visibleDoorEdges.length > 0 && (
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Dörrstorlek per kant</label>
                    <div className="space-y-2">
                        {visibleDoorEdges.map(({ key, label }) => (
                            <div key={key} className="grid grid-cols-[1fr_140px] gap-3 items-center">
                                <button
                                    onClick={() => onSelectEdge?.(key)}
                                    className={`text-sm text-left ${selectedEdge === key ? 'text-primary font-semibold' : 'text-text-primary'
                                        }`}
                                >
                                    {label}
                                </button>
                                <select
                                    value={doorSizeByEdge[key] ?? 1000}
                                    onChange={(e) =>
                                        onChange({
                                            doorSizeByEdge: {
                                                ...doorSizeByEdge,
                                                [key]: normalizeDoorSize(e.target.value)
                                            }
                                        })
                                    }
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-lg outline-none focus:border-primary text-sm"
                                >
                                    {DOOR_SIZES.map((size) => (
                                        <option key={size} value={size}>
                                            {size} mm
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
