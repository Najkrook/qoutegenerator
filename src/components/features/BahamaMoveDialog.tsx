import React, { useMemo, useState } from 'react';
import { IconAlertTriangle, IconArrowsExchange, IconMapPin } from '@tabler/icons-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
    formatBahamaStorageLocation,
    parseBahamaStorageLocation,
    type BahamaFloorNumber,
    type BahamaRackNumber,
    type BahamaStorageDepth,
    type BahamaStorageGrouping,
    type BahamaStorageLocation
} from '../../services/bahamaStorageLocation';
import type { BahamaInventoryV2Item } from '../../types/contracts';
import { getBahamaTubeLabel } from './bahamaStoragePresentation';

type MoveTargetMode = 'slot' | 'unplaced';

interface BahamaMoveDialogProps {
    grouping: BahamaStorageGrouping;
    initialRack: BahamaRackNumber;
    item: BahamaInventoryV2Item;
    onClose: () => void;
    onMove: (target: BahamaStorageLocation | null) => Promise<boolean>;
}

export function BahamaMoveDialog({
    grouping,
    initialRack,
    item,
    onClose,
    onMove
}: BahamaMoveDialogProps) {
    const currentLocation = parseBahamaStorageLocation(item.location);
    const [targetMode, setTargetMode] = useState<MoveTargetMode>('slot');
    const [rack, setRack] = useState<BahamaRackNumber>(currentLocation?.rack || initialRack);
    const [floor, setFloor] = useState<BahamaFloorNumber>(currentLocation?.floor || 5);
    const [depth, setDepth] = useState<BahamaStorageDepth>(currentLocation?.depth || 'front');
    const [isMoving, setIsMoving] = useState(false);

    const target = useMemo<BahamaStorageLocation>(() => ({ rack, floor, depth }), [depth, floor, rack]);
    const targetSlot = grouping.racks
        .find((rackGroup) => rackGroup.rack === rack)
        ?.slots.find((slot) => slot.canonicalLocation === formatBahamaStorageLocation(target));
    const targetOccupant = targetSlot?.item?.qrId === item.qrId ? null : targetSlot?.item || null;
    const targetIsConflict = targetMode === 'slot' && targetSlot?.status === 'conflict';

    const submitMove = async () => {
        if (targetIsConflict || isMoving) {
            return;
        }
        setIsMoving(true);
        try {
            const applied = await onMove(targetMode === 'unplaced' ? null : target);
            if (applied) {
                onClose();
            }
        } finally {
            setIsMoving(false);
        }
    };

    return (
        <Modal
            title={`Flytta ${item.id}`}
            description={getBahamaTubeLabel(item)}
            onClose={onClose}
            maxWidthClassName="max-w-lg"
            footer={(
                <div className="flex flex-wrap justify-end gap-2">
                    <Button onClick={onClose} disabled={isMoving}>Avbryt</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            void submitMove();
                        }}
                        disabled={Boolean(targetIsConflict) || isMoving}
                    >
                        {isMoving ? 'Flyttar...' : targetOccupant ? 'Fortsätt till platsväxling' : 'Flytta'}
                    </Button>
                </div>
            )}
        >
            <div className="space-y-5 p-5 sm:p-6">
                <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-text">Välj mål</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <label className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 ${targetMode === 'slot' ? 'border-action bg-action/10' : 'border-border bg-surface'}`}>
                            <input
                                type="radio"
                                name="bahama-move-target"
                                value="slot"
                                checked={targetMode === 'slot'}
                                onChange={() => setTargetMode('slot')}
                                className="mt-1"
                            />
                            <span>
                                <span className="flex items-center gap-2 text-sm font-semibold text-text">
                                    <IconMapPin size={17} aria-hidden="true" />
                                    Lagerplats
                                </span>
                                <span className="mt-1 block text-xs text-text-muted">Välj grenställ, våning och djup.</span>
                            </span>
                        </label>
                        <label className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 ${targetMode === 'unplaced' ? 'border-action bg-action/10' : 'border-border bg-surface'}`}>
                            <input
                                type="radio"
                                name="bahama-move-target"
                                value="unplaced"
                                checked={targetMode === 'unplaced'}
                                onChange={() => setTargetMode('unplaced')}
                                className="mt-1"
                            />
                            <span>
                                <span className="text-sm font-semibold text-text">Ej placerade</span>
                                <span className="mt-1 block text-xs text-text-muted">Tar bort den nuvarande lagerplatsen.</span>
                            </span>
                        </label>
                    </div>
                </fieldset>

                {targetMode === 'slot' ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-text">
                            Grenställ
                            <select
                                aria-label="Målgrenställ"
                                value={rack}
                                onChange={(event) => setRack(Number(event.target.value) as BahamaRackNumber)}
                                className="min-h-11 rounded-control border border-control-border bg-surface-raised px-3 text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                            >
                                {([1, 2, 3, 4] as BahamaRackNumber[]).map((rackNumber) => (
                                    <option key={rackNumber} value={rackNumber}>{rackNumber}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-text">
                            Våning
                            <select
                                aria-label="Målvåning"
                                value={floor}
                                onChange={(event) => setFloor(Number(event.target.value) as BahamaFloorNumber)}
                                className="min-h-11 rounded-control border border-control-border bg-surface-raised px-3 text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                            >
                                {([5, 4, 3, 2, 1] as BahamaFloorNumber[]).map((floorNumber) => (
                                    <option key={floorNumber} value={floorNumber}>{floorNumber}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-text">
                            Djup
                            <select
                                aria-label="Måldjup"
                                value={depth}
                                onChange={(event) => setDepth(event.target.value as BahamaStorageDepth)}
                                className="min-h-11 rounded-control border border-control-border bg-surface-raised px-3 text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                            >
                                <option value="front">Främre</option>
                                <option value="back">Bakre</option>
                            </select>
                        </label>
                    </div>
                ) : null}

                {targetIsConflict ? (
                    <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/35 bg-danger/10 p-3 text-sm text-danger">
                        <IconAlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                        <span>Platsen har en konflikt och kan inte användas som mål. Välj en annan plats.</span>
                    </div>
                ) : targetOccupant ? (
                    <div className="flex items-start gap-2 rounded-control border border-warning/35 bg-warning/10 p-3 text-sm text-text" role="status">
                        <IconArrowsExchange className="mt-0.5 shrink-0 text-warning" size={18} aria-hidden="true" />
                        <span>
                            Platsen används av <strong>{targetOccupant.id}</strong>. Du får bekräfta att artiklarna ska byta plats.
                        </span>
                    </div>
                ) : (
                    <p className="m-0 rounded-control border border-border bg-surface p-3 text-sm text-text-muted" role="status">
                        {targetMode === 'unplaced'
                            ? 'Artikeln flyttas till Ej placerade.'
                            : `${formatBahamaStorageLocation(target)} är ledig.`}
                    </p>
                )}
            </div>
        </Modal>
    );
}
