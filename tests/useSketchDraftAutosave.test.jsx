// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSketchDraftAutosave } from '../src/components/features/SketchWorkspace/useSketchDraftAutosave';

afterEach(() => {
    vi.useRealTimers();
});

describe('useSketchDraftAutosave', () => {
    it('debounces changed snapshots for 500 ms by default', () => {
        vi.useFakeTimers();
        const onSave = vi.fn();
        const { result, rerender } = renderHook(
            ({ snapshot }) => useSketchDraftAutosave({ snapshot, onSave }),
            { initialProps: { snapshot: { width: 8000 } } }
        );

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onSave).not.toHaveBeenCalled();
        expect(result.current.status).toBe('saved');

        rerender({ snapshot: { width: 9000 } });
        expect(result.current.status).toBe('saving');

        act(() => {
            vi.advanceTimersByTime(499);
        });
        expect(onSave).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenLastCalledWith({ width: 9000 });
        expect(result.current.status).toBe('saved');
    });

    it('coalesces rapid changes and ignores structurally identical snapshots', () => {
        vi.useFakeTimers();
        const onSave = vi.fn();
        const { rerender } = renderHook(
            ({ snapshot }) => useSketchDraftAutosave({ snapshot, onSave }),
            { initialProps: { snapshot: { depth: 4000, width: 8000 } } }
        );

        rerender({ snapshot: { depth: 4000, width: 9000 } });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        rerender({ snapshot: { depth: 4500, width: 9000 } });

        act(() => {
            vi.advanceTimersByTime(499);
        });
        expect(onSave).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenLastCalledWith({ depth: 4500, width: 9000 });

        rerender({ snapshot: { width: 9000, depth: 4500 } });
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('flushes the latest pending snapshot without a later duplicate save', () => {
        vi.useFakeTimers();
        const onSave = vi.fn();
        const { result, rerender } = renderHook(
            ({ snapshot }) => useSketchDraftAutosave({ snapshot, onSave }),
            { initialProps: { snapshot: { width: 8000 } } }
        );

        rerender({ snapshot: { width: 9000 } });
        rerender({ snapshot: { width: 10000 } });

        act(() => {
            result.current.flush();
        });

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenLastCalledWith({ width: 10000 });
        expect(result.current.status).toBe('saved');

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('flushes an unsaved snapshot before unmount', () => {
        vi.useFakeTimers();
        const onSave = vi.fn();
        const { rerender, unmount } = renderHook(
            ({ snapshot }) => useSketchDraftAutosave({ snapshot, onSave }),
            { initialProps: { snapshot: { width: 8000 } } }
        );

        rerender({ snapshot: { width: 9000 } });
        unmount();

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenLastCalledWith({ width: 9000 });
    });

    it('supports a caller-defined debounce delay', () => {
        vi.useFakeTimers();
        const onSave = vi.fn();
        const { rerender } = renderHook(
            ({ snapshot }) => useSketchDraftAutosave({
                snapshot,
                onSave,
                delay: 100
            }),
            { initialProps: { snapshot: { width: 8000 } } }
        );

        rerender({ snapshot: { width: 9000 } });
        act(() => {
            vi.advanceTimersByTime(99);
        });
        expect(onSave).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(onSave).toHaveBeenCalledTimes(1);
    });
});
