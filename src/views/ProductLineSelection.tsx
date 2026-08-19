import React, { useEffect } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import { createContractingWorkRow } from '../components/features/ContractingWorkEditor';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import type { ProductLineSelectionProps, RetailerRecord } from '../types/contracts';

export interface ProductLineOption {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    retailerDiscountPct: number | null;
}

function getProductLineDescription(lineId: string): string {
    if (lineId === 'BaHaMa') {
        return 'Premiumparasoller';
    }

    if (lineId === 'ClickitUp') {
        return 'Höj- och sänkbara glaspartier.';
    }

    if (lineId === 'ClickitUpFixed') {
        return 'Fasta glaspartier.';
    }

    return 'Premium biogas';
}

export function buildProductLineOptions(
    isRetailer: boolean,
    retailer: RetailerRecord | null
): ProductLineOption[] {
    const visibleLineIds = getCatalogLineIds().filter((lineId) => {
        if (!isRetailer) {
            return true;
        }

        return retailer?.productLines?.[lineId]?.enabled === true;
    });

    return visibleLineIds.map((lineId) => {
        const retailerConfig = retailer?.productLines?.[lineId];

        return {
            id: lineId,
            name: getCatalogLineName(lineId) || lineId,
            description: getProductLineDescription(lineId),
            enabled: true,
            retailerDiscountPct: isRetailer ? (Number(retailerConfig?.discountPct) || 0) : null
        };
    });
}

export function getFirstEnabledProductLineId(productLines: ProductLineOption[]): string | null {
    return productLines.find((line) => line.enabled)?.id || null;
}

export function ProductLineSelection({ onNext }: ProductLineSelectionProps) {
    const { state, dispatch } = useQuote();
    const { accessLevel, isRetailer, retailer } = useAuth();
    const { selectedLines } = state;
    const contractingWork = state.contractingWork || {
        enabled: false,
        projectName: '',
        rows: [],
        ata: { enabled: false, percent: 15 },
        margin: { enabled: false, percent: 15 }
    };
    const productLines = buildProductLineOptions(isRetailer, retailer);
    const hasRetailerLines = !isRetailer || productLines.length > 0;
    const selectedLineId = selectedLines[0] || '';
    const selectedLine = productLines.find((line) => line.id === selectedLineId) || null;
    const nextRetailerDiscount = selectedLine?.retailerDiscountPct ?? 0;
    const canSelectContractingWork = !isRetailer && (accessLevel === 'full' || accessLevel === 'quote-only');
    const contractingWorkEnabled = canSelectContractingWork && contractingWork.enabled;
    const hasSelectedQuoteContent = selectedLines.length > 0 || contractingWorkEnabled;
    const canContinue = hasSelectedQuoteContent;

    const toggleLine = (lineId: string): void => {
        if (isRetailer) {
            const selectedRetailerLine = productLines.find((line) => line.id === lineId);
            if (!selectedRetailerLine?.enabled) {
                return;
            }

            dispatch({ type: 'SET_SELECTED_LINES', payload: [lineId] });
            return;
        }

        let nextSelection: string[];
        if (selectedLines.includes(lineId)) {
            nextSelection = selectedLines.filter((id) => id !== lineId);
        } else {
            nextSelection = [...selectedLines, lineId];
        }

        dispatch({ type: 'SET_SELECTED_LINES', payload: nextSelection });
    };

    const toggleContractingWork = (): void => {
        if (!canSelectContractingWork) {
            return;
        }

        const enabled = !contractingWork.enabled;
        dispatch({
            type: 'SET_CONTRACTING_WORK',
            payload: {
                ...contractingWork,
                enabled,
                rows: enabled && contractingWork.rows.length === 0
                    ? [createContractingWorkRow()]
                    : contractingWork.rows
            }
        });
    };

    const handleNext = (): void => {
        if (!canContinue) {
            return;
        }

        if (isRetailer && selectedLines.length === 1 && retailer) {
            const selectedRetailerId = selectedLines[0];
            const lineConfig = retailer.productLines?.[selectedRetailerId];
            if (lineConfig) {
                const discountPct = Number(lineConfig.discountPct) || 0;
                dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: discountPct });
            }
        }

        onNext();
    };

    useEffect(() => {
        if (!isRetailer) {
            return;
        }

        const firstEnabledLineId = getFirstEnabledProductLineId(productLines);
        if (!firstEnabledLineId) {
            if (selectedLines.length > 0) {
                dispatch({ type: 'SET_SELECTED_LINES', payload: [] });
            }
            return;
        }

        const hasValidSelection = selectedLines.length === 1 && productLines.some((line) => (
            line.id === selectedLines[0] && line.enabled
        ));

        if (!hasValidSelection) {
            dispatch({ type: 'SET_SELECTED_LINES', payload: [firstEnabledLineId] });
        }
    }, [dispatch, isRetailer, productLines, selectedLines]);

    return (
        <div className="mx-auto max-w-[1200px] animate-fade-in">
            <PageHeader
                eyebrow="Steg 1 av 4"
                title="Välj offertinnehåll"
                description="Välj vad offerten ska innehålla."
            />

            {isRetailer && (
                <Panel className="mb-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="p-5 sm:p-6">
                            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                                Avtalat sortiment
                            </p>
                            <h2 className="mb-0 mt-2 text-xl font-semibold text-text">
                                {retailer?.name || 'Er återförsäljarprofil'}
                            </h2>
                            <p className="mb-0 mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                                Här visas de produktlinjer som ingår i ert avtal. När du fortsätter appliceras
                                linjens avtalade standardrabatt automatiskt i prissteget.
                            </p>
                        </div>

                        {selectedLine && (
                            <div className="m-5 rounded-panel border border-action/30 bg-action-soft px-4 py-3 text-sm text-action-soft-text sm:m-6 sm:ml-0">
                                <div className="font-semibold text-text">{selectedLine.name}</div>
                                <div className="mt-1">
                                    Förhandsvisning: {nextRetailerDiscount}% återförsäljarrabatt
                                </div>
                            </div>
                        )}
                    </div>
                </Panel>
            )}

            {isRetailer && !hasRetailerLines ? (
                <div className="mb-6 rounded-panel border border-warning-border bg-warning-bg p-5 text-sm text-warning-text">
                    Inga produktlinjer är tillgängliga för ert återförsäljarkonto ännu. Kontakta BRIXX om ni behöver
                    tillgång till fler produktlinjer.
                </div>
            ) : (
                <Panel
                    className="mb-6"
                    title="Välj innehåll"
                    description="Du kan kombinera flera produktlinjer och entreprenadarbete i samma offert."
                >
                    <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-3">
                        {productLines.map((line) => {
                            const isSelected = selectedLines.includes(line.id);

                            return (
                                <label
                                    key={line.id}
                                    className={`flex cursor-pointer items-start gap-4 rounded-panel border p-5 transition-colors ${
                                        isSelected
                                            ? 'border-action bg-action-soft'
                                            : 'border-border bg-surface hover:border-action/60 hover:bg-surface-hover'
                                    }`}
                                >
                                    <input
                                        type={isRetailer ? 'radio' : 'checkbox'}
                                        name={isRetailer ? 'productLine' : line.id}
                                        checked={isSelected}
                                        onChange={() => toggleLine(line.id)}
                                        className="mt-1 h-5 w-5 cursor-pointer accent-action"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="m-0 text-base font-semibold text-text">{line.name}</h3>
                                            {line.retailerDiscountPct !== null && (
                                                <StatusChip tone="success">
                                                    {line.retailerDiscountPct}% rabatt
                                                </StatusChip>
                                            )}
                                        </div>
                                        <p className="mb-0 mt-2 text-sm leading-relaxed text-text-muted">{line.description}</p>
                                    </div>
                                </label>
                            );
                        })}

                        {canSelectContractingWork && (
                            <label
                                data-testid="contracting-work-option"
                                className={`flex cursor-pointer items-start gap-4 rounded-panel border p-5 transition-colors ${
                                    contractingWorkEnabled
                                        ? 'border-action bg-action-soft'
                                        : 'border-border bg-surface hover:border-action/60 hover:bg-surface-hover'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={contractingWorkEnabled}
                                    onChange={toggleContractingWork}
                                    aria-describedby="contracting-work-option-description"
                                    className="mt-1 h-5 w-5 cursor-pointer accent-action"
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="m-0 text-base font-semibold text-text">Entreprenadarbete</h3>
                                    <p id="contracting-work-option-description" className="mb-0 mt-2 text-sm leading-relaxed text-text-muted">
                                        Fria arbetspaket med egen omfattning, enhet och pris exkl. moms.
                                    </p>
                                </div>
                            </label>
                        )}
                    </div>
                </Panel>
            )}

            <div className="mt-6 flex justify-end border-t border-border pt-6">
                <Button
                    onClick={handleNext}
                    disabled={!canContinue}
                    size="lg"
                    variant="primary"
                >
                    Fortsätt till konfiguration
                </Button>
            </div>
        </div>
    );
}
