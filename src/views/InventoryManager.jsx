import React, { useState, useEffect, useCallback } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { db, doc, getDoc, setDoc, collection, writeBatch, query, orderBy, limit, getDocs } from '../services/firebase';
import { InventoryTable } from '../components/features/InventoryTable';
import { ClickitupStockGrid } from '../components/features/ClickitupStockGrid';
import { InventoryItemModal } from '../components/features/InventoryItemModal';
import { PendingChangesPanel } from '../components/features/PendingChangesPanel';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export function InventoryManager({ onBack }) {
    const { state, dispatch } = useQuote();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [showBahama, setShowBahama] = useState(false);
    const [showClickitup, setShowClickitup] = useState(false);
    const [modalState, setModalState] = useState({ open: false, index: -1, item: null });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Load inventory from Firestore on mount
    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const docRef = doc(db, "stock", "main_inventory");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const inventoryData = JSON.parse(JSON.stringify(data || { bahama: [], clickitup: {} }));
                dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: JSON.parse(JSON.stringify(inventoryData)) });
                dispatch({ type: 'SET_INVENTORY_DATA', payload: inventoryData });
            } else {
                dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: { bahama: [], clickitup: {} } });
                dispatch({ type: 'SET_INVENTORY_DATA', payload: { bahama: [], clickitup: {} } });
            }
        } catch (err) {
            console.error("Failed to load Firestore inventory:", err);
            setLoadError(err.message);
            // Fallback: try loading local JSON
            try {
                const res = await fetch('/inventory_db.json');
                if (res.ok) {
                    const localData = await res.json();
                    dispatch({ type: 'SET_INVENTORY_DATA', payload: JSON.parse(JSON.stringify(localData)) });
                    dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: JSON.parse(JSON.stringify(localData)) });
                    toast('Laddat lokalt lagersaldo (offline-läge)', { icon: '💾' });
                }
            } catch (localErr) {
                console.error("Failed to load local inventory fallback:", localErr);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Excel/CSV Upload
    const handleFileUpload = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonArr = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                let headerIdx = -1;
                for (let i = 0; i < Math.min(jsonArr.length, 10); i++) {
                    if (jsonArr[i] && jsonArr[i].includes("BESKRIVNING")) {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx === -1) {
                    toast.error("Kunde inte hitta kolumnen 'BESKRIVNING'. Kontrollera att det är rätt lagersaldo-fil.");
                    return;
                }

                const headers = jsonArr[headerIdx];
                const inventory = [];

                for (let i = headerIdx + 1; i < jsonArr.length; i++) {
                    const row = jsonArr[i];
                    if (!row || row.length === 0) continue;
                    let item = {};
                    let hasData = false;
                    headers.forEach((h, colIdx) => {
                        if (h && typeof h === 'string') {
                            const val = row[colIdx];
                            item[h.trim()] = val;
                            if (val !== undefined && val !== "") hasData = true;
                        }
                    });
                    if (hasData && item['BESKRIVNING']) {
                        inventory.push(item);
                    }
                }

                const newData = { ...state.inventoryData, bahama: inventory };
                dispatch({ type: 'SET_INVENTORY_DATA', payload: newData });
                toast.success(`Lagersaldo inläst: ${inventory.length} artiklar. Klicka "Spara ändringar" för att synkronisera.`);
            } catch (err) {
                console.error(err);
                toast.error("Fel vid inläsning: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    }, [state.inventoryData, dispatch]);

    // BaHaMa item operations
    const handleSaveItem = (formData, editIndex) => {
        const newBahama = [...state.inventoryData.bahama];
        if (editIndex >= 0) {
            newBahama[editIndex] = { ...newBahama[editIndex], ...formData };
        } else {
            newBahama.push(formData);
        }
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...state.inventoryData, bahama: newBahama } });
        setModalState({ open: false, index: -1, item: null });
        toast.success(editIndex >= 0 ? 'Artikel uppdaterad' : 'Artikel tillagd');
    };

    const handleDeleteItem = (index, item) => {
        if (!confirm(`Ta bort artikel ID: ${item.ID || '-'}?`)) return;
        const newBahama = [...state.inventoryData.bahama];
        newBahama.splice(index, 1);
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...state.inventoryData, bahama: newBahama } });
        toast.success('Artikel borttagen');
    };

    const handleAddToBasket = (item) => {
        const newBasket = [...state.inventoryBasket, item];
        dispatch({ type: 'SET_INVENTORY_BASKET', payload: newBasket });
        toast.success(`${item.ID || 'Artikel'} tillagd i korg`);
    };

    // ClickitUp stock update
    const handleUpdateStock = (size, field, delta) => {
        const clickitup = JSON.parse(JSON.stringify(state.inventoryData.clickitup || {}));
        if (!clickitup[size]) clickitup[size] = { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 };
        const currentVal = clickitup[size][field] || 0;
        if (currentVal + delta < 0) return;
        clickitup[size][field] = currentVal + delta;
        dispatch({ type: 'SET_INVENTORY_DATA', payload: { ...state.inventoryData, clickitup } });
    };

    // Commit to Firestore
    const handleCommit = async () => {
        if (!user) {
            toast.error("Du måste vara inloggad för att spara ändringar.");
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const invRef = doc(db, "stock", "main_inventory");
            batch.set(invRef, state.inventoryData);

            // Generate audit logs
            const logsRef = collection(db, "inventory_logs");
            const userEmail = user.email || 'unknown';
            const userUid = user.uid || null;
            const now = new Date().toISOString();
            const nowMs = Date.now();

            // BaHaMa diffs
            const bahamaLocal = state.inventoryData.bahama || [];
            const bahamaCloud = state.cloudInventoryData.bahama || [];
            const cloudMap = {};
            bahamaCloud.forEach(i => { if (i.ID) cloudMap[i.ID] = i; });
            const localMap = {};
            let fallbackGlobalDiff = false;

            bahamaLocal.forEach(i => {
                if (!i.ID) { fallbackGlobalDiff = true; return; }
                localMap[i.ID] = i;
                if (!cloudMap[i.ID]) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now, createdAt: nowMs, action: "Lades Till", system: "BaHaMa", category: "bahama",
                        targetType: "item", targetId: String(i.ID), element: i.ID,
                        details: `${i.TYP} ${i.STORLEK || ''}`, user: userEmail, userUid, delta: null
                    });
                } else if (JSON.stringify(i) !== JSON.stringify(cloudMap[i.ID])) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now, createdAt: nowMs, action: "Ändrades", system: "BaHaMa", category: "bahama",
                        targetType: "item", targetId: String(i.ID), element: i.ID,
                        details: "Attribut uppdaterade", user: userEmail, userUid, delta: null
                    });
                }
            });

            bahamaCloud.forEach(i => {
                if (i.ID && !localMap[i.ID]) {
                    const logRef = doc(logsRef);
                    batch.set(logRef, {
                        timestamp: now, createdAt: nowMs, action: "Togs Bort", system: "BaHaMa", category: "bahama",
                        targetType: "item", targetId: String(i.ID), element: i.ID,
                        details: "-", user: userEmail, userUid, delta: null
                    });
                }
            });

            if (fallbackGlobalDiff && JSON.stringify(bahamaLocal) !== JSON.stringify(bahamaCloud)) {
                const logRef = doc(logsRef);
                batch.set(logRef, {
                    timestamp: now, createdAt: nowMs, action: "Massuppdatering", system: "BaHaMa", category: "bahama",
                    targetType: "batch", targetId: "excel-upload", element: "Excel Uppladdning",
                    details: `${bahamaLocal.length} rader`, user: userEmail, userUid, delta: null
                });
            }

            // ClickitUp diffs
            const cLocal = state.inventoryData.clickitup || {};
            const cCloud = state.cloudInventoryData.clickitup || {};
            for (const size in cLocal) {
                ['sektion', 'dorr_h', 'dorr_v', 'hane_h', 'hane_v'].forEach(f => {
                    const locVal = cLocal[size]?.[f] || 0;
                    const cloVal = cCloud[size]?.[f] || 0;
                    const delta = locVal - cloVal;
                    if (delta !== 0) {
                        const fName = f.replace('_h', ' Höger').replace('_v', ' Vänster').replace('dorr', 'Dörr').replace('hane', 'Hane').replace('sektion', 'Sektion');
                        const sign = delta > 0 ? '+' : '';
                        const logRef = doc(logsRef);
                        batch.set(logRef, {
                            timestamp: now, createdAt: nowMs, action: "Justering", system: "ClickitUp", category: "clickitup",
                            targetType: "size", targetId: String(size), element: size,
                            details: `${fName} (${sign}${delta})`, user: userEmail, userUid, delta
                        });
                    }
                });
            }

            await batch.commit();

            // Re-baseline
            dispatch({ type: 'SET_CLOUD_INVENTORY_DATA', payload: JSON.parse(JSON.stringify(state.inventoryData)) });
            toast.success('Ändringar sparade till molnet!');
        } catch (err) {
            console.error("Failed to commit:", err);
            toast.error("Nätverksfel. Kontrollera din internetuppkoppling.");
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
                    <h2 className="text-3xl font-semibold text-text-primary m-0">Hantera Lagersaldo</h2>
                    <p className="text-text-secondary mt-1 m-0">Uppdatera lagersaldon för BaHaMa och ClickitUp. Se loggar och historik.</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                >
                    ← Tillbaka
                </button>
            </div>

            {loadError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-4 mb-6 text-sm">
                    ⚠️ Firebase kunde inte nås: {loadError}. Visar lokalt lagersaldo (skrivskyddat).
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                {/* Main content */}
                <div className="space-y-6">
                    {/* BaHaMa Section */}
                    <section className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowBahama(!showBahama)}
                            className="w-full flex justify-between items-center p-5 bg-transparent border-none text-text-primary cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold m-0">📦 BaHaMa Lagersaldo</h3>
                                <span className="text-xs text-text-secondary bg-white/5 px-2.5 py-1 rounded-full">
                                    {(state.inventoryData.bahama || []).length} artiklar
                                </span>
                            </div>
                            <span className={`text-text-secondary transition-transform ${showBahama ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showBahama && (
                            <div className="p-5 pt-0 space-y-4">
                                {/* Toolbar */}
                                <div className="flex flex-wrap gap-3 items-center">
                                    <input
                                        type="text"
                                        placeholder="Sök ID, typ, storlek, beskrivning..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 min-w-[200px] bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                                    />
                                    <button
                                        onClick={() => setModalState({ open: true, index: -1, item: null })}
                                        className="px-4 py-2.5 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold text-sm hover:brightness-110"
                                    >
                                        + Ny Artikel
                                    </button>
                                    <label className="px-4 py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer text-sm hover:bg-white/5 flex items-center gap-2">
                                        📄 Ladda Excel
                                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>

                                {/* Table */}
                                <InventoryTable
                                    items={state.inventoryData.bahama || []}
                                    searchTerm={searchTerm}
                                    onAddToBasket={handleAddToBasket}
                                    onEdit={(idx, item) => setModalState({ open: true, index: idx, item })}
                                    onDelete={handleDeleteItem}
                                />
                            </div>
                        )}
                    </section>

                    {/* ClickitUp Section */}
                    <section className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowClickitup(!showClickitup)}
                            className="w-full flex justify-between items-center p-5 bg-transparent border-none text-text-primary cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold m-0">🔩 ClickitUp Lagersaldo</h3>
                            </div>
                            <span className={`text-text-secondary transition-transform ${showClickitup ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {showClickitup && (
                            <div className="p-5 pt-0">
                                <ClickitupStockGrid
                                    inventoryData={state.inventoryData}
                                    onUpdateStock={handleUpdateStock}
                                />
                            </div>
                        )}
                    </section>
                </div>

                {/* Sidebar: Pending Changes */}
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <PendingChangesPanel
                        inventoryData={state.inventoryData}
                        cloudInventoryData={state.cloudInventoryData}
                        onCommit={handleCommit}
                        isSaving={isSaving}
                    />

                    {/* Quick basket indicator */}
                    {state.inventoryBasket.length > 0 && (
                        <div className="mt-4 bg-panel-bg border border-panel-border rounded-xl p-4">
                            <h4 className="text-sm font-semibold text-text-primary uppercase mb-3 m-0">
                                🛒 Korg ({state.inventoryBasket.length})
                            </h4>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {state.inventoryBasket.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start bg-white/[0.03] border border-panel-border rounded p-2.5 text-sm">
                                        <div>
                                            <div className="text-primary font-bold text-xs">ID: {item.ID || '-'}</div>
                                            <div className="text-text-primary text-xs mt-0.5 line-clamp-2">{item.BESKRIVNING || ''}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newBasket = [...state.inventoryBasket];
                                                newBasket.splice(idx, 1);
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

            {/* Modal */}
            {modalState.open && (
                <InventoryItemModal
                    item={modalState.item}
                    editIndex={modalState.index}
                    onSave={handleSaveItem}
                    onClose={() => setModalState({ open: false, index: -1, item: null })}
                />
            )}
        </div>
    );
}
