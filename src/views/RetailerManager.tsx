import React, {
    useState,
    useEffect,
    useCallback,
    type ChangeEvent,
    type FormEvent
} from 'react';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import { PDF_THEME_OPTIONS, DEFAULT_PDF_THEME_ID } from '../config/pdfThemes';
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
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
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
            : buildEmptyProductLines(),
        pdfThemes: retailer?.pdfThemes || []
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
    const formId = React.useId();
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
        <form onSubmit={handleSubmit} className="animate-fade-in space-y-5 rounded-panel border border-border bg-surface-raised p-6 shadow-panel">
            {error && (
                <div role="alert" className="rounded-control border border-danger-border bg-danger-soft p-3 text-sm text-danger-text">
                    {error}
                </div>
            )}

            <div>
                <label htmlFor={`${formId}-name`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Namn *</label>
                <input
                    id={`${formId}-name`}
                    name="retailerName"
                    type="text"
                    value={form.name}
                    onChange={updateField('name')}
                    placeholder="T.ex. Markishuset"
                    required
                    autoComplete="organization"
                    className="w-full rounded-control border border-control-border bg-input p-2.5 text-text outline-none transition-colors focus:border-action"
                />
            </div>

            <div>
                <label htmlFor={`${formId}-email`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">E-post *</label>
                <input
                    id={`${formId}-email`}
                    name="retailerEmail"
                    type="email"
                    value={form.email}
                    onChange={updateField('email')}
                    placeholder="E-postadress för inloggning"
                    required
                    readOnly={Boolean(initial)}
                    autoComplete="email"
                    className={`w-full rounded-control border border-control-border bg-input p-2.5 text-text outline-none transition-colors focus:border-action ${initial ? 'cursor-not-allowed opacity-60' : ''}`}
                />
            </div>

            {!initial && (
                <div>
                    <label htmlFor={`${formId}-password`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Lösenord *</label>
                    <input
                        id={`${formId}-password`}
                        name="retailerPassword"
                        type="password"
                        value={form.password || ''}
                        onChange={updateField('password')}
                        placeholder="Minst 6 tecken"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="w-full rounded-control border border-control-border bg-input p-2.5 text-text outline-none transition-colors focus:border-action"
                    />
                </div>
            )}

            <fieldset className="m-0 border-0 p-0">
                <legend className="mb-3 block text-xs font-bold uppercase text-text-muted">Produktlinjer och rabatter</legend>
                <div className="space-y-3">
                    {PRODUCT_LINE_IDS.map((lineId) => {
                        const lineEntry = form.productLines[lineId];
                        const lineName = getCatalogLineName(lineId) || lineId;
                        return (
                            <div
                                key={lineId}
                                className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                                    lineEntry.enabled
                                        ? 'border-action bg-action-soft'
                                        : 'border-border bg-transparent'
                                }`}
                            >
                                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                    <input
                                        name={`productLine-${lineId}`}
                                        type="checkbox"
                                        checked={lineEntry.enabled}
                                        onChange={() => handleToggleLine(lineId)}
                                        className="h-4 w-4 cursor-pointer accent-action"
                                    />
                                    <span className="text-sm font-semibold text-text">
                                        {lineName}
                                    </span>
                                </label>
                                {lineEntry.enabled && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <label htmlFor={`${formId}-${lineId}-discount`} className="text-xs text-text-muted">Maxrabatt</label>
                                        <input
                                            id={`${formId}-${lineId}-discount`}
                                            name={`discount-${lineId}`}
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={lineEntry.discountPct}
                                            onChange={(event) => handleDiscountChange(lineId, event.target.value)}
                                            aria-label={`Maximal rabatt för ${lineName}`}
                                            className="w-16 rounded-control border border-control-border bg-input p-1.5 text-center text-sm text-text outline-none focus:border-action"
                                        />
                                        <span className="text-xs text-text-muted">%</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
                <legend className="mb-3 block text-xs font-bold uppercase text-text-muted">PDF-teman</legend>
                <div className="space-y-2">
                    {PDF_THEME_OPTIONS.filter((t) => t.id !== DEFAULT_PDF_THEME_ID).map((theme) => (
                        <label key={theme.id} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                name={`pdfTheme-${theme.id}`}
                                type="checkbox"
                                checked={(form.pdfThemes || []).includes(theme.id)}
                                onChange={() => handleTogglePdfTheme(theme.id)}
                                className="h-4 w-4 cursor-pointer accent-action"
                            />
                            <span className="text-sm text-text">{theme.label}</span>
                        </label>
                    ))}
                </div>
                <p className="mt-2 text-xs italic text-text-muted">
                    Standardtemat BRIXX är alltid tillgängligt.
                </p>
            </fieldset>

            <div>
                <label htmlFor={`${formId}-notes`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Anteckningar</label>
                <textarea
                    id={`${formId}-notes`}
                    name="retailerNotes"
                    value={form.notes}
                    onChange={updateField('notes')}
                    rows={2}
                    placeholder="Valfria anteckningar…"
                    className="w-full resize-y rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <Button
                    onClick={onCancel}
                    disabled={saving}
                >
                    Avbryt
                </Button>
                <Button
                    type="submit"
                    disabled={saving}
                    variant="primary"
                >
                    {saving ? 'Sparar…' : (initial ? 'Uppdatera' : 'Skapa')}
                </Button>
            </div>
        </form>
    );
}

function DeleteConfirmation({ retailerName, onConfirm, onCancel, deleting }: DeleteConfirmationProps) {
    return (
        <Modal
            dismissible={!deleting}
            onClose={onCancel}
            title="Ta bort återförsäljare?"
            description="Åtgärden går inte att ångra."
            maxWidthClassName="max-w-md"
            footer={(
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button onClick={onCancel} disabled={deleting}>
                        Avbryt
                    </Button>
                    <Button onClick={onConfirm} disabled={deleting} variant="danger">
                        {deleting ? 'Tar bort...' : 'Ta bort'}
                    </Button>
                </div>
            )}
        >
            <p className="m-0 p-6 text-sm text-text-muted">
                Du håller på att ta bort <strong className="text-text">{retailerName}</strong>.
            </p>
        </Modal>
    );
}

export function RetailerManager(_: RetailerManagerProps) {
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
        <div className="mx-auto max-w-[1000px] animate-slide-in">
            <PageHeader
                eyebrow="Partners"
                title="Återförsäljare"
                description="Hantera återförsäljare, produktlinjer, rabatter och dokument."
                actions={!showForm ? (
                    <Button onClick={openAdd} variant="primary">
                        Ny återförsäljare
                    </Button>
                ) : undefined}
            />

            {error && (
                <div role="alert" className="mb-6 mt-6 rounded-panel border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
                    {error}
                </div>
            )}

            {showForm && (
                <div className="mb-8 mt-6">
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
                <p role="status" className="py-12 text-center text-sm text-text-muted">Laddar återförsäljare…</p>
            ) : retailers.length === 0 ? (
                <Panel className="mt-6">
                    <div className="p-10 text-center">
                    <h2 className="m-0 text-lg font-semibold text-text">Inga återförsäljare ännu</h2>
                    <p className="mb-0 mt-2 text-sm text-text-muted">Skapa den första profilen för att tilldela sortiment och rabatter.</p>
                    {!showForm && (
                        <Button
                            onClick={openAdd}
                            className="mt-4"
                            variant="primary"
                        >
                            Lägg till den första
                        </Button>
                    )}
                    </div>
                </Panel>
            ) : (
                <div className="mt-6 space-y-3">
                    {retailers.map((retailer) => {
                        const lines = enabledLines(retailer);
                        return (
                            <div
                                key={retailer.id}
                                className="group flex items-center gap-5 rounded-panel border border-border bg-surface-raised p-5 transition-colors hover:border-action/40"
                            >
                                <div className="flex-1 min-w-0">
                                    <h2 className="m-0 text-base font-semibold text-text">{retailer.name}</h2>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {lines.length === 0 ? (
                                            <span className="text-xs text-text-secondary italic">Inga produktlinjer aktiverade</span>
                                        ) : (
                                            lines.map((lineId) => (
                                                <StatusChip key={lineId} tone="success">
                                                    {getCatalogLineName(lineId) || lineId}
                                                    {' · '}
                                                    {retailer.productLines?.[lineId]?.discountPct || 0}%
                                                </StatusChip>
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
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button
                                        onClick={() => openEdit(retailer)}
                                        size="sm"
                                    >
                                        Redigera
                                    </Button>
                                    <Button
                                        onClick={() => setDeleteTarget(retailer)}
                                        size="sm"
                                        variant="danger"
                                    >
                                        Ta bort
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <section className="mt-10 rounded-panel border border-border bg-surface-raised p-6 shadow-panel" data-testid="retailer-documents-admin">
                <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="m-0 text-lg font-semibold text-text-primary">Dokument per produktlinje</h3>
                        <p className="mt-1 text-sm text-text-secondary">
                            Hantera globala PDF-länkar för färgkartor och installationsinstruktioner som visas i återförsäljarvyn.
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            void loadRetailerDocuments();
                        }}
                    >
                        Uppdatera dokument
                    </Button>
                </div>

                {documentsError && (
                    <div role="alert" className="mt-4 rounded-control border border-danger-border bg-danger-soft p-3 text-sm text-danger-text">
                        {documentsError}
                    </div>
                )}

                {documentsLoading ? (
                    <p className="py-8 text-center text-sm italic text-text-muted">Laddar produktdokument…</p>
                ) : (
                    <div className="mt-6 grid grid-cols-1 gap-6">
                        {PRODUCT_LINE_IDS.map((lineId) => {
                            const documents = lineDocumentsById[lineId] || [];
                            const isSavingDocuments = savingDocumentsLineId === lineId;

                            return (
                                <section
                                    key={lineId}
                                    className="rounded-panel border border-border bg-surface p-5"
                                >
                                    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h4 className="m-0 text-base font-semibold text-text-primary">{getCatalogLineName(lineId) || lineId}</h4>
                                            <p className="mt-1 text-xs text-text-secondary">
                                                {documents.length === 0
                                                    ? 'Inga dokument publicerade ännu.'
                                                    : `${documents.length} dokument konfigurerade.`}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                onClick={() => addLineDocument(lineId)}
                                                size="sm"
                                            >
                                                Lägg till dokument
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    void saveLineDocuments(lineId);
                                                }}
                                                disabled={isSavingDocuments}
                                                size="sm"
                                                variant="primary"
                                            >
                                                {isSavingDocuments ? 'Sparar…' : 'Spara dokument'}
                                            </Button>
                                        </div>
                                    </div>

                                    {documents.length === 0 ? (
                                        <div className="mt-4 rounded-lg border border-dashed border-panel-border p-4 text-sm text-text-secondary">
                                            Lägg till de PDF-länkar som ska visas för återförsäljare med denna produktlinje.
                                        </div>
                                    ) : (
                                        <div className="mt-4 space-y-4">
                                            {documents.map((document, index) => (
                                                <div
                                                    key={document.id}
                                                    className="rounded-control border border-border bg-surface-raised p-4"
                                                >
                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                        <div>
                                                            <label htmlFor={`${lineId}-${document.id}-title`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Titel</label>
                                                            <input
                                                                id={`${lineId}-${document.id}-title`}
                                                                name={`${lineId}-${document.id}-title`}
                                                                type="text"
                                                                value={document.title}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { title: event.target.value })}
                                                                placeholder="T.ex. Färgkarta Markisväv"
                                                                className="w-full rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`${lineId}-${document.id}-kind`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Typ</label>
                                                            <select
                                                                id={`${lineId}-${document.id}-kind`}
                                                                name={`${lineId}-${document.id}-kind`}
                                                                value={document.kind}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { kind: event.target.value as RetailerDocumentKind })}
                                                                className="w-full rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                                                            >
                                                                <option value="color-chart">{getRetailerDocumentKindLabel('color-chart')}</option>
                                                                <option value="installation-instructions">{getRetailerDocumentKindLabel('installation-instructions')}</option>
                                                            </select>
                                                        </div>
                                                        <div className="lg:col-span-2">
                                                            <label htmlFor={`${lineId}-${document.id}-url`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">PDF-URL</label>
                                                            <input
                                                                id={`${lineId}-${document.id}-url`}
                                                                name={`${lineId}-${document.id}-url`}
                                                                type="url"
                                                                value={document.url}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { url: event.target.value })}
                                                                placeholder="https://..."
                                                                className="w-full rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`${lineId}-${document.id}-filename`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Filnamn</label>
                                                            <input
                                                                id={`${lineId}-${document.id}-filename`}
                                                                name={`${lineId}-${document.id}-filename`}
                                                                type="text"
                                                                value={document.fileName}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { fileName: event.target.value })}
                                                                placeholder="fargkarta.pdf"
                                                                className="w-full rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`${lineId}-${document.id}-sort`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Sortering</label>
                                                            <input
                                                                id={`${lineId}-${document.id}-sort`}
                                                                name={`${lineId}-${document.id}-sort`}
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                value={document.sortOrder}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { sortOrder: Number(event.target.value) || 0 })}
                                                                className="w-full rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                                                            />
                                                        </div>
                                                        <div className="lg:col-span-2">
                                                            <label htmlFor={`${lineId}-${document.id}-description`} className="mb-1.5 block text-xs font-bold uppercase text-text-muted">Beskrivning</label>
                                                            <textarea
                                                                id={`${lineId}-${document.id}-description`}
                                                                name={`${lineId}-${document.id}-description`}
                                                                value={document.description || ''}
                                                                onChange={(event) => updateLineDocument(lineId, document.id, { description: event.target.value })}
                                                                rows={2}
                                                                placeholder="Kort hjälptext som visas i återförsäljarvyn."
                                                                className="w-full resize-y rounded-control border border-control-border bg-input p-2.5 text-sm text-text outline-none transition-colors focus:border-action"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                                                        <div className="text-xs text-text-muted">
                                                            Rad {index + 1} · {getRetailerDocumentKindLabel(document.kind)}
                                                        </div>
                                                        <Button
                                                            onClick={() => removeLineDocument(lineId, document.id)}
                                                            size="sm"
                                                            variant="danger"
                                                        >
                                                            Ta bort dokument
                                                        </Button>
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
