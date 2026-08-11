import type { GridLineSelection, GridSelections } from '../types/contracts';

export function hasConfiguredGridSelection(
    selection: Partial<GridLineSelection> | null | undefined
): boolean {
    return Object.keys(selection?.items || {}).length > 0
        || Object.keys(selection?.addons || {}).length > 0
        || (selection?.customItems || []).length > 0
        || Object.values(selection?.customAddonsByCategory || {}).some((rows) => rows.length > 0);
}

export function hasConfiguredGridSelections(
    selections: GridSelections | null | undefined
): boolean {
    return Object.values(selections || {}).some(hasConfiguredGridSelection);
}
