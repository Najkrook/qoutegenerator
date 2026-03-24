import { describe, expect, it } from 'vitest';
import { buildSketchExportState } from '../src/features/sketchExportState.js';

function createIdFactory() {
    let index = 0;
    return () => `generated-${++index}`;
}

function createParasol(overrides = {}) {
    return {
        id: 'parasol-1',
        exportLine: 'BaHaMa',
        exportModel: 'Jumbrella',
        exportSize: '4x4 Kvadrat',
        ...overrides
    };
}

function createFiesta(overrides = {}) {
    return {
        id: 'fiesta-1',
        exportLine: 'Fiesta',
        exportModel: 'FIESTA Biogasstolpe 12 kW',
        exportSize: 'Standard',
        ...overrides
    };
}

describe('buildSketchExportState', () => {
    it('removes stale sketch parasol selections and rows on re-export', () => {
        const next = buildSketchExportState({
            selectedLines: ['ClickitUp', 'BaHaMa'],
            builderItems: [{
                id: 'old-parasol',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 2,
                addons: [],
                discountPct: 5,
                source: 'sketch',
                sourceType: 'parasol'
            }],
            sketchMeta: {
                addedBahamaLine: true,
                addedFiestaLine: false
            },
            parasols: [],
            fiestaItems: [],
            createId: createIdFactory()
        });

        expect(next.selectedLines).toEqual(['ClickitUp']);
        expect(next.builderItems).toEqual([]);
        expect(next.sketchMeta).toMatchObject({
            addedBahamaLine: false,
            addedFiestaLine: false
        });
    });

    it('removes stale sketch fiesta selections and rows on re-export', () => {
        const next = buildSketchExportState({
            selectedLines: ['ClickitUp', 'Fiesta'],
            builderItems: [{
                id: 'old-fiesta',
                line: 'Fiesta',
                model: 'FIESTA Biogasstolpe 12 kW',
                size: 'Standard',
                qty: 1,
                addons: [],
                discountPct: 0,
                source: 'sketch',
                sourceType: 'fiesta'
            }],
            sketchMeta: {
                addedBahamaLine: false,
                addedFiestaLine: true
            },
            parasols: [],
            fiestaItems: [],
            createId: createIdFactory()
        });

        expect(next.selectedLines).toEqual(['ClickitUp']);
        expect(next.builderItems).toEqual([]);
        expect(next.sketchMeta).toMatchObject({
            addedBahamaLine: false,
            addedFiestaLine: false
        });
    });

    it('keeps remaining sketch line selections when only one sketch family is removed', () => {
        const next = buildSketchExportState({
            selectedLines: ['ClickitUp', 'BaHaMa', 'Fiesta'],
            builderItems: [
                {
                    id: 'old-parasol',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    addons: [],
                    discountPct: 0,
                    source: 'sketch',
                    sourceType: 'parasol'
                },
                {
                    id: 'old-fiesta',
                    line: 'Fiesta',
                    model: 'FIESTA Biogasstolpe 12 kW',
                    size: 'Standard',
                    qty: 2,
                    addons: [],
                    discountPct: 0,
                    source: 'sketch',
                    sourceType: 'fiesta'
                }
            ],
            sketchMeta: {
                addedBahamaLine: true,
                addedFiestaLine: true
            },
            parasols: [],
            fiestaItems: [createFiesta(), createFiesta({ id: 'fiesta-2' })],
            globalDiscountPct: 7,
            createId: createIdFactory()
        });

        expect(next.selectedLines).toEqual(['ClickitUp', 'Fiesta']);
        expect(next.builderItems).toEqual([{
            id: 'generated-1',
            line: 'Fiesta',
            model: 'FIESTA Biogasstolpe 12 kW',
            size: 'Standard',
            qty: 2,
            addons: [],
            discountPct: 7,
            source: 'sketch',
            sourceType: 'fiesta'
        }]);
        expect(next.sketchMeta).toMatchObject({
            addedBahamaLine: false,
            addedFiestaLine: true
        });
    });

    it('preserves non-sketch selections while replacing sketch-sourced builder rows', () => {
        const next = buildSketchExportState({
            selectedLines: ['BaHaMa', 'Fiesta'],
            builderItems: [
                {
                    id: 'manual-bahama',
                    line: 'BaHaMa',
                    model: 'Manual',
                    size: '5x5',
                    qty: 1,
                    addons: [],
                    discountPct: 0
                },
                {
                    id: 'manual-fiesta',
                    line: 'Fiesta',
                    model: 'Manual Fiesta',
                    size: 'Custom',
                    qty: 3,
                    addons: [],
                    discountPct: 0
                },
                {
                    id: 'old-sketch-fiesta',
                    line: 'Fiesta',
                    model: 'FIESTA Biogasstolpe 12 kW',
                    size: 'Standard',
                    qty: 1,
                    addons: [],
                    discountPct: 0,
                    source: 'sketch',
                    sourceType: 'fiesta'
                }
            ],
            sketchMeta: {
                addedBahamaLine: true,
                addedFiestaLine: true
            },
            parasols: [createParasol()],
            fiestaItems: [],
            createId: createIdFactory()
        });

        expect(next.selectedLines).toEqual(['BaHaMa', 'Fiesta', 'ClickitUp']);
        expect(next.builderItems).toEqual([
            {
                id: 'manual-bahama',
                line: 'BaHaMa',
                model: 'Manual',
                size: '5x5',
                qty: 1,
                addons: [],
                discountPct: 0
            },
            {
                id: 'manual-fiesta',
                line: 'Fiesta',
                model: 'Manual Fiesta',
                size: 'Custom',
                qty: 3,
                addons: [],
                discountPct: 0
            },
            {
                id: 'generated-1',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                addons: [],
                discountPct: 0,
                source: 'sketch',
                sourceType: 'parasol'
            }
        ]);
        expect(next.sketchMeta).toMatchObject({
            addedBahamaLine: true,
            addedFiestaLine: false
        });
    });
});
