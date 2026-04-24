import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { DOOR_SIZES, MIN_DIMENSION_MM, SECTION_SIZES, STEP_MM } from '../../utils/sectionCalculator';
import {
    DEFAULT_PARASOL_PRESET_ID,
    FIESTA_DIAMETER_MM,
    PARASOL_PRESETS,
    getParasolRotationDeg,
    groupParasolPresetsByCategory,
    isParasolRotatable
} from '../../utils/parasolGeometry';
import type {
    EdgeSummary,
    SketchConfigProps,
    SketchEdgeKey,
    SketchInspectorPanelProps,
    SketchPriorityMode,
    SketchSetupPanelProps
} from '../../types/contracts';

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

const EDGE_LABELS: Record<SketchEdgeKey, string> = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};

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

function PanelSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <div className="space-y-1">
                <h4 className="text-sm font-semibold text-text-primary m-0">{title}</h4>
                {subtitle && <p className="text-xs text-text-secondary m-0">{subtitle}</p>}
            </div>
            {children}
        </section>
    );
}

function SettingsSurface({
    children,
    className = '',
    surfaceId
}: {
    children: ReactNode;
    className?: string;
    surfaceId?: string;
}) {
    return (
        <div
            data-surface={surfaceId}
            className={`rounded-xl border border-panel-border bg-input-bg/45 p-3.5 ${className}`.trim()}
        >
            {children}
        </div>
    );
}

function getEdgeSummaryLabel(summary?: Partial<EdgeSummary>) {
    if (!summary) {
        return 'Ingen beräkning ännu.';
    }

    return `${summary.sectionCount ?? 0} sektioner · ${summary.effectiveLength ?? 0} mm`;
}

function renderSuggestionButtons(
    suggestions: Array<{ id: string; text: string; priority?: string }>,
    onApplySuggestion?: (suggestionId: string) => void
) {
    if (suggestions.length === 0) {
        return (
            <p className="text-sm text-text-secondary m-0">
                Inga aktiva rekommendationer för det här valet just nu.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {suggestions.slice(0, 4).map((suggestion) => (
                <div key={suggestion.id} className="rounded-xl border border-panel-border bg-input-bg/70 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-text-primary m-0">{suggestion.text}</p>
                        {suggestion.priority && (
                            <span className="shrink-0 rounded-full border border-panel-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                                {suggestion.priority}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => onApplySuggestion?.(suggestion.id)}
                        className="rounded-lg border border-panel-border bg-panel-bg px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-white/5 transition-colors"
                    >
                        Använd förslag
                    </button>
                </div>
            ))}
        </div>
    );
}

export function SketchSetupPanel({
    config,
    onChange,
    edgeSummaries,
    onSetSectionCount,
    onClearSectionCount
}: SketchSetupPanelProps) {
    const {
        width,
        depth,
        depthLeft,
        depthRight,
        equalDepth,
        includeBack,
        prioMode,
        targetLength,
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

    return (
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-4 space-y-5 md:p-5">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-text-primary m-0">Grundinställningar</h3>
                <p className="text-sm text-text-secondary m-0">
                    Ange mått och styr hur layouten ska fördelas innan du jobbar vidare i ritningen.
                </p>
            </div>

            <PanelSection title="Mått" subtitle="Alla mått anges i millimeter.">
                <SettingsSurface surfaceId="sketch-measurements" className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Bredd</label>
                            <DelayedInput
                                value={width}
                                step={STEP_MM}
                                min={MIN_DIMENSION_MM}
                                onValueCommit={(value) => onChange({ width: normalizeDimension(value, width) })}
                                className="bg-panel-bg/75 border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                            />
                        </div>
                        {equalDepth ? (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase">Djup</label>
                                <DelayedInput
                                    value={depth}
                                    step={STEP_MM}
                                    min={0}
                                    onValueCommit={(value) => {
                                        const normalizedDepth = normalizeDepth(value, depth);
                                        onChange({ depth: normalizedDepth, depthLeft: normalizedDepth, depthRight: normalizedDepth });
                                    }}
                                    className="bg-panel-bg/75 border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                                />
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-panel-border px-3 py-3 text-xs text-text-secondary">
                                Olika djup aktiverat. Vänster och höger sida styrs var för sig längre ned.
                            </div>
                        )}
                    </div>

                    {!equalDepth && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase">Vänster djup</label>
                                <DelayedInput
                                    value={depthLeft}
                                    step={STEP_MM}
                                    min={0}
                                    onValueCommit={(value) => onChange({ depthLeft: normalizeDepth(value, depthLeft) })}
                                    className="bg-panel-bg/75 border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase">Höger djup</label>
                                <DelayedInput
                                    value={depthRight}
                                    step={STEP_MM}
                                    min={0}
                                    onValueCommit={(value) => onChange({ depthRight: normalizeDepth(value, depthRight) })}
                                    className="bg-panel-bg/75 border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                                />
                            </div>
                        </div>
                    )}
                </SettingsSurface>
            </PanelSection>

            <PanelSection title="Layoutregler" subtitle="Välj hur sektionerna ska fördelas.">
                <SettingsSurface surfaceId="sketch-setup-controls" className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-text-primary m-0">Lika djup</p>
                            <p className="text-xs text-text-secondary m-0">
                                {equalDepth ? 'Samma djup på båda sidor.' : 'Vänster och höger sida styrs separat.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-pressed={equalDepth}
                            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${equalDepth ? 'bg-primary' : 'bg-gray-600'}`}
                            onClick={() => onChange({ equalDepth: !equalDepth })}
                        >
                            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${equalDepth ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {equalDepth && (
                        <div className="flex items-start justify-between gap-3 border-t border-panel-border/70 pt-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-text-primary m-0">Rak 0 mm</p>
                                <p className="text-xs text-text-secondary m-0">Tar bort sidodjup och stänger av bakvägg.</p>
                            </div>
                            <button
                                type="button"
                                aria-pressed={isStraightEqualDepth}
                                className={`relative mt-0.5 inline-flex h-4 w-8 shrink-0 rounded-full transition-colors ${isStraightEqualDepth ? 'bg-primary' : 'bg-gray-600'}`}
                                onClick={toggleStraightLayout}
                            >
                                <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${isStraightEqualDepth ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    )}

                    <div className="border-t border-panel-border/70 pt-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-text-primary m-0">Inkludera bakvägg</p>
                                <p className="text-xs text-text-secondary m-0">
                                    Lägg till en bakre kant mot vägg/fasad när sidodjup finns.
                                </p>
                            </div>
                            <button
                                type="button"
                                data-control="include-back-toggle"
                                aria-label="Inkludera bakvägg"
                                aria-pressed={includeBack}
                                disabled={!hasAnySideDepth}
                                className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${includeBack
                                    ? 'bg-primary'
                                    : 'bg-gray-600'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                                onClick={() => {
                                    if (!hasAnySideDepth) return;
                                    if (includeBack) {
                                        const nextDoorSegmentsByEdge = { ...(config.doorSegmentsByEdge || {}) };
                                        delete nextDoorSegmentsByEdge.back;
                                        onChange({ includeBack: false, doorSegmentsByEdge: nextDoorSegmentsByEdge });
                                        return;
                                    }
                                    onChange({ includeBack: true });
                                }}
                            >
                                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${includeBack ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {!hasAnySideDepth && (
                            <p className="text-xs text-text-secondary m-0">Rak layout (0 mm djup) kan inte ha bakvägg.</p>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Prioritering</label>
                            <select
                                value={prioMode}
                                onChange={(event) => onChange({ prioMode: event.target.value as SketchPriorityMode })}
                                className="bg-panel-bg/75 border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm w-full"
                            >
                                <option value="symmetrical">Symmetrisk</option>
                                <option value="convenient">Bekväm (färre delar)</option>
                                <option value="target">Målstorlek</option>
                            </select>
                            <p className="text-xs text-text-secondary m-0">{PRIO_DESCRIPTIONS[prioMode]}</p>
                        </div>

                        {prioMode === 'target' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase">Målstorlek</label>
                                <select
                                    value={targetLength}
                                    onChange={(event) => onChange({ targetLength: normalizeTarget(event.target.value, targetLength) })}
                                    className="bg-panel-bg/75 border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm w-full"
                                >
                                    {SECTION_SIZES.map((size) => (
                                        <option key={size} value={size}>
                                            {size} mm
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </SettingsSurface>
            </PanelSection>

            <PanelSection title="Antal sektioner per kant" subtitle="Lämna tomt för automatisk beräkning.">
                <SettingsSurface surfaceId="sketch-section-counts">
                    <div className="grid grid-cols-2 gap-3">
                        {EDGE_META.map(({ key, label }) => {
                            const summary = edgeSummaries?.[key];
                            if (!summary?.enabled) return null;
                            const currentCount = sectionCountByEdge[key];
                            const autoCount = summary.segments?.length ?? null;
                            const hasOverride = currentCount !== undefined && currentCount !== null;
                            return (
                                <div key={key} className="space-y-1.5 rounded-xl border border-panel-border bg-panel-bg/55 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-text-primary">{label}</span>
                                        {hasOverride && (
                                            <button
                                                type="button"
                                                onClick={() => onClearSectionCount?.(key)}
                                                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                                                title="Återställ till automatisk"
                                            >
                                                Auto
                                            </button>
                                        )}
                                    </div>
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
                                        className={`bg-panel-bg border text-text-primary p-2 rounded-lg outline-none text-sm w-full ${hasOverride
                                            ? 'border-amber-500/60 focus:border-amber-400'
                                            : 'border-panel-border focus:border-primary'
                                            }`}
                                    />
                                    <span className="text-[11px] text-text-secondary">
                                        {hasOverride ? `Automatiskt: ${autoCount ?? 0}` : getEdgeSummaryLabel(summary)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </SettingsSurface>
            </PanelSection>
        </div>
    );
}

export function SketchInspectorPanel({
    config,
    onChange,
    selectedEdge,
    selectedSegmentIndex,
    edgeSummaries,
    suggestions = [],
    onSetManualPin,
    onClearManualPins,
    onConvertSegmentToDoor,
    onSetDoorSegmentSize,
    onResetDoorSegment,
    onApplySuggestion,
    onDeleteParasol,
    onRotateParasol,
    onDeleteFiesta
}: SketchInspectorPanelProps) {
    const {
        activeMode = 'clickitup',
        parasols = [],
        selectedParasolId = null,
        selectedParasolPresetId = DEFAULT_PARASOL_PRESET_ID,
        fiestaItems = [],
        selectedFiestaId = null,
        doorSegmentsByEdge = {},
        manualSectionsByEdge = {}
    } = config;

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
    const selectedEdgeSuggestions = useMemo(
        () => suggestions.filter((suggestion) => suggestion.edge === selectedEdge),
        [selectedEdge, suggestions]
    );

    if (activeMode === 'parasol') {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 space-y-5">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-text-primary m-0">Inspektör: Parasoll</h3>
                    <p className="text-sm text-text-secondary m-0">
                        Välj modell här och klicka sedan i ritningen för att placera den.
                    </p>
                </div>

                <PanelSection title="Lägg till parasoll">
                    <select
                        value={selectedParasolPresetId}
                        onChange={(event) => onChange({ selectedParasolPresetId: event.target.value })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm w-full"
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
                    <p className="text-xs text-text-secondary m-0">
                        Klicka i den ritade ytan för att placera ett parasoll med vald storlek.
                    </p>
                </PanelSection>

                <PanelSection
                    title={selectedParasol ? 'Markerat parasoll' : 'Ingen parasoll vald'}
                    subtitle={selectedParasol ? 'Justera eller ta bort det markerade parasollet.' : 'Klicka på ett placerat parasoll för att redigera det.'}
                >
                    {selectedParasol ? (
                        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                            <p className="text-sm text-text-secondary m-0">
                                Storlek: <b className="text-text-primary">{selectedParasol.label || 'Okänd'}</b>
                            </p>
                            <p className="text-sm text-text-secondary m-0">
                                Position: <b className="text-text-primary">{selectedParasol.xMm} × {selectedParasol.yMm} mm</b>
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
                                                    onClick={() => selectedParasolId && onRotateParasol?.(selectedParasolId, option.rotationDeg)}
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
                                onClick={() => selectedParasolId && onDeleteParasol?.(selectedParasolId)}
                                className="w-full px-3 py-2 rounded-lg text-sm border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                Ta bort markerat parasoll
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-panel-border px-4 py-5 text-sm text-text-secondary">
                            Placera ett parasoll eller markera ett befintligt för att få fler inställningar här.
                        </div>
                    )}
                </PanelSection>
            </div>
        );
    }

    if (activeMode === 'fiesta') {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 space-y-5">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-text-primary m-0">Inspektör: Fiesta</h3>
                    <p className="text-sm text-text-secondary m-0">
                        Klicka i ritningen för att placera en Fiesta med standarddiameter.
                    </p>
                </div>

                <PanelSection title="Lägg till Fiesta">
                    <div className="rounded-xl border border-panel-border bg-input-bg px-4 py-3 text-sm text-text-primary">
                        Fiesta 70 cm
                    </div>
                    <p className="text-xs text-text-secondary m-0">
                        Varje Fiesta placeras som en cirkel på 700 mm i ritningsytan.
                    </p>
                </PanelSection>

                <PanelSection
                    title={selectedFiesta ? 'Vald Fiesta' : 'Ingen Fiesta vald'}
                    subtitle={selectedFiesta ? 'Överblick och borttagning av markerad Fiesta.' : 'Klicka på en placerad Fiesta för att markera den.'}
                >
                    {selectedFiesta ? (
                        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                            <p className="text-sm text-text-secondary m-0">
                                Storlek: <b className="text-text-primary">{FIESTA_DIAMETER_MM} mm</b>
                            </p>
                            <p className="text-sm text-text-secondary m-0">
                                Position: <b className="text-text-primary">{selectedFiesta.xMm} × {selectedFiesta.yMm} mm</b>
                            </p>
                            <button
                                onClick={() => selectedFiestaId && onDeleteFiesta?.(selectedFiestaId)}
                                className="w-full px-3 py-2 rounded-lg text-sm border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                Ta bort markerad Fiesta
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-panel-border px-4 py-5 text-sm text-text-secondary">
                            Placera en Fiesta eller markera en befintlig för att få fler inställningar här.
                        </div>
                    )}
                </PanelSection>
            </div>
        );
    }

    if (selectedSegment && selectedEdge && selectedSegmentIndex !== null) {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 space-y-5">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-text-primary m-0">Inspektör: {EDGE_LABELS[selectedEdge]}</h3>
                    <p className="text-sm text-text-secondary m-0">
                        Du redigerar {selectedSegment.isDoor ? 'en dörr' : 'en sektion'} på vald kant.
                    </p>
                </div>

                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                    <div className="flex justify-between items-center gap-3">
                        <span className="text-xs font-semibold text-amber-400 uppercase">
                            {selectedSegment.isDoor ? 'Vald dörr' : 'Vald sektion'}
                        </span>
                        {!selectedSegment.isDoor && currentPinSize !== null && (
                            <button
                                onClick={() => onSetManualPin?.(selectedEdge, selectedSegmentIndex, null)}
                                className="text-xs text-amber-400 hover:text-amber-300 underline"
                            >
                                Återställ till auto
                            </button>
                        )}
                    </div>

                    {selectedSegment.isDoor ? (
                        <>
                            <p className="text-sm text-text-secondary m-0">
                                Dörr {selectedSegmentIndex + 1} · Nuvarande storlek <b className="text-text-primary">{selectedDoorSize} mm</b>
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
                                className="w-full px-3 py-2 rounded-lg text-sm border border-amber-500/40 bg-panel-bg text-text-primary hover:bg-white/5 transition-colors"
                            >
                                Återställ till sektion
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-text-secondary m-0">
                                Sektion {selectedSegmentIndex + 1} · Nuvarande storlek <b className="text-text-primary">{currentPinSize ?? selectedSegment.length} mm</b>
                                {currentPinSize !== null && <span className="text-amber-400 ml-1">(låst)</span>}
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

                    {hasAnyPins && !selectedSegment.isDoor && (
                        <button
                            onClick={() => onClearManualPins?.(selectedEdge)}
                            className="w-full px-3 py-2 rounded-lg text-sm border border-panel-border bg-panel-bg text-text-primary hover:bg-white/5 transition-colors"
                        >
                            Återställ alla manuella på denna kant
                        </button>
                    )}
                </div>

                <PanelSection title="Rekommendationer för vald kant">
                    {renderSuggestionButtons(selectedEdgeSuggestions, onApplySuggestion)}
                </PanelSection>
            </div>
        );
    }

    if (selectedEdge) {
        return (
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 space-y-5">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-text-primary m-0">Inspektör: {EDGE_LABELS[selectedEdge]}</h3>
                    <p className="text-sm text-text-secondary m-0">
                        Markera en sektion eller dörr på kanten för att låsa storlek eller byta till dörr.
                    </p>
                </div>

                <div className="rounded-xl border border-panel-border bg-input-bg/70 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-text-secondary m-0">Längd</p>
                            <p className="text-text-primary font-semibold mt-1 mb-0">{selectedEdgeSummary?.effectiveLength ?? 0} mm</p>
                        </div>
                        <div>
                            <p className="text-text-secondary m-0">Sektioner</p>
                            <p className="text-text-primary font-semibold mt-1 mb-0">{selectedEdgeSummary?.sectionCount ?? 0} st</p>
                        </div>
                        <div>
                            <p className="text-text-secondary m-0">Dörrar</p>
                            <p className="text-text-primary font-semibold mt-1 mb-0">{selectedEdgeSummary?.doorCount ?? 0} st</p>
                        </div>
                        <div>
                            <p className="text-text-secondary m-0">Status</p>
                            <p className="text-text-primary font-semibold mt-1 mb-0">
                                {selectedEdgeSummary?.valid === false ? 'Behöver åtgärd' : 'Redo'}
                            </p>
                        </div>
                    </div>

                    {selectedEdgeSummary?.autoAdjusted && (
                        <p className="text-xs text-amber-300 m-0">
                            Dörrstorleken på den här kanten har autojusterats till {selectedEdgeSummary.resolvedDoorSize} mm.
                        </p>
                    )}
                </div>

                <PanelSection title="Rekommendationer för vald kant">
                    {renderSuggestionButtons(selectedEdgeSuggestions, onApplySuggestion)}
                </PanelSection>
            </div>
        );
    }

    return (
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 space-y-5">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-text-primary m-0">Inspektör</h3>
                <p className="text-sm text-text-secondary m-0">
                    Klicka på en kant, sektion, dörr eller ett placerat objekt i ritningen för att få rätt verktyg här.
                </p>
            </div>

            <div className="rounded-xl border border-dashed border-panel-border px-4 py-5 text-sm text-text-secondary">
                Börja med att markera något i ritningen. För ClickitUp kan du först välja en kant och sedan en enskild sektion.
            </div>

            <PanelSection title="När du jobbar i canvasen">
                <ul className="m-0 pl-5 space-y-2 text-sm text-text-secondary">
                    <li>Klicka på en etikett för att öppna en kant i inspektören.</li>
                    <li>Klicka på en sektion för att låsa storleken eller göra den till dörr.</li>
                    <li>Byt till Parasoll eller Fiesta i canvas-toolbaren för att placera objekt.</li>
                </ul>
            </PanelSection>
        </div>
    );
}

export function SketchConfig(props: SketchConfigProps) {
    return (
        <div className="space-y-6">
            <SketchSetupPanel
                config={props.config}
                onChange={props.onChange}
                edgeSummaries={props.edgeSummaries}
                onSetSectionCount={props.onSetSectionCount}
                onClearSectionCount={props.onClearSectionCount}
            />
            <SketchInspectorPanel
                config={props.config}
                onChange={props.onChange}
                selectedEdge={props.selectedEdge}
                selectedSegmentIndex={props.selectedSegmentIndex}
                edgeSummaries={props.edgeSummaries}
                suggestions={[]}
                onSetManualPin={props.onSetManualPin}
                onClearManualPins={props.onClearManualPins}
                onConvertSegmentToDoor={props.onConvertSegmentToDoor}
                onSetDoorSegmentSize={props.onSetDoorSegmentSize}
                onResetDoorSegment={props.onResetDoorSegment}
                onDeleteParasol={props.onDeleteParasol}
                onRotateParasol={props.onRotateParasol}
                onDeleteFiesta={props.onDeleteFiesta}
            />
        </div>
    );
}
