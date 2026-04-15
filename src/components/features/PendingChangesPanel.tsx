import React from 'react';
import type {
    BahamaInventoryItem,
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
        <div className="flex flex-col gap-1 rounded p-2.5 border-l-[3px]" style={{ borderColor: color, background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-xs text-text-secondary uppercase">{title}</div>
            <div className="flex justify-between items-center text-sm">
                <span className="text-text-primary">{description}</span>
                <span className="font-bold" style={{ color }}>{icon}</span>
            </div>
        </div>
    );
}

function buildInventoryMap(items: BahamaInventoryItem[]): Record<string, BahamaInventoryItem> {
    return items.reduce<Record<string, BahamaInventoryItem>>((acc, item) => {
        const id = String(item.ID || '');
        if (id) {
            acc[id] = item;
        }
        return acc;
    }, {});
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

    const bahamaLocal = inventoryData.bahama || [];
    const bahamaCloud = cloudInventoryData.bahama || [];
    const cloudMap = buildInventoryMap(bahamaCloud);
    const localMap = buildInventoryMap(bahamaLocal);
    let fallbackGlobalDiff = false;

    bahamaLocal.forEach((item) => {
        const id = String(item.ID || '');
        if (!id) {
            fallbackGlobalDiff = true;
            return;
        }

        if (!cloudMap[id]) {
            changes.push({
                key: `add-${id}`,
                title: 'BaHaMa: Lades till',
                desc: `${id} - ${String(item.TYP || '')} ${String(item.STORLEK || '')}`.trim(),
                icon: '+',
                color: 'var(--success)'
            });
        } else if (JSON.stringify(item) !== JSON.stringify(cloudMap[id])) {
            changes.push({
                key: `upd-${id}`,
                title: 'BaHaMa: Ändrades',
                desc: id,
                icon: 'upd',
                color: 'var(--primary)'
            });
        }
    });

    bahamaCloud.forEach((item) => {
        const id = String(item.ID || '');
        if (id && !localMap[id]) {
            changes.push({
                key: `del-${id}`,
                title: 'BaHaMa: Togs bort',
                desc: id,
                icon: '-',
                color: 'var(--danger)'
            });
        }
    });

    if (fallbackGlobalDiff && JSON.stringify(bahamaLocal) !== JSON.stringify(bahamaCloud)) {
        changes.push({
            key: 'mass-update',
            title: 'BaHaMa',
            desc: 'Massuppdatering via Excel',
            icon: 'i',
            color: 'var(--primary)'
        });
    }

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
            icon: '📝',
            color: 'var(--primary)'
        });
    }

    const hasChanges = changes.length > 0;

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-text-primary uppercase m-0">Väntande ändringar</h4>
                {hasChanges && (
                    <span className="bg-primary text-white text-xs font-bold rounded-full px-2.5 py-0.5">
                        {changes.length}
                    </span>
                )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto mb-4">
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
                    <p className="text-text-secondary text-center text-sm py-8 m-0">
                        Inga ändringar gjorda ännu.
                    </p>
                )}
            </div>

            {hasChanges && (
                <button
                    onClick={onCommit}
                    disabled={isSaving}
                    className="w-full py-3 bg-green-600 text-white border-none rounded-lg font-semibold cursor-pointer hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                    {isSaving ? 'Sparar till molnet...' : `Spara ändringar (${changes.length})`}
                </button>
            )}
        </div>
    );
}
