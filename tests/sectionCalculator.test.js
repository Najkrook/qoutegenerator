import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/utils/sectionCalculator';

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

describe('computeLayout section count overrides', () => {
    it('applies explicit targetCount per edge', () => {
        // Width 4000 requires something like [2000, 2000] locally (2 sections)
        // If we force it to 3 sections, it should pick [1400, 1300, 1300]
        const layout = computeLayout({
            width: 4000,
            depth: 0,
            depthLeft: 0,
            depthRight: 0,
            equalDepth: false,
            includeBack: false,
            prioMode: 'symmetrical',
            sectionCountByEdge: { front: 3 }
        });

        expect(layout.frontEdge.length).toBe(3);
        expect(sumNumericSections(layout.frontEdge)).toBe(4000);
        expect(layout.edgeSummaries.front.valid).toBe(true);
    });

    it('returns WRONG_COUNT for impossible constraints', () => {
        // Width 1500 with targetCount 3 -> minimum is 3x700=2100 -> impossible
        const layout = computeLayout({
            width: 1500,
            depth: 0,
            depthLeft: 0,
            depthRight: 0,
            equalDepth: false,
            includeBack: false,
            prioMode: 'symmetrical',
            sectionCountByEdge: { front: 3 }
        });

        const frontSummary = layout.edgeSummaries.front;
        expect(frontSummary.valid).toBe(false);
        expect(frontSummary.errorCode).toBe('WRONG_COUNT');
        expect(hasCriticalWarningForEdge(layout, 'front')).toBe(true);

        const activeWarnings = layout.layoutWarnings.filter((w) => w.edge === 'front');
        expect(activeWarnings.some((w) => w.code === 'WRONG_COUNT')).toBe(true);
    });
});

describe('computeLayout stodben logic', () => {
    it('returns 0 stodben when fully enclosed (includeBack = true)', () => {
        const layout = computeLayout({
            width: 3000,
            depth: 2000,
            depthLeft: 2000,
            depthRight: 2000,
            equalDepth: true,
            includeBack: true,
            prioMode: 'symmetrical'
        });

        expect(layout.stodbenCount).toBe(0);
    });

    it('returns 2 stodben for straight layouts with 0 depth on both sides', () => {
        const layout = computeLayout({
            width: 3000,
            depth: 0,
            depthLeft: 0,
            depthRight: 0,
            equalDepth: false,
            includeBack: false,
            prioMode: 'symmetrical'
        });

        expect(layout.stodbenCount).toBe(2);
    });

    it('returns 1 stodben for L-shapes (one side open, one side closed)', () => {
        const layout = computeLayout({
            width: 3000,
            depth: 2000,
            depthLeft: 0,
            depthRight: 2000,
            equalDepth: false,
            includeBack: false,
            prioMode: 'symmetrical'
        });

        expect(layout.stodbenCount).toBe(1);
    });

    it('returns 0 stodben for U-shapes (both sides exist, no back)', () => {
        const layout = computeLayout({
            width: 3000,
            depth: 2000,
            depthLeft: 2000,
            depthRight: 2000,
            equalDepth: true,
            includeBack: false,
            prioMode: 'symmetrical'
        });

        expect(layout.stodbenCount).toBe(0);
    });
});
