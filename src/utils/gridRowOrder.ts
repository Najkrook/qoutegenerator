import type { QuoteTotalsRowSource } from '../types/contracts';

export type GridRowSource = Extract<
    QuoteTotalsRowSource,
    { type: 'grid' | 'grid-addon' | 'grid-custom-addon' | 'grid-custom-item' }
>;

export function isGridRowSource(source: QuoteTotalsRowSource): source is GridRowSource {
    return source.type === 'grid'
        || source.type === 'grid-addon'
        || source.type === 'grid-custom-addon'
        || source.type === 'grid-custom-item';
}

export function getGridRowOrderKey(source: GridRowSource): string {
    switch (source.type) {
        case 'grid':
            return `grid:${source.lineId}:${source.key}`;
        case 'grid-addon':
            return `grid-addon:${source.lineId}:${source.addonId}`;
        case 'grid-custom-addon':
            return `grid-custom-addon:${source.lineId}:${source.categoryId}:${source.rowId}`;
        case 'grid-custom-item':
            return `grid-custom-item:${source.lineId}:${source.rowId}`;
    }
}
