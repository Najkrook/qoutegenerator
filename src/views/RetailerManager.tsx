import React, {
    useState,
    useEffect,
    useCallback,
    type ChangeEvent,
    type FormEvent,
    type MouseEvent
} from 'react';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import { createRetailerAuthUser } from '../services/authService';
import {
    fetchRetailers,
    createRetailer,
    updateRetailer,
    deleteRetailer,
    normalizeRetailerData
} from '../services/retailerService';
import {
    getRetailerDocumentKindLabel,
    retailerDocumentService
} from '../services/retailerDocumentService';
import { notifySuccess } from '../services/notificationService';
import { getErrorMessage } from '../utils/runtime';
import type {
    PdfThemeId,
    RetailerFormState,
    RetailerDocumentKind,
    RetailerLineDocument,
    RetailerLineDocumentsRecord,
    RetailerManagerProps,
    RetailerProductLineDraftConfig,
    RetailerRecord
} from '../types/contracts';

interface RetailerFormProps {
    initial: RetailerRecord | null;
    onSave: (form: RetailerFormState) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

interface DeleteConfirmationProps {
    retailerName: string;
    onConfirm: () => Promise<void>;
    onCancel: () => void;
    deleting: boolean;
}

type RetailerLineDocumentsDraftMap = Record<string, RetailerLineDocument[]>;

const PRODUCT_LINE_IDS = getCatalogLineIds();

function buildEmptyProductLines(): Record<string, RetailerProductLineDraftConfig> {
    return PRODUCT_LINE_IDS.reduce<Record<string, RetailerProductLineDraftConfig>>((acc, id) => {
        acc[id] = { enabled: false, discountPct: 0 };
        return acc;
    }, {});
}

function buildFormState(retailer: RetailerRecord | null = null): RetailerFormState {
    return {
        name: retailer?.name || '',
        email: retailer?.email || '',
        password: '',
        notes: retailer?.notes || '',
        productLines: retailer
            ? PRODUCT_LINE_IDS.reduce<Record<string, RetailerProductLineDraftConfig>>((acc, id) => {
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

function buildEmptyRetailerLineDocumentDraft(sortOrder = 0): RetailerLineDocument {
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
        id: `document-${seed}`,
        title: '',
        kind: 'color-chart',
        url: '',
        fileName: '',
        description: '',
        sortOrder
    };
}

function buildRetailerLineDocumentsDraftMap(records: RetailerLineDocumentsRecord[] = []): RetailerLineDocumentsDraftMap {
    const recordsByLineId = records.reduce<Record<string, RetailerLineDocument[]>>((acc, record) => {
        acc[record.lineId] = record.documents.map((document) => ({
            ...document,
            description: document.description || ''
        }));
        return acc;
    }, {});

    return PRODUCT_LINE_IDS.reduce<RetailerLineDocumentsDraftMap>((acc, lineId) => {
        acc[lineId] = recordsByLineId[lineId] || [];
        return acc;
    }, {});
}

function RetailerForm({ initial, onSave, onCancel, saving }: RetailerFormProps) {
    const [form, setForm] = useState<RetailerFormState>(() => buildFormState(initial));
    const [error, setError] = useState('');

    useEffect(() => {
        setForm(buildFormState(initial));
    }, [initial]);

    const updateField = (field: keyof Pick<RetailerFormState, 'name' | 'email' | 'password' | 'notes'>) => (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const nextValue = event.target.value;
        setForm((prev) => ({ ...prev, [field]: nextValue }));
    };

    const handleToggleLine = (lineId: string) => {
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

    const handleDiscountChange = (lineId: string, value: string) => {
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

    const handleTogglePdfTheme = (themeId: PdfThemeId) => {
        setForm((prev) => {
            const currentThemes = prev.pdfThemes || [];
            if (currentThemes.includes(themeId)) {
                return { ...prev, pdfThemes: currentThemes.filter((t) => t !== themeId) };
            }
            return { ...prev, pdfThemes: [...currentThemes, themeId] };
        });
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        try {
            normalizeRetailerData(form, catalogData);
        } catch (err) {
            setError(getErrorMessage(err, 'Kunde inte validera återförsäljaren.'));
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
                    onChange={updateField('name')}
                    placeholder="T.ex. Markishuset"
                    required
                    className="w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-md outline-none focus:border-primary transition-colors"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">E-post *</label>
                <input
                    type="email"
                    value={form.email}
                    onChange={updateField('email')}
                    placeholder="E-postadress för inloggning"
                    required
                    readOnly={Boolean(initial)}
                    className={`w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-md outline-none focus:border-primary transition-colors ${initial ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
            </div>

            {!initial && (
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Lösenord *</label>
                    <input
                        type="text"
                        value={form.password || ''}
                        onChange={updateField('password')}
                        placeholder="Minst 6 tecken"
                        required
                        minLength={6}
                        className="w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-md outline-none focus:border-primary transition-colors"
                    />
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-3">Produktlinjer & rabatter</label>
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
                                    <span className="font-semibold text-text-primary text-sm">
                                        {getCatalogLineName(lineId) || lineId}
                                    </span>
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
                                            onChange={(event) => handleDiscountChange(lineId, event.target.value)}
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
                <label className="block text-xs font-bold text-text-secondary uppercase mb-3">PDF-teman</label>
                <div className="space-y-2">
                    {PDF_THEME_OPTIONS.filter((t) => t.id !== DEFAULT_PDF_THEME_ID).map((theme) => (
                        <label key={theme.id} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={(form.pdfThemes || []).includes(theme.id)}
                                onChange={() => handleTogglePdfTheme(theme.id)}
                                className="w-4 h-4 accent-primary cursor-pointer"
                            />
                            <span className="text-sm text-text-primary">{theme.label}</span>
                        </label>
                    ))}
                </div>
                <p className="mt-2 text-xs text-text-secondary italic">
                    (Standardtemat "BRIXX" är alltid tillgängligt.)
                </p>
            </div>

            <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1.5">Anteckningar</label>
                <textarea
                    value={form.notes}
                    onChange={updateField('notes')}
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

function DeleteConfirmation({ retailerName, onConfirm, onCancel, deleting }: DeleteConfirmationProps) {
    const handleDialogClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-fade-in" onClick={onCancel}>
            <div className="bg-panel-bg border border-panel-border rounded-xl p-6 max-w-md mx-4 shadow-2xl" onClick={handleDialogClick}>
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

export function RetailerManager({ onBack }: RetailerManagerProps) {
    const { user } = useAuth();
    const [retailers, setRetailers] = useState<RetailerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingRetailer, setEditingRetailer] = useState<RetailerRecord | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<RetailerRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [lineDocumentsById, setLineDocumentsById] = useState<RetailerLineDocumentsDraftMap>(() => buildRetailerLineDocumentsDraftMap());
    const [documentsLoading, setDocumentsLoading] = useState(true);
    const [documentsError, setDocumentsError] = useState('');
    const [savingDocumentsLineId, setSavingDocumentsLineId] = useState('');

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
        void loadRetailers();
    }, [loadRetailers]);

    const loadRetailerDocuments = useCallback(async () => {
        setDocumentsLoading(true);
        setDocumentsError('');
        try {
            const records = await retailerDocumentService.listRetailerLineDocuments();
            setLineDocumentsById(buildRetailerLineDocumentsDraftMap(records));
        } catch (err) {
            console.error('Failed to load retailer documents:', err);
            setLineDocumentsById(buildRetailerLineDocumentsDraftMap());
            setDocumentsError('Kunde inte ladda produktdokument.');
        } finally {
            setDocumentsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRetailerDocuments();
    }, [loadRetailerDocuments]);

    const handleSave = async (formData: RetailerFormState) => {
        setSaving(true);
        setError('');
        try {
            if (editingRetailer?.id) {
                await updateRetailer(editingRetailer.id, formData, user, catalogData);
            } else {
                try {
                    await createRetailerAuthUser(formData.email, formData.password || '');
                } catch (authErr) {
                    const code = authErr && typeof authErr === 'object' && 'code' in authErr ? String(authErr.code) : '';
                    const message = authErr instanceof Error ? authErr.message : 'Okänt fel';
                    if (code === 'auth/email-already-in-use') {
                        throw new Error('E-postadressen används redan av ett annat konto.');
                    } else if (code === 'auth/weak-password') {
                        throw new Error('Lösenordet är för svagt (minst 6 tecken).');
                    } else if (code === 'auth/invalid-email') {
                        throw new Error('Ogiltig e-postadress.');
                    }
                    throw new Error(`Kunde inte skapa inloggningskonto: ${message}`);
                }
                await createRetailer(formData, user, catalogData);
            }
            setShowForm(false);
            setEditingRetailer(null);
            await loadRetailers();
        } catch (err) {
            console.error('Failed to save retailer:', err);
            setError(getErrorMessage(err, 'Kunde inte spara återförsäljare.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
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

    const openEdit = (retailer: RetailerRecord) => {
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

    const enabledLines = (retailer: RetailerRecord) =>
        PRODUCT_LINE_IDS.filter((id) => retailer.productLines?.[id]?.enabled);

    const updateLineDocument = (
        lineId: string,
        documentId: string,
        patch: Partial<RetailerLineDocument>
    ) => {
        setLineDocumentsById((current) => ({
            ...current,
            [lineId]: (current[lineId] || []).map((document) => (
                document.id === documentId
                    ? { ...document, ...patch }
                    : document
            ))
        }));
    };

    const addLineDocument = (lineId: string) => {
        setLineDocumentsById((current) => {
            const existing = current[lineId] || [];
            return {
                ...current,
                [lineId]: [...existing, buildEmptyRetailerLineDocumentDraft(existing.length)]
            };
        });
    };

    const removeLineDocument = (lineId: string, documentId: string) => {
        setLineDocumentsById((current) => ({
            ...current,
            [lineId]: (current[lineId] || []).filter((document) => document.id !== documentId)
        }));
    };

    const saveLineDocuments = async (lineId: string) => {
        if (!user?.uid) {
            setDocumentsError('Du måste vara inloggad för att spara produktdokument.');
            return;
        }

        setSavingDocumentsLineId(lineId);
        setDocumentsError('');
        try {
            const saved = await retailerDocumentService.saveRetailerLineDocuments({
                lineId,
                documents: lineDocumentsById[lineId] || [],
                user
            });
            setLineDocumentsById((current) => ({
                ...current,
                [lineId]: saved.documents.map((document) => ({
                    ...document,
                    description: document.description || ''
                }))
            }));
            notifySuccess(`Produktdokument sparade för ${getCatalogLineName(lineId) || lineId}.`);
        } catch (err) {
            console.error('Failed to save retailer documents:', err);
            setDocumentsError(getErrorMessage(err, 'Kunde inte spara produktdokument.'));
        } finally {
            setSavingDocumentsLineId('');
        }
    };

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
                        + Ny återförsäljare
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
                        {editingRetailer ? `Redigera: ${editingRetailer.name}` : 'Ny återförsäljare'}
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
                                                    {getCatalogLineName(lineId) || lineId}
                                                    <span className="text-primary/70 font-normal">
                                                        {retailer.productLines?.[lineId]?.discountPct || 0}%
                                                    </span>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                    {retailer.email && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            <span className="bg-panel-bg border border-panel-border text-text-secondary rounded text-[10px] px-1.5 py-0.5" title={retailer.email}>
                                                {retailer.email}
                                            </span>
                                        </div>
                                    )}
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

            <section className="mt-10 rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm" data-testid="retailer-documents-admin">
                <div className="flex flex-col gap-3 border-b border-panel-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="m-0 text-lg font-semibold text-text-primary">Dokument per produktlinje</h3>
                        <p className="mt-1 text-sm text-text-secondary">
                            Hantera globala PDF-länkar för färgkartor och installationsinstruktioner som visas i retailer-vyn.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            void loadRetailerDocuments();
                        }}
                        className="rounded-md border border-panel-border bg-black/10 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                    >
                        Uppdatera dokument
                    </button>
                </div>

                {documentsError && (
                    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                        {documentsError}
                    </div>
                )}

                {documentsLoading ? (
                    <p className="py-8 text-center text-sm italic text-text-secondary">Laddar produktdokument...</p>
                ) : (
                    <div className="mt-6 grid grid-cols-1 gap-6">
                        {PRODUCT_LINE_IDS.map((lineId) => {
                            const documents = lineDocumentsById[lineId] || [];
                            const isSavingDocuments = savingDocumentsLineId === lineId;

                            return (
                                <section
                                    key={lineId}
                                    className="rounded-xl border border-panel-border bg-black/10 p-5"
                                >
                                    <div className="flex flex-col gap-3 border-b border-panel-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="m-0 text-base font-semibold text-text-primary">{getCatalogLineName(lineId) || lineId}</h4>
                                            <p className="mt-1 text-xs text-text-secondary">
                                                {documents.length === 0
                                                    ? 'Inga dokument publicerade ännu.'
                                                    : `${documents.length} dokument konfigurerade.`}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                type="button"
                                                onClick={() => addLineDocument(lineId)}
                                                className="rounded-md border border-panel-border bg-panel-bg px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-white/5"
                                            >
                                                + Lägg till dokument
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void saveLineDocuments(lineId);
                                                }}
                                                disabled={isSavingDocuments}
                                                className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isSavingDocuments ? 'Sparar...' : 'Spara dokument'}
                                            </button>
                                        </div>
                                    </div>

                                    {documents.length === 0 ? (
                                        <div className="mt-4 rounded-lg border border-dashed border-panel-border p-4 text-sm text-text-secondary">
                                            Lägg till de PDF-länkar som ska visas för retailers med denna produktlinje.
                                        </div>
                                    ) : (
                                        <div className="mt-4 space-y-4">
                                            {documents.map((document, index) => (
                                                <div
                                                    key={document.id}
                                                    className="rounded-lg border border-panel-border bg-panel-bg/60 p-4"
                                                >
                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                        <div>
                                                            <label className="mb-1.5 block text-xs font-bold uppercase text-text-secondary">Titel</label>
                                                            <input
                                                                type="text"
                                                                value={document.title}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { title: event.target.value })}
                                                                placeholder="T.ex. Färgkarta Markisväv"
                                                                className="w-full rounded-md border border-panel-border bg-input-bg p-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1.5 block text-xs font-bold uppercase text-text-secondary">Typ</label>
                                                            <select
                                                                value={document.kind}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { kind: event.target.value as RetailerDocumentKind })}
                                                                className="w-full rounded-md border border-panel-border bg-input-bg p-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
                                                            >
                                                                <option value="color-chart">{getRetailerDocumentKindLabel('color-chart')}</option>
                                                                <option value="installation-instructions">{getRetailerDocumentKindLabel('installation-instructions')}</option>
                                                            </select>
                                                        </div>
                                                        <div className="lg:col-span-2">
                                                            <label className="mb-1.5 block text-xs font-bold uppercase text-text-secondary">PDF-URL</label>
                                                            <input
                                                                type="url"
                                                                value={document.url}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { url: event.target.value })}
                                                                placeholder="https://..."
                                                                className="w-full rounded-md border border-panel-border bg-input-bg p-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1.5 block text-xs font-bold uppercase text-text-secondary">Filnamn</label>
                                                            <input
                                                                type="text"
                                                                value={document.fileName}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { fileName: event.target.value })}
                                                                placeholder="fargkarta.pdf"
                                                                className="w-full rounded-md border border-panel-border bg-input-bg p-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1.5 block text-xs font-bold uppercase text-text-secondary">Sortering</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                value={document.sortOrder}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { sortOrder: Number(event.target.value) || 0 })}
                                                                className="w-full rounded-md border border-panel-border bg-input-bg p-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
                                                            />
                                                        </div>
                                                        <div className="lg:col-span-2">
                                                            <label className="mb-1.5 block text-xs font-bold uppercase text-text-secondary">Beskrivning</label>
                                                            <textarea
                                                                value={document.description || ''}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { description: event.target.value })}
                                                                rows={2}
                                                                placeholder="Kort hjälptext som visas i retailer-vyn."
                                                                className="w-full resize-y rounded-md border border-panel-border bg-input-bg p-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-panel-border pt-3">
                                                        <div className="text-xs text-text-secondary">
                                                            Rad {index + 1} · {getRetailerDocumentKindLabel(document.kind)}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLineDocument(lineId, document.id)}
                                                            className="rounded-md border border-red-500/30 bg-panel-bg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                                                        >
                                                            Ta bort dokument
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}
            </section>

            {deleteTarget && (
                <DeleteConfirmation
                    retailerName={deleteTarget.name || ''}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                    deleting={deleting}
                />
            )}
        </div>
    );
}
