import { catalogData } from './catalog';
import type {
    BuilderCatalogLineData,
    CatalogLineData,
    CatalogLineId,
    GridCatalogLineData
} from '../types/contracts';

function hasCatalogLine(lineId: string): lineId is CatalogLineId {
    return Object.prototype.hasOwnProperty.call(catalogData, lineId);
}

export function getCatalogLine(lineId: string): CatalogLineData | null {
    return hasCatalogLine(lineId) ? catalogData[lineId] : null;
}

export function getBuilderCatalogLine(lineId: string): BuilderCatalogLineData | null {
    const lineData = getCatalogLine(lineId);
    return lineData?.type === 'builder' ? lineData : null;
}

export function getGridCatalogLine(lineId: string): GridCatalogLineData | null {
    const lineData = getCatalogLine(lineId);
    return lineData?.type === 'grid' ? lineData : null;
}

export function getCatalogLineName(lineId: string): string | null {
    return getCatalogLine(lineId)?.name || null;
}

export function getCatalogLineIds(): CatalogLineId[] {
    return Object.keys(catalogData);
}
