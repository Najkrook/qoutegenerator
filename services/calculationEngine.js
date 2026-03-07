function toFloat(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toInt(value, fallback = 1) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSizeDisplay(sizeStr) {
    if (!sizeStr || sizeStr === '-') return '-';
    return String(sizeStr).replace(/\s*(Rekt angel|Rektangel|Kvadrat|Rund|Runda|Rektangulär)\s*/ig, '').trim() || '-';
}

function getUnitSekPrice(basePrice, lineKey, catalogData, exchangeRate) {
    const lineCurrency = catalogData?.[lineKey]?.currency;
    if (lineCurrency === 'EUR') {
        return basePrice * exchangeRate;
    }
    return basePrice;
}

function findBuilderAddonDefinition(modelData, addonId) {
    if (!modelData || !addonId) return null;

    if (Array.isArray(modelData.addonCategories)) {
        for (const category of modelData.addonCategories) {
            const match = (category.items || []).find((item) => item.id === addonId);
            if (match) return match;
        }
    }

    if (Array.isArray(modelData.addons)) {
        return modelData.addons.find((item) => item.id === addonId) || null;
    }

    return null;
}

function findGridBasePrice(lineData, model, size) {
    if (!lineData || !Array.isArray(lineData.gridItems)) return 0;
    for (const group of lineData.gridItems) {
        if (group.model !== model) continue;
        const sizeRow = (group.sizes || []).find((row) => row.size === size);
        if (sizeRow) return toFloat(sizeRow.price);
    }
    return 0;
}

function findGridAddon(lineData, addonId) {
    if (!lineData || !Array.isArray(lineData.addonCategories)) return null;
    for (const category of lineData.addonCategories) {
        const addon = (category.items || []).find((item) => item.id === addonId);
        if (addon) return addon;
    }
    return null;
}

function parseSortableMetric(part) {
    const cleaned = String(part || '').trim().replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseSortableSize(sizeValue) {
    const raw = String(sizeValue ?? '').trim();
    if (!raw || raw === '-') {
        return { sortKind: 'empty', sortDimensions: [] };
    }

    if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
        const value = parseSortableMetric(raw);
        return value === null
            ? { sortKind: 'text', sortDimensions: [] }
            : { sortKind: 'number', sortDimensions: [value] };
    }

    if (raw.toLowerCase().includes('x')) {
        const parts = raw.split(/x/i).map(parseSortableMetric);
        if (parts.every((value) => value !== null)) {
            return { sortKind: 'dimension', sortDimensions: parts };
        }
    }

    return { sortKind: 'text', sortDimensions: [] };
}

function compareDimensionArrays(a = [], b = []) {
    const maxLength = Math.max(a.length, b.length);
    for (let index = 0; index < maxLength; index += 1) {
        const aValue = a[index];
        const bValue = b[index];

        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return -1;
        if (bValue === undefined) return 1;
        if (aValue !== bValue) return aValue - bValue;
    }
    return 0;
}

function sortQuoteTotalsRows(rows) {
    const mainRows = rows.filter((row) => !row.isAddon && !row.isCustom);
    const addonRows = rows.filter((row) => row.isAddon);
    const customRows = rows.filter((row) => row.isCustom);

    const modelOrder = new Map();
    mainRows.forEach((row) => {
        if (!modelOrder.has(row.sortModel)) {
            modelOrder.set(row.sortModel, modelOrder.size);
        }
    });

    const sortPriority = {
        number: 0,
        dimension: 1,
        text: 2,
        empty: 3
    };

    const sortedMainRows = [...mainRows].sort((left, right) => {
        const modelRank = (modelOrder.get(left.sortModel) ?? Number.MAX_SAFE_INTEGER) - (modelOrder.get(right.sortModel) ?? Number.MAX_SAFE_INTEGER);
        if (modelRank !== 0) return modelRank;

        const kindRank = (sortPriority[left.sortKind] ?? sortPriority.text) - (sortPriority[right.sortKind] ?? sortPriority.text);
        if (kindRank !== 0) return kindRank;

        if (left.sortKind === 'number' || left.sortKind === 'dimension') {
            const dimensionCompare = compareDimensionArrays(left.sortDimensions, right.sortDimensions);
            if (dimensionCompare !== 0) return dimensionCompare;
        }

        if (left.sortKind === 'text' || right.sortKind === 'text') {
            const textCompare = String(left.sortSizeRaw || left.size || '').localeCompare(
                String(right.sortSizeRaw || right.size || ''),
                'sv',
                { numeric: true, sensitivity: 'base' }
            );
            if (textCompare !== 0) return textCompare;
        }

        return left.originalIndex - right.originalIndex;
    });

    return [...sortedMainRows, ...addonRows, ...customRows];
}

/**
 * Pure quote total computation used by summary and export flows.
 * @param {{state: object, catalogData: object}} params
 * @returns {{ totals: object[], grossTotalSek: number, totalDiscountSek: number, finalTotalSek: number, globalDiscountAmt: number }}
 */
export function computeQuoteTotals({ state, catalogData }) {
    const safeState = state || {};
    const safeCatalog = catalogData || {};

    const exchangeRate = toFloat(safeState.exchangeRate || 0);
    const totals = [];
    let grossTotalSek = 0;
    let totalDiscountSek = 0;
    let originalIndex = 0;

    for (const item of safeState.builderItems || []) {
        let basePrice = 0;
        if (item?.line && item?.model && item?.size) {
            basePrice = toFloat(
                safeCatalog?.[item.line]?.models?.[item.model]?.sizes?.[item.size]?.price || 0
            );
        }

        const unitPrice = getUnitSekPrice(basePrice, item?.line, safeCatalog, exchangeRate);
        const qty = toInt(item?.qty, 1);
        const gross = unitPrice * qty;
        const discountPct = toFloat(item?.discountPct || 0);
        const discountSek = gross * (discountPct / 100);
        const net = gross - discountSek;
        const formattedSize = formatSizeDisplay(item?.size);
        const sizeMeta = parseSortableSize(formattedSize);

        grossTotalSek += gross;
        totalDiscountSek += discountSek;

        totals.push({
            model: `${item?.line || ''} ${item?.model || ''}`.trim(),
            size: formattedSize,
            unitPrice,
            qty,
            gross,
            discountPct,
            discountSek,
            net,
            isAddon: false,
            source: { type: 'builder', itemId: item.id },
            sortModel: `${item?.line || ''} ${item?.model || ''}`.trim(),
            sortSizeRaw: item?.size || formattedSize,
            sortKind: sizeMeta.sortKind,
            sortDimensions: sizeMeta.sortDimensions,
            originalIndex: originalIndex++
        });

        for (const addon of item?.addons || []) {
            const modelData = safeCatalog?.[item.line]?.models?.[item.model];
            const addonDef = findBuilderAddonDefinition(modelData, addon?.id);
            const addonBasePrice = toFloat(addonDef?.price || 0);
            const addonUnitPrice = getUnitSekPrice(addonBasePrice, item?.line, safeCatalog, exchangeRate);
            const addonQty = toInt(addon?.qty, 1);
            const addonGross = addonUnitPrice * addonQty;
            const addonDiscountPct = toFloat(addon?.discountPct || 0);
            const addonDiscountSek = addonGross * (addonDiscountPct / 100);
            const addonNet = addonGross - addonDiscountSek;

            grossTotalSek += addonGross;
            totalDiscountSek += addonDiscountSek;

            totals.push({
                model: `  + Tillval: ${addonDef?.name || addon?.id || 'Okant tillval'}`,
                size: '-',
                unitPrice: addonUnitPrice,
                qty: addonQty,
                gross: addonGross,
                discountPct: addonDiscountPct,
                discountSek: addonDiscountSek,
                net: addonNet,
                isAddon: true,
                source: { type: 'builder-addon', itemId: item.id, addonId: addon.id },
                sortModel: `${item?.line || ''} ${item?.model || ''}`.trim(),
                sortSizeRaw: '-',
                sortKind: 'empty',
                sortDimensions: [],
                originalIndex: originalIndex++
            });
        }
    }

    const gridSelections = safeState.gridSelections || {};
    for (const line of Object.keys(gridSelections)) {
        const lineData = safeCatalog?.[line];
        const gridState = gridSelections[line] || {};

        for (const key of Object.keys(gridState.items || {})) {
            const [model, size] = key.split('|');
            const gridItem = gridState.items[key] || {};
            const basePrice = findGridBasePrice(lineData, model, size);
            const unitPrice = getUnitSekPrice(basePrice, line, safeCatalog, exchangeRate);
            const qty = toInt(gridItem.qty, 1);
            const gross = unitPrice * qty;
            const discountPct = toFloat(gridItem.discountPct || 0);
            const discountSek = gross * (discountPct / 100);
            const net = gross - discountSek;
            const formattedSize = formatSizeDisplay(size);
            const sizeMeta = parseSortableSize(formattedSize);

            grossTotalSek += gross;
            totalDiscountSek += discountSek;

            totals.push({
                model: model || '',
                size: formattedSize,
                unitPrice,
                qty,
                gross,
                discountPct,
                discountSek,
                net,
                isAddon: false,
                source: { type: 'grid', lineId: line, key },
                sortModel: model || '',
                sortSizeRaw: size || formattedSize,
                sortKind: sizeMeta.sortKind,
                sortDimensions: sizeMeta.sortDimensions,
                originalIndex: originalIndex++
            });
        }

        for (const addonId of Object.keys(gridState.addons || {})) {
            const addonState = gridState.addons[addonId] || {};
            const addonDef = findGridAddon(lineData, addonId);
            const basePrice = toFloat(addonDef?.price || 0);
            const unitPrice = getUnitSekPrice(basePrice, line, safeCatalog, exchangeRate);
            const qty = toInt(addonState.qty, 1);
            const gross = unitPrice * qty;
            const discountPct = toFloat(addonState.discountPct || 0);
            const discountSek = gross * (discountPct / 100);
            const net = gross - discountSek;

            grossTotalSek += gross;
            totalDiscountSek += discountSek;

            totals.push({
                model: `  + Tillval: ${addonDef?.name || addonId}`,
                size: '-',
                unitPrice,
                qty,
                gross,
                discountPct,
                discountSek,
                net,
                isAddon: true,
                source: { type: 'grid-addon', lineId: line, addonId },
                sortModel: line,
                sortSizeRaw: '-',
                sortKind: 'empty',
                sortDimensions: [],
                originalIndex: originalIndex++
            });
        }
    }

    for (const cost of safeState.customCosts || []) {
        const unitPrice = toFloat(cost?.price || 0);
        const qty = toInt(cost?.qty, 1);
        const gross = unitPrice * qty;

        grossTotalSek += gross;

        totals.push({
            model: `Ovrigt: ${cost?.description || 'Kostnad'}`,
            size: '-',
            unitPrice,
            qty,
            gross,
            discountPct: 0,
            discountSek: 0,
            net: gross,
            isAddon: false,
            isCustom: true,
            source: { type: 'custom' },
            sortModel: `Ovrigt: ${cost?.description || 'Kostnad'}`,
            sortSizeRaw: '-',
            sortKind: 'empty',
            sortDimensions: [],
            originalIndex: originalIndex++
        });
    }

    // Global discount is an editing helper and must not be applied a second time.
    const globalDiscountAmt = 0;
    const finalTotalSek = grossTotalSek - totalDiscountSek;
    const sortedTotals = sortQuoteTotalsRows(totals);

    return {
        totals: sortedTotals,
        grossTotalSek,
        totalDiscountSek,
        finalTotalSek,
        globalDiscountAmt
    };
}
