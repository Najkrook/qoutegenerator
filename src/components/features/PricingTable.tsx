import React, { type ChangeEvent, type DragEvent, useState } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';
import { catalogData } from '../../data/catalog';
import { computeQuoteTotals } from '../../services/calculationEngine';
import { translateQuoteTotalsRowModel } from '../../services/exportLocalization';
import { DEFAULT_UNKNOWN_ADDON_NAME, formatAddonLabel } from '../../utils/addonLabels';
import { buildEffectiveGridSelections } from '../../utils/gridAutoScale';
import type {
    BuilderAddon,
    BuilderItem,
    GridCatalogLineData,
    PricingEffectiveGridAddonsMap,
    QuoteTotalsRow,
    QuoteTotalsRowSource
} from '../../types/contracts';

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) {
        return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    return nextItems;
}

export type PricingTableDropPosition = 'before' | 'after';

type PricingTableBuilderRowSource = Extract<
    QuoteTotalsRowSource,
    { type: 'builder' | 'builder-addon' | 'builder-custom-addon' }
>;

interface PricingTableDragState {
    rowKey: string;
    source: PricingTableBuilderRowSource;
}

interface PricingTableDropTarget {
    rowKey: string;
    position: PricingTableDropPosition;
}

export function isPricingTableDropAllowed(
    draggedSource: PricingTableBuilderRowSource,
    targetSource: QuoteTotalsRowSource
): boolean {
    if (draggedSource.type === 'builder') {
        return targetSource.type === 'builder' && targetSource.itemId !== draggedSource.itemId;
    }

    return (
        (targetSource.type === 'builder-addon' || targetSource.type === 'builder-custom-addon') &&
        targetSource.itemId === draggedSource.itemId
    );
}

export function reorderBuilderItemsByDrop(
    items: BuilderItem[],
    sourceItemId: string,
    targetItemId: string,
    position: PricingTableDropPosition
): BuilderItem[] {
    const sourceIndex = items.findIndex((item) => item.id === sourceItemId);
    const targetIndex = items.findIndex((item) => item.id === targetItemId);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return items;
    }

    const sourceItem = items[sourceIndex];
    const remainingItems = items.filter((item) => item.id !== sourceItemId);
    let insertIndex = remainingItems.findIndex((item) => item.id === targetItemId);
    if (insertIndex === -1) {
        return items;
    }

    if (position === 'after') {
        insertIndex += 1;
    }

    remainingItems.splice(insertIndex, 0, sourceItem);

    return remainingItems.every((item, index) => item === items[index]) ? items : remainingItems;
}

export function reorderBuilderAddonsByDrop<T extends BuilderAddon>(
    addons: T[],
    sourceIndex: number,
    targetIndex: number,
    position: PricingTableDropPosition
): T[] {
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= addons.length || targetIndex >= addons.length) {
        return addons;
    }

    let nextIndex = targetIndex;
    if (position === 'after') {
        nextIndex += 1;
    }
    if (sourceIndex < nextIndex) {
        nextIndex -= 1;
    }

    return moveArrayItem(addons, sourceIndex, nextIndex);
}

function findBuilderAddonDefinition(modelData: any, addonId: string) {
    if (!modelData || !addonId) return null;

    if (Array.isArray(modelData.addonCategories)) {
        for (const category of modelData.addonCategories) {
            const match = (category.items || []).find((item: { id: string }) => item.id === addonId);
            if (match) return match;
        }
    }

    if (Array.isArray(modelData.addons)) {
        return modelData.addons.find((item: { id: string }) => item.id === addonId) || null;
    }

    return null;
}

function getRowKey(row: QuoteTotalsRow, index: number): string {
    switch (row.source.type) {
        case 'builder':
            return `builder:${row.source.itemId}`;
        case 'builder-addon':
            return `builder-addon:${row.source.itemId}:${row.source.addonId}`;
        case 'builder-custom-addon':
            return `builder-custom-addon:${row.source.itemId}:${row.source.rowId}`;
        case 'grid':
            return `grid:${row.source.lineId}:${row.source.key}`;
        case 'grid-addon':
            return `grid-addon:${row.source.lineId}:${row.source.addonId}`;
        case 'grid-custom-addon':
            return `grid-custom-addon:${row.source.lineId}:${row.source.categoryId}:${row.source.rowId}`;
        case 'grid-custom-item':
            return `grid-custom-item:${row.source.lineId}:${row.source.rowId}`;
        case 'custom':
            return `custom:${row.source.index}`;
        default:
            return `row:${index}`;
    }
}

export function clampPricingRowDiscount(value: string, isRetailer: boolean, retailerDiscountPct: number): number {
    const parsed = Number.parseFloat(value);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    const bounded = Math.max(0, Math.min(100, normalized));
    return isRetailer ? Math.min(bounded, retailerDiscountPct) : bounded;
}

export function PricingTable() {
    const { state, dispatch } = useQuote();
    const { isRetailer, retailer } = useAuth();
    const [displayNameDrafts, setDisplayNameDrafts] = useState<Record<string, string>>({});
    const [dragState, setDragState] = useState<PricingTableDragState | null>(null);
    const [dropTarget, setDropTarget] = useState<PricingTableDropTarget | null>(null);
    const selectedLineId = state.selectedLines?.[0] || '';
    const retailerDiscountPct = isRetailer
        ? (Number(retailer?.productLines?.[selectedLineId]?.discountPct) || 0)
        : 0;
    const { totals, grossTotalSek, totalDiscountSek, finalTotalSek } = computeQuoteTotals({
        state,
        catalogData
    });

    const updateBuilderItems = (nextItems: BuilderItem[]): void => {
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: nextItems });
    };

    const isCustomBuilderAddon = (
        addon: BuilderAddon
    ): addon is Extract<BuilderAddon, { isCustom: true }> => 'isCustom' in addon && addon.isCustom === true;

    const getBuilderItemIndex = (itemId: string): number => state.builderItems.findIndex((item) => item.id === itemId);

    const getBuilderAddonPosition = (
        source: Extract<QuoteTotalsRowSource, { type: 'builder-addon' | 'builder-custom-addon' }>
    ): { itemIndex: number; addonIndex: number } | null => {
        const itemIndex = getBuilderItemIndex(source.itemId);
        if (itemIndex === -1) {
            return null;
        }

        const item = state.builderItems[itemIndex];
        const addonIndex = item.addons.findIndex((addon) => {
            if (source.type === 'builder-addon') {
                return !isCustomBuilderAddon(addon) && addon.id === source.addonId;
            }

            return isCustomBuilderAddon(addon) && addon.id === source.rowId;
        });

        return addonIndex === -1 ? null : { itemIndex, addonIndex };
    };

    const getEditableDisplayName = (source: QuoteTotalsRowSource): string => {
        if (source.type === 'builder') {
            return state.builderItems.find((item) => item.id === source.itemId)?.displayName || '';
        }

        if (source.type === 'builder-addon' || source.type === 'builder-custom-addon') {
            const position = getBuilderAddonPosition(source);
            if (!position) return '';
            return state.builderItems[position.itemIndex].addons[position.addonIndex].displayName || '';
        }

        return '';
    };

    const updateDisplayNameDraft = (rowKey: string, value: string): void => {
        setDisplayNameDrafts((currentDrafts) => ({
            ...currentDrafts,
            [rowKey]: value
        }));
    };

    const clearDisplayNameDraft = (rowKey: string): void => {
        setDisplayNameDrafts((currentDrafts) => {
            if (!Object.prototype.hasOwnProperty.call(currentDrafts, rowKey)) {
                return currentDrafts;
            }

            const nextDrafts = { ...currentDrafts };
            delete nextDrafts[rowKey];
            return nextDrafts;
        });
    };

    const clearDragState = (): void => {
        setDragState(null);
        setDropTarget(null);
    };

    const getDefaultBuilderLabel = (source: QuoteTotalsRowSource): string => {
        if (source.type === 'builder') {
            const item = state.builderItems.find((builderItem) => builderItem.id === source.itemId);
            return `${item?.line || ''} ${item?.model || ''}`.trim();
        }

        if (source.type === 'builder-addon') {
            const position = getBuilderAddonPosition(source);
            if (!position) {
                return formatAddonLabel(source.addonId, DEFAULT_UNKNOWN_ADDON_NAME);
            }

            const item = state.builderItems[position.itemIndex];
            const lineData = catalogData[item.line];
            const modelData = lineData?.type === 'builder' ? lineData.models?.[item.model] : null;
            const addonDef = findBuilderAddonDefinition(modelData, source.addonId);
            return formatAddonLabel(addonDef?.name || source.addonId, DEFAULT_UNKNOWN_ADDON_NAME);
        }

        if (source.type === 'builder-custom-addon') {
            const position = getBuilderAddonPosition(source);
            if (!position) {
                return formatAddonLabel('');
            }

            const addon = state.builderItems[position.itemIndex].addons[position.addonIndex];
            let customAddonName = '';
            if (isCustomBuilderAddon(addon)) {
                customAddonName = String(addon.name || '').trim();
            }
            return formatAddonLabel(customAddonName);
        }

        return '';
    };

    const getDisplayNameInputValue = (row: QuoteTotalsRow, rowKey: string): string => {
        if (Object.prototype.hasOwnProperty.call(displayNameDrafts, rowKey)) {
            return displayNameDrafts[rowKey];
        }

        return getEditableDisplayName(row.source) || row.model;
    };

    const handleDisplayNameChange = (row: QuoteTotalsRow, rowKey: string, value: string): void => {
        updateDisplayNameDraft(rowKey, value);

        const source = row.source;
        const defaultLabel = getDefaultBuilderLabel(row.source) || row.model;
        const normalizedValue = value.trim();
        const normalizedDefaultLabel = String(defaultLabel || '').trim();
        const displayName = normalizedValue === '' || normalizedValue === normalizedDefaultLabel
            ? undefined
            : value;

        if (source.type === 'builder') {
            updateBuilderItems(state.builderItems.map((item) => (
                item.id === source.itemId ? { ...item, displayName } : item
            )));
            return;
        }

        if (source.type === 'builder-addon') {
            updateBuilderItems(state.builderItems.map((item) => {
                if (item.id !== source.itemId) {
                    return item;
                }

                return {
                    ...item,
                    addons: item.addons.map((addon) => (
                        !isCustomBuilderAddon(addon) && addon.id === source.addonId
                            ? { ...addon, displayName }
                            : addon
                    ))
                };
            }));
            return;
        }

        if (source.type === 'builder-custom-addon') {
            updateBuilderItems(state.builderItems.map((item) => {
                if (item.id !== source.itemId) {
                    return item;
                }

                return {
                    ...item,
                    addons: item.addons.map((addon) => (
                        isCustomBuilderAddon(addon) && addon.id === source.rowId
                            ? { ...addon, displayName }
                            : addon
                    ))
                };
            }));
        }
    };

    const isEditableBuilderRow = (source: QuoteTotalsRowSource): boolean => (
        source.type === 'builder' || source.type === 'builder-addon' || source.type === 'builder-custom-addon'
    );

    const getDropPosition = (event: DragEvent<HTMLTableRowElement>): PricingTableDropPosition => {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    };

    const handleDragStart = (rowKey: string, source: PricingTableBuilderRowSource) => (event: DragEvent<HTMLElement>) => {
        if (isRetailer) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', rowKey);
        setDragState({ rowKey, source });
        setDropTarget(null);
    };

    const handleDragOver = (rowKey: string, source: QuoteTotalsRowSource) => (event: DragEvent<HTMLTableRowElement>) => {
        if (!dragState || isRetailer || !isPricingTableDropAllowed(dragState.source, source)) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const position = getDropPosition(event);
        setDropTarget((currentTarget) => (
            currentTarget?.rowKey === rowKey && currentTarget.position === position
                ? currentTarget
                : { rowKey, position }
        ));
    };

    const handleDragLeave = (rowKey: string) => (): void => {
        setDropTarget((currentTarget) => (currentTarget?.rowKey === rowKey ? null : currentTarget));
    };

    const handleDrop = (source: QuoteTotalsRowSource) => (event: DragEvent<HTMLTableRowElement>) => {
        if (!dragState || isRetailer || !isPricingTableDropAllowed(dragState.source, source)) {
            return;
        }

        event.preventDefault();
        const position = getDropPosition(event);

        if (dragState.source.type === 'builder' && source.type === 'builder') {
            const nextItems = reorderBuilderItemsByDrop(
                state.builderItems,
                dragState.source.itemId,
                source.itemId,
                position
            );

            if (nextItems !== state.builderItems) {
                updateBuilderItems(nextItems);
            }

            clearDragState();
            return;
        }

        if (
            (dragState.source.type === 'builder-addon' || dragState.source.type === 'builder-custom-addon') &&
            (source.type === 'builder-addon' || source.type === 'builder-custom-addon')
        ) {
            const sourcePosition = getBuilderAddonPosition(dragState.source);
            const targetPosition = getBuilderAddonPosition(source);

            if (!sourcePosition || !targetPosition || sourcePosition.itemIndex !== targetPosition.itemIndex) {
                clearDragState();
                return;
            }

            const item = state.builderItems[sourcePosition.itemIndex];
            const nextAddons = reorderBuilderAddonsByDrop(
                item.addons,
                sourcePosition.addonIndex,
                targetPosition.addonIndex,
                position
            );

            if (nextAddons !== item.addons) {
                updateBuilderItems(state.builderItems.map((builderItem, itemIndex) => (
                    itemIndex === sourcePosition.itemIndex
                        ? { ...builderItem, addons: nextAddons }
                        : builderItem
                )));
            }
        }

        clearDragState();
    };

    const handleDiscountChange = (source: QuoteTotalsRowSource, value: string): void => {
        const discountPct = clampPricingRowDiscount(value, isRetailer, retailerDiscountPct);

        if (source.type === 'builder') {
            const nextItems = state.builderItems.map((item) => (
                item.id === source.itemId ? { ...item, discountPct } : item
            ));
            updateBuilderItems(nextItems);
            return;
        }

        if (source.type === 'builder-addon') {
            const nextItems = state.builderItems.map((item) => {
                if (item.id === source.itemId) {
                    const nextAddons = item.addons.map((addon) => (
                        !isCustomBuilderAddon(addon) && addon.id === source.addonId ? { ...addon, discountPct } : addon
                    ));
                    return { ...item, addons: nextAddons };
                }
                return item;
            });
            updateBuilderItems(nextItems);
            return;
        }

        if (source.type === 'builder-custom-addon') {
            const nextItems = state.builderItems.map((item) => {
                if (item.id !== source.itemId) {
                    return item;
                }

                const nextAddons = item.addons.map((addon) => (
                    isCustomBuilderAddon(addon) && addon.id === source.rowId
                        ? { ...addon, discountPct }
                        : addon
                ));

                return { ...item, addons: nextAddons };
            });
            updateBuilderItems(nextItems);
            return;
        }

        if (source.type === 'grid') {
            const lineSelections = state.gridSelections[source.lineId];
            if (!lineSelections) return;

            const nextSelections = {
                ...state.gridSelections,
                [source.lineId]: {
                    ...lineSelections,
                    items: {
                        ...lineSelections.items,
                        [source.key]: { ...lineSelections.items[source.key], discountPct }
                    }
                }
            };
            dispatch({ type: 'SET_GRID_SELECTIONS', payload: nextSelections });
            return;
        }

        if (source.type === 'grid-addon') {
            const lineSelections = state.gridSelections[source.lineId] || { items: {}, addons: {}, customAddonsByCategory: {} };
            const lineData = catalogData[source.lineId];
            const gridLineData: GridCatalogLineData | null = lineData?.type === 'grid' ? lineData : null;
            const effectiveSelections = buildEffectiveGridSelections(gridLineData || undefined, lineSelections, {
                globalDiscountPct: state.globalDiscountPct
            });
            const existingAddon = lineSelections.addons?.[source.addonId];
            const effectiveAddons: PricingEffectiveGridAddonsMap = effectiveSelections.addons;
            const effectiveAddon = effectiveAddons[source.addonId];
            const nextSelections = {
                ...state.gridSelections,
                [source.lineId]: {
                    ...lineSelections,
                    addons: {
                        ...lineSelections.addons,
                        [source.addonId]: {
                            ...(existingAddon || {}),
                            qty: existingAddon?.qty ?? effectiveAddon?.qty ?? 0,
                            syncMode: existingAddon?.syncMode ?? effectiveAddon?.syncMode ?? 'manual',
                            discountPct,
                            discountSyncMode: 'manual' as const
                        }
                    }
                }
            };
            dispatch({ type: 'SET_GRID_SELECTIONS', payload: nextSelections });
            return;
        }

        if (source.type === 'grid-custom-addon') {
            const lineSelections = state.gridSelections[source.lineId] || { items: {}, addons: {}, customAddonsByCategory: {} };
            const nextCustomAddonsByCategory = {
                ...(lineSelections.customAddonsByCategory || {}),
                [source.categoryId]: (lineSelections.customAddonsByCategory?.[source.categoryId] || []).map((row) => (
                    row.id === source.rowId ? { ...row, discountPct } : row
                ))
            };
            const nextSelections = {
                ...state.gridSelections,
                [source.lineId]: {
                    ...lineSelections,
                    customAddonsByCategory: nextCustomAddonsByCategory
                }
            };
            dispatch({ type: 'SET_GRID_SELECTIONS', payload: nextSelections });
            return;
        }

        if (source.type === 'custom') {
            const nextCosts = [...state.customCosts];
            nextCosts[source.index] = { ...nextCosts[source.index], discountPct };
            dispatch({ type: 'SET_CUSTOM_COSTS', payload: nextCosts });
        }
    };

    const formatSek = (value: number): string => Math.round(value).toLocaleString('sv-SE');

    const hasPriceUponRequest = totals.some((row) => row.priceUponRequest === true);

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto bg-panel-bg border border-panel-border rounded-lg shadow-inner">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                        <tr className="bg-black/20 text-[10px] uppercase font-bold text-text-secondary tracking-wider">
                            <th className="p-4 border-b border-panel-border">Modell/Beskrivning</th>
                            <th className="p-4 border-b border-panel-border">Storlek</th>
                            <th className="p-4 border-b border-panel-border text-right">Pris/enhet</th>
                            <th className="p-4 border-b border-panel-border text-center">Antal</th>
                            <th className="p-4 border-b border-panel-border text-right">Rek utpris</th>
                            <th className="p-4 border-b border-panel-border text-center">Rabatt %</th>
                            <th className="p-4 border-b border-panel-border text-right">Ert pris (SEK)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border/50">
                        {totals.map((row, index) => {
                            const editable = isEditableBuilderRow(row.source);
                            const builderSource = editable ? row.source as PricingTableBuilderRowSource : null;
                            const rowKey = getRowKey(row, index);
                            const displayNameValue = editable ? getDisplayNameInputValue(row, rowKey) : '';
                            const dropIndicatorPosition = dropTarget?.rowKey === rowKey ? dropTarget.position : null;
                            const dragHandleLabel = row.source.type === 'builder'
                                ? 'Dra och flytta produkt'
                                : 'Dra och flytta tillval';
                            const dragHandleClass = isRetailer
                                ? 'cursor-not-allowed opacity-40'
                                : 'cursor-grab active:cursor-grabbing hover:bg-white/10';
                            const dropIndicatorClass = dropIndicatorPosition === 'before'
                                ? 'border-t-2 border-primary'
                                : dropIndicatorPosition === 'after'
                                    ? 'border-b-2 border-primary'
                                    : '';
                            const isDraggedRow = dragState?.rowKey === rowKey;
                            const isReq = row.priceUponRequest === true;

                            return (
                                <tr
                                    key={rowKey}
                                    onDragOver={editable ? handleDragOver(rowKey, row.source) : undefined}
                                    onDragLeave={editable ? handleDragLeave(rowKey) : undefined}
                                    onDrop={editable ? handleDrop(row.source) : undefined}
                                    className={`hover:bg-white/[0.02] transition-colors ${row.isAddon ? 'bg-black/5' : ''} ${row.isCustom ? 'bg-secondary/5' : ''} ${isDraggedRow ? 'opacity-60' : ''}`}
                                >
                                    <td className={`p-4 text-sm ${dropIndicatorClass} ${row.isAddon ? 'pl-8 text-text-secondary italic' : 'font-medium'}`}>
                                        {editable ? (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    draggable={!isRetailer}
                                                    disabled={isRetailer}
                                                    onDragStart={builderSource ? handleDragStart(rowKey, builderSource) : undefined}
                                                    onDragEnd={clearDragState}
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border border-panel-border text-text-secondary transition-colors ${dragHandleClass}`}
                                                    aria-label={dragHandleLabel}
                                                >
                                                    <span className="grid grid-cols-2 gap-[3px]" aria-hidden="true">
                                                        {Array.from({ length: 6 }).map((_, dotIndex) => (
                                                            <span key={dotIndex} className="h-1 w-1 rounded-full bg-current" />
                                                        ))}
                                                    </span>
                                                </button>
                                                <input
                                                    type="text"
                                                    value={displayNameValue}
                                                    disabled={isRetailer}
                                                    onBlur={() => clearDisplayNameDraft(rowKey)}
                                                    onChange={(event: ChangeEvent<HTMLInputElement>) => handleDisplayNameChange(row, rowKey, event.target.value)}
                                                    className={`w-full bg-black/20 border border-panel-border rounded p-2 text-sm outline-none focus:border-primary placeholder:text-text-secondary ${
                                                        row.isAddon ? 'text-text-secondary italic' : 'text-text-primary font-medium'
                                                    } ${isRetailer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    aria-label="Redigera radnamn"
                                                />
                                            </div>
                                        ) : (
                                            translateQuoteTotalsRowModel(row, state.exportLanguage)
                                        )}
                                    </td>
                                    <td className={`p-4 text-sm text-text-secondary ${dropIndicatorClass}`}>{row.size}</td>
                                    <td className={`p-4 text-sm text-right text-text-secondary ${dropIndicatorClass}`}>
                                        {isReq ? 'Pris på förfrågan' : formatSek(row.unitPrice)}
                                    </td>
                                    <td className={`p-4 text-sm text-center font-medium ${dropIndicatorClass}`}>{row.qty}</td>
                                    <td className={`p-4 text-sm text-right text-text-secondary ${dropIndicatorClass}`}>
                                        {isReq ? 'Pris på förfrågan' : formatSek(row.gross)}
                                    </td>
                                    <td className={`p-4 text-center ${dropIndicatorClass}`}>
                                        {isReq ? (
                                            <span className="text-text-secondary italic text-xs">-</span>
                                        ) : (
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max={isRetailer ? retailerDiscountPct : 100}
                                                value={row.discountPct}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) => handleDiscountChange(row.source, event.target.value)}
                                                className={`w-16 text-center bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${row.discountPct > 0 ? 'text-primary' : ''}`}
                                            />
                                        )}
                                    </td>
                                    <td className={`p-4 text-sm text-right font-bold text-primary ${dropIndicatorClass}`}>
                                        {isReq ? 'Pris på förfrågan' : formatSek(row.net)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-black/40">
                        <tr className="border-t-2 border-panel-border">
                            <td colSpan={4} className="p-4 text-right font-semibold text-text-secondary uppercase text-xs">Summa brutto</td>
                            <td className="p-4 text-right font-medium text-text-secondary">{formatSek(grossTotalSek)} SEK</td>
                            <td colSpan={2}></td>
                        </tr>
                        <tr>
                            <td colSpan={4} className="p-4 text-right font-semibold text-text-secondary uppercase text-xs">Total rabatt</td>
                            <td colSpan={2} className="p-4 text-right font-medium text-danger">-{formatSek(totalDiscountSek)} SEK</td>
                            <td></td>
                        </tr>
                        <tr className="bg-primary/10">
                            <td colSpan={4} className="p-4 text-right font-bold text-lg uppercase">Totalt att betala (exkl. moms)</td>
                            <td colSpan={3} className="p-4 text-right font-black text-2xl text-primary">{formatSek(finalTotalSek)} SEK</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {hasPriceUponRequest && (
                <p className="text-xs text-text-secondary italic text-right px-1">
                    * Totalsumman exkluderar artiklar med pris på förfrågan
                </p>
            )}
        </div>
    );
}
