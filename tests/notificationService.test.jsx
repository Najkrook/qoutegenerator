// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toastState = vi.hoisted(() => {
    const state = {
        lastCustomRenderer: null
    };

    const toastFn = vi.fn(() => 'info-toast-id');
    toastFn.success = vi.fn(() => 'success-toast-id');
    toastFn.error = vi.fn(() => 'error-toast-id');
    toastFn.loading = vi.fn(() => 'loading-toast-id');
    toastFn.dismiss = vi.fn();
    toastFn.custom = vi.fn((renderer) => {
        state.lastCustomRenderer = renderer;
        return 'action-toast-id';
    });

    return { toastFn, state };
});

vi.mock('react-hot-toast', () => ({
    default: toastState.toastFn
}));

import {
    dismissNotification,
    notifyAction,
    notifyError,
    notifyInfo,
    notifyLoading,
    notifySuccess,
    notifyWarn,
    updateNotification
} from '../src/services/notificationService';

const mountedRoots = [];

function mountToast(visible) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
        root.render(toastState.state.lastCustomRenderer({ id: 'action-toast-id', visible }));
    });

    mountedRoots.push({ root, container });
    return container;
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
    toastState.state.lastCustomRenderer = null;
    toastState.toastFn.mockClear();
    toastState.toastFn.success.mockClear();
    toastState.toastFn.error.mockClear();
    toastState.toastFn.loading.mockClear();
    toastState.toastFn.dismiss.mockClear();
    toastState.toastFn.custom.mockClear();
});

describe('notificationService', () => {
    it('maps toast wrappers to the expected hot-toast methods', () => {
        expect(notifySuccess('Sparad')).toBe('success-toast-id');
        expect(notifyError('Misslyckades')).toBe('error-toast-id');
        expect(notifyInfo('Info')).toBe('info-toast-id');
        expect(notifyWarn('Varning')).toBe('info-toast-id');

        expect(toastState.toastFn.success).toHaveBeenCalledWith('Sparad', expect.objectContaining({ duration: 3500 }));
        expect(toastState.toastFn.error).toHaveBeenCalledWith('Misslyckades', expect.objectContaining({ duration: 5000 }));
        expect(toastState.toastFn).toHaveBeenCalledWith('Info', expect.objectContaining({ icon: '!' }));
        expect(toastState.toastFn).toHaveBeenCalledWith('Varning', expect.objectContaining({ icon: '⚠️' }));
    });

    it('supports loading, update, and dismiss by toast id', () => {
        expect(notifyLoading('Laddar...')).toBe('loading-toast-id');
        expect(updateNotification('loading-toast-id', { type: 'success', message: 'Klar' })).toBe('success-toast-id');

        dismissNotification('loading-toast-id');

        expect(toastState.toastFn.loading).toHaveBeenCalledWith('Laddar...', expect.objectContaining({ id: undefined }));
        expect(toastState.toastFn.success).toHaveBeenCalledWith('Klar', expect.objectContaining({
            id: 'loading-toast-id',
            duration: 3500
        }));
        expect(toastState.toastFn.dismiss).toHaveBeenCalledWith('loading-toast-id');
    });

    it('renders action notifications and runs the undo action', async () => {
        const onAction = vi.fn();

        notifyAction({
            message: '"Projekt A" raderades',
            actionLabel: 'Ångra',
            onAction
        });

        expect(toastState.toastFn.custom).toHaveBeenCalledTimes(1);

        const container = mountToast(true);
        const actionButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Ångra');

        expect(actionButton).toBeTruthy();

        await act(async () => {
            actionButton.click();
            await Promise.resolve();
        });

        expect(onAction).toHaveBeenCalledTimes(1);
        expect(toastState.toastFn.dismiss).toHaveBeenCalledWith('action-toast-id');
    });

    it('runs onDismiss when an action notification closes without undo', async () => {
        const onDismiss = vi.fn();

        notifyAction({
            message: '"Projekt B" raderades',
            actionLabel: 'Ångra',
            onAction: vi.fn(),
            onDismiss
        });

        mountToast(true);

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        mountedRoots.push({ root, container });

        await act(async () => {
            root.render(toastState.state.lastCustomRenderer({ id: 'action-toast-id', visible: false }));
            await Promise.resolve();
        });

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
