// @vitest-environment jsdom

import React from 'react';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const notificationMocks = vi.hoisted(() => ({
    confirmAction: vi.fn(async () => false),
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    notifyWarn: vi.fn()
}));

vi.mock('../src/services/notificationService', () => notificationMocks);

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../src/utils/fileUtils', () => ({
    downloadBlob: vi.fn()
}));

vi.mock('react-konva', async () => {
    const ReactModule = await import('react');
    const Container = ({ children }) => ReactModule.createElement('div', null, children);
    const Stage = ReactModule.forwardRef(function Stage({ children }, ref) {
        ReactModule.useImperativeHandle(ref, () => ({
            toDataURL: () => 'data:image/png;base64,'
        }));
        return ReactModule.createElement('div', { 'data-testid': 'konva-stage' }, children);
    });
    const Line = ({ onClick, stroke }) => (
        stroke === 'transparent' && typeof onClick === 'function'
            ? ReactModule.createElement(
                'button',
                {
                    type: 'button',
                    'aria-label': 'Markera vägg',
                    onClick: () => onClick({ cancelBubble: false })
                },
                'Vägg'
            )
            : null
    );

    return {
        Stage,
        Layer: Container,
        Group: Container,
        Circle: () => null,
        Line,
        Rect: () => null,
        Text: () => null,
        Arc: () => null
    };
});

vi.mock('../src/components/features/AdvancedSketch/AdvancedSketchSidebar', () => ({
    AdvancedSketchSidebar: ({ activeTab, selectedEdge }) => (
        <div>
            <span data-testid="sidebar-tab">{activeTab}</span>
            <span data-testid="selected-edge">{selectedEdge?.id || 'none'}</span>
        </div>
    )
}));

vi.mock('../src/components/features/SketchWorkspace/SketchWorkspaceChrome', () => ({
    SketchWorkspaceHeader: ({
        modeToggleNode,
        overflowActions,
        primaryAction,
        saveStatus,
        secondaryAction
    }) => (
        <header>
            {modeToggleNode}
            <span data-testid="save-status">{saveStatus}</span>
            <button
                type="button"
                data-testid="primary-action"
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
            >
                {primaryAction.label}
            </button>
            {secondaryAction ? (
                <button type="button" data-testid="secondary-action" onClick={secondaryAction.onClick}>
                    {secondaryAction.label}
                </button>
            ) : null}
            {overflowActions.map((action) => (
                <button
                    key={action.label}
                    type="button"
                    disabled={action.disabled}
                    onClick={action.onClick}
                >
                    {action.label}
                </button>
            ))}
        </header>
    ),
    SketchResponsivePanel: ({ activeTab, children }) => (
        <aside data-testid="responsive-panel" data-active-tab={activeTab}>
            {children}
        </aside>
    )
}));

import { AdvancedSketchEditor } from '../src/components/features/AdvancedSketch/AdvancedSketchEditor';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

const advancedDraft = {
    config: {
        nodes: [
            { id: 'node-a', x: 0, y: 0 },
            { id: 'node-b', x: 180, y: 0 }
        ],
        edges: [
            { id: 'edge-1', startNodeId: 'node-a', endNodeId: 'node-b' }
        ]
    },
    workspace: {
        camera: { zoom: 1, panX: 100, panY: 100 },
        uiDensity: 'desktop'
    }
};

function renderEditor({
    canExportSketchToQuote = true,
    dispatch = vi.fn()
} = {}) {
    const state = {
        ...createInitialQuoteState(),
        advancedSketchDraft: advancedDraft
    };
    const authValue = {
        user: null,
        loading: false,
        accessLevel: canExportSketchToQuote ? 'full' : 'sketch-only',
        canViewEverything: canExportSketchToQuote,
        canStartQuote: canExportSketchToQuote,
        canAccessSketch: true,
        canAccessQuoteHistory: canExportSketchToQuote,
        canExportSketchToQuote,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: null,
        isRetailer: false
    };

    render(
        <AuthContext.Provider value={authValue}>
            <QuoteContext.Provider value={{ state, dispatch }}>
                <AdvancedSketchEditor
                    onBack={vi.fn()}
                    onExportToQuoteComplete={vi.fn()}
                    modeToggleNode={<span>Avancerat läge</span>}
                />
            </QuoteContext.Provider>
        </AuthContext.Provider>
    );

    return { dispatch };
}

describe('AdvancedSketchEditor workspace integration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        notificationMocks.confirmAction.mockReset();
        notificationMocks.confirmAction.mockResolvedValue(false);
        vi.stubGlobal('ResizeObserver', class ResizeObserver {
            observe() {}
            disconnect() {}
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('uses the transfer action for full access and image download for sketch-only access', () => {
        const fullAccessView = renderEditor({ canExportSketchToQuote: true });

        expect(screen.getByTestId('primary-action').textContent).toBe('Överför till offert');
        expect(screen.getByTestId('secondary-action').textContent).toBe('Ladda ner bild');

        cleanup();
        fullAccessView.dispatch.mockClear();
        renderEditor({ canExportSketchToQuote: false });

        expect(screen.getByTestId('primary-action').textContent).toBe('Ladda ner bild');
        expect(screen.queryByTestId('secondary-action')).toBeNull();
        expect(screen.queryByText('Överför till offert')).toBeNull();
    });

    it('does not dispatch an identical draft after initialization or the debounce window', () => {
        const dispatch = vi.fn();
        renderEditor({ dispatch });

        expect(dispatch).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(750);
        });

        expect(dispatch).not.toHaveBeenCalled();
        expect(screen.getByTestId('save-status').textContent).toBe('saved');
    });

    it('switches the responsive panel to properties when a canvas wall is selected', async () => {
        renderEditor();

        expect(screen.getByTestId('responsive-panel').getAttribute('data-active-tab')).toBe('drawing');

        fireEvent.click(screen.getByRole('button', { name: 'Markera vägg' }));

        expect(screen.getByTestId('responsive-panel').getAttribute('data-active-tab')).toBe('properties');
        expect(screen.getByTestId('selected-edge').textContent).toBe('edge-1');
    });

    it('uses confirmAction for reset and never calls window.confirm', async () => {
        const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
        renderEditor();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Börja om' }));
            await Promise.resolve();
        });

        expect(notificationMocks.confirmAction).toHaveBeenCalledTimes(1);
        expect(notificationMocks.confirmAction).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Börja om med ritningen?',
            confirmText: 'Börja om',
            tone: 'danger'
        }));
        expect(nativeConfirm).not.toHaveBeenCalled();
    });
});
