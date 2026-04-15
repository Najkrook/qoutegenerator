import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DOOR_SIZES, MIN_DIMENSION_MM, SECTION_SIZES, STEP_MM } from '../../utils/sectionCalculator';
import {
    DEFAULT_PARASOL_PRESET_ID,
    FIESTA_DIAMETER_MM,
    PARASOL_PRESETS,
    getParasolRotationDeg,
    groupParasolPresetsByCategory,
    isParasolRotatable
} from '../../utils/parasolGeometry';
import type { SketchConfigProps, SketchPriorityMode } from '../../types/contracts';

const PRIO_DESCRIPTIONS: Record<SketchPriorityMode, string> = {
    target: 'Fördelar sektioner så nära målstorleken som möjligt med standardstorlekar.',
    convenient: 'Använder större sektioner för färre totala delar.',
    symmetrical: 'Prioriterar jämn sektionstorlek för symmetri.'
};

const EDGE_META = [
    { key: 'front', label: 'Fram' },
    { key: 'left', label: 'Vänster' },
    { key: 'right', label: 'Höger' },
    { key: 'back', label: 'Bak' }
] as const;

interface DelayedInputProps {
    value: string | number;
    min: number;
    step: number;
    onValueCommit: (value: string | number) => void;
    className: string;
}

function roundToStep(value: number): number {
    return Math.round(value / STEP_MM) * STEP_MM;
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function nearestFromList(value: number, list: number[]): number {
    return list.reduce((best, current) => {
        const bestDiff = Math.abs(best - value);
        const currentDiff = Math.abs(current - value);
        if (currentDiff < bestDiff) return current;
        if (currentDiff === bestDiff && current > best) return current;
        return best;
    }, list[0]);
}

function normalizeDimension(rawValue: string | number, fallback: number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, MIN_DIMENSION_MM, 50000);
}

function normalizeDepth(rawValue: string | number, fallback: number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    return clamp(rounded, 0, 50000);
}

function normalizeTarget(rawValue: string | number, fallback: number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : fallback;
    const rounded = roundToStep(base);
    const clamped = clamp(rounded, 700, 2000);
    return nearestFromList(clamped, SECTION_SIZES);
}

function normalizeDoorSize(rawValue: string | number): number {
    const parsed = Number(rawValue);
    const base = Number.isFinite(parsed) ? parsed : 1000;
    return nearestFromList(base, DOOR_SIZES);
}

function DelayedInput({ value, min, step, onValueCommit, className }: DelayedInputProps) {
    const [localValue, setLocalValue] = useState<string | number>(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (String(localValue) !== String(value)) {
            onValueCommit(localValue);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }
    };

    return (
        <input
            type="number"
            value={localValue}
            step={step}
            min={min}
            onChange={(event) => setLocalValue(event.target.value)}
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
    onSetManualPin,
    onClearManualPins,
    onConvertSegmentToDoor,
    onSetDoorSegmentSize,
    onResetDoorSegment,
    edgeSummaries,
    onDeleteParasol,
    onRotateParasol,
    onDeleteFiesta,
    onSetSectionCount,
    onClearSectionCount
}: SketchConfigProps) {
    const {
        activeMode = 'clickitup',
        parasols = [],
        selectedParasolId = null,
        selectedParasolPresetId = DEFAULT_PARASOL_PRESET_ID,
        fiestaItems = [],
        selectedFiestaId = null,
        width,
        depth,
        depthLeft,
        depthRight,
        equalDepth,
        includeBack,
        prioMode,
        targetLength,
        doorSegmentsByEdge = {},
        manualSectionsByEdge = {},
        sectionCountByEdge = {}
    } = config;
    const hasLeftDepth = depthLeft > 0;
    const hasRightDepth = depthRight > 0;
    const hasAnySideDepth = hasLeftDepth || hasRightDepth;
    const isStraightEqualDepth = equalDepth && depth === 0;
    const lastNonZeroEqualDepthRef = useRef(MIN_DIMENSION_MM);

    useEffect(() => {
        if (equalDepth && depth > 0) {
            lastNonZeroEqualDepthRef.current = depth;
        }
    }, [equalDepth, depth]);

    const toggleStraightLayout = () => {
        if (isStraightEqualDepth) {
            const restoredDepth = normalizeDepth(lastNonZeroEqualDepthRef.current, MIN_DIMENSION_MM);
            onChange({
                depth: restoredDepth,
                depthLeft: restoredDepth,
                depthRight: restoredDepth
            });
            return;
        }

        if (equalDepth && depth > 0) {
            lastNonZeroEqualDepthRef.current = depth;
        }

        onChange({
            depth: 0,
            depthLeft: 0,
            depthRight: 0,
            includeBack: false
        });
    };

    const selectedEdgeSummary = selectedEdge ? edgeSummaries?.[selectedEdge] : undefined;
    const selectedSegment =
        selectedSegmentIndex !== null && selectedSegmentIndex !== undefined
            ? selectedEdgeSummary?.segments?.find((segment) => segment.index === selectedSegmentIndex) ?? null
            : null;

    const selectedPins = selectedEdge ? manualSectionsByEdge[selectedEdge] || [] : [];
    const currentPinSize = selectedPins.find((pin) => pin.index === selectedSegmentIndex)?.size ?? null;
    const hasAnyPins = selectedPins.length > 0;
    const currentDoorSegments = selectedEdge ? doorSegmentsByEdge[selectedEdge] || [] : [];
    const existingDoorSegment =
        currentDoorSegments.find((segment) => segment.index === selectedSegmentIndex) || null;
    const selectedDoorSize = existingDoorSegment?.size ?? normalizeDoorSize(selectedSegment?.length ?? 1000);
    const selectedParasol = selectedParasolId
        ? parasols.find((parasol) => parasol.id === selectedParasolId) || null
        : null;
    const selectedFiesta = selectedFiestaId
        ? fiestaItems.find((fiesta) => fiesta.id === selectedFiestaId) || null
        : null;
    const canRotateSelectedParasol = isParasolRotatable(selectedParasol);
    const selectedParasolRotation = getParasolRotationDeg(selectedParasol);
    const groupedParasolPresets = groupParasolPresetsByCategory(PARASOL_PRESETS);

    if (activeMode === 'parasol') {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-xl p-5 space-y-5">
                <h3 className="text-lg font-semibold text-text-primary m-0">Parasollkonfiguration</h3>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Lägg till parasoll</label>
                    <select
                        value={selectedParasolPresetId}
                        onChange={(event) => onChange({ selectedParasolPresetId: event.target.value })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    >
                        {groupedParasolPresets.map((group) => (
                            <optgroup key={group.category} label={group.category}>
                                {group.presets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                        {preset.label} ({preset.widthMm}x{preset.depthMm} mm)
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">Klicka i den ritade ytan för att placera ett parasoll med denna storlek.</p>
                </div>

                {selectedParasolId && selectedParasol && (
                    <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-amber-400 uppercase">Valt Parasoll</span>
                        </div>
                        <p className="text-xs text-text-secondary m-0">
                            Storlek: <b className="text-text-primary">{selectedParasol.label || 'Okänd'}</b>
                        </p>
                        {canRotateSelectedParasol && (
                            <div className="space-y-2">
                                <span className="block text-xs font-semibold text-text-secondary uppercase">Riktning</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Standard', rotationDeg: 0 as const },
                                        { label: 'Roterad 90°', rotationDeg: 90 as const }
                                    ].map((option) => {
                                        const isActive = selectedParasolRotation === option.rotationDeg;
                                        return (
                                            <button
                                                key={option.label}
                                                type="button"
                                                aria-pressed={isActive}
                                                onClick={() => onRotateParasol?.(selectedParasolId, option.rotationDeg)}
                                                className={`px-3 py-2 rounded-md text-xs border transition-colors ${isActive
                                                    ? 'border-amber-300/70 bg-amber-400/20 text-amber-100'
                                                    : 'border-panel-border bg-input-bg text-text-secondary hover:text-text-primary hover:bg-white/5'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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

    if (activeMode === 'fiesta') {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-xl p-5 space-y-5">
                <h3 className="text-lg font-semibold text-text-primary m-0">Fiesta</h3>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Lägg till Fiesta</label>
                    <div className="bg-input-bg border border-panel-border text-text-primary p-3 rounded-lg text-sm">
                        Fiesta 70 cm
                    </div>
                    <p className="text-xs text-text-secondary mt-1">Klicka i den ritade ytan för att placera en Fiesta med 700 mm diameter.</p>
                </div>

                {selectedFiestaId && selectedFiesta && (
                    <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold text-amber-400 uppercase">Vald Fiesta</span>
                        </div>
                        <p className="text-xs text-text-secondary m-0">
                            Storlek: <b className="text-text-primary">{FIESTA_DIAMETER_MM} mm</b>
                        </p>
                        <button
                            onClick={() => onDeleteFiesta?.(selectedFiestaId)}
                            className="w-full px-3 py-1.5 rounded-md text-xs border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            Ta bort markerad Fiesta
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5 space-y-5">
            <h3 className="text-lg font-semibold text-text-primary m-0">Konfiguration</h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Bredd (mm)</label>
                    <DelayedInput
                        value={width}
                        step={STEP_MM}
                        min={MIN_DIMENSION_MM}
                        onValueCommit={(value) => onChange({ width: normalizeDimension(value, width) })}
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
                            onValueCommit={(value) => {
                                const normalizedDepth = normalizeDepth(value, depth);
                                onChange({ depth: normalizedDepth, depthLeft: normalizedDepth, depthRight: normalizedDepth });
                            }}
                            className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                ) : (
                    <div />
                )}
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${equalDepth ? 'bg-primary' : 'bg-gray-600'}`}
                        onClick={() => onChange({ equalDepth: !equalDepth })}
                    >
                        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${equalDepth ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-text-primary">Lika djup</span>
                </label>

                {equalDepth && (
                    <div className="flex items-center gap-2 select-none">
                        <button
                            type="button"
                            aria-pressed={isStraightEqualDepth}
                            className={`relative inline-flex h-4 w-8 rounded-full transition-colors ${isStraightEqualDepth ? 'bg-primary' : 'bg-gray-600'}`}
                            onClick={toggleStraightLayout}
                        >
                            <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${isStraightEqualDepth ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <span className="text-xs text-text-secondary">Rak 0 mm</span>
                    </div>
                )}
            </div>

            {!equalDepth && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Vänster djup (mm)</label>
                        <DelayedInput
                            value={depthLeft}
                            step={STEP_MM}
                            min={0}
                            onValueCommit={(value) => onChange({ depthLeft: normalizeDepth(value, depthLeft) })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Höger djup (mm)</label>
                        <DelayedInput
                            value={depthRight}
                            step={STEP_MM}
                            min={0}
                            onValueCommit={(value) => onChange({ depthRight: normalizeDepth(value, depthRight) })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>
                </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={includeBack}
                    disabled={!hasAnySideDepth}
                    onChange={(event) => {
                        const newBack = event.target.checked;
                        if (!newBack) {
                            const nextDoorSegmentsByEdge = { ...doorSegmentsByEdge };
                            delete nextDoorSegmentsByEdge.back;
                            onChange({ includeBack: false, doorSegmentsByEdge: nextDoorSegmentsByEdge });
                        } else {
                            onChange({ includeBack: true });
                        }
                    }}
                    className="accent-primary w-4 h-4"
                />
                <span className="text-sm text-text-primary">Inkludera bakvägg</span>
            </label>

            {!hasAnySideDepth && (
                <p className="text-xs text-text-secondary m-0">Rak layout (0 mm djup) kan inte ha bakvägg.</p>
            )}

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Prioritering</label>
                <select
                    value={prioMode}
                    onChange={(event) => onChange({ prioMode: event.target.value as SketchPriorityMode })}
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
                        onChange={(event) => onChange({ targetLength: normalizeTarget(event.target.value, targetLength) })}
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

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Antal sektioner per kant</label>
                <p className="text-xs text-text-secondary m-0">Lämna tomt för automatisk beräkning.</p>
                <div className="grid grid-cols-2 gap-3 mt-1">
                    {EDGE_META.map(({ key, label }) => {
                        const summary = edgeSummaries?.[key];
                        if (!summary?.enabled) return null;
                        const currentCount = sectionCountByEdge[key];
                        const autoCount = summary.segments?.length ?? null;
                        const hasOverride = currentCount !== undefined && currentCount !== null;
                        return (
                            <div key={key} className="flex flex-col gap-1">
                                <span className="text-xs text-text-secondary">{label}</span>
                                <div className="flex items-center gap-1.5">
                                    <DelayedInput
                                        value={hasOverride ? currentCount : ''}
                                        step={1}
                                        min={1}
                                        onValueCommit={(value) => {
                                            const parsed = Number.parseInt(String(value), 10);
                                            if (Number.isFinite(parsed) && parsed > 0) {
                                                onSetSectionCount?.(key, parsed);
                                            } else {
                                                onClearSectionCount?.(key);
                                            }
                                        }}
                                        className={`bg-input-bg border text-text-primary p-2 rounded-lg outline-none text-sm w-full ${hasOverride
                                            ? 'border-amber-500/60 focus:border-amber-400'
                                            : 'border-panel-border focus:border-primary'
                                            }`}
                                    />
                                    {hasOverride && (
                                        <button
                                            type="button"
                                            onClick={() => onClearSectionCount?.(key)}
                                            className="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap"
                                            title="Återställ till automatisk"
                                        >
                                            ↺
                                        </button>
                                    )}
                                </div>
                                {autoCount !== null && (
                                    <span className="text-[10px] text-text-secondary">
                                        {hasOverride ? `Auto: ${autoCount}` : `${autoCount} st`}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedSegment && selectedEdge && selectedSegmentIndex !== null && (
                <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-amber-400 uppercase">
                            {selectedSegment.isDoor ? 'Vald dörr' : 'Vald sektion'}
                        </span>
                        {!selectedSegment.isDoor && currentPinSize !== null && (
                            <button
                                onClick={() => onSetManualPin?.(selectedEdge, selectedSegmentIndex, null)}
                                className="text-xs text-amber-400 hover:text-amber-300 underline"
                            >
                                ↺ Auto
                            </button>
                        )}
                    </div>
                    {selectedSegment.isDoor ? (
                        <>
                            <p className="text-xs text-text-secondary m-0">
                                Dörr {selectedSegmentIndex + 1} &bull; Nuvarande: <b className="text-text-primary">{selectedDoorSize} mm</b>
                            </p>
                            <select
                                value={selectedDoorSize}
                                onChange={(event) => onSetDoorSegmentSize?.(selectedEdge, selectedSegmentIndex, normalizeDoorSize(event.target.value))}
                                className="w-full bg-input-bg border border-amber-500/40 text-text-primary p-2.5 rounded-lg outline-none focus:border-amber-400 text-sm"
                            >
                                {DOOR_SIZES.map((size) => (
                                    <option key={size} value={size}>{size} mm</option>
                                ))}
                            </select>
                            <button
                                onClick={() => onResetDoorSegment?.(selectedEdge, selectedSegmentIndex)}
                                className="w-full px-3 py-1.5 rounded-md text-xs border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                            >
                                Återställ till sektion
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-text-secondary m-0">
                                Sektion {selectedSegmentIndex + 1} &bull; Nuvarande: <b className="text-text-primary">{currentPinSize ?? selectedSegment.length} mm</b>
                                {currentPinSize !== null && <span className="text-amber-400 ml-1">(Låst)</span>}
                            </p>
                            <select
                                value={currentPinSize ?? selectedSegment.length}
                                onChange={(event) => onSetManualPin?.(selectedEdge, selectedSegmentIndex, Number(event.target.value))}
                                className="w-full bg-input-bg border border-amber-500/40 text-text-primary p-2.5 rounded-lg outline-none focus:border-amber-400 text-sm"
                            >
                                {SECTION_SIZES.map((size) => (
                                    <option key={size} value={size}>{size} mm</option>
                                ))}
                            </select>
                            <div className="space-y-2">
                                <span className="block text-xs font-semibold text-text-secondary uppercase">Gör till dörr</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {DOOR_SIZES.map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => onConvertSegmentToDoor?.(selectedEdge, selectedSegmentIndex, size)}
                                            className="px-3 py-2 rounded-md text-xs border border-panel-border bg-input-bg text-text-primary hover:bg-white/5 transition-colors"
                                        >
                                            {size} mm
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
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
        </div>
    );
}
