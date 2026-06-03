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
    const onCancel = vi.fn();
    const onDelete = vi.fn();

    await act(async () => {
        root.render(
            <InventoryItemModal
                item={null}
                mode="create"
                existingIds={[]}
                onSave={onSave}
                onDelete={onDelete}
                onCancel={onCancel}
                {...props}
            />
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container, onSave, onCancel, onDelete };
}

function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function openOptionsForInput(container, input) {
    await act(async () => {
        input.focus();
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        await Promise.resolve();
    });

    return Array.from(input.parentElement.querySelectorAll('[role="option"]')).map((option) => option.textContent);
}

async function openPopupRowsForInput(container, input) {
    await act(async () => {
        input.focus();
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        await Promise.resolve();
    });

    return Array.from(input.parentElement.querySelectorAll('[role="listbox"] > *')).map((row) => row.textContent);
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
    it('shows a notification instead of alert when ID is missing', async () => {
        const { container, onSave } = await renderModal();
        const form = container.querySelector('form');

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(notificationMocks.notifyError).toHaveBeenCalledWith('Du måste ange ett lager-ID.');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('trims and saves BaHaMa V2 inventory fields', async () => {
        const { container, onSave } = await renderModal({
            item: {
                id: ' BA-001 ',
                type: ' Parasoll ',
                size: ' 4x4 ',
                status: 'reserved',
                location: ' Grenställ 3 ',
                properties: {
                    stativ: ' RAL 7016 ',
                    textil: ' 9947 - mushroom ',
                    fot: ' Tipping ',
                    belysning: ' Classic ',
                    varme: ' Heaters '
                },
                comment: ' Reserverad ',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
                updatedByUid: '',
                updatedByEmail: ''
            },
            mode: 'edit',
            existingIds: [' BA-001 ']
        });
        const form = container.querySelector('form');

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(onSave).toHaveBeenCalledWith({
            id: 'BA-001',
            type: 'Parasoll',
            size: '4x4',
            status: 'reserved',
            location: 'Grenställ 3',
                properties: {
                    stativ: 'RAL 7016',
                    textil: '9947 - mushroom',
                    fot: 'Tipping',
                    belysning: 'Classic',
                    varme: 'Heaters'
                },
            comment: 'Reserverad',
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-01T10:00:00.000Z',
            updatedByUid: '',
            updatedByEmail: ''
        }, ' BA-001 ');
    });

    it('validates that lager-ID is unique', async () => {
        const { container, onSave } = await renderModal({
            item: {
                id: 'BA-001',
                type: '',
                size: '',
                status: 'available',
                location: '',
                properties: { stativ: '', textil: '', fot: '', belysning: '', varme: '' },
                comment: '',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
                updatedByUid: '',
                updatedByEmail: ''
            },
            mode: 'edit',
            existingIds: ['BA-001', 'BA-002']
        });
        const idInput = container.querySelector('input[type="text"]');
        const form = container.querySelector('form');

        await act(async () => {
            setInputValue(idInput, 'BA-002');
            await Promise.resolve();
        });

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(notificationMocks.notifyError).toHaveBeenCalledWith('Lager-ID måste vara unikt.');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('offers presets while still accepting free text values', async () => {
        const { container, onSave } = await renderModal();
        const idInput = container.querySelector('input[placeholder="BA-001"]');
        const typeInput = container.querySelector('input[placeholder="Pure"]');
        const locationInput = container.querySelector('input[placeholder="Grenställ 3 våning 5"]');
        const textileInput = container.querySelector('input[placeholder="9947 - mushroom"]');
        const form = container.querySelector('form');

        expect(await openOptionsForInput(container, typeInput)).toEqual(['Pure', 'Jumbrella', 'XL']);
        expect(await openPopupRowsForInput(container, locationInput)).toEqual(expect.arrayContaining([
            '--- GRENSTÄLL 1 ---',
            'Våning 1',
            '--- GRENSTÄLL 6 ---',
            'Våning 7'
        ]));
        expect(await openOptionsForInput(container, textileInput)).toContain('9947 - mushroom');
        expect(await openOptionsForInput(container, textileInput)).toContain('2821 - Silver');
        expect(await openPopupRowsForInput(container, textileInput)).toEqual(expect.arrayContaining([
            '--- BETEX 05 ---',
            '--- AKRYL ---'
        ]));

        await act(async () => {
            setInputValue(idInput, 'BA-FRI');
            setInputValue(typeInput, 'Specialmodell');
            setInputValue(textileInput, 'Custom textil');
            await Promise.resolve();
        });

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            id: 'BA-FRI',
            type: 'Specialmodell',
            properties: expect.objectContaining({
                textil: 'Custom textil'
            })
        }), null);
    });

    it('saves the full storage location when a grouped floor preset is selected', async () => {
        const { container, onSave } = await renderModal();
        const idInput = container.querySelector('input[placeholder="BA-001"]');
        const locationInput = container.querySelector('input[placeholder="Grenställ 3 våning 5"]');
        const form = container.querySelector('form');

        await act(async () => {
            setInputValue(idInput, 'BA-003');
            setInputValue(locationInput, 'Grenställ 3');
            await Promise.resolve();
        });

        await openOptionsForInput(container, locationInput);
        const floorOption = Array.from(locationInput.parentElement.querySelectorAll('[role="option"]'))
            .find((option) => option.textContent === 'Våning 5');

        await act(async () => {
            floorOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            id: 'BA-003',
            location: 'Grenställ 3 våning 5'
        }), null);
    });

    it('updates size presets from the selected parasol type without clearing the current size', async () => {
        const { container } = await renderModal({
            item: {
                id: 'BA-001',
                type: 'Pure',
                size: 'Fri storlek',
                status: 'available',
                location: '',
                properties: { stativ: '', textil: '', fot: '', belysning: '', varme: '' },
                comment: '',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
                updatedByUid: '',
                updatedByEmail: ''
            },
            mode: 'edit'
        });
        const typeInput = container.querySelector('input[placeholder="Pure"]');
        const sizeInput = container.querySelector('input[placeholder="4x4"]');

        expect(sizeInput.value).toBe('Fri storlek');
        expect(await openOptionsForInput(container, sizeInput)).toContain('2x2');
        expect(await openOptionsForInput(container, sizeInput)).not.toContain('7x7 Kvadrat');
        expect(await openPopupRowsForInput(container, sizeInput)).toEqual(expect.arrayContaining([
            '--- KVADRAT ---',
            '--- RUNDA ---',
            '--- REKTANGEL ---'
        ]));

        await act(async () => {
            setInputValue(typeInput, 'XL');
            await Promise.resolve();
        });

        expect(sizeInput.value).toBe('Fri storlek');
        expect(await openOptionsForInput(container, sizeInput)).toContain('7x7 Kvadrat');
        expect(await openOptionsForInput(container, sizeInput)).not.toContain('2x2');
    });
});
