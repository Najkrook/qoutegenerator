// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const firebaseMocks = vi.hoisted(() => ({
    db: {},
    collection: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({
        docs: [{
            id: 'planner-1',
            data: () => ({
                title: 'Projekt Alpha',
                done: false,
                contractor: '',
                priority: 'Normal',
                createdAt: Date.parse('2026-05-20T09:00:00.000Z'),
                createdBy: 'admin@example.com',
                week: '2026-W21',
                address: '',
                phone: '',
                notes: '',
                assignees: []
            })
        }]
    })),
    addDoc: vi.fn(async () => ({ id: 'planner-2' })),
    deleteDoc: vi.fn(async () => {}),
    doc: vi.fn(() => ({})),
    updateDoc: vi.fn(async () => {})
}));

const notificationMocks = vi.hoisted(() => ({
    dismissNotification: vi.fn(),
    notifyAction: vi.fn(() => 'toast-1'),
    notifyError: vi.fn()
}));

vi.mock('../src/services/firebase', () => firebaseMocks);
vi.mock('../src/services/notificationService', () => notificationMocks);

import { Planner } from '../src/views/Planner';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

async function renderPlanner() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <AuthContext.Provider value={{
                user: { uid: 'admin-1', email: 'admin@example.com' },
                loading: false,
                accessLevel: 'full',
                canViewEverything: true,
                canStartQuote: true,
                canAccessSketch: true,
                canAccessQuoteHistory: true,
                canExportSketchToQuote: true,
                login: vi.fn(),
                logout: vi.fn(),
                retailer: null,
                isRetailer: false
            }}>
                <Planner onBack={() => {}} />
            </AuthContext.Provider>
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container };
}

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
    vi.useRealTimers();
});

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    notificationMocks.dismissNotification.mockReset();
    notificationMocks.notifyAction.mockReset();
    notificationMocks.notifyAction.mockReturnValue('toast-1');
    notificationMocks.notifyError.mockReset();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.deleteDoc.mockClear();
    firebaseMocks.updateDoc.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
});

describe('Planner delete undo flow', () => {
    it('shows a shared undo notification and restores the project when undo is used', async () => {
        const { container } = await renderPlanner();

        expect(container.textContent).toContain('Projekt Alpha');

        const deleteButton = Array.from(container.querySelectorAll('button')).find((button) => (
            button.textContent?.includes('Ta bort')
        ));

        expect(deleteButton).toBeTruthy();

        await act(async () => {
            deleteButton.click();
            await Promise.resolve();
        });

        expect(notificationMocks.notifyAction).toHaveBeenCalledWith(expect.objectContaining({
            message: '"Projekt Alpha" raderades',
            actionLabel: 'Ångra',
            onAction: expect.any(Function),
            onDismiss: expect.any(Function)
        }));
        expect(container.textContent).not.toContain('Projekt Alpha');

        const [{ onAction }] = notificationMocks.notifyAction.mock.calls.map(([options]) => options);

        await act(async () => {
            await onAction();
            await Promise.resolve();
        });

        expect(notificationMocks.dismissNotification).toHaveBeenCalledWith('toast-1');
        expect(firebaseMocks.deleteDoc).not.toHaveBeenCalled();
        expect(container.textContent).toContain('Projekt Alpha');
    });
});
