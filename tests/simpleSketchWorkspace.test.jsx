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

const authState = vi.hoisted(() => ({
    value: {
        user: { uid: 'user-1', email: 'user@example.com' },
        canExportSketchToQuote: true
    }
}));

const quoteState = vi.hoisted(() => ({
    value: {
        state: {
            activeQuoteId: null,
            inventoryData: { bahama: [], clickitup: {} },
            selectedLines: [],
            sketchDraft: null,
            sketchMeta: { addedBahamaLine: false }
        },
        dispatch: vi.fn()
    }
}));

const canvasState = vi.hoisted(() => ({
    props: null
}));

const inspectorState = vi.hoisted(() => ({
    props: null
}));

const autosaveState = vi.hoisted(() => ({
    flush: vi.fn()
}));

vi.mock('../src/store/AuthContext', () => ({
    useAuth: () => authState.value
}));

vi.mock('../src/store/QuoteContext', () => ({
    useQuote: () => quoteState.value
}));

vi.mock('../src/components/features/SketchCanvas', () => ({
    SketchCanvas: (props) => {
        canvasState.props = props;
        return (
            <div>
                <button type="button" onClick={() => props.onSelectEdge('left')}>
                    Välj kant
                </button>
                <button type="button" onClick={() => props.onSelectSection(null, null)}>
                    Rensa kantmarkering
                </button>
                <button type="button" onClick={() => props.onSelectParasol('parasol-1')}>
                    Välj parasoll
                </button>
            </div>
        );
    }
}));

vi.mock('../src/components/features/SketchConfig', () => ({
    SketchSetupPanel: () => <div>Ritningspanel</div>,
    SketchInspectorPanel: (props) => {
        inspectorState.props = props;
        return <div>Egenskapspanel</div>;
    }
}));

vi.mock('../src/components/features/SketchBom', () => ({
    SketchReviewPanel: () => <div>Materialpanel</div>
}));

vi.mock('../src/components/features/StockComparisonModal', () => ({
    StockComparisonModal: () => null
}));

vi.mock('../src/components/features/SketchWorkspace/useSketchDraftAutosave', () => ({
    useSketchDraftAutosave: () => ({
        status: 'saved',
        flush: autosaveState.flush
    })
}));

vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: vi.fn(async () => ({ ok: true }))
}));

vi.mock('../src/services/notificationService', () => ({
    confirmAction: vi.fn(async () => false),
    dismissNotification: vi.fn(),
    notifyError: vi.fn(),
    notifyInfo: vi.fn(),
    notifyLoading: vi.fn(() => 'toast-id'),
    notifySuccess: vi.fn(),
    notifyWarn: vi.fn(),
    updateNotification: vi.fn(),
    warnIfActivityLogFailed: vi.fn()
}));

vi.mock('../src/utils/fileUtils', () => ({
    downloadBlob: vi.fn(),
    saveBlobWithPicker: vi.fn(async () => 'unavailable')
}));

import { SimpleSketchEditor } from '../src/components/features/SimpleSketch/SimpleSketchEditor';

function renderEditor() {
    return render(
        <SimpleSketchEditor
            modeToggleNode={<button type="button">Enkel</button>}
            onBack={() => {}}
        />
    );
}

function activeTabName() {
    return screen
        .getAllByRole('tab')
        .find((tab) => tab.getAttribute('aria-selected') === 'true')
        ?.textContent;
}

beforeEach(() => {
    authState.value = {
        user: { uid: 'user-1', email: 'user@example.com' },
        canExportSketchToQuote: true
    };
    quoteState.value = {
        state: {
            activeQuoteId: null,
            inventoryData: { bahama: [], clickitup: {} },
            selectedLines: [],
            sketchDraft: null,
            sketchMeta: { addedBahamaLine: false }
        },
        dispatch: vi.fn()
    };
    canvasState.props = null;
    inspectorState.props = null;
    autosaveState.flush.mockReset();
});

afterEach(() => {
    cleanup();
});

describe('SimpleSketchEditor workspace', () => {
    it('uses quote transfer as the primary action and image download as the secondary action for full access', () => {
        renderEditor();

        const transfer = screen.getByRole('button', { name: /^Överför till offert/ });
        const download = screen.getByRole('button', { name: /^Ladda ner bild/ });

        expect(transfer.className).toContain('bg-action');
        expect(download.className).toContain('bg-surface-raised');
    });

    it('uses image download as the only primary action for sketch-only access', () => {
        authState.value = {
            user: { uid: 'sketch-1', email: 'sketch@example.com' },
            canExportSketchToQuote: false
        };

        renderEditor();

        const download = screen.getByRole('button', { name: /^Ladda ner bild/ });
        expect(download.className).toContain('bg-action');
        expect(screen.queryByRole('button', { name: /^Överför till offert/ })).toBeNull();
    });

    it('opens Egenskaper for a canvas selection and does not jump back after the selection is cleared', () => {
        renderEditor();

        fireEvent.click(screen.getByRole('tab', { name: 'Ritning' }));
        fireEvent.click(screen.getByRole('button', { name: 'Välj kant' }));

        expect(activeTabName()).toBe('Egenskaper');
        expect(screen.getByText('Egenskapspanel')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Rensa kantmarkering' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Ritning' }));
        fireEvent.click(screen.getByRole('button', { name: 'Välj parasoll' }));

        expect(activeTabName()).toBe('Egenskaper');
        const { onDeleteParasol } = inspectorState.props;

        fireEvent.click(screen.getByRole('tab', { name: 'Ritning' }));
        act(() => {
            onDeleteParasol('parasol-1');
        });

        expect(activeTabName()).toBe('Ritning');
        expect(screen.getByText('Ritningspanel')).not.toBeNull();
    });

    it('opens Material from the readiness status', () => {
        renderEditor();
        fireEvent.click(screen.getByRole('tab', { name: 'Ritning' }));

        const readinessButtons = screen.getAllByRole('button').filter((button) => (
            /^(Redo|Kontrollera|Kan inte)/.test(button.textContent?.trim() || '')
        ));
        expect(readinessButtons.length).toBeGreaterThan(0);

        fireEvent.click(readinessButtons[0]);

        expect(activeTabName()).toContain('Material');
        expect(screen.getByText('Materialpanel')).not.toBeNull();
    });
});
