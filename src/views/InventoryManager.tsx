import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { db, doc, getDoc } from '../services/firebase';
import { InventoryTable } from '../components/features/InventoryTable';
import { ClickitupStockGrid } from '../components/features/ClickitupStockGrid';
import { ClickitupAccessoryStock } from '../components/features/ClickitupAccessoryStock';
import { InventoryItemModal } from '../components/features/InventoryItemModal';
import { PendingChangesPanel } from '../components/features/PendingChangesPanel';
import {
    BahamaRackDetail,
    BahamaStorageMap,
    BahamaStorageSidebar,
    type BahamaStorageFocusRequest
} from '../components/features/BahamaStorageMap';
import { BahamaMoveDialog } from '../components/features/BahamaMoveDialog';
import {
    BAHAMA_INVENTORY_STATUSES,
    cloneInventoryData,
    createDefaultInventoryData,
    normalizeStoredInventoryData
} from './inventoryData';
import {
    confirmAction,
    confirmChoiceAction,
    notifyError,
    notifySuccess
} from '../services/notificationService';
import { getErrorMessage } from '../utils/runtime';
import { useInventoryWorkflow } from '../services/useInventoryWorkflow';
import { getAccessoryLabel, getClickitupCountProgress, seedMissingClickitupAccessories, setClickitupAccessoryQuantity, setClickitupSizeQuantity, toggleClickitupCounted } from '../services/clickitupInventory';
import {
    clearClickitupInventoryDraft,
    createClickitupDraftSnapshot,
    readClickitupInventoryDraft,
    restoreClickitupInventoryDraft,
    writeClickitupInventoryDraft
} from '../services/clickitupInventoryDraft';
import {
    formatBahamaStorageLocation,
    groupBahamaInventoryByStorageLocation,
    type BahamaRackNumber,
    type BahamaStorageGrouping,
    type BahamaStorageLocation
} from '../services/bahamaStorageLocation';
import {
    planBahamaInventoryMove,
    undoBahamaInventoryMove
} from '../services/bahamaInventoryMove';
import {
    getInventoryRouteSearch,
    getClickitupInventoryRouteSearch,
    readClickitupInventoryRoute,
    readInventoryRouteState,
    type InventoryView
} from '../navigation/inventoryLinks';
import type {
    BahamaInventoryStatus,
    BahamaInventoryV2Item,
    ClickitupFieldKey,
    InventoryData,
    InventoryManagerProps
} from '../types/contracts';

type InspectorMode = 'view' | 'create' | 'edit';

interface InventoryViewTabsProps {
    view: InventoryView;
    onChange: (view: 'map' | 'list') => void;
}

const DEFAULT_INVENTORY_DATA: InventoryData = createDefaultInventoryData();

const STATUS_LABELS: Record<BahamaInventoryStatus, string> = {
    available: 'Tillgänglig',
    reserved: 'Reserverad',
    'needs-review': 'Kontroll',
    used: 'Begagnad',
    sold: 'Såld'
};

function InventoryViewTabs({ view, onChange }: InventoryViewTabsProps) {
    return (
        <div className="inline-flex overflow-hidden rounded-lg border border-white/15 bg-[#10171c]" role="tablist" aria-label="Visningsläge för BaHaMa-lagret">
            <button
                type="button"
                role="tab"
                aria-selected={view !== 'list'}
                onClick={() => onChange('map')}
                className={`min-w-32 px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2] ${view !== 'list' ? 'bg-[#eadfce] text-[#17130f]' : 'text-slate-300 hover:bg-white/5'}`}
            >
                Lagerkarta
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => onChange('list')}
                className={`min-w-28 border-l border-white/10 px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2] ${view === 'list' ? 'bg-[#eadfce] text-[#17130f]' : 'text-slate-300 hover:bg-white/5'}`}
            >
                Lista
            </button>
        </div>
    );
}

function getStoragePresentation(items: BahamaInventoryV2Item[]): {
    grouping: BahamaStorageGrouping;
    error: string | null;
} {
    try {
        return {
            grouping: groupBahamaInventoryByStorageLocation(items),
            error: null
        };
    } catch (error) {
        return {
            grouping: {
                ...groupBahamaInventoryByStorageLocation([]),
                unplacedItems: items
            },
            error: getErrorMessage(error, 'Lagerplatserna kunde inte grupperas.')
        };
    }
}

function getSafeInventoryData(inventoryData: InventoryData | undefined): InventoryData {
    return normalizeStoredInventoryData({
        ...DEFAULT_INVENTORY_DATA,
        ...(inventoryData || {})
    });
}

function sortBahamaItems(items: BahamaInventoryV2Item[]): BahamaInventoryV2Item[] {
    return [...items].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
}

function getSearchBlob(item: BahamaInventoryV2Item): string {
    return [
        item.id,
        item.type,
        item.size,
        STATUS_LABELS[item.status],
        item.status,
        item.location,
        item.properties.stativ,
        item.properties.textil,
        item.properties.fot,
        item.properties.belysning,
        item.properties.varme,
        item.comment
    ].join(' ').toLowerCase();
}

function getUserEmail(user: { email?: string | null } | null): string {
    return user?.email || 'unknown';
}

function getUserUid(user: { uid?: string | null } | null): string {
    return user?.uid || '';
}

export function InventoryManager(_props: InventoryManagerProps) {
    const { state, dispatch } = useQuote();
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | BahamaInventoryStatus>('all');
    const [sizeFilter, setSizeFilter] = useState('all');
    const [selectedBahamaQrId, setSelectedBahamaQrId] = useState<string | null>(null);
    const [inspectorMode, setInspectorMode] = useState<InspectorMode>('view');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [draggingBahamaQrId, setDraggingBahamaQrId] = useState<string | null>(null);
    const [moveDialogQrId, setMoveDialogQrId] = useState<string | null>(null);
    const [storageFocusRequest, setStorageFocusRequest] = useState<BahamaStorageFocusRequest | null>(null);
    const storageFocusSequence = useRef(0);
    const dropHandledRef = useRef(false);

    const inventoryData = useMemo(() => getSafeInventoryData(state.inventoryData), [state.inventoryData]);
    const cloudInventoryData = useMemo(() => getSafeInventoryData(state.cloudInventoryData), [state.cloudInventoryData]);
    const { changes, isSaving, save, moveHistory, setMoveHistory } = useInventoryWorkflow({
        inventory: inventoryData,
        baseline: cloudInventoryData,
        updateDraft: (payload) => dispatch({ type: 'SET_INVENTORY_DATA', payload }),
        updateBaseline: (payload) => dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload })
    });
    const bahamaItems = inventoryData.bahamaV2 || [];
    const sortedBahamaItems = useMemo(() => sortBahamaItems(bahamaItems), [bahamaItems]);
    const selectedItem = useMemo(
        () => sortedBahamaItems.find((item) => item.qrId === selectedBahamaQrId) || null,
        [selectedBahamaQrId, sortedBahamaItems]
    );
    const moveDialogItem = useMemo(
        () => sortedBahamaItems.find((item) => item.qrId === moveDialogQrId) || null,
        [moveDialogQrId, sortedBahamaItems]
    );
    const inventoryRoute = readInventoryRouteState(searchParams);
    const clickitupRoute = readClickitupInventoryRoute(searchParams);
    const activeLine = clickitupRoute.line;
    const countProgress = getClickitupCountProgress(inventoryData.clickitupCounted);
    const storagePresentation = useMemo(
        () => getStoragePresentation(sortedBahamaItems),
        [sortedBahamaItems]
    );
    const selectedRack = storagePresentation.grouping.racks.find((rack) => rack.rack === inventoryRoute.rack)
        || storagePresentation.grouping.racks[0];

    const sizeOptions = useMemo(() => {
        const sizes = new Set<string>();
        sortedBahamaItems.forEach((item) => {
            if (item.size) {
                sizes.add(item.size);
            }
        });
        return Array.from(sizes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [sortedBahamaItems]);

    const filteredBahamaItems = useMemo(() => {
        const lowerTerm = searchTerm.trim().toLowerCase();
        return sortedBahamaItems.filter((item) => {
            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
            }
            if (sizeFilter !== 'all' && item.size !== sizeFilter) {
                return false;
            }
            if (!lowerTerm) {
                return true;
            }
            return getSearchBlob(item).includes(lowerTerm);
        });
    }, [searchTerm, sizeFilter, sortedBahamaItems, statusFilter]);

    const changesPending = changes.length > 0;

    const navigateInventory = (view: InventoryView, rack: BahamaRackNumber = inventoryRoute.rack) => {
        setSearchParams(new URLSearchParams(getInventoryRouteSearch(view, rack)));
    };

    const navigateClickitup = (tab: 'sections' | 'accessories' = 'sections') => {
        setSearchParams(new URLSearchParams(getClickitupInventoryRouteSearch(tab)));
    };

    const loadInventory = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const docRef = doc(db, 'stock', 'main_inventory');
            const docSnap = await getDoc(docRef);
            const rawInventory = docSnap.exists() ? docSnap.data() : null;
            const loadedInventory = rawInventory
                ? normalizeStoredInventoryData(rawInventory)
                : createDefaultInventoryData();
            let workingInventory = seedMissingClickitupAccessories(cloneInventoryData(loadedInventory), rawInventory);
            const localDraft = readClickitupInventoryDraft(user?.uid);
            if (localDraft) {
                const recovery = restoreClickitupInventoryDraft(loadedInventory, localDraft);
                const resumedInventory = restoreClickitupInventoryDraft(workingInventory, localDraft).inventory;
                const hasConflict = recovery.conflicts.length > 0;
                const conflictLabels = recovery.conflicts.slice(0, 3).map((item) => item.startsWith('accessory:')
                    ? getAccessoryLabel(item.slice('accessory:'.length))
                    : item.startsWith('size:') ? `Storlek ${item.slice('size:'.length)}` : getAccessoryLabel(item));
                const choice = await confirmChoiceAction({
                    title: hasConflict ? 'Molnlagret har ändrats' : 'Återuppta inventering?',
                    message: hasConflict
                        ? `${recovery.conflicts.length} av dina ändrade rader har också ändrats i molnet (${conflictLabels.join(', ')}${recovery.conflicts.length > 3 ? ' med flera' : ''}). Om du återupptar används dina lokala värden för dessa rader; övriga molnändringar behålls.`
                        : 'Det finns osparade ClickitUp-ändringar på den här enheten. Vill du fortsätta där du slutade?',
                    confirmText: 'Återuppta lokalt',
                    cancelText: 'Använd molnlagret',
                    tone: hasConflict ? 'danger' : 'neutral'
                });
                if (choice === 'confirm') workingInventory = resumedInventory;
                else clearClickitupInventoryDraft(user?.uid);
            }

            dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(loadedInventory) });
            dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(workingInventory) });
            setMoveHistory([]);
        } catch (err) {
            console.error('Failed to load Firestore inventory:', err);
            setLoadError(getErrorMessage(err, 'Kunde inte läsa lagersaldot.'));
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, user?.uid]);

    useEffect(() => {
        void loadInventory();
    }, [loadInventory]);

    useEffect(() => {
        if (isLoading || loadError) return;
        writeClickitupInventoryDraft(
            user?.uid,
            createClickitupDraftSnapshot(cloudInventoryData),
            createClickitupDraftSnapshot(inventoryData)
        );
    }, [cloudInventoryData, inventoryData, isLoading, loadError, user?.uid]);

    useEffect(() => {
        if (inspectorMode === 'create') {
            return;
        }
        if (selectedBahamaQrId && sortedBahamaItems.some((item) => item.qrId === selectedBahamaQrId)) {
            return;
        }
        setSelectedBahamaQrId(sortedBahamaItems[0]?.qrId || null);
        setInspectorMode(sortedBahamaItems[0] ? 'edit' : 'view');
    }, [inspectorMode, selectedBahamaQrId, sortedBahamaItems]);

    const replaceBahamaItems = (items: BahamaInventoryV2Item[]) => {
        dispatch({
            type: 'SET_INVENTORY_DATA',
            payload: {
                ...inventoryData,
                bahamaV2: sortBahamaItems(items)
            }
        });
    };

    const handleSelectItem = (item: BahamaInventoryV2Item) => {
        setSelectedBahamaQrId(item.qrId);
        setInspectorMode('edit');
    };

    const requestStorageFocus = (qrId: string) => {
        storageFocusSequence.current += 1;
        setStorageFocusRequest({ qrId, sequence: storageFocusSequence.current });
    };

    const handleCreateItem = () => {
        navigateInventory('list');
        setSelectedBahamaQrId(null);
        setInspectorMode('create');
    };

    const handleSaveBahamaItem = (item: BahamaInventoryV2Item, previousId: string | null) => {
        const now = new Date().toISOString();
        const userEmail = getUserEmail(user);
        const userUid = getUserUid(user);
        const existingItem = previousId ? bahamaItems.find((candidate) => candidate.id === previousId) : null;
        const nextItem: BahamaInventoryV2Item = {
            ...item,
            createdAt: existingItem?.createdAt || item.createdAt || now,
            updatedAt: now,
            updatedByUid: userUid,
            updatedByEmail: userEmail
        };

        const nextItems = previousId
            ? bahamaItems.map((candidate) => candidate.id === previousId ? nextItem : candidate)
            : [...bahamaItems, nextItem];

        replaceBahamaItems(nextItems);
        setMoveHistory([]);
        setSelectedBahamaQrId(nextItem.qrId);
        setInspectorMode('edit');
        notifySuccess(previousId ? 'BaHaMa-artikel uppdaterad' : 'BaHaMa-artikel tillagd');
    };

    const handleDeleteBahamaItem = async (item: BahamaInventoryV2Item) => {
        const confirmed = await confirmAction({
            title: 'Ta bort artikel',
            message: `Ta bort BaHaMa-artikel ${item.id}?`,
            confirmText: 'Ta bort',
            cancelText: 'Avbryt',
            tone: 'danger'
        });
        if (!confirmed) return;

        replaceBahamaItems(bahamaItems.filter((candidate) => candidate.id !== item.id));
        setMoveHistory([]);
        setSelectedBahamaQrId(null);
        setInspectorMode('view');
        notifySuccess('BaHaMa-artikel borttagen');
    };

    const handleStageBahamaMove = async (
        sourceQrId: string,
        target: BahamaStorageLocation | null
    ): Promise<boolean> => {
        const plan = planBahamaInventoryMove(bahamaItems, sourceQrId, target, {
            updatedAt: new Date().toISOString(),
            updatedByUid: getUserUid(user),
            updatedByEmail: getUserEmail(user)
        });

        if (plan.status === 'blocked') {
            notifyError(plan.reason === 'target-conflict'
                ? 'Platsen har en konflikt och kan inte användas som mål.'
                : 'Artikeln kunde inte hittas i den lokala arbetskopian.');
            requestStorageFocus(sourceQrId);
            return false;
        }

        if (plan.status === 'noop') {
            requestStorageFocus(sourceQrId);
            return true;
        }

        if (plan.requiresConfirmation && plan.displacedItem) {
            const targetLabel = target ? formatBahamaStorageLocation(target) : 'Ej placerade';
            const confirmed = await confirmAction({
                title: 'Bekräfta platsväxling',
                message: `${targetLabel} används av ${plan.displacedItem.id}. Byt plats på ${plan.sourceItem?.id || 'artikeln'} och ${plan.displacedItem.id}?`,
                confirmText: 'Byt plats',
                cancelText: 'Avbryt',
                tone: 'neutral'
            });
            if (!confirmed) {
                requestStorageFocus(sourceQrId);
                return false;
            }
        }

        replaceBahamaItems(plan.items);
        setMoveHistory((history) => [...history, {
            changes: plan.changes,
            label: `${plan.sourceItem?.id || 'Artikel'} → ${target ? formatBahamaStorageLocation(target) : 'Ej placerade'}`,
            sourceQrId
        }]);
        setSelectedBahamaQrId(sourceQrId);
        setInspectorMode('edit');
        if (target) {
            navigateInventory('rack', target.rack);
        }
        requestStorageFocus(sourceQrId);
        notifySuccess(plan.kind === 'swap' ? 'Platsväxling lagd i väntande ändringar' : 'Flytt lagd i väntande ändringar');
        return true;
    };

    const handleUndoBahamaMove = () => {
        const latestMove = moveHistory.at(-1);
        if (!latestMove) {
            return;
        }
        replaceBahamaItems(undoBahamaInventoryMove(bahamaItems, latestMove.changes));
        setMoveHistory((history) => history.slice(0, -1));
        setSelectedBahamaQrId(latestMove.sourceQrId);
        requestStorageFocus(latestMove.sourceQrId);
        notifySuccess('Senaste flytten ångrades');
    };

    const handleDragStartItem = (item: BahamaInventoryV2Item, event: React.DragEvent<HTMLElement>) => {
        dropHandledRef.current = false;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.qrId);
        setDraggingBahamaQrId(item.qrId);
        setSelectedBahamaQrId(item.qrId);
    };

    const handleDragEndItem = (item: BahamaInventoryV2Item) => {
        setDraggingBahamaQrId(null);
        if (dropHandledRef.current) {
            dropHandledRef.current = false;
        } else {
            requestStorageFocus(item.qrId);
        }
    };

    const handleDropItem = (sourceQrId: string, target: BahamaStorageLocation | null) => {
        dropHandledRef.current = true;
        setDraggingBahamaQrId(null);
        void handleStageBahamaMove(sourceQrId, target);
    };

    const handleOpenMoveDialog = (item: BahamaInventoryV2Item) => {
        handleSelectItem(item);
        setMoveDialogQrId(item.qrId);
    };

    const handleSetStock = (size: string, field: ClickitupFieldKey, value: number) => {
        const next = setClickitupSizeQuantity(inventoryData, size, field, value);
        if (next !== inventoryData) dispatch({ type: 'SET_INVENTORY_DATA', payload: next });
    };

    const handleSetAccessoryStock = (id: string, value: number) => {
        const next = setClickitupAccessoryQuantity(inventoryData, id, value);
        if (next !== inventoryData) dispatch({ type: 'SET_INVENTORY_DATA', payload: next });
    };

    const handleToggleCounted = (type: 'size' | 'accessory', id: string) => {
        const next = toggleClickitupCounted(inventoryData, type, id);
        if (next !== inventoryData) dispatch({ type: 'SET_INVENTORY_DATA', payload: next });
    };

    const handleNewCountRound = async () => {
        if (Object.keys(inventoryData.clickitupCounted).length === 0) return;
        const confirmed = await confirmAction({
            title: 'Starta ny inventeringsrunda',
            message: 'Rensa alla ClickitUp-avprickningar? Lagersaldona behålls.',
            confirmText: 'Rensa avprickningar',
            cancelText: 'Avbryt',
            tone: 'danger'
        });
        if (!confirmed) return;
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...inventoryData, clickitupCounted: {} } });
    };

    const handleCommit = async () => {
        if (!user) {
            notifyError('Du måste vara inloggad för att spara ändringar.');
            return;
        }

        try {
            if (await save(user)) notifySuccess('Ändringar sparade till molnet!');
        } catch (err) {
            console.error('Failed to commit:', err);
            notifyError(getErrorMessage(err, 'Nätverksfel. Kontrollera din internetuppkoppling.'));
        }
    };

    const inventoryInspector = (
        <InventoryItemModal
            item={inspectorMode === 'create' ? null : selectedItem}
            mode={inspectorMode}
            existingIds={bahamaItems.map((item) => item.id)}
            onSave={handleSaveBahamaItem}
            onDelete={(item) => {
                void handleDeleteBahamaItem(item);
            }}
            onCancel={() => {
                setInspectorMode(selectedItem ? 'edit' : 'view');
            }}
        />
    );

    const pendingChangesPanel = (
        <div className="space-y-4">
            {moveHistory.length > 0 ? (
                <section aria-label="Ångra lagerflytt" className="rounded-xl border border-[#d9bd91]/30 bg-[#d9bd91]/10 p-4">
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#d9bd91]">Senaste flytt</p>
                    <p className="m-0 mt-1 text-sm text-slate-200">{moveHistory.at(-1)?.label}</p>
                    <button
                        type="button"
                        onClick={handleUndoBahamaMove}
                        className="mt-3 rounded-md border border-[#d9bd91]/40 px-3 py-2 text-sm font-semibold text-[#f0dfc2] outline-none hover:bg-[#d9bd91]/10 focus-visible:ring-2 focus-visible:ring-[#f0dfc2]"
                    >
                        Ångra senaste flytten
                    </button>
                </section>
            ) : null}
            <PendingChangesPanel
                changes={changes}
                onCommit={handleCommit}
                isSaving={isSaving}
            />
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-panel-border bg-[#0d1115]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#e8e1d4] border-t-transparent" />
                    <p className="m-0 text-sm text-slate-400">Laddar lagersaldo...</p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-xl border border-amber-400/30 bg-[#11191d] p-6 text-slate-100">
                <h2 className="m-0 text-xl font-semibold">Kunde inte öppna lagret</h2>
                <p className="mt-2 text-sm text-amber-100">{loadError} Försök igen för att hämta molnlagret och återuppta ett eventuellt lokalt utkast.</p>
                <button type="button" onClick={() => { void loadInventory(); }} className="min-h-11 rounded-lg bg-[#e8e1d4] px-4 py-2 font-semibold text-[#10161b]">
                    Försök igen
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-[40rem] overflow-hidden rounded-xl border border-panel-border bg-[#0d1115] text-slate-100">
            <aside className="hidden w-[248px] shrink-0 border-r border-white/10 bg-[#10161b] p-5 lg:flex lg:flex-col">
                <div className="mb-8">
                    <p className="m-0 text-xs font-semibold uppercase text-slate-500">Brixx</p>
                    <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal text-slate-50">Lagersaldo</h1>
                </div>

                <nav aria-label="Produktlinjer i lager" className="space-y-6 text-sm">
                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase text-slate-600">Produktlinjer</p>
                        <button
                            type="button"
                            onClick={() => navigateInventory(inventoryRoute.view, inventoryRoute.rack)}
                            className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold transition-colors ${
                                activeLine === 'bahama' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            BaHaMa
                            <span>{bahamaItems.length}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigateClickitup(clickitupRoute.tab)}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold transition-colors ${
                                activeLine === 'clickitup' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            ClickitUp
                            <span>{countProgress.done}/{countProgress.total}</span>
                        </button>
                    </div>

                </nav>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="border-b border-white/10 bg-[#0f1418] px-4 py-4 md:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="m-0 text-xs font-semibold uppercase text-slate-500">Inventory V2</p>
                            <h2 className="m-0 mt-1 text-2xl font-semibold text-slate-50">
                                {activeLine === 'bahama' ? 'BaHaMa lagersaldo' : 'ClickitUp lagersaldo'}
                            </h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {activeLine === 'bahama' && (
                                <button
                                    type="button"
                                    onClick={handleCreateItem}
                                    className="rounded-md border border-[#e8e1d4] bg-[#e8e1d4] px-4 py-2 text-sm font-semibold text-[#10161b] transition-colors hover:bg-white"
                                >
                                    Ny artikel
                                </button>
                            )}
                            <div className="flex rounded-lg border border-white/10 bg-[#12191f] p-1 lg:hidden">
                                <button
                                    type="button"
                                    onClick={() => navigateInventory(inventoryRoute.view, inventoryRoute.rack)}
                                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${activeLine === 'bahama' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-400 hover:text-slate-100'}`}
                                >
                                    BaHaMa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigateClickitup(clickitupRoute.tab)}
                                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${activeLine === 'clickitup' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-400 hover:text-slate-100'}`}
                                >
                                    ClickitUp
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleCommit();
                                }}
                                disabled={!changesPending || isSaving}
                                className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {isSaving ? 'Sparar...' : 'Spara ändringar'}
                            </button>
                        </div>
                    </div>
                </header>

                {activeLine === 'bahama' ? (
                    <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <InventoryViewTabs
                                view={inventoryRoute.view}
                                onChange={(view) => navigateInventory(view)}
                            />
                            <p className="m-0 text-sm text-slate-500">
                                {inventoryRoute.view === 'list'
                                    ? `${filteredBahamaItems.length} av ${bahamaItems.length} artiklar`
                                    : '40 Lagerplatser · 4 Grenställ'}
                            </p>
                        </div>

                        {inventoryRoute.view === 'list' ? (
                            <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                                <section className="flex min-h-0 flex-col gap-4" aria-label="BaHaMa lagerlista">
                                    <div className="grid gap-3 rounded-lg border border-white/10 bg-[#10161b] p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
                                        <input
                                            type="search"
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            placeholder="Sök ID, typ, status, storlek, lagerplats eller egenskap"
                                            aria-label="Sök i BaHaMa-lagret"
                                            className="rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#e8e1d4] focus-visible:ring-2 focus-visible:ring-[#f0dfc2]"
                                        />
                                        <select
                                            value={statusFilter}
                                            onChange={(event) => setStatusFilter(event.target.value as 'all' | BahamaInventoryStatus)}
                                            aria-label="Filtrera på status"
                                            className="rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#e8e1d4] focus-visible:ring-2 focus-visible:ring-[#f0dfc2]"
                                        >
                                            <option value="all">Alla statusar</option>
                                            {BAHAMA_INVENTORY_STATUSES.map((status) => (
                                                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={sizeFilter}
                                            onChange={(event) => setSizeFilter(event.target.value)}
                                            aria-label="Filtrera på storlek"
                                            className="rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#e8e1d4] focus-visible:ring-2 focus-visible:ring-[#f0dfc2]"
                                        >
                                            <option value="all">Alla storlekar</option>
                                            {sizeOptions.map((size) => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                                        <div className="rounded-lg border border-white/10 bg-[#10161b] p-3">
                                            <p className="m-0 text-[11px] uppercase text-slate-500">Totalt</p>
                                            <p className="m-0 mt-1 text-xl font-semibold">{bahamaItems.length}</p>
                                        </div>
                                        {BAHAMA_INVENTORY_STATUSES.slice(0, 4).map((status) => (
                                            <div key={status} className="rounded-lg border border-white/10 bg-[#10161b] p-3">
                                                <p className="m-0 text-[11px] uppercase text-slate-500">{STATUS_LABELS[status]}</p>
                                                <p className="m-0 mt-1 text-xl font-semibold">
                                                    {bahamaItems.filter((item) => item.status === status).length}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <InventoryTable
                                        items={filteredBahamaItems}
                                        selectedItemId={selectedItem?.id || null}
                                        onSelect={handleSelectItem}
                                    />
                                </section>

                                <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1fr)_auto]">
                                    {inventoryInspector}
                                    {pendingChangesPanel}
                                </div>
                            </div>
                        ) : (
                            <div className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                                {inventoryRoute.view === 'rack' ? (
                                    <BahamaRackDetail
                                        rack={selectedRack}
                                        selectedItemQrId={selectedBahamaQrId}
                                        onSelectItem={handleSelectItem}
                                        onOpenRack={(rack) => navigateInventory('rack', rack)}
                                        onBackToMap={() => navigateInventory('map')}
                                        draggingItemQrId={draggingBahamaQrId}
                                        focusRequest={storageFocusRequest}
                                        onDragStartItem={handleDragStartItem}
                                        onDragEndItem={handleDragEndItem}
                                        onDropItem={handleDropItem}
                                        onOpenMoveDialog={handleOpenMoveDialog}
                                    />
                                ) : (
                                    <BahamaStorageMap
                                        grouping={storagePresentation.grouping}
                                        selectedRack={inventoryRoute.rack}
                                        onOpenRack={(rack) => navigateInventory('rack', rack)}
                                    />
                                )}
                                <BahamaStorageSidebar
                                    grouping={storagePresentation.grouping}
                                    selectedRack={inventoryRoute.rack}
                                    selectedItemQrId={selectedBahamaQrId}
                                    onSelectItem={handleSelectItem}
                                    onOpenRack={(rack) => navigateInventory('rack', rack)}
                                    showRackDetailAction={inventoryRoute.view === 'map'}
                                    groupingError={storagePresentation.error}
                                    inspector={inventoryInspector}
                                    pendingChanges={pendingChangesPanel}
                                    draggingItemQrId={draggingBahamaQrId}
                                    focusRequest={storageFocusRequest}
                                    onDragStartItem={handleDragStartItem}
                                    onDragEndItem={handleDragEndItem}
                                    onDropItem={handleDropItem}
                                    onOpenMoveDialog={handleOpenMoveDialog}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 space-y-4 p-3 pb-24 sm:p-4 md:p-6 md:pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#10161b] p-3 sm:p-4">
                            <div>
                                <p className="m-0 text-sm font-semibold text-slate-100">{countProgress.done} av {countProgress.total} rader räknade</p>
                                <p className="m-0 mt-1 text-xs text-slate-400">Saldot sparas först när du väljer Spara ändringar.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { void handleNewCountRound(); }}
                                disabled={countProgress.done === 0}
                                className="min-h-11 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Ny inventeringsrunda
                            </button>
                        </div>
                        {Object.keys(cloudInventoryData.clickitupAccessories).length === 0 && Object.keys(inventoryData.clickitupAccessories).length > 0 ? (
                            <p className="m-0 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                                Excel-antalen är förifyllda som startsaldo. Spara ändringarna för att lägga in dem i molnlagret.
                            </p>
                        ) : null}
                        <div role="tablist" aria-label="ClickitUp lagerdelar" className="inline-flex w-full rounded-xl border border-white/10 bg-[#10161b] p-1 sm:w-auto">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={clickitupRoute.tab === 'sections'}
                                onClick={() => navigateClickitup('sections')}
                                className={`min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-none ${clickitupRoute.tab === 'sections' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-300 hover:bg-white/10'}`}
                            >Sektioner</button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={clickitupRoute.tab === 'accessories'}
                                onClick={() => navigateClickitup('accessories')}
                                className={`min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-none ${clickitupRoute.tab === 'accessories' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-300 hover:bg-white/10'}`}
                            >Tillbehör</button>
                        </div>
                        <section className="rounded-xl border border-white/10 bg-[#10161b] p-3 sm:p-4">
                            {clickitupRoute.tab === 'sections' ? (
                                <ClickitupStockGrid
                                    inventoryData={inventoryData}
                                    cloudInventoryData={cloudInventoryData}
                                    onSetStock={handleSetStock}
                                    onToggleCounted={handleToggleCounted}
                                />
                            ) : (
                                <ClickitupAccessoryStock
                                    inventoryData={inventoryData}
                                    cloudInventoryData={cloudInventoryData}
                                    onSetStock={handleSetAccessoryStock}
                                    onToggleCounted={(id) => handleToggleCounted('accessory', id)}
                                />
                            )}
                        </section>
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <section className="rounded-lg border border-white/10 bg-[#10161b] p-5">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[11px] font-semibold uppercase text-slate-500">Noteringar</span>
                                    <textarea
                                        value={inventoryData.notes || ''}
                                        onChange={(event) => {
                                            dispatch({
                                                type: 'SET_INVENTORY_DATA',
                                                payload: { ...inventoryData, notes: event.target.value }
                                            });
                                        }}
                                        className="min-h-32 rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#e8e1d4]"
                                    />
                                </label>
                            </section>
                            <PendingChangesPanel
                                changes={changes}
                                onCommit={handleCommit}
                                isSaving={isSaving}
                            />
                        </div>
                        <div className="sticky bottom-0 z-10 -mx-3 border-t border-white/15 bg-[#0f1418]/95 p-3 backdrop-blur sm:-mx-4 md:hidden">
                            <button
                                type="button"
                                onClick={() => { void handleCommit(); }}
                                disabled={!changesPending || isSaving}
                                className="min-h-12 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-[#08150f] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {isSaving ? 'Sparar...' : `Spara ändringar${changesPending ? ` (${changes.length})` : ''}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {moveDialogItem ? (
                <BahamaMoveDialog
                    grouping={storagePresentation.grouping}
                    initialRack={inventoryRoute.rack}
                    item={moveDialogItem}
                    onClose={() => setMoveDialogQrId(null)}
                    onMove={(target) => handleStageBahamaMove(moveDialogItem.qrId, target)}
                />
            ) : null}
        </div>
    );
}
