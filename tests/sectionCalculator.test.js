import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/utils/sectionCalculator.js';

function baseConfig(overrides = {}) {
    return {
        width: 5800,
        depth: 2300,
        depthLeft: 7400,
        depthRight: 4900,
        includeBack: false,
        prioMode: 'symmetrical',
        targetLength: 1500,
        doorEdges: new Set(),
        doorSizeByEdge: {},
        ...overrides
    };
}

function sumNumericSections(sections) {
    return sections.reduce((sum, item) => (typeof item === 'number' ? sum + item : sum), 0);
}

describe('computeLayout split depth handling', () => {
    it('solves left and right edges using independent depths', () => {
        const layout = computeLayout(baseConfig());

        expect(layout.depthLeft).toBe(7400);
        expect(layout.depthRight).toBe(4900);
        expect(sumNumericSections(layout.leftEdge)).toBe(7400);
        expect(sumNumericSections(layout.rightEdge)).toBe(4900);
    });

    it('emits edge-specific dimension suggestions for invalid side edges', () => {
        const layout = computeLayout(
            baseConfig({
                depthLeft: 1200,
                depthRight: 1300,
                doorEdges: new Set(['left', 'right']),
                doorSizeByEdge: { left: 1100, right: 1100 }
            })
        );

        const leftSetDimension = layout.suggestions.find(
            (suggestion) => suggestion.type === 'setDimension' && suggestion.edge === 'left'
        );
        const rightSetDimension = layout.suggestions.find(
            (suggestion) => suggestion.type === 'setDimension' && suggestion.edge === 'right'
        );

        expect(leftSetDimension).toBeTruthy();
        expect(rightSetDimension).toBeTruthy();
        expect(leftSetDimension.dimension).toBe('depthLeft');
        expect(rightSetDimension.dimension).toBe('depthRight');
    });
});
