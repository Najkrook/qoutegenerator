// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const notificationMocks = vi.hoisted(() => ({
    notifyError: vi.fn()
}));

vi.mock('../src/services/notificationService', () => notificationMocks);

import { InventoryItemModal } from '../src/components/features/InventoryItemModal';

const mountedRoots = [];

async function renderModal(props = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSave = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
        root.render(
            <InventoryItemModal
                item={null}
                editIndex={-1}
                onSave={onSave}
                onClose={onClose}
                {...props}
            />
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container, onSave, onClose };
}

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
});

beforeEach(() => {
    notificationMocks.notifyError.mockReset();
});

describe('InventoryItemModal', () => {
    it('shows a notification instead of alert when required fields are missing', async () => {
        const { container, onSave } = await renderModal();
        const form = container.querySelector('form');

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(notificationMocks.notifyError).toHaveBeenCalledWith('Du måste minst ange ID och beskrivning.');
        expect(onSave).not.toHaveBeenCalled();
    });
});
