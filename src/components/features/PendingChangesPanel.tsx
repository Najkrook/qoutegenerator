import React from 'react';
import type {
    BahamaInventoryV2Item,
    ClickitupFieldKey,
    ClickitupStockMap,
    PendingChangesPanelProps
} from '../../types/contracts';

interface DiffChange {
    key: string;
    title: string;
    desc: string;
    icon: string;
    color: string;
}

const CLICKITUP_FIELDS: ClickitupFieldKey[] = ['sektion', 'dorr_h', 'dorr_v', 'hane_h', 'hane_v'];

function DiffTag({ title, description, icon, color }: { title: string; description: string; icon: string; color: string }) {
    return (
        <div className="flex flex-col gap-1 rounded border-l-[3px] bg-white/[0.03] p-2.5" style={{ borderColor: color }}>
            <div className="text-xs uppercase text-slate-500">{title}</div>
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-200">{description}</span>
                <span className="shrink-0 font-bold" style={{ color }}>{icon}</span>
            </div>
        </div>
    );
}

function buildBahamaMap(items: BahamaInventoryV2Item[]): Record<string, BahamaInventoryV2Item> {
    return items.reduce<Record<string, BahamaInventoryV2Item>>((acc, item) => {
        if (item.id) {
            acc[item.id] = item;
        }
        return acc;
    }, {});
}

function formatBahamaDescription(item: BahamaInventoryV2Item): string {
    return [item.id, item.type, item.size].filter(Boolean).join(' - ');
}

function formatClickitupField(field: ClickitupFieldKey): string {
    return field
        .replace('_h', ' Höger')
        .replace('_v', ' Vänster')
        .replace('dorr', 'Dörr')
        .replace('hane', 'Hane')
        .replace('sektion', 'Sektion');
}

export function PendingChangesPanel({ inventoryData, cloudInventoryData, onCommit, isSaving }: PendingChangesPanelProps) {
    const changes: DiffChange[] = [];

    const bahamaLocal = inventoryData.bahamaV2 || [];
    const bahamaCloud = cloudInventoryData.bahamaV2 || [];
    const cloudMap = buildBahamaMap(bahamaCloud);
    const localMap = buildBahamaMap(bahamaLocal);

    bahamaLocal.forEach((item) => {
        if (!cloudMap[item.id]) {
            changes.push({
                key: `add-${item.id}`,
                title: 'BaHaMa: Lades till',
                desc: formatBahamaDescription(item),
                icon: '+',
                color: 'var(--success)'
            });
        } else if (JSON.stringify(item) !== JSON.stringify(cloudMap[item.id])) {
            changes.push({
                key: `upd-${item.id}`,
                title: 'BaHaMa: Ändrades',
                desc: formatBahamaDescription(item),
                icon: 'upd',
                color: 'var(--primary)'
            });
        }
    });

    bahamaCloud.forEach((item) => {
        if (item.id && !localMap[item.id]) {
            changes.push({
                key: `del-${item.id}`,
                title: 'BaHaMa: Togs bort',
                desc: formatBahamaDescription(item),
                icon: '-',
                color: 'var(--danger)'
            });
        }
    });

    const clickitupLocal: ClickitupStockMap = inventoryData.clickitup || {};
    const clickitupCloud: ClickitupStockMap = cloudInventoryData.clickitup || {};

    Object.keys(clickitupLocal).forEach((size) => {
        CLICKITUP_FIELDS.forEach((field) => {
            const localValue = clickitupLocal[size]?.[field] || 0;
            const cloudValue = clickitupCloud[size]?.[field] || 0;
            const delta = localValue - cloudValue;
            if (delta !== 0) {
                const sign = delta > 0 ? '+' : '';
                const color = delta > 0 ? 'var(--success)' : 'var(--danger)';
                changes.push({
                    key: `cu-${size}-${field}`,
                    title: `ClickitUp ${size}`,
                    desc: formatClickitupField(field),
                    icon: `${sign}${delta}`,
                    color
                });
            }
        });
    });

    if (inventoryData.notes !== cloudInventoryData.notes) {
        changes.push({
            key: 'inventory-notes',
            title: 'Huvudnoteringar',
            desc: 'Noteringar har ändrats',
            icon: 'txt',
            color: 'var(--primary)'
        });
    }

    const hasChanges = changes.length > 0;

    return (
        <div className="rounded-lg border border-white/10 bg-[#10161b] p-5">
            <div className="mb-4 flex items-center justify-between">
                <h4 className="m-0 text-sm font-semibold uppercase text-slate-200">Väntande ändringar</h4>
                {hasChanges && (
                    <span className="rounded-full bg-[#e8e1d4] px-2.5 py-0.5 text-xs font-bold text-[#10161b]">
                        {changes.length}
                    </span>
                )}
            </div>

            <div className="mb-4 max-h-[260px] space-y-2 overflow-y-auto">
                {hasChanges ? (
                    changes.map((change) => (
                        <DiffTag
                            key={change.key}
                            title={change.title}
                            description={change.desc}
                            icon={change.icon}
                            color={change.color}
                        />
                    ))
                ) : (
                    <p className="m-0 py-8 text-center text-sm text-slate-500">
                        Inga ändringar gjorda ännu.
                    </p>
                )}
            </div>

            {hasChanges && (
                <button
                    onClick={onCommit}
                    disabled={isSaving}
                    className="w-full rounded-md border border-emerald-400/30 bg-emerald-400/10 py-3 font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSaving ? 'Sparar till molnet...' : `Spara ändringar (${changes.length})`}
                </button>
            )}
        </div>
    );
}
