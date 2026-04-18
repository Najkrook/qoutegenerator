import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../src/components/features/BuilderConfig', () => ({
    BuilderConfig: () => React.createElement('div', null, 'BuilderConfigMock')
}));

vi.mock('../src/components/features/GridConfig', () => ({
    GridConfig: ({ lineId }) => React.createElement('div', null, `GridConfigMock:${lineId}`)
}));

import {
    getBuilderCatalogLine,
    getCatalogLineIds,
    getCatalogLineName,
    getGridCatalogLine
} from '../src/data/catalogLookup';
import { QuoteContext } from '../src/store/QuoteContext';
import { Configuration } from '../src/views/Configuration';

describe('catalogLookup', () => {
    it('returns builder lines only from the builder lookup', () => {
        expect(getBuilderCatalogLine('BaHaMa')?.type).toBe('builder');
        expect(getBuilderCatalogLine('ClickitUp')).toBeNull();
        expect(getBuilderCatalogLine('missing-line')).toBeNull();
    });

    it('returns grid lines only from the grid lookup', () => {
        expect(getGridCatalogLine('ClickitUp')?.type).toBe('grid');
        expect(getGridCatalogLine('BaHaMa')).toBeNull();
        expect(getGridCatalogLine('missing-line')).toBeNull();
    });

    it('returns stable catalog ids and names for consumer labeling', () => {
        expect(getCatalogLineIds()).toEqual(expect.arrayContaining(['BaHaMa', 'ClickitUp', 'Fiesta']));
        expect(getCatalogLineName('BaHaMa')).toBe('BaHaMa');
        expect(getCatalogLineName('ClickitUp')).toBe('ClickitUp');
        expect(getCatalogLineName('missing-line')).toBeNull();
    });

    it('partitions selected lines in the configuration flow through typed catalog helpers', () => {
        const html = renderToStaticMarkup(
            <QuoteContext.Provider
                value={{
                    state: {
                        selectedLines: ['BaHaMa', 'ClickitUp', 'missing-line'],
                        builderItems: [],
                        gridSelections: {}
                    },
                    dispatch: vi.fn()
                }}
            >
                <Configuration onNext={() => {}} onPrev={() => {}} />
            </QuoteContext.Provider>
        );

        expect(html).toContain('Standardkonfiguration');
        expect(html).toContain('BuilderConfigMock');
        expect(html).toContain('Sektionsval (Grid)');
        expect(html).toContain('GridConfigMock:ClickitUp');
        expect(html).not.toContain('GridConfigMock:missing-line');
    });
});
