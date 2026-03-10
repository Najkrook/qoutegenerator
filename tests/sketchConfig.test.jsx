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
                    doorEdges: new Set(),
                    doorSizeByEdge: {},
                    manualSectionsByEdge: {}
                }}
                onChange={vi.fn()}
                selectedEdge={null}
                selectedSegmentIndex={null}
                onSelectEdge={vi.fn()}
                onSetManualPin={vi.fn()}
                onClearManualPins={vi.fn()}
                edgeSummaries={{}}
                onDeleteParasol={vi.fn()}
            />
        );

        expect(html).toContain('Rak 0 mm');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('Rak layout (0 mm djup) kan inte ha bak');
        expect(html).toContain('Fram');
        expect((html.match(/disabled=""/g) || []).length).toBe(3);
    });
});
