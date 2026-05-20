import type {
    EdgeDiagnostic,
    SketchBomProps,
    SketchEdgeKey,
    SketchReviewPanelProps,
    SketchReviewRow,
    SketchReviewState
} from '../../types/contracts';

const EDGE_LABELS: Record<SketchEdgeKey, string> = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};

function buildLegacyReviewRows(counts: Record<string, number>, slimlineCount: number, stodbenCount: number, parasols: Array<{ label?: string }> = [], fiestaCount = 0): SketchReviewRow[] {
    const keys = Object.keys(counts);
    const doorKeys = keys
        .filter((key) => String(key).includes('Dörr'))
        .sort((a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10));
    const sectionKeys = keys
        .filter((key) => !String(key).includes('Dörr'))
        .sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a));

    const rows: SketchReviewRow[] = [...doorKeys, ...sectionKeys].map((size) => ({
        id: size,
        label: String(size).includes('Dörr') ? size : `ClickitUp Sektion ${size} mm`,
        qty: counts[size],
        tone: 'default'
    }));

    if (slimlineCount > 0) {
        rows.push({
            id: 'slimline',
            label: 'Slimline (stöd för dörr)',
            qty: slimlineCount,
            tone: 'secondary'
        });
    }

    if (stodbenCount > 0) {
        rows.push({
            id: 'stodben',
            label: 'Stödben 45° (för fri ände)',
            qty: stodbenCount,
            tone: 'secondary'
        });
    }

    const parasolCounts = parasols.reduce<Record<string, number>>((acc, parasol) => {
        const label = parasol.label || 'Okänd modell';
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {});

    Object.keys(parasolCounts).sort().forEach((label) => {
        rows.push({
            id: `parasol-${label}`,
            label: `Parasoll ${label}`,
            qty: parasolCounts[label],
            tone: 'default'
        });
    });

    if (fiestaCount > 0) {
        rows.push({
            id: 'fiesta',
            label: 'Fiesta 70 cm',
            qty: fiestaCount,
            tone: 'default'
        });
    }

    return rows;
}

function buildLegacyReviewState({
    counts,
    totalGlassLength,
    slimlineCount,
    stodbenCount,
    hasInvalidEdges,
    invalidEdges,
    autoAdjustedEdges,
    parasols = [],
    fiestaItems = [],
    parasolWarnings = []
}: SketchBomProps): SketchReviewState {
    const recommendationWarnings = parasolWarnings.map((warning, index) => ({
        id: warning.id || `parasol-warning-${index}`,
        level: 'warning' as const,
        code: 'PARASOL_OVERLAP',
        edge: 'front' as const,
        text: warning.text
    }));

    return {
        health: hasInvalidEdges ? 'blocked' : recommendationWarnings.length > 0 || autoAdjustedEdges.length > 0 ? 'attention' : 'ready',
        healthLabel: hasInvalidEdges ? 'Kräver kontroll' : recommendationWarnings.length > 0 || autoAdjustedEdges.length > 0 ? 'Behöver översyn' : 'Redo',
        healthText: hasInvalidEdges
            ? `Ogiltig kant: ${invalidEdges.map(([edge]) => EDGE_LABELS[edge] || edge).join(', ')}.`
            : 'Material och exportkontroller ser bra ut.',
        criticalWarnings: hasInvalidEdges
            ? invalidEdges.map(([edge], index) => ({
                id: `invalid-${edge}-${index}`,
                level: 'critical' as const,
                code: 'INVALID_EDGE',
                edge,
                text: `Ogiltig kant: ${EDGE_LABELS[edge] || edge}.`
            }))
            : [],
        recommendationWarnings,
        suggestions: [],
        invalidEdges,
        autoAdjustedEdges,
        parasolWarnings,
        materialRows: buildLegacyReviewRows(counts, slimlineCount, stodbenCount, parasols, fiestaItems.length),
        totalGlassLength,
        sectionCount: Object.values(counts).reduce((sum, value) => sum + value, 0),
        parasolCount: parasols.length,
        fiestaCount: fiestaItems.length,
        exportReady: Object.keys(counts).length > 0 || parasols.length > 0 || fiestaItems.length > 0,
        hasInvalidEdges
    };
}

export function SketchReviewPanel({
    reviewState,
    canExportToQuote = true,
    onApplySuggestion,
    onHoverSuggestion,
    onExport,
    onExportImage
}: SketchReviewPanelProps) {
    const exportDisabled = !reviewState.exportReady || !canExportToQuote;
    const exportButtonTitle = !canExportToQuote
        ? 'Du har inte behörighet att exportera till offert.'
        : undefined;

    return (
        <div className="glass-panel rounded-2xl p-4 space-y-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-text-primary m-0">Granska & exportera</h3>
                    <p className="text-sm text-text-secondary m-0">{reviewState.healthText}</p>
                </div>
                <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${reviewState.health === 'blocked'
                        ? 'border-danger/50 text-danger bg-danger/10'
                        : reviewState.health === 'attention'
                            ? 'border-amber-400/40 text-amber-200 bg-amber-500/10'
                            : 'border-success/40 text-success bg-success/10'
                        }`}
                >
                    {reviewState.healthLabel}
                </span>
            </div>

            {reviewState.criticalWarnings.length > 0 && (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 space-y-2">
                    <p className="text-sm font-semibold text-danger m-0">Blockerande problem</p>
                    <ul className="m-0 pl-5 space-y-1 text-sm text-danger">
                        {reviewState.criticalWarnings.map((warning) => (
                            <li key={warning.id}>{warning.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            {(reviewState.recommendationWarnings.length > 0 || reviewState.autoAdjustedEdges.length > 0) && (
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-200 m-0">Varning (Parasoll)</p>
                    {reviewState.recommendationWarnings.length > 0 && (
                        <ul className="m-0 pl-5 space-y-1 text-sm text-amber-100">
                            {reviewState.recommendationWarnings.map((warning) => (
                                <li key={warning.id}>{warning.text}</li>
                            ))}
                        </ul>
                    )}
                    {reviewState.autoAdjustedEdges.length > 0 && (
                        <p className="text-sm text-amber-100 m-0">
                            Autojustering:{' '}
                            {reviewState.autoAdjustedEdges
                                .map(([edge, diag]) => `${EDGE_LABELS[edge] || edge} ${diag.requestedDoorSize} → ${diag.resolvedDoorSize} mm`)
                                .join(', ')}
                        </p>
                    )}
                </div>
            )}

            {reviewState.suggestions.length > 0 && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-text-primary m-0">Föreslagna justeringar</h4>
                        <p className="text-xs text-text-secondary m-0">Applicera snabba förbättringar direkt från granskningen.</p>
                    </div>
                    <div className="space-y-2">
                        {reviewState.suggestions.slice(0, 6).map((suggestion) => (
                            <div
                                key={suggestion.id}
                                className="glass-card p-3 space-y-2 hover:scale-[1.02] hover:border-amber-500/40 hover:shadow-[0_8px_20px_-6px_rgba(245,158,11,0.2)]"
                                onMouseEnter={() => onHoverSuggestion?.(suggestion)}
                                onMouseLeave={() => onHoverSuggestion?.(null)}
                            >
                                <p className="text-sm text-text-primary m-0">{suggestion.text}</p>
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
                </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-panel-border bg-input-bg/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-text-secondary m-0">Glaslängd</p>
                    <p className="text-lg font-semibold text-text-primary mt-2 mb-0">
                        {(reviewState.totalGlassLength / 1000).toLocaleString('sv-SE', { minimumFractionDigits: 1 })} löpmeter
                    </p>
                </div>
                <div className="rounded-xl border border-panel-border bg-input-bg/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-text-secondary m-0">Sektioner</p>
                    <p className="text-lg font-semibold text-text-primary mt-2 mb-0">{reviewState.sectionCount} st</p>
                </div>
                <div className="rounded-xl border border-panel-border bg-input-bg/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-text-secondary m-0">Parasoll</p>
                    <p className="text-lg font-semibold text-text-primary mt-2 mb-0">{reviewState.parasolCount} st</p>
                </div>
                <div className="rounded-xl border border-panel-border bg-input-bg/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-text-secondary m-0">Fiesta</p>
                    <p className="text-lg font-semibold text-text-primary mt-2 mb-0">{reviewState.fiestaCount} st</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-text-primary m-0">Materialförteckning</h4>
                    <p className="text-xs text-text-secondary m-0">Sammanställningen uppdateras automatiskt när du ändrar ritningen.</p>
                </div>

                {reviewState.materialRows.length > 0 ? (
                    <ul className="list-none p-0 m-0 space-y-2">
                        {reviewState.materialRows.map((row) => (
                            <li
                                key={row.id}
                                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${row.tone === 'secondary'
                                    ? 'border-panel-border bg-input-bg/40 text-text-secondary'
                                    : 'border-panel-border bg-input-bg/60 text-text-primary'
                                    }`}
                            >
                                <span>{row.label}</span>
                                <span className="font-bold">{row.qty} st</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-text-secondary m-0 rounded-xl border border-dashed border-panel-border px-4 py-5">
                        Inga sektioner eller objekt beräknade ännu.
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-3 pt-1">
                <button
                    onClick={onExport}
                    disabled={exportDisabled}
                    title={exportButtonTitle}
                    className="w-full py-3 bg-primary text-white border-none rounded-lg font-semibold cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    {!canExportToQuote
                        ? 'Export till Offert ej tillgänglig'
                        : (reviewState.hasInvalidEdges ? 'Exportera till offert (bekräfta varningar)' : 'Exportera till offert')}
                </button>
                <button
                    onClick={onExportImage}
                    disabled={!reviewState.exportReady}
                    className="w-full py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    Ladda ner Bild
                </button>
            </div>
        </div>
    );
}

export function SketchBom(props: SketchBomProps) {
    const reviewState = buildLegacyReviewState(props);
    return (
        <SketchReviewPanel
            reviewState={reviewState}
            canExportToQuote={props.canExportToQuote}
            onExport={props.onExport}
            onExportImage={props.onExportImage}
        />
    );
}
