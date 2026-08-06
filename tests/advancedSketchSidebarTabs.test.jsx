import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvancedSketchSidebar } from '../src/components/features/AdvancedSketch/AdvancedSketchSidebar';

const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 150, y: 0 }
];
const edges = [{ id: 'edge-1', startNodeId: 'a', endNodeId: 'b' }];

function renderSidebar(activeTab, overrides = {}) {
    const props = {
        activeTab,
        selectedNode: null,
        selectedEdge: null,
        nodes,
        edges,
        onUpdateNode: vi.fn(),
        onDeleteNode: vi.fn(),
        onUpdateEdgeLength: vi.fn(),
        onDeleteEdge: vi.fn(),
        onApplyTemplate: vi.fn(),
        onClearAll: vi.fn(),
        gridActive: true,
        setGridActive: vi.fn(),
        orthoActive: true,
        setOrthoActive: vi.fn(),
        scale: 10,
        onSelectEdge: vi.fn(),
        onExportToQuote: vi.fn(),
        canExportToQuote: true,
        onUpdateEdgeProperties: vi.fn(),
        onSplitEdge: vi.fn(),
        ...overrides
    };

    return renderToStaticMarkup(<AdvancedSketchSidebar {...props} />);
}

describe('advanced sketch sidebar tabs', () => {
    it('keeps drawing helpers, wall selection and templates in the drawing tab', () => {
        const html = renderSidebar('drawing');

        expect(html).toContain('Hjälpmedel');
        expect(html).toContain('Väggar i ritningen');
        expect(html).toContain('Snabbmallar');
        expect(html).not.toContain('Rensa Hela Ritningen');
        expect(html).not.toContain('Väggegenskaper');
        expect(html).not.toContain('Materiallista (BOM)');
    });

    it('shows an explicit properties empty state when nothing is selected', () => {
        const html = renderSidebar('properties');

        expect(html).toContain('Inget markerat');
        expect(html).toContain('Välj en vägg eller punkt i ritningen för att redigera dess egenskaper.');
        expect(html).not.toContain('Hjälpmedel');
        expect(html).not.toContain('Materiallista (BOM)');
    });

    it('renders selected edge geometry only in the properties tab', () => {
        const html = renderSidebar('properties', { selectedEdge: edges[0] });

        expect(html).toContain('Väggegenskaper');
        expect(html).toContain('Beräknade Glassektioner');
        expect(html).toContain('1500 mm');
        expect(html).not.toContain('Snabbmallar');
        expect(html).not.toContain('Materiallista (BOM)');
    });

    it('keeps the complete material summary available while an edge is selected', () => {
        const html = renderSidebar('material', { selectedEdge: edges[0] });

        expect(html).toContain('Materiallista (BOM)');
        expect(html).toContain('ClickitUp Sektion');
        expect(html).toContain('Total glaslängd:');
        expect(html).toContain('Överför till offert');
        expect(html).not.toContain('Väggegenskaper');
        expect(html).not.toContain('Snabbmallar');
    });

    it('shows a material empty state before a wall exists', () => {
        const html = renderSidebar('material', { nodes: [], edges: [] });

        expect(html).toContain('Ingen materiallista ännu');
        expect(html).toContain('Rita minst en vägg för att se material, varningar och offertunderlag.');
        expect(html).not.toContain('Överför till offert');
    });
});
