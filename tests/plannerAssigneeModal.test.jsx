// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ProjectDetailsModal } from '../src/views/Planner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots = [];

function createProject(overrides = {}) {
    return {
        id: 'project-1',
        title: 'Projekt',
        done: false,
        contractor: '',
        priority: 'Normal',
        createdAt: 1710000000000,
        createdBy: 'admin@example.com',
        week: '2026-W17',
        address: '',
        phone: '',
        notes: '',
        assignees: [],
        ...overrides
    };
}

async function renderModal(props = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();

    await act(async () => {
        root.render(
            <ProjectDetailsModal
                project={createProject(props.project)}
                onClose={onClose}
                onSave={onSave}
            />
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container, onSave, onClose };
}

function getByTestId(container, testId) {
    const node = container.querySelector(`[data-testid="${testId}"]`);
    expect(node).toBeTruthy();
    return node;
}

function createDataTransfer() {
    const payload = {};

    return {
        effectAllowed: 'all',
        dropEffect: 'move',
        setData(type, value) {
            payload[type] = value;
        },
        getData(type) {
            return payload[type] || '';
        }
    };
}

async function dispatchDragEvent(node, type, dataTransfer) {
    await act(async () => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        node.dispatchEvent(event);
        await Promise.resolve();
    });
}

async function click(node) {
    await act(async () => {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
    });
}

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
    vi.clearAllMocks();
});

describe('planner assignee modal', () => {
    it('renders the fixed assignee pool and saves drag-and-drop assignees without duplicates', async () => {
        const { container, onSave, onClose } = await renderModal();
        const johanOption = getByTestId(container, 'planner-assignee-option-johan@brixx.se');
        const erikOption = getByTestId(container, 'planner-assignee-option-erik@brixx.se');
        const dropzone = getByTestId(container, 'planner-assignee-dropzone');
        const saveButton = getByTestId(container, 'planner-assignee-save');

        expect(container.textContent).toContain('johan@brixx.se');
        expect(container.textContent).toContain('info@brixx.se');
        expect(container.textContent).toContain('erik@brixx.se');

        const firstTransfer = createDataTransfer();
        await dispatchDragEvent(johanOption, 'dragstart', firstTransfer);
        await dispatchDragEvent(dropzone, 'dragover', firstTransfer);
        await dispatchDragEvent(dropzone, 'drop', firstTransfer);

        const duplicateTransfer = createDataTransfer();
        await dispatchDragEvent(johanOption, 'dragstart', duplicateTransfer);
        await dispatchDragEvent(dropzone, 'drop', duplicateTransfer);

        const secondTransfer = createDataTransfer();
        await dispatchDragEvent(erikOption, 'dragstart', secondTransfer);
        await dispatchDragEvent(dropzone, 'drop', secondTransfer);

        expect(container.textContent).toContain('Johan');
        expect(container.textContent).toContain('Erik');

        await click(saveButton);

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            assignees: ['johan@brixx.se', 'erik@brixx.se']
        }));
        expect(onClose).toHaveBeenCalled();
    });

    it('allows removing an assignee before saving', async () => {
        const { container, onSave } = await renderModal({
            project: { assignees: ['johan@brixx.se', 'info@brixx.se'] }
        });

        const removeJohan = getByTestId(container, 'planner-assignee-remove-johan@brixx.se');
        const saveButton = getByTestId(container, 'planner-assignee-save');

        await click(removeJohan);
        await click(saveButton);

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            assignees: ['info@brixx.se']
        }));
    });
});
