import React, { useEffect, useMemo, useState } from 'react';
import {
    IconAlertTriangle,
    IconChevronLeft,
    IconChevronRight,
    IconFileTypePdf,
    IconFileTypePng,
    IconQrcode,
    IconSearch
} from '@tabler/icons-react';
import { db, doc, getDoc } from '../services/firebase';
import { isBahamaQrId } from '../services/bahamaQrService';
import {
    DEFAULT_QR_LABEL_LAYOUT,
    QR_LABEL_PRESETS,
    exportBahamaLabelsAsPdf,
    exportBahamaLabelsAsPng,
    getA4LabelGrid,
    renderBahamaLabelDataUrl,
    validateQrLabelLayout
} from '../services/qrLabelExport';
import { notifyError, notifySuccess } from '../services/notificationService';
import { getErrorMessage } from '../utils/runtime';
import { normalizeStoredInventoryData } from './inventoryData';
import type { BahamaInventoryStatus, BahamaInventoryV2Item, QrLabelLayout } from '../types/contracts';

const PAGE_SIZE = 25;
const STATUS_LABELS: Record<BahamaInventoryStatus, string> = {
    available: 'Tillgänglig',
    reserved: 'Reserverad',
    'needs-review': 'Kontroll',
    used: 'Begagnad',
    sold: 'Såld'
};

function uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }));
}

function searchText(item: BahamaInventoryV2Item): string {
    return [item.id, item.type, item.size, item.location, item.properties.stativ, item.properties.textil]
        .join(' ')
        .toLocaleLowerCase('sv');
}

function MeasureInput({
    label,
    field,
    value,
    onChange
}: {
    label: string;
    field: keyof QrLabelLayout;
    value: number;
    onChange: (field: keyof QrLabelLayout, value: number) => void;
}) {
    return (
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-400">
            {label}
            <span className="flex min-w-0 w-full items-center rounded-lg border border-white/10 bg-[#111722] pr-3 focus-within:border-[#e8e1d4]">
                <input
                    type="number"
                    min={field === 'widthMm' ? 60 : field === 'heightMm' ? 40 : 0}
                    step="1"
                    value={value}
                    onChange={(event) => onChange(field, Number(event.target.value))}
                    className="min-w-0 w-full flex-1 border-0 bg-transparent px-3 py-2 text-base text-white outline-none sm:text-sm"
                />
                <span className="shrink-0 text-[11px] text-slate-400">mm</span>
            </span>
        </label>
    );
}

export function InventoryQrGenerator({ initialItems }: { initialItems?: BahamaInventoryV2Item[] } = {}) {
    const [items, setItems] = useState<BahamaInventoryV2Item[]>(initialItems || []);
    const [loading, setLoading] = useState(initialItems === undefined);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [model, setModel] = useState('all');
    const [status, setStatus] = useState<'all' | BahamaInventoryStatus>('all');
    const [location, setLocation] = useState('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [layout, setLayout] = useState<QrLabelLayout>(DEFAULT_QR_LABEL_LAYOUT);
    const [labelPreset, setLabelPreset] = useState('a4');
    const [page, setPage] = useState(1);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);

    useEffect(() => {
        if (initialItems) {
            setItems(initialItems);
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const snapshot = await getDoc(doc(db, 'stock', 'main_inventory'));
                const inventory = normalizeStoredInventoryData(snapshot.exists() ? snapshot.data() : {});
                if (!cancelled) setItems(inventory.bahamaV2 || []);
            } catch (error) {
                if (!cancelled) setLoadError(getErrorMessage(error, 'Kunde inte läsa BaHaMa-lagret.'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [initialItems]);

    const modelOptions = useMemo(() => uniqueSorted(items.map((item) => item.type)), [items]);
    const locationOptions = useMemo(() => uniqueSorted(items.map((item) => item.location)), [items]);
    const filteredItems = useMemo(() => {
        const query = search.trim().toLocaleLowerCase('sv');
        return [...items]
            .filter((item) => model === 'all' || item.type === model)
            .filter((item) => status === 'all' || item.status === status)
            .filter((item) => location === 'all' || item.location === location)
            .filter((item) => !query || searchText(item).includes(query))
            .sort((a, b) => a.id.localeCompare(b.id, 'sv', { numeric: true }));
    }, [items, location, model, search, status]);
    const validFilteredItems = useMemo(() => filteredItems.filter((item) => isBahamaQrId(item.qrId)), [filteredItems]);
    const selectedItems = useMemo(
        () => items.filter((item) => selected.has(item.qrId) && isBahamaQrId(item.qrId)),
        [items, selected]
    );
    const previewItem = selectedItems[0] || validFilteredItems[0] || null;
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const pageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const layoutError = validateQrLabelLayout(layout);
    const grid = getA4LabelGrid(layout);
    const missingQrCount = items.filter((item) => !isBahamaQrId(item.qrId)).length;
    const origin = window.location.origin;
    const isLocalOrigin = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

    useEffect(() => setPage(1), [location, model, search, status]);
    useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

    useEffect(() => {
        let cancelled = false;
        if (!previewItem || layoutError) {
            setPreviewUrl(null);
            return;
        }
        void renderBahamaLabelDataUrl(previewItem, layout, origin)
            .then((url) => { if (!cancelled) setPreviewUrl(url); })
            .catch(() => { if (!cancelled) setPreviewUrl(null); });
        return () => { cancelled = true; };
    }, [layout, layoutError, origin, previewItem]);

    const updateLayout = (field: keyof QrLabelLayout, value: number) => {
        setLabelPreset('custom');
        setLayout((current) => ({ ...current, [field]: value }));
    };

    const applyLabelPreset = (value: string) => {
        setLabelPreset(value);
        if (QR_LABEL_PRESETS[value]) setLayout(QR_LABEL_PRESETS[value]);
    };

    const resetFilters = () => {
        setSearch('');
        setModel('all');
        setStatus('all');
        setLocation('all');
    };

    const toggleItem = (qrId: string) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(qrId)) next.delete(qrId);
            else next.add(qrId);
            return next;
        });
    };

    const toggleAllFiltered = () => {
        const allSelected = validFilteredItems.length > 0 && validFilteredItems.every((item) => selected.has(item.qrId));
        setSelected((current) => {
            const next = new Set(current);
            validFilteredItems.forEach((item) => allSelected ? next.delete(item.qrId) : next.add(item.qrId));
            return next;
        });
    };

    const runExport = async (format: 'pdf' | 'png') => {
        if (selectedItems.length === 0 || layoutError) return;
        setExporting(format);
        try {
            if (format === 'pdf') await exportBahamaLabelsAsPdf(selectedItems, layout, origin);
            else await exportBahamaLabelsAsPng(selectedItems, layout, origin);
            notifySuccess(format === 'pdf' ? 'PDF-arket har skapats.' : selectedItems.length === 1 ? 'PNG-etiketten har skapats.' : 'ZIP-filen har skapats.');
        } catch (error) {
            notifyError(getErrorMessage(error, 'Kunde inte skapa etiketterna.'));
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c111b] text-slate-100 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-5 md:px-7">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#d4c8b4]">BaHaMa lager</p>
                        <h1 className="m-0 text-2xl font-semibold tracking-tight md:text-3xl">QR-etiketter</h1>
                        <p className="mb-0 mt-2 max-w-2xl text-sm text-slate-400">Välj parasoll, anpassa A4-arket och exportera skanningsbara lageretiketter.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                        <IconQrcode size={16} aria-hidden="true" />
                        {selectedItems.length} valda
                    </div>
                </div>
            </div>

            <div className="grid min-h-[650px] xl:grid-cols-[minmax(0,1fr)_390px]">
                <section className="min-w-0 border-b border-white/10 p-4 md:p-6 xl:border-b-0 xl:border-r">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.2fr)_1fr_1fr_1fr_auto]">
                        <label className="relative md:col-span-2 lg:col-span-1">
                            <span className="sr-only">Sök lager</span>
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sök ID, modell, storlek…" className="w-full rounded-lg border border-white/10 bg-[#111722] py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#e8e1d4]" />
                        </label>
                        <select value={model} onChange={(event) => setModel(event.target.value)} aria-label="Filtrera modell" className="rounded-lg border border-white/10 bg-[#111722] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#e8e1d4]">
                            <option value="all">Alla modeller</option>
                            {modelOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filtrera status" className="rounded-lg border border-white/10 bg-[#111722] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#e8e1d4]">
                            <option value="all">Alla statusar</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filtrera lagerplats" className="rounded-lg border border-white/10 bg-[#111722] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#e8e1d4]">
                            <option value="all">Alla lagerplatser</option>
                            {locationOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                        <button type="button" onClick={resetFilters} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.07] hover:text-white">Återställ</button>
                    </div>

                    {missingQrCount > 0 && (
                        <div className="mt-4 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                            <IconAlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                            {missingQrCount} lagerposter saknar QR-ID och kan inte väljas. Kör backfill-skriptet eller spara lagret en gång.
                        </div>
                    )}
                    {loadError && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{loadError}</div>}

                    <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-4 py-3">
                            <label className="flex items-center gap-3 text-sm font-semibold text-slate-200">
                                <input type="checkbox" checked={validFilteredItems.length > 0 && validFilteredItems.every((item) => selected.has(item.qrId))} onChange={toggleAllFiltered} />
                                Välj alla filtrerade
                            </label>
                            <span className="text-xs text-slate-500">{filteredItems.length} parasoll</span>
                        </div>

                        {loading ? (
                            <div className="grid min-h-64 place-items-center text-sm text-slate-500">Läser lagret…</div>
                        ) : pageItems.length === 0 ? (
                            <div className="grid min-h-64 place-items-center px-5 text-center text-sm text-slate-500">Inga parasoll matchar filtren.</div>
                        ) : (
                            <>
                                <div className="hidden grid-cols-[32px_.75fr_.9fr_.65fr_.8fr_1fr_1.1fr_.7fr] gap-3 border-b border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:grid">
                                    <span /><span>ID</span><span>Modell</span><span>Storlek</span><span>Stativ</span><span>Textil</span><span>Belysning / värme</span><span>Status</span>
                                </div>
                                <div className="divide-y divide-white/[0.07]">
                                    {pageItems.map((item) => {
                                        const valid = isBahamaQrId(item.qrId);
                                        return (
                                            <label key={`${item.id}-${item.qrId}`} className={`grid cursor-pointer gap-2 px-4 py-3 transition-colors hover:bg-white/[0.035] md:grid-cols-[32px_.75fr_.9fr_.65fr_.8fr_1fr_1.1fr_.7fr] md:items-center ${selected.has(item.qrId) ? 'bg-blue-400/[0.08]' : ''} ${!valid ? 'cursor-not-allowed opacity-45' : ''}`}>
                                                <input type="checkbox" disabled={!valid} checked={valid && selected.has(item.qrId)} onChange={() => valid && toggleItem(item.qrId)} />
                                                <span><span className="block font-semibold text-white">{item.id}</span><span className="mt-0.5 block text-[10px] text-slate-600">{item.location || '—'}</span></span>
                                                <span className="text-sm text-slate-300">{item.type || '—'}</span>
                                                <span className="text-sm text-slate-400">{item.size || '—'}</span>
                                                <span className="text-xs text-slate-400">{item.properties.stativ || '—'}</span>
                                                <span className="text-xs text-slate-400">{item.properties.textil || '—'}</span>
                                                <span className="text-xs leading-5 text-slate-400">{[item.properties.belysning, item.properties.varme].filter(Boolean).join(' · ') || '—'}</span>
                                                <span className="text-xs text-slate-300">{STATUS_LABELS[item.status]}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="m-0 text-xs text-slate-500">Sida {page} av {pageCount}</p>
                        <div className="flex gap-2">
                            <button type="button" aria-label="Föregående sida" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-30"><IconChevronLeft size={18} /></button>
                            <button type="button" aria-label="Nästa sida" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-30"><IconChevronRight size={18} /></button>
                        </div>
                    </div>
                </section>

                <aside className="min-w-0 bg-[#0f1520] p-5 md:p-6">
                    <div className="xl:sticky xl:top-5">
                        <div className="flex items-center justify-between">
                            <h2 className="m-0 text-lg font-semibold">Etikettlayout (A4)</h2>
                            <button type="button" onClick={() => { setLayout(DEFAULT_QR_LABEL_LAYOUT); setLabelPreset('a4'); }} className="text-xs font-semibold text-[#d4c8b4] hover:text-white">Återställ</button>
                        </div>
                        <label className="mt-4 grid min-w-0 gap-1.5 text-xs font-semibold text-slate-400">
                            Standard
                            <select value={labelPreset} onChange={(event) => applyLabelPreset(event.target.value)} className="min-w-0 w-full rounded-lg border border-white/10 bg-[#111722] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-[#e8e1d4]">
                                <option value="a4">A4 – en etikett per sida</option>
                                <option value="70x50">BRIXX – BaHaMa (70 × 50 mm)</option>
                                <option value="90x50">Standard (90 × 50 mm)</option>
                                <option value="custom">Anpassad storlek</option>
                            </select>
                        </label>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <MeasureInput label="Bredd" field="widthMm" value={layout.widthMm} onChange={updateLayout} />
                            <MeasureInput label="Höjd" field="heightMm" value={layout.heightMm} onChange={updateLayout} />
                            <MeasureInput label="Marginal" field="marginMm" value={layout.marginMm} onChange={updateLayout} />
                            <MeasureInput label="Mellanrum" field="gapMm" value={layout.gapMm} onChange={updateLayout} />
                        </div>
                        {layoutError ? <p className="mt-3 text-xs text-red-300">{layoutError}</p> : <p className="mt-3 text-xs text-slate-500">{grid.columns} × {grid.rows} etiketter per sida ({grid.labelsPerPage} totalt)</p>}
                        {labelPreset === 'a4' && <p className="mt-2 text-xs leading-5 text-slate-400">Stående A4 med 10 mm marginal. Skriv ut i faktisk storlek (100 %).</p>}

                        <div className="mt-5 rounded-xl border border-white/10 bg-[#090d14] p-4">
                            <p className="mb-3 mt-0 text-xs font-bold uppercase tracking-wider text-slate-600">Förhandsvisning</p>
                            <div className="mx-auto grid min-h-44 place-items-center" aria-label="Förhandsvisning av etikett">
                                {previewUrl && !layoutError && (
                                    <img
                                        src={previewUrl}
                                        alt={`Etikett för ${previewItem?.id || 'parasollet'}`}
                                        className="h-auto w-full bg-white object-contain shadow-[0_18px_50px_rgba(0,0,0,.35)]"
                                        style={{
                                            aspectRatio: `${layout.widthMm} / ${layout.heightMm}`
                                        }}
                                    />
                                )}
                            </div>
                            <p className="mb-0 mt-3 text-center text-xs text-slate-500">Förhandsvisar {previewItem?.id || 'första valda parasoll'}</p>
                        </div>

                        {isLocalOrigin && (
                            <div className="mt-4 flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
                                <IconAlertTriangle className="shrink-0" size={17} aria-hidden="true" />
                                QR-koderna använder den aktuella localhost-adressen. Skapa skarpa etiketter från produktionsappen.
                            </div>
                        )}

                        <div className="mt-5 grid gap-2">
                            <button type="button" disabled={selectedItems.length === 0 || Boolean(layoutError) || exporting !== null} onClick={() => void runExport('pdf')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#e8e1d4] px-4 text-sm font-bold text-[#10161b] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                                <IconFileTypePdf size={19} aria-hidden="true" />
                                {exporting === 'pdf' ? 'Skapar PDF…' : `Exportera PDF (${selectedItems.length})`}
                            </button>
                            <button type="button" disabled={selectedItems.length === 0 || Boolean(layoutError) || exporting !== null} onClick={() => void runExport('png')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40">
                                <IconFileTypePng size={19} aria-hidden="true" />
                                {exporting === 'png' ? 'Skapar filer…' : selectedItems.length > 1 ? `Exportera ZIP (${selectedItems.length})` : 'Exportera PNG'}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
