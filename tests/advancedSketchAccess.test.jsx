import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvancedSketchSidebar } from '../src/components/features/AdvancedSketch/AdvancedSketchSidebar';

const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 150, y: 0 }
];
const edges = [{ id: 'edge-1', startNodeId: 'a', endNodeId: 'b' }];

function renderSidebar(canExportToQuote, activeTab = 'material') {
    return renderToStaticMarkup(
        <AdvancedSketchSidebar
            activeTab={activeTab}
            selectedNode={null}
            selectedEdge={null}
            nodes={nodes}
            edges={edges}
            onUpdateNode={vi.fn()}
            onDeleteNode={vi.fn()}
            onUpdateEdgeLength={vi.fn()}
            onDeleteEdge={vi.fn()}
            onApplyTemplate={vi.fn()}
            onClearAll={vi.fn()}
            gridActive
            setGridActive={vi.fn()}
            orthoActive
            setOrthoActive={vi.fn()}
            scale={10}
            onSelectEdge={vi.fn()}
            onExportToQuote={vi.fn()}
            canExportToQuote={canExportToQuote}
            onUpdateEdgeProperties={vi.fn()}
            onSplitEdge={vi.fn()}
        />
    );
}

describe('advanced sketch quote access', () => {
    it('shows an explicit transfer action when the role permits it', () => {
        const html = renderSidebar(true);

        expect(html).toContain('Överför till offert');
        expect(html).not.toContain('saknar behörighet');
    });

    it('replaces the transfer action with a clear read-only explanation', () => {
        const html = renderSidebar(false);

        expect(html).not.toContain('Överför till offert');
        expect(html).toContain('ditt konto har inte behörighet att överföra den till en offert');
    });

    it('keeps quote access details out of the drawing and properties tabs', () => {
        expect(renderSidebar(false, 'drawing')).not.toContain('behörighet att överföra');
        expect(renderSidebar(false, 'properties')).not.toContain('behörighet att överföra');
    });
});
