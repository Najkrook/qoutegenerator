import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SketchCanvas } from '../src/components/features/SketchCanvas';

function renderCanvas({ parasols, fiestaItems = [] }) {
    return renderToStaticMarkup(
        <SketchCanvas
            width={6000}
            depth={6000}
            includeBack={false}
            leftEdge={[1500, 1500, 1500, 1500]}
            rightEdge={[1500, 1500, 1500, 1500]}
            frontEdge={[1500, 1500, 1500, 1500]}
            backEdge={[]}
            activeMode="parasol"
            parasols={parasols}
            fiestaItems={fiestaItems}
        />
    );
}

describe('SketchCanvas parasol collision warnings', () => {
    it('allows a parasol canopy to cross a ClickitUp edge and cover a heater', () => {
        const html = renderCanvas({
            parasols: [{
                id: 'parasol-1',
                presetId: 'parasol_5x5',
                label: '5x5 Kvadrat',
                widthMm: 5000,
                depthMm: 5000,
                xMm: 2500,
                yMm: 5000,
                rotationDeg: 0
            }],
            fiestaItems: [{
                id: 'fiesta-1',
                xMm: 2500,
                yMm: 5000,
                diameterMm: 700,
                zLayer: 'below'
            }]
        });

        expect(html).not.toContain('>!</text>');
        expect(html).not.toContain('stroke="#ef4444"');
    });

    it('still warns when two parasol canopies overlap', () => {
        const html = renderCanvas({
            parasols: [
                {
                    id: 'parasol-1',
                    presetId: 'parasol_3x3',
                    label: '3x3 Kvadrat',
                    widthMm: 3000,
                    depthMm: 3000,
                    xMm: 2500,
                    yMm: 2500,
                    rotationDeg: 0
                },
                {
                    id: 'parasol-2',
                    presetId: 'parasol_3x3',
                    label: '3x3 Kvadrat',
                    widthMm: 3000,
                    depthMm: 3000,
                    xMm: 3000,
                    yMm: 2500,
                    rotationDeg: 0
                }
            ]
        });

        expect(html).toContain('>!</text>');
        expect(html).toContain('stroke="#ef4444"');
    });
});
