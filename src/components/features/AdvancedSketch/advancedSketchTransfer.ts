import { buildSketchExportState } from '../../../features/sketchExportState';
import type {
    AdvancedEdge,
    AdvancedNode,
    AdvancedSketchDraft,
    GridCustomAddonRow,
    GridLineSelection,
    GridSelections,
    QuoteState,
    SketchCamera,
    SketchMeta
} from '../../../types/contracts';
import { calculateSectionsForEdge, parseSection } from '../../../utils/sectionCalculator';

const SCALE_MM_PER_PIXEL = 10;
const MIN_EDGE_LENGTH_MM = 1000;

export type AdvancedSketchTransferError = 'empty-sketch' | 'no-valid-edges';

export interface AdvancedSketchTransferPatch {
    selectedLines: string[];
    gridSelections: GridSelections;
    builderItems: QuoteState['builderItems'];
    advancedSketchDraft: AdvancedSketchDraft;
    sketchMeta: SketchMeta;
}

export interface AdvancedSketchTransferResult {
    error: AdvancedSketchTransferError | null;
    excludedEdgeCount: number;
    patch: AdvancedSketchTransferPatch | null;
}

interface AdvancedSketchTransferInput {
    nodes: AdvancedNode[];
    edges: AdvancedEdge[];
    camera: SketchCamera;
    quoteState: Pick<
        QuoteState,
        'selectedLines' | 'builderItems' | 'gridSelections' | 'globalDiscountPct' | 'sketchMeta'
    >;
}

export function buildAdvancedSketchDraft(
    nodes: AdvancedNode[],
    edges: AdvancedEdge[],
    camera: SketchCamera
): AdvancedSketchDraft {
    return {
        config: { nodes, edges },
        workspace: { camera, uiDensity: 'desktop' }
    };
}

function getEdgeLengthMm(
    edge: AdvancedEdge,
    nodesById: Map<string, AdvancedNode>
): number | null {
    const start = nodesById.get(edge.startNodeId);
    const end = nodesById.get(edge.endNodeId);
    if (!start || !end) {
        return null;
    }

    return Math.round(Math.hypot(end.x - start.x, end.y - start.y) * SCALE_MM_PER_PIXEL);
}

export function buildAdvancedSketchTransfer({
    nodes,
    edges,
    camera,
    quoteState
}: AdvancedSketchTransferInput): AdvancedSketchTransferResult {
    if (edges.length === 0) {
        return {
            error: 'empty-sketch',
            excludedEdgeCount: 0,
            patch: null
        };
    }

    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const validEdges = edges.flatMap((edge) => {
        const lengthMm = getEdgeLengthMm(edge, nodesById);
        return lengthMm !== null && lengthMm >= MIN_EDGE_LENGTH_MM
            ? [{ edge, lengthMm }]
            : [];
    });
    const excludedEdgeCount = edges.length - validEdges.length;

    if (validEdges.length === 0) {
        return {
            error: 'no-valid-edges',
            excludedEdgeCount,
            patch: null
        };
    }

    const bomCounts: Record<number, number> = {};
    const bomDoorCounts: Record<number, number> = {};
    const nodeEdgeCounts: Record<string, number> = {};
    let totalSlimlineCount = 0;

    validEdges.forEach(({ edge, lengthMm }) => {
        nodeEdgeCounts[edge.startNodeId] = (nodeEdgeCounts[edge.startNodeId] || 0) + 1;
        nodeEdgeCounts[edge.endNodeId] = (nodeEdgeCounts[edge.endNodeId] || 0) + 1;

        const sections = calculateSectionsForEdge(lengthMm, edge.hasDoor || false, {
            prioMode: edge.prioMode || 'symmetrical',
            targetLength: edge.targetLength || 1500,
            doorSize: edge.doorSize || 1000
        });
        sections.forEach((section) => {
            const parsed = parseSection(section);
            if (parsed.kind === 'door') {
                bomDoorCounts[parsed.length] = (bomDoorCounts[parsed.length] || 0) + 1;
                totalSlimlineCount += 1;
                return;
            }

            if (parsed.length > 0) {
                bomCounts[parsed.length] = (bomCounts[parsed.length] || 0) + 1;
            }
        });
    });

    const supportPostCount = Object.values(nodeEdgeCounts)
        .filter((edgeCount) => edgeCount === 1)
        .length;
    const nextSketchExportState = buildSketchExportState({
        selectedLines: quoteState.selectedLines,
        builderItems: quoteState.builderItems || [],
        globalDiscountPct: quoteState.globalDiscountPct || 0,
        sketchMeta: quoteState.sketchMeta || {},
        parasols: [],
        fiestaItems: []
    });
    const preservedCustomAddons = Object.entries(
        quoteState.gridSelections?.ClickitUp?.customAddonsByCategory || {}
    ).reduce<Record<string, GridCustomAddonRow[]>>((result, [categoryId, rows]) => {
        result[categoryId] = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
        return result;
    }, {});
    const clickitupSelection: GridLineSelection = {
        items: {},
        addons: {},
        customAddonsByCategory: preservedCustomAddons
    };

    Object.entries(bomCounts).forEach(([size, qty]) => {
        clickitupSelection.items[`ClickitUp Sektion|${size}`] = { qty, discountPct: 0 };
    });
    Object.entries(bomDoorCounts).forEach(([size, qty]) => {
        clickitupSelection.items[`ClickitUp Dörr|${size}`] = { qty, discountPct: 0 };
    });
    if (totalSlimlineCount > 0) {
        clickitupSelection.addons.stodben_litet = { qty: totalSlimlineCount, discountPct: 0 };
    }
    if (supportPostCount > 0) {
        clickitupSelection.addons.stodben_stort = { qty: supportPostCount, discountPct: 0 };
    }

    const selectedLines = nextSketchExportState.selectedLines.includes('ClickitUp')
        ? nextSketchExportState.selectedLines
        : [...nextSketchExportState.selectedLines, 'ClickitUp'];

    return {
        error: null,
        excludedEdgeCount,
        patch: {
            selectedLines,
            gridSelections: {
                ...quoteState.gridSelections,
                ClickitUp: clickitupSelection
            },
            builderItems: nextSketchExportState.builderItems,
            advancedSketchDraft: buildAdvancedSketchDraft(nodes, edges, camera),
            sketchMeta: nextSketchExportState.sketchMeta
        }
    };
}
