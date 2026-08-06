import { describe, expect, it } from 'vitest';
import {
    buildAdvancedSketchDraft,
    buildAdvancedSketchTransfer
} from '../src/components/features/AdvancedSketch/advancedSketchTransfer';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

const camera = { zoom: 1, panX: 100, panY: 100 };

describe('advanced sketch transfer', () => {
    it('keeps draft saving separate from quote transfer validation', () => {
        const nodes = [{ id: 'start', x: 0, y: 0 }];
        const edges = [{ id: 'missing-end', startNodeId: 'start', endNodeId: 'end' }];

        expect(buildAdvancedSketchDraft(nodes, edges, camera)).toEqual({
            config: { nodes, edges },
            workspace: { camera, uiDensity: 'desktop' }
        });

        const result = buildAdvancedSketchTransfer({
            nodes,
            edges,
            camera,
            quoteState: createInitialQuoteState()
        });
        expect(result).toEqual({
            error: 'no-valid-edges',
            excludedEdgeCount: 1,
            patch: null
        });
    });

    it('rejects an empty sketch without changing quote data', () => {
        const result = buildAdvancedSketchTransfer({
            nodes: [],
            edges: [],
            camera,
            quoteState: createInitialQuoteState()
        });

        expect(result.error).toBe('empty-sketch');
        expect(result.patch).toBeNull();
    });

    it('builds one atomic quote patch and preserves custom ClickitUp addons', () => {
        const initialState = {
            ...createInitialQuoteState(),
            selectedLines: ['BaHaMa'],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Sektion|1000': { qty: 99, discountPct: 5 }
                    },
                    addons: {},
                    customAddonsByCategory: {
                        montage: [{
                            id: 'custom-1',
                            description: 'Specialmontage',
                            qty: 2,
                            price: 500,
                            discountPct: 0
                        }]
                    }
                }
            }
        };
        const nodes = [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 150, y: 0 }
        ];
        const edges = [{ id: 'edge-1', startNodeId: 'a', endNodeId: 'b' }];

        const result = buildAdvancedSketchTransfer({
            nodes,
            edges,
            camera,
            quoteState: initialState
        });

        expect(result.error).toBeNull();
        expect(result.excludedEdgeCount).toBe(0);
        expect(result.patch).toEqual(expect.objectContaining({
            selectedLines: ['BaHaMa', 'ClickitUp'],
            advancedSketchDraft: {
                config: { nodes, edges },
                workspace: { camera, uiDensity: 'desktop' }
            }
        }));
        expect(Object.values(result.patch.gridSelections.ClickitUp.items)).not.toHaveLength(0);
        expect(result.patch.gridSelections.ClickitUp.customAddonsByCategory.montage).toEqual(
            initialState.gridSelections.ClickitUp.customAddonsByCategory.montage
        );
        expect(result.patch.gridSelections.ClickitUp.customAddonsByCategory.montage)
            .not.toBe(initialState.gridSelections.ClickitUp.customAddonsByCategory.montage);
        expect(initialState.gridSelections.ClickitUp.items['ClickitUp Sektion|1000'].qty).toBe(99);
    });

    it('reports short edges while transferring the valid part of the drawing', () => {
        const nodes = [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 150, y: 0 },
            { id: 'c', x: 155, y: 0 }
        ];
        const edges = [
            { id: 'valid', startNodeId: 'a', endNodeId: 'b' },
            { id: 'short', startNodeId: 'b', endNodeId: 'c' }
        ];

        const result = buildAdvancedSketchTransfer({
            nodes,
            edges,
            camera,
            quoteState: createInitialQuoteState()
        });

        expect(result.error).toBeNull();
        expect(result.excludedEdgeCount).toBe(1);
        expect(result.patch.selectedLines).toContain('ClickitUp');
    });
});
