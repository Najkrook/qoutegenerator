// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../src/components/features/SimpleSketch/SimpleSketchEditor', () => ({
    SimpleSketchEditor: ({ modeToggleNode }) => (
        <div>
            {modeToggleNode}
            Simple editor
        </div>
    )
}));

vi.mock('../src/components/features/AdvancedSketch/AdvancedSketchEditor', () => ({
    AdvancedSketchEditor: ({ modeToggleNode }) => (
        <div>
            {modeToggleNode}
            Advanced editor
        </div>
    )
}));

import { SketchTool } from '../src/views/SketchTool';

const mountedRoots = [];

afterEach(() => {
    while (mountedRoots.length > 0) {
        const { root, container } = mountedRoots.pop();
        act(() => root.unmount());
        container.remove();
    }
});

describe('sketch mode switching', () => {
    it('keeps both persisted drafts and switches without destructive dispatches', async () => {
        const dispatch = vi.fn();
        const state = {
            ...createInitialQuoteState(),
            sketchDraft: {
                config: {},
                workspace: {}
            },
            advancedSketchDraft: {
                config: { nodes: [], edges: [] },
                workspace: {
                    camera: { zoom: 1, panX: 0, panY: 0 },
                    uiDensity: 'desktop'
                }
            }
        };
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        mountedRoots.push({ root, container });

        await act(async () => {
            root.render(
                <QuoteContext.Provider value={{ state, dispatch }}>
                    <SketchTool onBack={() => {}} />
                </QuoteContext.Provider>
            );
        });

        expect(container.textContent).toContain('Simple editor');
        const advancedButton = Array.from(container.querySelectorAll('button'))
            .find((button) => button.textContent === 'Avancerat');

        await act(async () => {
            advancedButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(container.textContent).toContain('Advanced editor');
        expect(dispatch).not.toHaveBeenCalledWith({
            type: 'UPDATE_STATE',
            payload: { sketchDraft: null }
        });
        expect(dispatch).not.toHaveBeenCalledWith({
            type: 'UPDATE_STATE',
            payload: { advancedSketchDraft: null }
        });
    });
});
