import { FIESTA_EXPORT_LINE } from '../utils/parasolGeometry';
import type {
    BuilderItem,
    PlacedFiesta,
    PlacedParasol,
    SketchExportBuilderItem,
    SketchExportStateResult,
    SketchMeta
} from '../types/contracts';

const CLICKITUP_LINE = 'ClickitUp';
const BAHAMA_LINE = 'BaHaMa';
const SKETCH_SOURCE = 'sketch';

type SketchSourceType = 'parasol' | 'fiesta';
type SketchExportItem = PlacedParasol | PlacedFiesta;

interface BuildSketchExportStateInput {
    selectedLines?: string[];
    builderItems?: BuilderItem[];
    globalDiscountPct?: number;
    sketchMeta?: Partial<SketchMeta>;
    parasols?: PlacedParasol[];
    fiestaItems?: PlacedFiesta[];
    createId?: () => string;
}

function addLineIfMissing(selectedLines: string[], line: string): string[] {
    if (selectedLines.includes(line)) return selectedLines;
    return [...selectedLines, line];
}

function hasNonSketchBuilder(builderItems: BuilderItem[], line: string, sourceType: SketchSourceType): boolean {
    return builderItems.some(
        (item) => item.line === line && !(item.source === SKETCH_SOURCE && item.sourceType === sourceType)
    );
}

function groupSketchItems(items: SketchExportItem[]): Record<string, { line: string; model: string; size: string; qty: number }> {
    return items.reduce<Record<string, { line: string; model: string; size: string; qty: number }>>((acc, item) => {
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

function buildSketchBuilderItems(
    items: SketchExportItem[],
    sourceType: SketchSourceType,
    discountPct: number,
    createId: () => string
): SketchExportBuilderItem[] {
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
}: BuildSketchExportStateInput): SketchExportStateResult {
    const hasParasols = parasols.length > 0;
    const hasFiestaItems = fiestaItems.length > 0;
    const hadSketchBahamaLine = Boolean(sketchMeta?.addedBahamaLine);
    const hadSketchFiestaLine = Boolean(sketchMeta?.addedFiestaLine);

    let nextSelectedLines = addLineIfMissing(selectedLines, CLICKITUP_LINE);
    const nextSketchMeta: SketchMeta = {
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

    const nextBuilderItems: BuilderItem[] = [
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
