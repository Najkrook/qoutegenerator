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
        doorSegmentsByEdge: {},
        ...overrides
    };
}

function sumNumericSections(sections) {
    return sections.reduce((sum, item) => (typeof item === 'number' ? sum + item : sum), 0);
}

function hasCriticalWarningForEdge(layout, edgeKey) {
    return layout.layoutWarnings.some((warning) => warning.level === 'critical' && warning.edge === edgeKey);
}

describe('computeLayout split depth handling', () => {
    it('solves left and right edges using independent depths', () => {
        const layout = computeLayout(baseConfig());

        expect(layout.depthLeft).toBe(7400);
        expect(layout.depthRight).toBe(4900);
        expect(sumNumericSections(layout.leftEdge)).toBe(7400 - 100);
        expect(sumNumericSections(layout.rightEdge)).toBe(4900 - 100);
    });

    it('emits edge-specific dimension suggestions for invalid side edges', () => {
        const layout = computeLayout(
            baseConfig({
                depthLeft: 1300,
                depthRight: 1300,
                doorSegmentsByEdge: {
                    left: [{ index: 0, size: 1100 }],
                    right: [{ index: 0, size: 1100 }]
                }
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

    it('treats equal-depth 0 mm as a valid front-only straight layout', () => {
        const layout = computeLayout(
            baseConfig({
                width: 8000,
                depth: 0,
                depthLeft: 0,
                depthRight: 0,
                includeBack: false
            })
        );

        expect(layout.depthLeft).toBe(0);
        expect(layout.depthRight).toBe(0);
        expect(layout.leftEdge).toEqual([]);
        expect(layout.rightEdge).toEqual([]);
        expect(layout.backEdge).toEqual([]);
        expect(layout.edgeSummaries.left.enabled).toBe(false);
        expect(layout.edgeSummaries.right.enabled).toBe(false);
        expect(layout.hasInvalidEdges).toBe(false);
        expect(hasCriticalWarningForEdge(layout, 'left')).toBe(false);
        expect(hasCriticalWarningForEdge(layout, 'right')).toBe(false);
        expect(layout.frontEdge.length).toBeGreaterThan(0);
        expect(layout.allSections).toEqual(layout.frontEdge);
    });

    it('allows one zero-depth side without marking it invalid', () => {
        const layout = computeLayout(
            baseConfig({
                width: 8000,
                depthLeft: 0,
                depthRight: 2300,
                includeBack: false
            })
        );

        expect(layout.leftEdge).toEqual([]);
        expect(layout.edgeSummaries.left.enabled).toBe(false);
        expect(layout.rightEdge.length).toBeGreaterThan(0);
        expect(layout.edgeSummaries.right.enabled).toBe(true);
        expect(hasCriticalWarningForEdge(layout, 'left')).toBe(false);
        expect(layout.frontEdge.length).toBeGreaterThan(0);
    });

    it('ignores stale side-door selections when both side depths are zero', () => {
        const layout = computeLayout(
            baseConfig({
                width: 8000,
                depth: 0,
                depthLeft: 0,
                depthRight: 0,
                includeBack: false,
                doorSegmentsByEdge: {
                    left: [{ index: 0, size: 1100 }],
                    right: [{ index: 0, size: 1100 }]
                }
            })
        );

        expect(layout.leftEdge).toEqual([]);
        expect(layout.rightEdge).toEqual([]);
        expect(layout.hasInvalidEdges).toBe(false);
        expect(hasCriticalWarningForEdge(layout, 'left')).toBe(false);
        expect(hasCriticalWarningForEdge(layout, 'right')).toBe(false);
    });

    it('disables the back edge when both side depths are zero even if includeBack is set', () => {
        const layout = computeLayout(
            baseConfig({
                width: 8000,
                depth: 0,
                depthLeft: 0,
                depthRight: 0,
                includeBack: true
            })
        );

        expect(layout.backEdge).toEqual([]);
        expect(layout.edgeSummaries.back.enabled).toBe(false);
        expect(hasCriticalWarningForEdge(layout, 'back')).toBe(false);
    });

    it('supports multiple doors on the same edge', () => {
        const layout = computeLayout(
            baseConfig({
                width: 8000,
                depth: 4000,
                depthLeft: 4000,
                depthRight: 4000,
                doorSegmentsByEdge: {
                    front: [
                        { index: 1, size: 700 },
                        { index: 3, size: 1100 }
                    ]
                }
            })
        );

        expect(layout.edgeSummaries.front.doorCount).toBe(2);
        expect(layout.frontEdge.filter((segment) => String(segment).includes('Dörr')).length).toBe(2);
        expect(layout.frontEdge[1]).toBe('Dörr 700');
        expect(layout.frontEdge[3]).toBe('Dörr 1100');
    });
});
