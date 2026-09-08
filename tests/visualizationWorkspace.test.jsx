// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VisualizationWorkspace } from '../src/features/visualization/VisualizationWorkspace';
import { sketch } from './helpers/visualizationFixtures';
import { createVisualizationScene } from '../src/features/visualization/runtime/scene';
import { downloadBlob } from '../src/utils/fileUtils';
vi.mock('../src/features/visualization/runtime/scene', () => ({ createVisualizationScene: vi.fn() }));
vi.mock('../src/utils/fileUtils', () => ({ downloadBlob: vi.fn() }));
vi.mock('../src/services/notificationService', () => ({
    notifyError: vi.fn(),
    notifyWarn: vi.fn(),
    notifyLoading: vi.fn(() => 'toast'),
    updateNotification: vi.fn(),
    dismissNotification: vi.fn()
}));
let scene;
beforeEach(() => {
    vi.clearAllMocks();
    scene = {
        problems: [],
        focusableIds: [],
        fit: vi.fn(),
        style: vi.fn(),
        quality: vi.fn(),
        rotate: vi.fn(),
        zoom: vi.fn(),
        capture: vi.fn(async () => new Blob(['png'])),
        dispose: vi.fn()
    };
    createVisualizationScene.mockResolvedValue(scene);
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);
const show = (props = {}) =>
    render(<VisualizationWorkspace config={sketch()} label="Projekt A" onBack={() => {}} {...props} />);

describe('production visualization workspace', () => {
    it('loads the real adapter boundary and exports the selected language label only when ready', async () => {
        show({ language: 'en' });
        expect(screen.getByRole('button', { name: 'Ladda ner PNG' }).disabled).toBe(true);
        await screen.findByText('Redo');
        fireEvent.click(screen.getByRole('button', { name: 'Ovanifrån' }));
        expect(scene.fit).toHaveBeenCalledWith(true);
        fireEvent.change(screen.getByLabelText('Visuell kvalitet'), { target: { value: 'simple' } });
        expect(scene.quality).toHaveBeenLastCalledWith('simple');
        fireEvent.click(screen.getByRole('button', { name: 'Ladda ner PNG' }));
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(scene.capture).toHaveBeenCalledWith('Projekt A', expect.stringContaining('simplified models'));
        expect(createVisualizationScene.mock.calls[0][1]).toHaveProperty('clickitUpRuns');
        expect(createVisualizationScene.mock.calls[0][1]).not.toHaveProperty('label');
    });
    it('blocks omitted entities, keeps degraded errors exportable and offers focus only for known positions', async () => {
        scene.problems = [
            {
                code: 'PRODUCT_DIMENSIONS_INVALID',
                effect: 'omitted',
                severity: 'error',
                entityRef: { kind: 'placed-product', id: 'bad' }
            }
        ];
        show();
        await screen.findByText('Produkten kan inte visas eftersom användbara mått eller placering saknas.');
        expect(screen.getByRole('button', { name: 'Ladda ner PNG' }).disabled).toBe(true);
        expect(screen.queryByText('Fokusera i scenen')).toBeNull();
    });
    it('aborts loading on return and disposes a late scene without mounting it', async () => {
        let resolve;
        createVisualizationScene.mockImplementation(
            () =>
                new Promise((r) => {
                    resolve = r;
                })
        );
        const view = show();
        await waitFor(() => expect(createVisualizationScene).toHaveBeenCalledTimes(1));
        const signal = createVisualizationScene.mock.calls[0][2];
        view.unmount();
        expect(signal.aborted).toBe(true);
        await act(async () => resolve(scene));
        expect(scene.dispose).toHaveBeenCalledTimes(1);
    });
    it('suppresses a late image after navigation and releases preview URLs', async () => {
        let resolve;
        scene.capture.mockImplementation(
            () =>
                new Promise((r) => {
                    resolve = r;
                })
        );
        const view = show();
        await screen.findByText('Redo');
        fireEvent.click(screen.getByRole('button', { name: 'Ladda ner PNG' }));
        view.unmount();
        await act(async () => resolve(new Blob(['png'])));
        expect(downloadBlob).not.toHaveBeenCalled();
        expect(scene.dispose).toHaveBeenCalledTimes(1);
    });
    it('recovers from real startup rejection, and a capture failure keeps the scene usable', async () => {
        createVisualizationScene.mockRejectedValueOnce(new Error('WebGL failed'));
        show();
        fireEvent.click(await screen.findByRole('button', { name: 'Försök igen' }));
        await screen.findByText('Redo');
        scene.capture.mockRejectedValueOnce(new Error('capture failed'));
        fireEvent.click(screen.getByRole('button', { name: 'Ladda ner PNG' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Ladda ner PNG' }).disabled).toBe(false)
        );
        expect(downloadBlob).not.toHaveBeenCalled();
    });
    it('does not create a renderer for missing or malformed sketches', () => {
        const view = show({ config: undefined });
        expect(screen.getByText('Det finns ingen enkel skiss att visa ännu.')).toBeTruthy();
        view.rerender(<VisualizationWorkspace config={{ width: NaN }} label="" onBack={() => {}} />);
        expect(screen.getByText('3D-visualiseringen kan inte visas från den här skissen.')).toBeTruthy();
        expect(createVisualizationScene).not.toHaveBeenCalled();
    });
});
