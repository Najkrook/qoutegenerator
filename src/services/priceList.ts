import type {
    CatalogData,
    CatalogLineData,
    RetailerRecord
} from '../types/contracts';

export type PriceListEntryKind = 'product' | 'addon';

export interface PriceListEntry {
    id: string;
    categoryName: string;
    currency: string;
    kind: PriceListEntryKind;
    lineId: string;
    lineName: string;
    name: string;
    priceUponRequest: boolean;
    sectionId: string;
    sectionName: string;
    size: string;
    unitPrice: number;
    variantCategory: string | null;
}

export interface PriceListFilters {
    kind?: PriceListEntryKind | 'all';
    lineId?: string | 'all';
    search?: string;
}

function normalizeSearchValue(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('sv-SE')
        .trim();
}

function safePrice(value: unknown): number {
    const price = Number(value);
    return Number.isFinite(price) ? price : 0;
}

function createEntryId(parts: Array<string | number>): string {
    return parts.map((part) => encodeURIComponent(String(part))).join(':');
}

export function getPriceListSizeCategory(size: string): string | null {
    const normalizedSize = String(size || '').trim();
    if (!normalizedSize) {
        return null;
    }
    if (/rektangel/i.test(normalizedSize)) {
        return 'Rektangel';
    }
    if (/kvadrat/i.test(normalizedSize)) {
        return 'Kvadrat';
    }
    if (/rund/i.test(normalizedSize) || normalizedSize.startsWith('Ø')) {
        return 'Runda';
    }

    const dimensionMatch = normalizedSize.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
    if (!dimensionMatch) {
        return null;
    }

    const width = Number.parseFloat(dimensionMatch[1].replace(',', '.'));
    const depth = Number.parseFloat(dimensionMatch[2].replace(',', '.'));
    return width === depth ? 'Kvadrat' : 'Rektangel';
}

function buildBuilderEntries(
    lineId: string,
    lineData: Extract<CatalogLineData, { type: 'builder' }>
): PriceListEntry[] {
    const entries: PriceListEntry[] = [];

    Object.entries(lineData.models || {}).forEach(([modelId, modelData]) => {
        Object.entries(modelData.sizes || {}).forEach(([size, sizeData]) => {
            entries.push({
                id: createEntryId([lineId, 'product', modelId, size]),
                categoryName: 'Produkter',
                currency: lineData.currency,
                kind: 'product',
                lineId,
                lineName: lineData.name,
                name: modelData.name,
                priceUponRequest: sizeData.priceUponRequest === true,
                sectionId: createEntryId([lineId, modelId, 'products']),
                sectionName: modelData.name,
                size,
                unitPrice: safePrice(sizeData.price),
                variantCategory: getPriceListSizeCategory(size)
            });
        });

        const appendAddons = (
            categoryName: string,
            categoryId: string,
            items: NonNullable<typeof modelData.addons>
        ) => {
            items.forEach((item) => {
                entries.push({
                    id: createEntryId([lineId, 'addon', modelId, categoryId, item.id]),
                    categoryName,
                    currency: lineData.currency,
                    kind: 'addon',
                    lineId,
                    lineName: lineData.name,
                    name: item.name,
                    priceUponRequest: item.priceUponRequest === true,
                    sectionId: createEntryId([lineId, modelId, categoryId]),
                    sectionName: `${modelData.name} · ${categoryName}`,
                    size: '',
                    unitPrice: safePrice(item.price),
                    variantCategory: null
                });
            });
        };

        if (Array.isArray(modelData.addons) && modelData.addons.length > 0) {
            appendAddons('Tillbehör', 'addons', modelData.addons);
        }

        (modelData.addonCategories || []).forEach((category, categoryIndex) => {
            const categoryName = category.name || 'Tillbehör';
            appendAddons(
                categoryName,
                category.id || `category-${categoryIndex}`,
                category.items || []
            );
        });
    });

    return entries;
}

function buildGridEntries(
    lineId: string,
    lineData: Extract<CatalogLineData, { type: 'grid' }>
): PriceListEntry[] {
    const entries: PriceListEntry[] = [];

    (lineData.gridItems || []).forEach((group, groupIndex) => {
        (group.sizes || []).forEach((sizeData) => {
            entries.push({
                id: createEntryId([lineId, 'product', groupIndex, group.model, sizeData.size]),
                categoryName: 'Produkter',
                currency: lineData.currency,
                kind: 'product',
                lineId,
                lineName: lineData.name,
                name: group.model,
                priceUponRequest: sizeData.priceUponRequest === true,
                sectionId: createEntryId([lineId, 'grid', groupIndex, group.model]),
                sectionName: group.model,
                size: sizeData.size,
                unitPrice: safePrice(sizeData.price),
                variantCategory: null
            });
        });
    });

    (lineData.addonCategories || []).forEach((category, categoryIndex) => {
        const categoryName = category.name || 'Tillbehör';
        const categoryId = category.id || category.categoryId || `category-${categoryIndex}`;

        (category.items || []).forEach((item) => {
            entries.push({
                id: createEntryId([lineId, 'addon', categoryId, item.id]),
                categoryName,
                currency: lineData.currency,
                kind: 'addon',
                lineId,
                lineName: lineData.name,
                name: item.name,
                priceUponRequest: item.priceUponRequest === true,
                sectionId: createEntryId([lineId, 'grid-addons', categoryId]),
                sectionName: categoryName,
                size: '',
                unitPrice: safePrice(item.price),
                variantCategory: null
            });
        });
    });

    return entries;
}

export function buildPriceListEntries(catalog: CatalogData): PriceListEntry[] {
    return Object.entries(catalog || {}).flatMap(([lineId, lineData]) => (
        lineData.type === 'builder'
            ? buildBuilderEntries(lineId, lineData)
            : buildGridEntries(lineId, lineData)
    ));
}

export function filterPriceListEntries(
    entries: PriceListEntry[],
    filters: PriceListFilters = {}
): PriceListEntry[] {
    const lineId = filters.lineId || 'all';
    const kind = filters.kind || 'all';
    const search = normalizeSearchValue(filters.search);

    return entries.filter((entry) => {
        if (lineId !== 'all' && entry.lineId !== lineId) {
            return false;
        }
        if (kind !== 'all' && entry.kind !== kind) {
            return false;
        }
        if (!search) {
            return true;
        }

        return normalizeSearchValue([
            entry.lineName,
            entry.sectionName,
            entry.categoryName,
            entry.name,
            entry.size,
            entry.variantCategory
        ].join(' ')).includes(search);
    });
}

export function getVisiblePriceListLineIds(
    catalog: CatalogData,
    isRetailer: boolean,
    retailer: RetailerRecord | null
): string[] {
    return Object.keys(catalog || {}).filter((lineId) => (
        !isRetailer || retailer?.productLines?.[lineId]?.enabled === true
    ));
}

export function getRetailerLineDiscount(
    lineId: string,
    isRetailer: boolean,
    retailer: RetailerRecord | null
): number | null {
    if (!isRetailer) {
        return null;
    }

    const discount = Number(retailer?.productLines?.[lineId]?.discountPct);
    if (!Number.isFinite(discount)) {
        return 0;
    }

    return Math.min(100, Math.max(0, discount));
}

export function convertPriceListEntryToSek(entry: PriceListEntry, eurToSek: number): number {
    const safeExchangeRate = Number.isFinite(eurToSek) && eurToSek > 0 ? eurToSek : 0;
    return entry.currency === 'EUR'
        ? entry.unitPrice * safeExchangeRate
        : entry.unitPrice;
}

export function applyPriceListDiscount(price: number, discountPct: number | null): number | null {
    if (discountPct === null) {
        return null;
    }

    return price * (1 - discountPct / 100);
}
