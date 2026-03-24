import { FIESTA_EXPORT_LINE } from '../utils/parasolGeometry.js';

const CLICKITUP_LINE = 'ClickitUp';
const BAHAMA_LINE = 'BaHaMa';
const SKETCH_SOURCE = 'sketch';

function addLineIfMissing(selectedLines, line) {
    if (selectedLines.includes(line)) return selectedLines;
    return [...selectedLines, line];
}

function hasNonSketchBuilder(builderItems, line, sourceType) {
    return builderItems.some(
        (item) => item.line === line && !(item.source === SKETCH_SOURCE && item.sourceType === sourceType)
    );
}

function groupSketchItems(items) {
    return items.reduce((acc, item) => {
        const key = `${item.exportLine}|${item.exportModel}|${item.exportSize}`;
        if (!acc[key]) {
            acc[key] = {
                line: item.exportLine,
                model: item.exportModel,
                size: item.exportSize,
                qty: 0
            };
        }
        acc[key].qty += 1;
        return acc;
    }, {});
}

function buildSketchBuilderItems(items, sourceType, discountPct, createId) {
    return Object.values(groupSketchItems(items)).map((grouped) => ({
        id: createId(),
        line: grouped.line,
        model: grouped.model,
        size: grouped.size,
        qty: grouped.qty,
        addons: [],
        discountPct,
        source: SKETCH_SOURCE,
        sourceType
    }));
}

export function buildSketchExportState({
    selectedLines = [],
    builderItems = [],
    globalDiscountPct = 0,
    sketchMeta = {},
    parasols = [],
    fiestaItems = [],
    createId = () => Math.random().toString(36).slice(2, 11)
}) {
    const hasParasols = parasols.length > 0;
    const hasFiestaItems = fiestaItems.length > 0;
    const hadSketchBahamaLine = Boolean(sketchMeta?.addedBahamaLine);
    const hadSketchFiestaLine = Boolean(sketchMeta?.addedFiestaLine);

    let nextSelectedLines = addLineIfMissing(selectedLines, CLICKITUP_LINE);
    let nextSketchMeta = {
        ...sketchMeta,
        addedBahamaLine: hadSketchBahamaLine,
        addedFiestaLine: hadSketchFiestaLine
    };

    if (hasParasols) {
        nextSelectedLines = addLineIfMissing(nextSelectedLines, BAHAMA_LINE);
        nextSketchMeta.addedBahamaLine = true;
    } else if (hadSketchBahamaLine && !hasNonSketchBuilder(builderItems, BAHAMA_LINE, 'parasol')) {
        nextSelectedLines = nextSelectedLines.filter((line) => line !== BAHAMA_LINE);
        nextSketchMeta.addedBahamaLine = false;
    } else if (!hasParasols) {
        nextSketchMeta.addedBahamaLine = false;
    }

    if (hasFiestaItems) {
        nextSelectedLines = addLineIfMissing(nextSelectedLines, FIESTA_EXPORT_LINE);
        nextSketchMeta.addedFiestaLine = true;
    } else if (hadSketchFiestaLine && !hasNonSketchBuilder(builderItems, FIESTA_EXPORT_LINE, 'fiesta')) {
        nextSelectedLines = nextSelectedLines.filter((line) => line !== FIESTA_EXPORT_LINE);
        nextSketchMeta.addedFiestaLine = false;
    } else if (!hasFiestaItems) {
        nextSketchMeta.addedFiestaLine = false;
    }

    const baseBuilderItems = builderItems.filter(
        (item) => !(item.source === SKETCH_SOURCE && (item.sourceType === 'parasol' || item.sourceType === 'fiesta'))
    );

    const nextBuilderItems = [
        ...baseBuilderItems,
        ...buildSketchBuilderItems(parasols, 'parasol', globalDiscountPct, createId),
        ...buildSketchBuilderItems(fiestaItems, 'fiesta', globalDiscountPct, createId)
    ];

    return {
        selectedLines: nextSelectedLines,
        builderItems: nextBuilderItems,
        sketchMeta: nextSketchMeta
    };
}
