import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_AUTOSAVE_DELAY = 500;

export type SketchDraftAutosaveStatus = 'saving' | 'saved';

export interface UseSketchDraftAutosaveOptions<TSnapshot> {
    snapshot: TSnapshot;
    onSave: (snapshot: TSnapshot) => void;
    delay?: number;
}

export interface UseSketchDraftAutosaveResult {
    status: SketchDraftAutosaveStatus;
    flush: () => void;
}

function stableSerialize(value: unknown): string {
    const ancestors = new WeakSet<object>();

    const normalize = (current: unknown): unknown => {
        if (current === null || typeof current !== 'object') {
            return current;
        }

        if (ancestors.has(current)) {
            throw new TypeError('Sketch drafts must be serializable without circular references.');
        }

        ancestors.add(current);

        let normalized: unknown;
        if (Array.isArray(current)) {
            normalized = current.map(normalize);
        } else {
            normalized = Object.keys(current)
                .sort()
                .reduce<Record<string, unknown>>((result, key) => {
                    const normalizedValue = normalize((current as Record<string, unknown>)[key]);

                    if (normalizedValue !== undefined) {
                        result[key] = normalizedValue;
                    }

                    return result;
                }, {});
        }

        ancestors.delete(current);
        return normalized;
    };

    return JSON.stringify(normalize(value)) ?? 'undefined';
}

export function useSketchDraftAutosave<TSnapshot>({
    snapshot,
    onSave,
    delay = DEFAULT_AUTOSAVE_DELAY
}: UseSketchDraftAutosaveOptions<TSnapshot>): UseSketchDraftAutosaveResult {
    const serializedSnapshot = useMemo(() => stableSerialize(snapshot), [snapshot]);
    const latestSnapshotRef = useRef({ snapshot, serialized: serializedSnapshot });
    const lastSavedSerializationRef = useRef(serializedSnapshot);
    const onSaveRef = useRef(onSave);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const [status, setStatus] = useState<SketchDraftAutosaveStatus>('saved');

    latestSnapshotRef.current = { snapshot, serialized: serializedSnapshot };
    onSaveRef.current = onSave;

    const clearPendingTimeout = useCallback(() => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const saveLatestSnapshot = useCallback(() => {
        clearPendingTimeout();

        const latest = latestSnapshotRef.current;
        if (latest.serialized === lastSavedSerializationRef.current) {
            if (mountedRef.current) {
                setStatus('saved');
            }
            return;
        }

        lastSavedSerializationRef.current = latest.serialized;
        onSaveRef.current(latest.snapshot);

        if (mountedRef.current) {
            setStatus('saved');
        }
    }, [clearPendingTimeout]);

    useEffect(() => {
        clearPendingTimeout();

        if (serializedSnapshot === lastSavedSerializationRef.current) {
            setStatus('saved');
            return undefined;
        }

        setStatus('saving');
        timeoutRef.current = setTimeout(saveLatestSnapshot, Math.max(0, delay));

        return clearPendingTimeout;
    }, [clearPendingTimeout, delay, saveLatestSnapshot, serializedSnapshot]);

    useEffect(() => () => {
        mountedRef.current = false;
        saveLatestSnapshot();
    }, [saveLatestSnapshot]);

    return {
        status,
        flush: saveLatestSnapshot
    };
}
