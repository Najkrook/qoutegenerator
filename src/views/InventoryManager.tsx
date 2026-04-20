import React, { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { db, doc, getDoc, collection, writeBatch } from '../services/firebase';
import { InventoryTable } from '../components/features/InventoryTable';
import { ClickitupStockGrid } from '../components/features/ClickitupStockGrid';
import { InventoryItemModal } from '../components/features/InventoryItemModal';
import { PendingChangesPanel } from '../components/features/PendingChangesPanel';
import {
    buildImportedInventoryItem,
    createDefaultInventoryData,
    DEFAULT_CLICKITUP_ENTRY,
    normalizeInventorySheetHeaders,
    normalizeStoredInventoryData
} from './inventoryData';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import type {
    BahamaInventoryItem,
    ClickitupFieldKey,
    InventoryData,
    InventoryManagerProps
} from '../types/contracts';

interface InventoryModalState {
    open: boolean;
    index: number;
    item: BahamaInventoryItem | null;
}

type SheetCell = string | number | boolean | null | undefined;
type SheetRow = SheetCell[];

const DEFAULT_INVENTORY_DATA: InventoryData = createDefaultInventoryData();

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

function cloneInventoryData(inventory: InventoryData): InventoryData {
    return JSON.parse(JSON.stringify(inventory)) as InventoryData;
}

function createEmptyModalState(): InventoryModalState {
    return { open: false, index: -1, item: null };
}

export function InventoryManager({ onBack }: InventoryManagerProps) {
    const { state, dispatch } = useQuote();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [showBahama, setShowBahama] = useState(false);
    const [showClickitup, setShowClickitup] = useState(false);
    const [modalState, setModalState] = useState<InventoryModalState>(createEmptyModalState());
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadInventory = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const docRef = doc(db, 'stock', 'main_inventory');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const inventoryData = normalizeStoredInventoryData(docSnap.data());
                dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(inventoryData) });
                dispatch({ type: 'SET_INVENTORY_DATA', payload: inventoryData });
            } else {
                dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(DEFAULT_INVENTORY_DATA) });
                dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(DEFAULT_INVENTORY_DATA) });
            }
        } catch (err) {
            console.error('Failed to load Firestore inventory:', err);
            setLoadError(getErrorMessage(err, 'Kunde inte läsa lagersaldot.'));

            try {
                const res = await fetch('/inventory_db.json');
                if (res.ok) {
                    const localData = normalizeStoredInventoryData(await res.json());
                    dispatch({ type: 'SET_INVENTORY_DATA', payload: cloneInventoryData(localData) });
                    dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(localData) });
                    toast('Laddat lokalt lagersaldo (offline-läge)', { icon: '💾' });
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

    const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (loadEvent: ProgressEvent<FileReader>) => {
            try {
                const result = loadEvent.target?.result;
                if (!(result instanceof ArrayBuffer)) {
                    throw new Error('Kunde inte läsa den valda filen.');
                }

                const data = new Uint8Array(result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonArr = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as SheetRow[];

                let headerIdx = -1;
                for (let index = 0; index < Math.min(jsonArr.length, 10); index += 1) {
                    if (jsonArr[index]?.includes('BESKRIVNING')) {
                        headerIdx = index;
                        break;
                    }
                }

                if (headerIdx === -1) {
                    toast.error("Kunde inte hitta kolumnen 'BESKRIVNING'. Kontrollera att det är rätt lagersaldo-fil.");
                    return;
                }

                const headers = normalizeInventorySheetHeaders(jsonArr[headerIdx] || []);
                const inventory: BahamaInventoryItem[] = [];

                for (let rowIndex = headerIdx + 1; rowIndex < jsonArr.length; rowIndex += 1) {
                    const row = jsonArr[rowIndex];
                    if (!row || row.length === 0) continue;

                    const { item: cleanItem, hasData } = buildImportedInventoryItem(headers, row);
                    if (hasData && cleanItem.BESKRIVNING) {
                        inventory.push(cleanItem);
                    }
                }

                const newData: InventoryData = { ...state.inventoryData, bahama: inventory };
                dispatch({ type: 'SET_INVENTORY_DATA', payload: newData });
                toast.success(`Lagersaldo inläst: ${inventory.length} artiklar. Klicka "Spara ändringar" för att synkronisera.`);
            } catch (err) {
                console.error(err);
                toast.error(`Fel vid inläsning: ${getErrorMessage(err, 'Okänt fel')}`);
            }
        };

        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }, [dispatch, state.inventoryData]);

    const handleSaveItem = (formData: BahamaInventoryItem, editIndex: number) => {
        const newBahama = [...state.inventoryData.bahama];
        if (editIndex >= 0) {
            newBahama[editIndex] = { ...newBahama[editIndex], ...formData };
        } else {
            newBahama.push(formData);
        }

        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...state.inventoryData, bahama: newBahama } });
        setModalState(createEmptyModalState());
        toast.success(editIndex >= 0 ? 'Artikel uppdaterad' : 'Artikel tillagd');
    };

    const handleDeleteItem = (index: number, item: BahamaInventoryItem) => {
        if (!confirm(`Ta bort artikel ID: ${String(item.ID || '-')}?`)) return;

        const newBahama = [...state.inventoryData.bahama];
        newBahama.splice(index, 1);
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...state.inventoryData, bahama: newBahama } });
        toast.success('Artikel borttagen');
    };

    const handleAddToBasket = (item: BahamaInventoryItem) => {
        const newBasket = [...state.inventoryBasket, item];
        dispatch({ type: 'SET_INVENTORY_BASKET', payload: newBasket });
        toast.success(`${String(item.ID || 'Artikel')} tillagd i korg`);
    };

    const handleUpdateStock = (size: string, field: ClickitupFieldKey, delta: number) => {
        const clickitup = cloneInventoryData({ bahama: [], clickitup: state.inventoryData.clickitup || {} }).clickitup;
        if (!clickitup[size]) {
            clickitup[size] = { ...DEFAULT_CLICKITUP_ENTRY };
        }

        const currentVal = clickitup[size][field] || 0;
        if (currentVal + delta < 0) return;
        clickitup[size][field] = currentVal + delta;
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...state.inventoryData, clickitup } });
    };

    const handleCommit = async () => {
        if (!user) {
            toast.error('Du måste vara inloggad för att spara ändringar.');
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const invRef = doc(db, 'stock', 'main_inventory');
            batch.set(invRef, state.inventoryData);

            const logsRef = collection(db, 'inventory_logs');
            const userEmail = user.email || 'unknown';
            const userUid = user.uid || null;
            const now = new Date().toISOString();
            const nowMs = Date.now();

            const bahamaLocal = state.inventoryData.bahama || [];
            const bahamaCloud = state.cloudInventoryData.bahama || [];
            const cloudMap = bahamaCloud.reduce<Record<string, BahamaInventoryItem>>((acc, item) => {
                const id = String(item.ID || '');
                if (id) {
                    acc[id] = item;
                }
                return acc;
            }, {});
            const localMap: Record<string, BahamaInventoryItem> = {};
            let fallbackGlobalDiff = false;

            bahamaLocal.forEach((item) => {
                const id = String(item.ID || '');
                if (!id) {
                    fallbackGlobalDiff = true;
                    return;
                }

                localMap[id] = item;
                if (!cloudMap[id]) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now,
                        createdAt: nowMs,
                        action: 'Lades Till',
                        system: 'BaHaMa',
                        category: 'bahama',
                        targetType: 'item',
                        targetId: id,
                        element: id,
                        details: `${String(item.TYP || '')} ${String(item.STORLEK || '')}`.trim(),
                        user: userEmail,
                        userUid,
                        delta: null
                    });
                } else if (JSON.stringify(item) !== JSON.stringify(cloudMap[id])) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now,
                        createdAt: nowMs,
                        action: 'Ändrades',
                        system: 'BaHaMa',
                        category: 'bahama',
                        targetType: 'item',
                        targetId: id,
                        element: id,
                        details: 'Attribut uppdaterade',
                        user: userEmail,
                        userUid,
                        delta: null
                    });
                }
            });

            bahamaCloud.forEach((item) => {
                const id = String(item.ID || '');
                if (id && !localMap[id]) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now,
                        createdAt: nowMs,
                        action: 'Togs Bort',
                        system: 'BaHaMa',
                        category: 'bahama',
                        targetType: 'item',
                        targetId: id,
                        element: id,
                        details: '-',
                        user: userEmail,
                        userUid,
                        delta: null
                    });
                }
            });

            if (fallbackGlobalDiff && JSON.stringify(bahamaLocal) !== JSON.stringify(bahamaCloud)) {
                const logRef = doc(logsRef);
                batch.set(logRef, {
                    timestamp: now,
                    createdAt: nowMs,
                    action: 'Massuppdatering',
                    system: 'BaHaMa',
                    category: 'bahama',
                    targetType: 'batch',
                    targetId: 'excel-upload',
                    element: 'Excel Uppladdning',
                    details: `${bahamaLocal.length} rader`,
                    user: userEmail,
                    userUid,
                    delta: null
                });
            }

            const clickitupLocal = state.inventoryData.clickitup || {};
            const clickitupCloud = state.cloudInventoryData.clickitup || {};
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
            dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: cloneInventoryData(state.inventoryData) });
            toast.success('Ändringar sparade till molnet!');
        } catch (err) {
            console.error('Failed to commit:', err);
            toast.error('Nätverksfel. Kontrollera din internetuppkoppling.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p className="text-text-secondary">Laddar lagersaldo...</p>
            </div>
        );
    }

    return (
        <div className="animate-slide-in">
            <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
                <div>
                    <h2 className="text-3xl font-semibold text-text-primary m-0">Hantera lagersaldo</h2>
                    <p className="text-text-secondary mt-1 m-0">Uppdatera lagersaldon för BaHaMa och ClickitUp. Se loggar och historik.</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                >
                    &larr; Tillbaka
                </button>
            </div>

            {loadError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-4 mb-6 text-sm">
                    ⚠️ Firebase kunde inte nås: {loadError}. Visar lokalt lagersaldo (skrivskyddat).
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                <div className="space-y-6">
                    <section className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowBahama((prev) => !prev)}
                            className="w-full flex justify-between items-center p-5 bg-transparent border-none text-text-primary cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold m-0">📦 BaHaMa lagersaldo</h3>
                                <span className="text-xs text-text-secondary bg-white/5 px-2.5 py-1 rounded-full">
                                    {state.inventoryData.bahama.length} artiklar
                                </span>
                            </div>
                            <span className={`text-text-secondary transition-transform ${showBahama ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showBahama && (
                            <div className="p-5 pt-0 space-y-4">
                                <div className="flex flex-wrap gap-3 items-center">
                                    <input
                                        type="text"
                                        placeholder="Sök ID, typ, storlek, beskrivning..."
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        className="flex-1 min-w-[200px] bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                                    />
                                    <button
                                        onClick={() => setModalState({ open: true, index: -1, item: null })}
                                        className="px-4 py-2.5 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold text-sm hover:brightness-110"
                                    >
                                        + Ny artikel
                                    </button>
                                    <label className="px-4 py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer text-sm hover:bg-white/5 flex items-center gap-2">
                                        📄 Ladda Excel
                                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>

                                <InventoryTable
                                    items={state.inventoryData.bahama}
                                    searchTerm={searchTerm}
                                    onAddToBasket={handleAddToBasket}
                                    onEdit={(index, item) => setModalState({ open: true, index, item })}
                                    onDelete={handleDeleteItem}
                                />
                            </div>
                        )}
                    </section>

                    <section className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowClickitup((prev) => !prev)}
                            className="w-full flex justify-between items-center p-5 bg-transparent border-none text-text-primary cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold m-0">🔩 ClickitUp lagersaldo</h3>
                            </div>
                            <span className={`text-text-secondary transition-transform ${showClickitup ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showClickitup && (
                            <div className="p-5 pt-0">
                                <ClickitupStockGrid
                                    inventoryData={state.inventoryData}
                                    cloudInventoryData={state.cloudInventoryData}
                                    onUpdateStock={handleUpdateStock}
                                />
                            </div>
                        )}
                    </section>
                </div>

                <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
                    <PendingChangesPanel
                        inventoryData={state.inventoryData}
                        cloudInventoryData={state.cloudInventoryData}
                        onCommit={handleCommit}
                        isSaving={isSaving}
                    />

                    <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">📝</span>
                            <h4 className="text-sm font-semibold text-text-primary uppercase m-0">Noteringar</h4>
                        </div>
                        <textarea
                            value={state.inventoryData.notes || ''}
                            onChange={(e) => {
                                dispatch({
                                    type: 'SET_INVENTORY_DATA',
                                    payload: { ...state.inventoryData, notes: e.target.value }
                                });
                            }}
                            placeholder="Skriv interna noteringar om lagret här..."
                            className="w-full h-40 bg-input-bg border border-panel-border text-text-primary p-3 rounded-lg outline-none focus:border-primary text-sm resize-none"
                        />
                        <p className="text-[10px] text-text-secondary mt-2 m-0 italic">
                            Dessa noteringar sparas när du klickar på "Spara ändringar" ovan.
                        </p>
                    </div>

                    {state.inventoryBasket.length > 0 && (
                        <div className="mt-4 bg-panel-bg border border-panel-border rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-text-primary uppercase mb-3 m-0">
                                🛒 Korg ({state.inventoryBasket.length})
                            </h4>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {state.inventoryBasket.map((item, index) => (
                                    <div key={`${String(item.ID || 'item')}-${index}`} className="flex justify-between items-start bg-white/[0.03] border border-panel-border rounded p-2.5 text-sm">
                                        <div>
                                            <div className="text-primary font-bold text-xs">ID: {String(item.ID || '-')}</div>
                                            <div className="text-text-primary text-xs mt-0.5 line-clamp-2">{String(item.BESKRIVNING || '')}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newBasket = [...state.inventoryBasket];
                                                newBasket.splice(index, 1);
                                                dispatch({ type: 'SET_INVENTORY_BASKET', payload: newBasket });
                                            }}
                                            className="bg-transparent border-none text-text-secondary cursor-pointer text-sm hover:text-danger ml-2 shrink-0"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modalState.open && (
                <InventoryItemModal
                    item={modalState.item}
                    editIndex={modalState.index}
                    onSave={handleSaveItem}
                    onClose={() => setModalState(createEmptyModalState())}
                />
            )}
        </div>
    );
}
