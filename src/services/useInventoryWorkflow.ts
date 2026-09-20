import { useMemo, useRef, useState } from 'react';
import type { InventoryData } from '../types/contracts';
import type { BahamaInventoryMoveChange } from './bahamaInventoryMove';
import { cloneSerializable } from '../utils/runtime';
import { ensureBahamaQrIds } from './bahamaQrService';
import { getInventoryChanges } from './inventoryChanges';
import { saveInventoryBatch, type InventorySaveAdapter, type InventorySaveRequest } from './inventorySaveAdapter';

interface MoveHistoryEntry {
    changes: BahamaInventoryMoveChange[];
    label: string;
    sourceQrId: string;
}

interface InventoryWorkflowOptions {
    inventory: InventoryData;
    baseline: InventoryData;
    updateDraft: (inventory: InventoryData) => void;
    updateBaseline: (inventory: InventoryData) => void;
    persist?: InventorySaveAdapter;
}

/** The draft stays editable while saving. Only the captured baseline advances on success. */
export function useInventoryWorkflow({ inventory, baseline, updateDraft, updateBaseline, persist = saveInventoryBatch }: InventoryWorkflowOptions) {
    const [isSaving, setIsSaving] = useState(false);
    const saving = useRef(false);
    const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
    const changes = useMemo(() => getInventoryChanges(inventory, baseline), [inventory, baseline]);

    const save = async (actor: InventorySaveRequest['actor']): Promise<boolean> => {
        if (saving.current || changes.length === 0) return false;
        saving.current = true;
        setIsSaving(true);
        try {
            const snapshot = cloneSerializable(inventory);
            snapshot.bahamaV2 = ensureBahamaQrIds(snapshot.bahamaV2);
            // Assign missing identities before I/O, never by replacing a newer draft on completion.
            if (JSON.stringify(snapshot) !== JSON.stringify(inventory)) updateDraft(cloneSerializable(snapshot));
            const savedHistory = new Set(moveHistory);
            await persist({ inventory: snapshot, baseline: cloneSerializable(baseline),
                changes: getInventoryChanges(snapshot, baseline), actor });
            updateBaseline(cloneSerializable(snapshot));
            setMoveHistory((history) => history.filter((entry) => !savedHistory.has(entry)));
            return true;
        } finally {
            saving.current = false;
            setIsSaving(false);
        }
    };

    return { changes, isSaving, save, moveHistory, setMoveHistory };
}
