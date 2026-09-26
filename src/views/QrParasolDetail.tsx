import React, { useEffect, useState } from 'react';
import {
    IconArrowLeft,
    IconBulb,
    IconFlame,
    IconMapPin,
    IconMessage,
    IconPalette,
    IconQrcode,
    IconRulerMeasure,
    IconShieldCheck,
    IconTool
} from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { APP_PATHS, APP_ROUTE_IDS } from '../navigation/routes';
import { getBahamaQrRecord } from '../services/bahamaQrService';
import { getErrorMessage } from '../utils/runtime';
import type { BahamaInventoryStatus, BahamaQrActiveRecord, BahamaQrRecord } from '../types/contracts';

const STATUS_LABELS: Record<BahamaInventoryStatus, string> = {
    available: 'Tillgänglig',
    reserved: 'Reserverad',
    'needs-review': 'Kontroll behövs',
    used: 'Begagnad',
    sold: 'Såld'
};

function Value({ value }: { value: string }) {
    return <span className={value ? 'text-slate-100' : 'text-slate-400'}>{value || 'Ej angivet'}</span>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 border-b border-white/[0.07] py-3 last:border-b-0 sm:py-4">
            <div className="mt-0.5 text-[#d4c8b4]" aria-hidden="true">{icon}</div>
            <div className="min-w-0">
                <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mb-0 mt-1 whitespace-pre-wrap text-sm font-medium [overflow-wrap:anywhere]"><Value value={value} /></p>
            </div>
        </div>
    );
}

function ActiveDetail({ record }: { record: BahamaQrActiveRecord }) {
    return (
        <>
            <div className="border-b border-white/10 bg-gradient-to-br from-[#151d2a] to-[#0d131d] px-4 py-4 sm:px-7 sm:py-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4c8b4]">Lager-ID</p>
                        <h1 className="m-0 mt-1 text-3xl font-semibold tracking-tight text-white">{record.inventoryId}</h1>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
                        <IconShieldCheck size={16} aria-hidden="true" /> {STATUS_LABELS[record.status]}
                    </span>
                </div>
                <p className="mb-0 mt-2 text-sm text-slate-300 [overflow-wrap:anywhere]">{record.type || 'Modell ej angiven'} · {record.size || 'Storlek ej angiven'}</p>
            </div>

            <div className="grid gap-3 p-3 sm:gap-5 sm:p-7 lg:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] px-3 sm:px-4" aria-labelledby="basic-heading">
                    <h2 id="basic-heading" className="mb-0 mt-4 text-sm font-semibold text-white">Parasollet</h2>
                    <DetailRow icon={<IconRulerMeasure size={20} />} label="Modell och storlek" value={[record.type, record.size].filter(Boolean).join(' · ')} />
                    <DetailRow icon={<IconMapPin size={20} />} label="Lagerplats" value={record.location} />
                    <DetailRow icon={<IconPalette size={20} />} label="Stativ / färg" value={record.properties.stativ} />
                    <DetailRow icon={<IconPalette size={20} />} label="Duk / textil" value={record.properties.textil} />
                </section>

                <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] px-3 sm:px-4" aria-labelledby="equipment-heading">
                    <h2 id="equipment-heading" className="mb-0 mt-4 text-sm font-semibold text-white">Utrustning</h2>
                    <DetailRow icon={<IconTool size={20} />} label="Fot" value={record.properties.fot} />
                    <DetailRow icon={<IconBulb size={20} />} label="Belysning" value={record.properties.belysning} />
                    <DetailRow icon={<IconFlame size={20} />} label="Värme" value={record.properties.varme} />
                    <DetailRow icon={<IconMessage size={20} />} label="Kommentar" value={record.comment} />
                </section>
            </div>

            <div className="border-t border-white/10 px-4 py-4 text-xs text-slate-400 sm:px-7">
                Senast uppdaterad {new Date(record.updatedAt).toLocaleString('sv-SE')}
            </div>
        </>
    );
}

export function QrParasolDetail({ initialRecord }: { initialRecord?: BahamaQrRecord } = {}) {
    const { qrId = '' } = useParams();
    const [record, setRecord] = useState<BahamaQrRecord | null>(initialRecord || null);
    const [loading, setLoading] = useState(initialRecord === undefined);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialRecord) {
            setRecord(initialRecord);
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        void getBahamaQrRecord(qrId)
            .then((nextRecord) => { if (!cancelled) setRecord(nextRecord); })
            .catch((nextError) => { if (!cancelled) setError(getErrorMessage(nextError, 'Kunde inte läsa parasollet.')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [initialRecord, qrId]);

    return (
        <div className="mx-auto min-h-0 w-full max-w-4xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0c111b] text-slate-100 shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0c111b] px-4 py-1 sm:px-6">
                <Link to={APP_PATHS[APP_ROUTE_IDS.qrScanner]} className="inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-slate-300 no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    <IconArrowLeft size={18} aria-hidden="true" /> Skanna igen
                </Link>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#d4c8b4]">
                    <IconQrcode size={17} aria-hidden="true" /> BRIXX
                </div>
            </header>

            {loading ? (
                <div className="grid min-h-[440px] place-items-center text-sm text-slate-500">Hämtar parasollet…</div>
            ) : error ? (
                <div className="grid min-h-[440px] place-items-center p-8 text-center">
                    <div><h1 className="text-xl font-semibold">Något gick fel</h1><p className="max-w-md text-sm leading-6 text-red-200">{error}</p></div>
                </div>
            ) : !record ? (
                <div className="grid min-h-[440px] place-items-center p-8 text-center">
                    <div>
                        <IconQrcode className="mx-auto text-slate-600" size={46} stroke={1.3} aria-hidden="true" />
                        <h1 className="mt-4 text-xl font-semibold">Parasollet hittades inte</h1>
                        <p className="max-w-md text-sm leading-6 text-slate-400">Kontrollera att hela QR-koden är synlig och försök skanna igen.</p>
                    </div>
                </div>
            ) : record.active ? (
                <ActiveDetail record={record} />
            ) : (
                <div className="grid min-h-[440px] place-items-center p-8 text-center">
                    <div>
                        <IconQrcode className="mx-auto text-slate-600" size={46} stroke={1.3} aria-hidden="true" />
                        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Lager-ID</p>
                        <h1 className="m-0 mt-1 text-3xl font-semibold">{record.inventoryId}</h1>
                        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">Det här parasollet är inte längre aktivt i BaHaMa-lagret.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
