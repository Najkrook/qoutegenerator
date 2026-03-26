import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import {
    fetchRetailers,
    createRetailer,
    updateRetailer,
    deleteRetailer,
    normalizeRetailerData
} from '../services/retailerService';

const PRODUCT_LINE_IDS = Object.keys(catalogData);

function buildEmptyProductLines() {
    return PRODUCT_LINE_IDS.reduce((acc, id) => {
        acc[id] = { enabled: false, discountPct: 0 };
        return acc;
    }, {});
}

function buildFormState(retailer = null) {
    return {
        name: retailer?.name || '',
        notes: retailer?.notes || '',
        productLines: retailer
            ? PRODUCT_LINE_IDS.reduce((acc, id) => {
                const existing = retailer.productLines?.[id];
                acc[id] = {
                    enabled: Boolean(existing?.enabled),
                    discountPct: Number(existing?.discountPct) || 0
                };
                return acc;
            }, {})
            : buildEmptyProductLines()
    };
}

function RetailerForm({ initial, onSave, onCancel, saving }) {
    const [form, setForm] = useState(() => buildFormState(initial));
    const [error, setError] = useState('');

    const handleToggleLine = (lineId) => {
        setForm((prev) => ({
            ...prev,
            productLines: {
                ...prev.productLines,
                [lineId]: {
                    ...prev.productLines[lineId],
                    enabled: !prev.productLines[lineId].enabled,
                    discountPct: !prev.productLines[lineId].enabled ? prev.productLines[lineId].discountPct : 0
                }
            }
        }));
    };

    const handleDiscountChange = (lineId, value) => {
        setForm((prev) => ({
            ...prev,
            productLines: {
                ...prev.productLines,
                [lineId]: {
                    ...prev.productLines[lineId],
                    discountPct: value === '' ? '' : Number(value)
                }
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            normalizeRetailerData(form, catalogData);
        } catch (err) {
            setError(err.message);
            return;
        }
        await onSave(form);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-panel-bg border border-panel-border rounded-xl p-6 space-y-5 animate-fade-in">
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Namn *</label>
                <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="T.ex. Markishuset"
                    required
                    className="w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-md outline-none focus:border-primary transition-colors"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-3">Produktlinjer & Rabatter</label>
                <div className="space-y-3">
                    {PRODUCT_LINE_IDS.map((lineId) => {
                        const lineEntry = form.productLines[lineId];
                        return (
                            <div
                                key={lineId}
                                className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                                    lineEntry.enabled
                                        ? 'border-primary/40 bg-primary/5'
                                        : 'border-panel-border bg-transparent'
                                }`}
                            >
                                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={lineEntry.enabled}
                                        onChange={() => handleToggleLine(lineId)}
                                        className="w-4 h-4 accent-primary cursor-pointer"
                                    />
                                    <span className="font-semibold text-text-primary text-sm">{catalogData[lineId]?.name || lineId}</span>
                                </label>
                                {lineEntry.enabled && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-text-secondary">Rabatt:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={lineEntry.discountPct}
                                            onChange={(e) => handleDiscountChange(lineId, e.target.value)}
                                            className="w-16 bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md text-center text-sm outline-none focus:border-primary"
                                        />
                                        <span className="text-xs text-text-secondary">%</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Anteckningar</label>
                <textarea
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Valfria anteckningar..."
                    className="w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-md outline-none focus:border-primary transition-colors resize-y text-sm"
                />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="px-4 py-2 rounded-md font-medium text-text-primary bg-panel-bg border border-panel-border hover:bg-panel-border transition-colors text-sm"
                >
                    Avbryt
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-md font-bold text-white bg-primary hover:bg-primary-hover transition-colors text-sm disabled:opacity-50"
                >
                    {saving ? 'Sparar...' : (initial ? 'Uppdatera' : 'Skapa')}
                </button>
            </div>
        </form>
    );
}

function DeleteConfirmation({ retailerName, onConfirm, onCancel, deleting }) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-fade-in" onClick={onCancel}>
            <div className="bg-panel-bg border border-panel-border rounded-xl p-6 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-text-primary mb-2">Ta bort återförsäljare?</h3>
                <p className="text-text-secondary text-sm mb-5">
                    Är du säker på att du vill ta bort <strong className="text-text-primary">{retailerName}</strong>? Det går inte att ångra.
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={deleting}
                        className="px-4 py-2 rounded-md font-medium text-text-primary bg-panel-bg border border-panel-border hover:bg-panel-border transition-colors text-sm"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="px-5 py-2 rounded-md font-bold text-white bg-red-600 hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                    >
                        {deleting ? 'Tar bort...' : 'Ta bort'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function RetailerManager({ onBack }) {
    const { user } = useAuth();
    const [retailers, setRetailers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingRetailer, setEditingRetailer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadRetailers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchRetailers();
            setRetailers(data);
        } catch (err) {
            console.error('Failed to fetch retailers:', err);
            setError('Kunde inte ladda återförsäljare.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRetailers();
    }, [loadRetailers]);

    const handleSave = async (formData) => {
        setSaving(true);
        setError('');
        try {
            if (editingRetailer) {
                await updateRetailer(editingRetailer.id, formData, user, catalogData);
            } else {
                await createRetailer(formData, user, catalogData);
            }
            setShowForm(false);
            setEditingRetailer(null);
            await loadRetailers();
        } catch (err) {
            console.error('Failed to save retailer:', err);
            setError(err.message || 'Kunde inte spara återförsäljare.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteRetailer(deleteTarget.id, deleteTarget.name, user);
            setDeleteTarget(null);
            await loadRetailers();
        } catch (err) {
            console.error('Failed to delete retailer:', err);
            setError('Kunde inte ta bort återförsäljare.');
        } finally {
            setDeleting(false);
        }
    };

    const openEdit = (retailer) => {
        setEditingRetailer(retailer);
        setShowForm(true);
    };

    const openAdd = () => {
        setEditingRetailer(null);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingRetailer(null);
    };

    const enabledLines = (retailer) =>
        PRODUCT_LINE_IDS.filter((id) => retailer.productLines?.[id]?.enabled);

    return (
        <div className="max-w-[1000px] mx-auto animate-slide-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <button
                        onClick={onBack}
                        className="text-text-secondary hover:text-text-primary text-sm mb-2 transition-colors inline-flex items-center gap-1"
                    >
                        &laquo; Tillbaka till Dashboard
                    </button>
                    <h2 className="text-2xl font-bold text-text-primary m-0">Återförsäljare</h2>
                    <p className="text-text-secondary text-sm mt-1">
                        Hantera återförsäljare och deras produktlinjer med rabatter.
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={openAdd}
                        className="px-5 py-2.5 rounded-md font-bold text-white bg-primary hover:bg-primary-hover transition-colors text-sm shadow shadow-primary/20"
                    >
                        + Ny Återförsäljare
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm mb-6">
                    {error}
                </div>
            )}

            {showForm && (
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        {editingRetailer ? `Redigera: ${editingRetailer.name}` : 'Ny Återförsäljare'}
                    </h3>
                    <RetailerForm
                        initial={editingRetailer}
                        onSave={handleSave}
                        onCancel={closeForm}
                        saving={saving}
                    />
                </div>
            )}

            {loading ? (
                <p className="text-text-secondary text-center italic py-12">Laddar återförsäljare...</p>
            ) : retailers.length === 0 ? (
                <div className="bg-panel-bg border border-panel-border rounded-xl p-12 text-center">
                    <div className="text-5xl mb-3">🏪</div>
                    <p className="text-text-secondary">Inga återförsäljare konfigurerade ännu.</p>
                    {!showForm && (
                        <button
                            onClick={openAdd}
                            className="mt-4 px-5 py-2 rounded-md font-medium text-primary border border-primary hover:bg-primary/10 transition-colors text-sm"
                        >
                            Lägg till den första
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {retailers.map((retailer) => {
                        const lines = enabledLines(retailer);
                        return (
                            <div
                                key={retailer.id}
                                className="bg-panel-bg border border-panel-border rounded-xl p-5 flex items-center gap-5 hover:border-primary/30 transition-colors group"
                            >
                                <div className="text-2xl">🏪</div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-text-primary text-base m-0">{retailer.name}</h4>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {lines.length === 0 ? (
                                            <span className="text-xs text-text-secondary italic">Inga produktlinjer aktiverade</span>
                                        ) : (
                                            lines.map((lineId) => (
                                                <span
                                                    key={lineId}
                                                    className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                                >
                                                    {catalogData[lineId]?.name || lineId}
                                                    <span className="text-primary/70 font-normal">
                                                        {retailer.productLines[lineId]?.discountPct || 0}%
                                                    </span>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                    {retailer.notes && (
                                        <p className="text-xs text-text-secondary mt-1.5 m-0 truncate">{retailer.notes}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEdit(retailer)}
                                        className="px-3 py-1.5 rounded-md text-xs font-medium text-text-primary bg-panel-bg border border-panel-border hover:bg-panel-border transition-colors"
                                    >
                                        Redigera
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(retailer)}
                                        className="px-3 py-1.5 rounded-md text-xs font-medium text-red-400 bg-panel-bg border border-red-500/30 hover:bg-red-500/10 transition-colors"
                                    >
                                        Ta bort
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {deleteTarget && (
                <DeleteConfirmation
                    retailerName={deleteTarget.name}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    deleting={deleting}
                />
            )}
        </div>
    );
}
