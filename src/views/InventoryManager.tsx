import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { db, doc, getDoc, collection, writeBatch } from '../services/firebase';
import { InventoryTable } from '../components/features/InventoryTable';
import { ClickitupStockGrid } from '../components/features/ClickitupStockGrid';
import { InventoryItemModal } from '../components/features/InventoryItemModal';
import { PendingChangesPanel } from '../components/features/PendingChangesPanel';
import ThemeToggle from '../components/ThemeToggle';
import {
    BAHAMA_INVENTORY_STATUSES,
    cloneInventoryData,
    createDefaultInventoryData,
    DEFAULT_CLICKITUP_ENTRY,
    normalizeStoredInventoryData
} from './inventoryData';
import {
    confirmAction,
    notifyError,
    notifySuccess,
    notifyWarn
} from '../services/notificationService';
import { getErrorMessage } from '../utils/runtime';
import type {
    BahamaInventoryStatus,
    BahamaInventoryV2Item,
    ClickitupFieldKey,
    InventoryData,
    InventoryManagerProps
} from '../types/contracts';

type ProductLine = 'bahama' | 'clickitup';
type InspectorMode = 'view' | 'create' | 'edit';

const DEFAULT_INVENTORY_DATA: InventoryData = createDefaultInventoryData();

const STATUS_LABELS: Record<BahamaInventoryStatus, string> = {
    available: 'Tillgänglig',
    reserved: 'Reserverad',
    'needs-review': 'Kontroll',
    used: 'Begagnad',
    sold: 'Såld'
};

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

function formatBahamaDetails(item: BahamaInventoryV2Item): string {
    const properties = [
        item.properties.stativ,
        item.properties.textil,
        item.properties.fot,
        item.properties.belysning,
        item.properties.varme
    ].filter(Boolean).join(' / ');

    return [
        item.type,
        item.size,
        properties
    ].filter(Boolean).join(' - ') || item.id;
}

function hasInventoryChanges(local: InventoryData, cloud: InventoryData): boolean {
    return JSON.stringify(local) !== JSON.stringify(cloud);
}

function getUserEmail(user: { email?: string | null } | null): string {
    return user?.email || 'unknown';
}

function getUserUid(user: { uid?: string | null } | null): string {
    return user?.uid || '';
}

export function InventoryManager({ onBack }: InventoryManagerProps) {
    const { state, dispatch } = useQuote();
    const { user } = useAuth();
    const [activeLine, setActiveLine] = useState<ProductLine>('bahama');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | BahamaInventoryStatus>('all');
    const [sizeFilter, setSizeFilter] = useState('all');
    const [selectedBahamaId, setSelectedBahamaId] = useState<string | null>(null);
    const [inspectorMode, setInspectorMode] = useState<InspectorMode>('view');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const inventoryData = useMemo(() => getSafeInventoryData(state.inventoryData), [state.inventoryData]);
    const cloudInventoryData = useMemo(() => getSafeInventoryData(state.cloudInventoryData), [state.cloudInventoryData]);
    const bahamaItems = inventoryData.bahamaV2 || [];
    const sortedBahamaItems = useMemo(() => sortBahamaItems(bahamaItems), [bahamaItems]);
    const selectedItem = useMemo(
        () => sortedBahamaItems.find((item) => item.id === selectedBahamaId) || null,
        [selectedBahamaId, sortedBahamaItems]
    );

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

    const changesPending = hasInventoryChanges(inventoryData, cloudInventoryData);

    const loadInventory = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const docRef = doc(db, 'stock', 'main_inventory');
            const docSnap = await getDoc(docRef);
            const loadedInventory = docSnap.exists()
                ? normalizeStoredInventoryData(docSnap.data())
                : createDefaultInventoryData();

            dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(loadedInventory) });
            dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(loadedInventory) });
        } catch (err) {
            console.error('Failed to load Firestore inventory:', err);
            setLoadError(getErrorMessage(err, 'Kunde inte läsa lagersaldot.'));

            try {
                const res = await fetch('/inventory_db.json');
                if (res.ok) {
                    const localData = normalizeStoredInventoryData(await res.json());
                    dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(localData) });
                    dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(localData) });
                    notifyWarn('Laddat lokalt lagersaldo i offline-läge.');
                }
            } catch (localErr) {
                console.error('Failed to load local inventory fallback:', localErr);
            }
        } finally {
            setIsLoading(false);
        }
    }, [dispatch]);

    useEffect(() => {
        void loadInventory();
    }, [loadInventory]);

    useEffect(() => {
        if (inspectorMode === 'create') {
            return;
        }
        if (selectedBahamaId && sortedBahamaItems.some((item) => item.id === selectedBahamaId)) {
            return;
        }
        setSelectedBahamaId(sortedBahamaItems[0]?.id || null);
        setInspectorMode(sortedBahamaItems[0] ? 'edit' : 'view');
    }, [inspectorMode, selectedBahamaId, sortedBahamaItems]);

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
        setSelectedBahamaId(item.id);
        setInspectorMode('edit');
    };

    const handleCreateItem = () => {
        setActiveLine('bahama');
        setSelectedBahamaId(null);
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
        setSelectedBahamaId(nextItem.id);
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
        setSelectedBahamaId(null);
        setInspectorMode('view');
        notifySuccess('BaHaMa-artikel borttagen');
    };

    const handleUpdateStock = (size: string, field: ClickitupFieldKey, delta: number) => {
        const clickitup = cloneInventoryData(inventoryData).clickitup;
        if (!clickitup[size]) {
            clickitup[size] = { ...DEFAULT_CLICKITUP_ENTRY };
        }

        const currentVal = clickitup[size][field] || 0;
        if (currentVal + delta < 0) return;
        clickitup[size][field] = currentVal + delta;
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...inventoryData, clickitup } });
    };

    const handleCommit = async () => {
        if (!user) {
            notifyError('Du måste vara inloggad för att spara ändringar.');
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const inventoryToSave = cloneInventoryData(inventoryData);
            const invRef = doc(db, 'stock', 'main_inventory');
            batch.set(invRef, inventoryToSave);

            const logsRef = collection(db, 'inventory_logs');
            const userEmail = getUserEmail(user);
            const userUid = getUserUid(user);
            const now = new Date().toISOString();
            const nowMs = Date.now();

            const bahamaLocal = inventoryToSave.bahamaV2 || [];
            const bahamaCloud = cloudInventoryData.bahamaV2 || [];
            const cloudMap = bahamaCloud.reduce<Record<string, BahamaInventoryV2Item>>((acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {});
            const localMap = bahamaLocal.reduce<Record<string, BahamaInventoryV2Item>>((acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {});

            bahamaLocal.forEach((item) => {
                const cloudItem = cloudMap[item.id];
                if (!cloudItem) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now,
                        createdAt: nowMs,
                        action: 'Lades Till',
                        system: 'BaHaMa',
                        category: 'bahama',
                        targetType: 'item',
                        targetId: item.id,
                        element: item.id,
                        details: formatBahamaDetails(item),
                        user: userEmail,
                        userUid,
                        delta: null
                    });
                } else if (JSON.stringify(item) !== JSON.stringify(cloudItem)) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now,
                        createdAt: nowMs,
                        action: 'Ändrades',
                        system: 'BaHaMa',
                        category: 'bahama',
                        targetType: 'item',
                        targetId: item.id,
                        element: item.id,
                        details: formatBahamaDetails(item),
                        user: userEmail,
                        userUid,
                        delta: null
                    });
                }
            });

            bahamaCloud.forEach((item) => {
                if (!localMap[item.id]) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now,
                        createdAt: nowMs,
                        action: 'Togs Bort',
                        system: 'BaHaMa',
                        category: 'bahama',
                        targetType: 'item',
                        targetId: item.id,
                        element: item.id,
                        details: formatBahamaDetails(item),
                        user: userEmail,
                        userUid,
                        delta: null
                    });
                }
            });

            const clickitupLocal = inventoryToSave.clickitup || {};
            const clickitupCloud = cloudInventoryData.clickitup || {};
            Object.keys(clickitupLocal).forEach((size) => {
                (['sektion', 'dorr_h', 'dorr_v', 'hane_h', 'hane_v'] as ClickitupFieldKey[]).forEach((field) => {
                    const localValue = clickitupLocal[size]?.[field] || 0;
                    const cloudValue = clickitupCloud[size]?.[field] || 0;
                    const delta = localValue - cloudValue;
                    if (delta !== 0) {
                        const fieldName = field
                            .replace('_h', ' Höger')
                            .replace('_v', ' Vänster')
                            .replace('dorr', 'Dörr')
                            .replace('hane', 'Hane')
                            .replace('sektion', 'Sektion');
                        const sign = delta > 0 ? '+' : '';
                        const logRef = doc(logsRef);
                        batch.set(logRef, {
                            timestamp: now,
                            createdAt: nowMs,
                            action: 'Justering',
                            system: 'ClickitUp',
                            category: 'clickitup',
                            targetType: 'size',
                            targetId: String(size),
                            element: size,
                            details: `${fieldName} (${sign}${delta})`,
                            user: userEmail,
                            userUid,
                            delta
                        });
                    }
                });
            });

            await batch.commit();
            dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(inventoryToSave) });
            notifySuccess('Ändringar sparade till molnet!');
        } catch (err) {
            console.error('Failed to commit:', err);
            notifyError('Nätverksfel. Kontrollera din internetuppkoppling.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0d1115]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#e8e1d4] border-t-transparent" />
                    <p className="m-0 text-sm text-slate-400">Laddar lagersaldo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#0d1115] text-slate-100">
            <aside className="hidden w-[248px] shrink-0 border-r border-white/10 bg-[#10161b] p-5 lg:flex lg:flex-col">
                <div className="mb-8">
                    <p className="m-0 text-xs font-semibold uppercase text-slate-500">Brixx</p>
                    <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal text-slate-50">Lagersaldo</h1>
                </div>

                <nav className="space-y-6 text-sm">
                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase text-slate-600">Produktlinjer</p>
                        <button
                            type="button"
                            onClick={() => setActiveLine('bahama')}
                            className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold transition-colors ${
                                activeLine === 'bahama' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            BaHaMa
                            <span>{bahamaItems.length}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveLine('clickitup')}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold transition-colors ${
                                activeLine === 'clickitup' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            ClickitUp
                            <span>{Object.keys(inventoryData.clickitup || {}).length}</span>
                        </button>
                    </div>

                    <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase text-slate-600">Navigering</p>
                        <button type="button" onClick={onBack} className="block w-full rounded-md px-3 py-2 text-left font-semibold text-slate-300 transition-colors hover:bg-white/5">
                            Start
                        </button>
                        <a href="/inventory-logs" className="block rounded-md px-3 py-2 font-semibold text-slate-300 no-underline transition-colors hover:bg-white/5">
                            Lagerloggar
                        </a>
                    </div>
                </nav>

                <div className="mt-auto space-y-3">
                    <ThemeToggle />
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="m-0 text-[11px] uppercase text-slate-500">Inloggad</p>
                        <p className="m-0 mt-1 truncate text-sm text-slate-300">{user?.email || '-'}</p>
                    </div>
                </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
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
                            <div className="flex rounded-lg border border-white/10 bg-[#12191f] p-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveLine('bahama')}
                                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${activeLine === 'bahama' ? 'bg-[#e8e1d4] text-[#10161b]' : 'text-slate-400 hover:text-slate-100'}`}
                                >
                                    BaHaMa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveLine('clickitup')}
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

                {loadError && (
                    <div className="mx-4 mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 md:mx-6">
                        Firebase kunde inte nås: {loadError}. Visar lokalt lagersaldo.
                    </div>
                )}

                {activeLine === 'bahama' ? (
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px] md:p-6">
                        <section className="flex min-h-0 flex-col gap-4">
                            <div className="grid gap-3 rounded-lg border border-white/10 bg-[#10161b] p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Sök ID, typ, status, storlek, lagerplats eller egenskap"
                                    className="rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#e8e1d4]"
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value as 'all' | BahamaInventoryStatus)}
                                    className="rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#e8e1d4]"
                                >
                                    <option value="all">Alla statusar</option>
                                    {BAHAMA_INVENTORY_STATUSES.map((status) => (
                                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                                    ))}
                                </select>
                                <select
                                    value={sizeFilter}
                                    onChange={(event) => setSizeFilter(event.target.value)}
                                    className="rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#e8e1d4]"
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
                                selectedItemId={selectedBahamaId}
                                onSelect={handleSelectItem}
                            />
                        </section>

                        <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1fr)_auto]">
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
                            <PendingChangesPanel
                                inventoryData={inventoryData}
                                cloudInventoryData={cloudInventoryData}
                                onCommit={handleCommit}
                                isSaving={isSaving}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 space-y-4 p-4 md:p-6">
                        <section className="rounded-lg border border-white/10 bg-[#10161b] p-4">
                            <ClickitupStockGrid
                                inventoryData={inventoryData}
                                cloudInventoryData={cloudInventoryData}
                                onUpdateStock={handleUpdateStock}
                            />
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
                                inventoryData={inventoryData}
                                cloudInventoryData={cloudInventoryData}
                                onCommit={handleCommit}
                                isSaving={isSaving}
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
