import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SketchConfig } from '../src/components/features/SketchConfig.jsx';

describe('SketchConfig zero-depth controls', () => {
    it('disables unavailable side controls for a straight 0 mm layout', () => {
        const html = renderToStaticMarkup(
            <SketchConfig
                config={{
                    activeMode: 'clickitup',
                    parasols: [],
                    selectedParasolId: null,
                    width: 8000,
                    depth: 0,
                    depthLeft: 0,
                    depthRight: 0,
                    equalDepth: true,
                    includeBack: false,
                    prioMode: 'symmetrical',
                    targetLength: 1500,
                    doorSegmentsByEdge: {},
                    manualSectionsByEdge: {}
                }}
                onChange={vi.fn()}
                selectedEdge={null}
                selectedSegmentIndex={null}
                onSelectEdge={vi.fn()}
                onSetManualPin={vi.fn()}
                onClearManualPins={vi.fn()}
                onConvertSegmentToDoor={vi.fn()}
                onSetDoorSegmentSize={vi.fn()}
                onResetDoorSegment={vi.fn()}
                edgeSummaries={{}}
                onDeleteParasol={vi.fn()}
                onRotateParasol={vi.fn()}
            />
        );

        expect(html).toContain('Rak 0 mm');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('Rak layout (0 mm djup) kan inte ha bak');
        expect(html).not.toContain('Dörrplacering');
    });

    it('shows a rotation control for selected rectangular parasols only', () => {
        const rectangularHtml = renderToStaticMarkup(
            <SketchConfig
                config={{
                    activeMode: 'parasol',
                    parasols: [{
                        id: 'p1',
                        label: '5x2,5 Rektangel',
                        widthMm: 5000,
                        depthMm: 2500,
                        rotationDeg: 90
                    }],
                    selectedParasolId: 'p1',
                    selectedParasolPresetId: 'jumbrella_5x25_rektangel',
                    width: 8000,
                    depth: 4000,
                    depthLeft: 4000,
                    depthRight: 4000,
                    equalDepth: true,
                    includeBack: false,
                    prioMode: 'symmetrical',
                    targetLength: 1500,
                    doorSegmentsByEdge: {},
                    manualSectionsByEdge: {}
                }}
                onChange={vi.fn()}
                selectedEdge={null}
                selectedSegmentIndex={null}
                onSelectEdge={vi.fn()}
                onSetManualPin={vi.fn()}
                onClearManualPins={vi.fn()}
                onConvertSegmentToDoor={vi.fn()}
                onSetDoorSegmentSize={vi.fn()}
                onResetDoorSegment={vi.fn()}
                edgeSummaries={{}}
                onDeleteParasol={vi.fn()}
                onRotateParasol={vi.fn()}
            />
        );

        const squareHtml = renderToStaticMarkup(
            <SketchConfig
                config={{
                    activeMode: 'parasol',
                    parasols: [{
                        id: 'p2',
                        label: '3x3 Kvadrat',
                        widthMm: 3000,
                        depthMm: 3000,
                        rotationDeg: 0
                    }],
                    selectedParasolId: 'p2',
                    selectedParasolPresetId: 'parasol_3x3',
                    width: 8000,
                    depth: 4000,
                    depthLeft: 4000,
                    depthRight: 4000,
                    equalDepth: true,
                    includeBack: false,
                    prioMode: 'symmetrical',
                    targetLength: 1500,
                    doorSegmentsByEdge: {},
                    manualSectionsByEdge: {}
                }}
                onChange={vi.fn()}
                selectedEdge={null}
                selectedSegmentIndex={null}
                onSelectEdge={vi.fn()}
                onSetManualPin={vi.fn()}
                onClearManualPins={vi.fn()}
                onConvertSegmentToDoor={vi.fn()}
                onSetDoorSegmentSize={vi.fn()}
                onResetDoorSegment={vi.fn()}
                edgeSummaries={{}}
                onDeleteParasol={vi.fn()}
                onRotateParasol={vi.fn()}
            />
        );

        expect(rectangularHtml).toContain('Riktning');
        expect(rectangularHtml).toContain('Standard');
        expect(rectangularHtml).toContain('Roterad 90°');
        expect(rectangularHtml).toContain('aria-pressed="true"');
        expect(squareHtml).not.toContain('Roterad 90°');
    });

    it('shows a selected-door panel when a door segment is selected', () => {
        const html = renderToStaticMarkup(
            <SketchConfig
                config={{
                    activeMode: 'clickitup',
                    parasols: [],
                    selectedParasolId: null,
                    width: 8000,
                    depth: 4000,
                    depthLeft: 4000,
                    depthRight: 4000,
                    equalDepth: true,
                    includeBack: false,
                    prioMode: 'symmetrical',
                    targetLength: 1500,
                    doorSegmentsByEdge: {
                        front: [{ index: 1, size: 1000 }]
                    },
                    manualSectionsByEdge: {}
                }}
                onChange={vi.fn()}
                selectedEdge="front"
                selectedSegmentIndex={1}
                onSelectEdge={vi.fn()}
                onSetManualPin={vi.fn()}
                onClearManualPins={vi.fn()}
                onConvertSegmentToDoor={vi.fn()}
                onSetDoorSegmentSize={vi.fn()}
                onResetDoorSegment={vi.fn()}
                edgeSummaries={{
                    front: {
                        segments: [
                            { index: 0, isDoor: false, length: 1600 },
                            { index: 1, isDoor: true, length: 1000 }
                        ]
                    }
                }}
                onDeleteParasol={vi.fn()}
                onRotateParasol={vi.fn()}
            />
        );

        expect(html).toContain('Vald dörr');
        expect(html).toContain('Återställ till sektion');
        expect(html).not.toContain('Dörrplacering');
    });
});
