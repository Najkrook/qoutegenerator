import React, { useEffect, useMemo, useRef } from 'react';
import {
    IconAlertTriangle,
    IconArrowLeft,
    IconArrowsMove,
    IconChevronRight,
    IconPackage,
    IconStack2
} from '@tabler/icons-react';
import type {
    BahamaRackNumber,
    BahamaStorageGrouping,
    BahamaStorageLocation,
    BahamaStorageRackGroup,
    BahamaStorageSlot
} from '../../services/bahamaStorageLocation';
import type { BahamaInventoryStatus, BahamaInventoryV2Item } from '../../types/contracts';
import { getBahamaTubeLabel } from './bahamaStoragePresentation';

const STATUS_LABELS: Record<BahamaInventoryStatus, string> = {
    available: 'Tillgänglig',
    reserved: 'Reserverad',
    'needs-review': 'Kontroll',
    used: 'Begagnad',
    sold: 'Såld'
};

const STATUS_DOT_CLASSES: Record<BahamaInventoryStatus, string> = {
    available: 'bg-emerald-400',
    reserved: 'bg-violet-400',
    'needs-review': 'bg-amber-400',
    used: 'bg-slate-400',
    sold: 'bg-rose-400'
};

const STATUS_SLOT_CLASSES: Record<BahamaInventoryStatus, string> = {
    available: 'border-emerald-400/45 bg-emerald-400/25',
    reserved: 'border-violet-400/45 bg-violet-400/25',
    'needs-review': 'border-amber-400/45 bg-amber-400/25',
    used: 'border-slate-400/45 bg-slate-400/20',
    sold: 'border-rose-400/45 bg-rose-400/25'
};

const RACK_POSITIONS: Record<BahamaRackNumber, string> = {
    1: 'lg:col-start-1 lg:row-start-1',
    2: 'lg:col-start-3 lg:row-start-1',
    3: 'lg:col-start-3 lg:row-start-2',
    4: 'lg:col-start-1 lg:row-start-2'
};

export interface BahamaStorageFocusRequest {
    qrId: string;
    sequence: number;
}

interface BahamaStorageMoveProps {
    draggingItemQrId?: string | null;
    focusRequest?: BahamaStorageFocusRequest | null;
    onDragEndItem?: (item: BahamaInventoryV2Item) => void;
    onDragStartItem?: (item: BahamaInventoryV2Item, event: React.DragEvent<HTMLElement>) => void;
    onDropItem?: (sourceQrId: string, target: BahamaStorageLocation | null) => void;
    onOpenMoveDialog?: (item: BahamaInventoryV2Item) => void;
}

function slotIndicatorClass(slot: BahamaStorageSlot): string {
    if (slot.status === 'conflict') {
        return 'border-rose-400/60 bg-rose-400/25';
    }
    if (slot.item) {
        return STATUS_SLOT_CLASSES[slot.item.status];
    }
    return 'border-white/15 bg-[#12191f]';
}

function RackOccupancyGrid({ rack, compact = false }: { rack: BahamaStorageRackGroup; compact?: boolean }) {
    return (
        <div className={`grid grid-cols-[1.5rem_1fr_1fr] ${compact ? 'gap-1' : 'gap-1.5'}`} aria-label={`Beläggning för Grenställ ${rack.rack}`}>
            <span aria-hidden="true" />
            <span className="text-center text-[10px] font-medium text-slate-400">Främre</span>
            <span className="text-center text-[10px] font-medium text-slate-400">Bakre</span>
            {[5, 4, 3, 2, 1].map((floor) => {
                const floorSlots = rack.slots.filter((slot) => slot.location.floor === floor);
                return (
                    <React.Fragment key={floor}>
                        <span className="flex items-center justify-center rounded border border-white/5 bg-black/20 text-[11px] font-semibold text-slate-300">
                            {floor}
                        </span>
                        {floorSlots.map((slot) => (
                            <span
                                key={slot.canonicalLocation}
                                data-slot-status={slot.status}
                                className={`h-6 rounded border ${slotIndicatorClass(slot)}`}
                                title={slot.status === 'conflict'
                                    ? `Platskonflikt: ${slot.canonicalLocation}`
                                    : slot.item
                                        ? `${getBahamaTubeLabel(slot.item)}, ${STATUS_LABELS[slot.item.status]}`
                                        : `Tom: ${slot.canonicalLocation}`}
                                aria-label={slot.status === 'conflict'
                                    ? `Platskonflikt på Våning ${floor}, ${slot.location.depth === 'front' ? 'Främre' : 'Bakre'}`
                                    : slot.item
                                        ? `${getBahamaTubeLabel(slot.item)}, ${STATUS_LABELS[slot.item.status]}`
                                        : `Tom plats, Våning ${floor}, ${slot.location.depth === 'front' ? 'Främre' : 'Bakre'}`}
                            />
                        ))}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function RackCard({
    rack,
    selected,
    onOpen
}: {
    rack: BahamaStorageRackGroup;
    selected: boolean;
    onOpen: (rack: BahamaRackNumber) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onOpen(rack.rack)}
            aria-label={`Öppna Grenställ ${rack.rack}, ${rack.occupiedCount}/10 platser`}
            className={`group relative min-h-[15rem] overflow-hidden rounded-xl border bg-[#10171c] px-5 py-5 text-left shadow-[0_22px_60px_rgba(0,0,0,0.2)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-[#e8e1d4]/70 focus-visible:ring-2 focus-visible:ring-[#f0dfc2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1115] ${RACK_POSITIONS[rack.rack]} ${selected ? 'border-[#ead9bc]' : 'border-white/15'}`}
        >
            <span className="absolute inset-y-4 left-2 w-1.5 rounded-full border border-white/20 bg-gradient-to-r from-slate-700 to-slate-400" aria-hidden="true" />
            <span className="absolute inset-y-4 right-2 w-1.5 rounded-full border border-white/20 bg-gradient-to-r from-slate-600 to-slate-800" aria-hidden="true" />
            <span className="relative block rounded-lg border border-white/10 bg-[#0c1216]/95 p-4">
                <span className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-slate-50">Grenställ {rack.rack}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-300">
                        {rack.occupiedCount}/10 platser
                        <IconChevronRight size={16} aria-hidden="true" />
                    </span>
                </span>
                <RackOccupancyGrid rack={rack} />
                {rack.conflictCount > 0 ? (
                    <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                        <IconAlertTriangle size={15} aria-hidden="true" />
                        {rack.conflictCount} platskonflikt{rack.conflictCount === 1 ? '' : 'er'}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

export function BahamaStorageMap({
    grouping,
    selectedRack,
    onOpenRack
}: {
    grouping: BahamaStorageGrouping;
    selectedRack: BahamaRackNumber;
    onOpenRack: (rack: BahamaRackNumber) => void;
}) {
    const isEmpty = grouping.racks.every((rack) => rack.occupiedCount === 0 && rack.conflictCount === 0)
        && grouping.unplacedItems.length === 0;

    return (
        <section aria-labelledby="storage-map-title" className="min-w-0">
            <h3 id="storage-map-title" className="sr-only">Lagerkarta</h3>

            {isEmpty ? (
                <p className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                    Lagret är tomt. Lägg till en artikel för att börja.
                </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] lg:grid-rows-2">
                {grouping.racks.map((rack) => (
                    <RackCard
                        key={rack.rack}
                        rack={rack}
                        selected={rack.rack === selectedRack}
                        onOpen={onOpenRack}
                    />
                ))}
                <div className="relative hidden min-h-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block" aria-label="Lagergång">
                    <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-white/25" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                        Lagergång
                    </span>
                </div>
            </div>
        </section>
    );
}

function StorageSlotButton({
    slot,
    selected,
    onSelectItem,
    draggingItemQrId,
    focusRequest,
    onDragEndItem,
    onDragStartItem,
    onDropItem,
    onOpenMoveDialog
}: {
    slot: BahamaStorageSlot;
    selected: boolean;
    onSelectItem: (item: BahamaInventoryV2Item) => void;
} & BahamaStorageMoveProps) {
    const depthLabel = slot.location.depth === 'front' ? 'Främre' : 'Bakre';
    const itemButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (slot.item?.qrId === focusRequest?.qrId) {
            itemButtonRef.current?.focus();
        }
    }, [focusRequest, slot.item?.qrId]);

    if (slot.status === 'conflict') {
        return (
            <div
                role="status"
                aria-label={`Platskonflikt, Våning ${slot.location.floor}, ${depthLabel}, ${slot.conflictingQrIds.length} artiklar`}
                className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-rose-400/60 bg-rose-400/10 px-3 text-center text-rose-100"
            >
                <IconAlertTriangle size={22} aria-hidden="true" />
                <span className="mt-2 text-sm font-semibold">Platskonflikt</span>
                <span className="mt-1 text-xs text-rose-200/80">{slot.conflictingQrIds.length} artiklar</span>
            </div>
        );
    }

    if (!slot.item) {
        return (
            <div
                aria-label={`Tom plats, Våning ${slot.location.floor}, ${depthLabel}`}
                data-storage-drop-target={slot.canonicalLocation}
                onDragOver={(event) => {
                    if (draggingItemQrId && onDropItem) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (draggingItemQrId && onDropItem) {
                        onDropItem(draggingItemQrId, slot.location);
                    }
                }}
                className={`flex min-h-20 items-center justify-center rounded-lg border border-dashed bg-black/10 text-sm transition ${draggingItemQrId ? 'border-[#e8d5b5]/70 text-[#e8d5b5]' : 'border-white/20 text-slate-500'}`}
            >
                {draggingItemQrId ? 'Släpp här' : 'Tom plats'}
            </div>
        );
    }

    const item = slot.item;
    return (
        <div
            onDragOver={(event) => {
                if (draggingItemQrId && onDropItem) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }
            }}
            onDrop={(event) => {
                event.preventDefault();
                if (draggingItemQrId && onDropItem) {
                    onDropItem(draggingItemQrId, slot.location);
                }
            }}
            className={`relative flex min-h-20 overflow-hidden rounded-lg border text-[#19140e] transition ${selected ? 'border-[#f7e4c4] ring-2 ring-[#f7e4c4]' : 'border-[#8f6b43]'} ${draggingItemQrId === item.qrId ? 'opacity-45' : ''} bg-[linear-gradient(180deg,#c99a62_0%,#a97842_52%,#81582f_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_20px_rgba(0,0,0,0.24)]`}
        >
            <button
                ref={itemButtonRef}
                type="button"
                draggable={Boolean(onDragStartItem)}
                onDragStart={(event) => onDragStartItem?.(item, event)}
                onDragEnd={() => onDragEndItem?.(item)}
                data-storage-item-qr-id={item.qrId}
                onClick={() => onSelectItem(item)}
                aria-label={`Välj ${item.id}, ${getBahamaTubeLabel(item)}, ${STATUS_LABELS[item.status]}, Våning ${slot.location.floor}, ${depthLabel}`}
                aria-pressed={selected}
                className="min-w-0 flex-1 px-4 py-3 text-left outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2]"
            >
                <span className="block text-sm font-bold sm:text-base">{getBahamaTubeLabel(item)}</span>
                <span className="mt-2 flex items-center gap-2 text-xs font-medium">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_CLASSES[item.status]}`} aria-hidden="true" />
                    {STATUS_LABELS[item.status]}
                </span>
            </button>
            {onOpenMoveDialog ? (
                <button
                    type="button"
                    onClick={() => onOpenMoveDialog(item)}
                    aria-label={`Flytta ${item.id}`}
                    className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-l border-black/20 bg-black/10 px-1 text-[10px] font-bold outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2]"
                >
                    <IconArrowsMove size={17} aria-hidden="true" />
                    Flytta
                </button>
            ) : null}
        </div>
    );
}

export function BahamaRackDetail({
    rack,
    selectedItemQrId,
    onSelectItem,
    onOpenRack,
    onBackToMap,
    draggingItemQrId,
    focusRequest,
    onDragEndItem,
    onDragStartItem,
    onDropItem,
    onOpenMoveDialog
}: {
    rack: BahamaStorageRackGroup;
    selectedItemQrId: string | null;
    onSelectItem: (item: BahamaInventoryV2Item) => void;
    onOpenRack: (rack: BahamaRackNumber) => void;
    onBackToMap: () => void;
} & BahamaStorageMoveProps) {
    const rackHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (rackHoverTimerRef.current) {
            clearTimeout(rackHoverTimerRef.current);
        }
    }, []);

    const scheduleRackOpen = (rackNumber: BahamaRackNumber) => {
        if (!draggingItemQrId || rackNumber === rack.rack) {
            return;
        }
        if (rackHoverTimerRef.current) {
            clearTimeout(rackHoverTimerRef.current);
        }
        rackHoverTimerRef.current = setTimeout(() => onOpenRack(rackNumber), 600);
    };

    const cancelRackOpen = () => {
        if (rackHoverTimerRef.current) {
            clearTimeout(rackHoverTimerRef.current);
            rackHoverTimerRef.current = null;
        }
    };

    return (
        <section aria-labelledby="rack-detail-title" className="min-w-0">
            <button
                type="button"
                onClick={onBackToMap}
                className="mb-5 inline-flex items-center gap-2 rounded-md border border-white/15 bg-[#10171c] px-3 py-2 text-sm font-semibold text-slate-200 outline-none transition hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-[#f0dfc2]"
            >
                <IconArrowLeft size={17} aria-hidden="true" />
                Till lagerkartan
            </button>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h3 id="rack-detail-title" className="m-0 text-3xl font-semibold tracking-tight text-slate-50">
                        Grenställ {rack.rack}
                    </h3>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                        {rack.occupiedCount}/10 platser
                    </span>
                </div>
                <div className="flex overflow-hidden rounded-lg border border-white/15" aria-label="Välj Grenställ">
                    {([1, 2, 3, 4] as BahamaRackNumber[]).map((rackNumber) => (
                        <button
                            key={rackNumber}
                            type="button"
                            onClick={() => onOpenRack(rackNumber)}
                            onDragEnter={() => scheduleRackOpen(rackNumber)}
                            onDragLeave={cancelRackOpen}
                            aria-label={`Visa Grenställ ${rackNumber}`}
                            aria-pressed={rackNumber === rack.rack}
                            className={`h-11 w-12 border-r border-white/10 text-sm font-semibold outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2] ${rackNumber === rack.rack ? 'bg-[#ead9bc] text-[#15120f]' : 'bg-[#11181d] text-slate-300 hover:bg-white/5'}`}
                        >
                            {rackNumber}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(80,101,112,0.18),transparent_60%),#0d1419] px-4 py-6 shadow-[inset_0_-30px_80px_rgba(0,0,0,0.22)] sm:px-7">
                <div className="absolute inset-y-5 left-2 w-2 rounded bg-gradient-to-r from-slate-800 via-slate-500 to-slate-800 sm:left-4" aria-hidden="true" />
                <div className="absolute inset-y-5 right-2 w-2 rounded bg-gradient-to-r from-slate-800 via-slate-500 to-slate-800 sm:right-4" aria-hidden="true" />
                <div className="relative grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-4 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-5">
                    <span aria-hidden="true" />
                    <span className="text-center text-sm font-semibold text-slate-300">Främre</span>
                    <span className="text-center text-sm font-semibold text-slate-300">Bakre</span>
                    {[5, 4, 3, 2, 1].map((floor) => {
                        const slots = rack.slots.filter((slot) => slot.location.floor === floor);
                        return (
                            <React.Fragment key={floor}>
                                <span className="flex h-11 items-center justify-center self-center rounded-lg border border-white/15 bg-[#10171c] text-base font-semibold text-slate-100" aria-label={`Våning ${floor}`}>
                                    {floor}
                                </span>
                                {slots.map((slot) => (
                                    <StorageSlotButton
                                        key={slot.canonicalLocation}
                                        slot={slot}
                                        selected={slot.item?.qrId === selectedItemQrId}
                                        onSelectItem={onSelectItem}
                                        draggingItemQrId={draggingItemQrId}
                                        focusRequest={focusRequest}
                                        onDragEndItem={onDragEndItem}
                                        onDragStartItem={onDragStartItem}
                                        onDropItem={onDropItem}
                                        onOpenMoveDialog={onOpenMoveDialog}
                                    />
                                ))}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function UnplacedItemRow({
    item,
    conflictLocation,
    selected,
    draggingItemQrId,
    focusRequest,
    onDragEndItem,
    onDragStartItem,
    onOpenMoveDialog,
    onSelectItem
}: {
    item: BahamaInventoryV2Item;
    conflictLocation?: string;
    selected: boolean;
    onSelectItem: (item: BahamaInventoryV2Item) => void;
} & Omit<BahamaStorageMoveProps, 'onDropItem'>) {
    const itemButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (focusRequest?.qrId === item.qrId) {
            itemButtonRef.current?.focus();
        }
    }, [focusRequest, item.qrId]);

    return (
        <li
            className={`flex list-none ${draggingItemQrId === item.qrId ? 'opacity-45' : ''}`}
        >
            <button
                ref={itemButtonRef}
                type="button"
                draggable={Boolean(onDragStartItem)}
                onDragStart={(event) => onDragStartItem?.(item, event)}
                onDragEnd={() => onDragEndItem?.(item)}
                data-storage-item-qr-id={item.qrId}
                onClick={() => onSelectItem(item)}
                aria-label={`Välj ej placerad artikel ${item.id}${conflictLocation ? `, Platskonflikt på ${conflictLocation}` : ''}`}
                aria-pressed={selected}
                className={`flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2] ${selected ? 'bg-white/[0.07]' : ''}`}
            >
                <IconPackage className="mt-0.5 shrink-0 text-[#d9bd91]" size={18} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-100">{item.id}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">{getBahamaTubeLabel(item)}</span>
                    {conflictLocation ? (
                        <span className="mt-1 block text-xs font-semibold text-rose-200">Platskonflikt · {conflictLocation}</span>
                    ) : item.location.trim() ? (
                        <span className="mt-1 block truncate text-xs text-amber-200">Tidigare: {item.location}</span>
                    ) : null}
                </span>
            </button>
            {onOpenMoveDialog ? (
                <button
                    type="button"
                    onClick={() => onOpenMoveDialog(item)}
                    aria-label={`Flytta ${item.id}`}
                    className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-l border-white/[0.07] text-[10px] font-semibold text-[#d9bd91] outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f0dfc2]"
                >
                    <IconArrowsMove size={17} aria-hidden="true" />
                    Flytta
                </button>
            ) : null}
        </li>
    );
}

export function BahamaStorageSidebar({
    grouping,
    selectedRack,
    selectedItemQrId,
    onSelectItem,
    onOpenRack,
    showRackDetailAction = false,
    groupingError,
    inspector,
    pendingChanges,
    draggingItemQrId,
    focusRequest,
    onDragEndItem,
    onDragStartItem,
    onDropItem,
    onOpenMoveDialog
}: {
    grouping: BahamaStorageGrouping;
    selectedRack: BahamaRackNumber;
    selectedItemQrId: string | null;
    onSelectItem: (item: BahamaInventoryV2Item) => void;
    onOpenRack: (rack: BahamaRackNumber) => void;
    showRackDetailAction?: boolean;
    groupingError?: string | null;
    inspector?: React.ReactNode;
    pendingChanges?: React.ReactNode;
} & BahamaStorageMoveProps) {
    const rack = grouping.racks.find((candidate) => candidate.rack === selectedRack) || grouping.racks[0];
    const conflictLocationsByQrId = useMemo(() => {
        const result = new Map<string, string>();
        grouping.racks.forEach((rackGroup) => {
            rackGroup.slots.forEach((slot) => {
                slot.conflictingQrIds.forEach((qrId) => result.set(qrId, slot.canonicalLocation));
            });
        });
        return result;
    }, [grouping]);
    const conflictCount = grouping.racks.reduce((sum, rackGroup) => sum + rackGroup.conflictCount, 0);

    return (
        <aside aria-label="Lageröversikt och artikelinspektör" className="min-w-0 space-y-4">
            {groupingError ? (
                <div role="alert" className="rounded-lg border border-rose-400/35 bg-rose-400/10 p-4 text-sm text-rose-100">
                    <div className="flex items-start gap-2">
                        <IconAlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                        <div>
                            <p className="m-0 font-semibold">Lagerkartan behöver kontrolleras</p>
                            <p className="m-0 mt-1 text-rose-200/85">{groupingError}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            <section aria-labelledby="selected-rack-title" className="rounded-xl border border-white/10 bg-[#10171c] p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Markerat grenställ</p>
                        <h3 id="selected-rack-title" className="m-0 mt-2 text-xl font-semibold text-slate-50">Grenställ {rack.rack}</h3>
                        <p className="m-0 mt-1 text-sm text-slate-400">5 Våningar × 2 platser</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-100">
                        {rack.occupiedCount}/10 platser
                    </span>
                </div>
                <RackOccupancyGrid rack={rack} compact />
                {showRackDetailAction ? (
                    <button
                        type="button"
                        onClick={() => onOpenRack(rack.rack)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 outline-none hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-[#f0dfc2]"
                    >
                        Visa detaljer
                        <IconChevronRight size={16} aria-hidden="true" />
                    </button>
                ) : null}
            </section>

            <section
                aria-labelledby="unplaced-title"
                data-storage-drop-target="unplaced"
                onDragOver={(event) => {
                    if (draggingItemQrId && onDropItem) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                    }
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    if (draggingItemQrId && onDropItem) {
                        onDropItem(draggingItemQrId, null);
                    }
                }}
                className={`rounded-xl border bg-[#10171c] transition ${draggingItemQrId ? 'border-[#e8d5b5]/70' : 'border-white/10'}`}
            >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <h3 id="unplaced-title" className="m-0 text-base font-semibold text-slate-50">Ej placerade</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200">
                        {grouping.unplacedItems.length}
                    </span>
                </div>
                {conflictCount > 0 ? (
                    <div className="border-b border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-xs text-rose-100">
                        <p className="m-0 flex items-center gap-2 font-semibold">
                            <IconAlertTriangle size={15} aria-hidden="true" />
                            {conflictCount} platskonflikt{conflictCount === 1 ? '' : 'er'}
                        </p>
                        <p className="m-0 mt-1 text-rose-200/75">Alla berörda artiklar visas här tills konflikten rättas.</p>
                    </div>
                ) : null}
                {grouping.unplacedItems.length > 0 ? (
                    <ul className="m-0 divide-y divide-white/[0.07] p-0">
                        {grouping.unplacedItems.map((item) => {
                            const conflictLocation = conflictLocationsByQrId.get(item.qrId);
                            return (
                                <UnplacedItemRow
                                    key={item.qrId || item.id}
                                    item={item}
                                    conflictLocation={conflictLocation}
                                    selected={selectedItemQrId === item.qrId}
                                    draggingItemQrId={draggingItemQrId}
                                    focusRequest={focusRequest}
                                    onDragStartItem={onDragStartItem}
                                    onDragEndItem={onDragEndItem}
                                    onOpenMoveDialog={onOpenMoveDialog}
                                    onSelectItem={onSelectItem}
                                />
                            );
                        })}
                    </ul>
                ) : (
                    <div className="px-4 py-6 text-center">
                        <IconStack2 className="mx-auto text-slate-600" size={24} aria-hidden="true" />
                        <p className="m-0 mt-2 text-sm text-slate-500">Inga ej placerade artiklar</p>
                    </div>
                )}
            </section>

            {inspector}
            {pendingChanges}
        </aside>
    );
}
