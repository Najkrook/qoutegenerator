import React from 'react';

function DiffTag({ title, description, icon, color }) {
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

export function PendingChangesPanel({ inventoryData, cloudInventoryData, onCommit, isSaving }) {
    const changes = [];

    // BaHaMa diffs
    const bahamaLocal = inventoryData.bahama || [];
    const bahamaCloud = cloudInventoryData.bahama || [];

    const cloudMap = {};
    bahamaCloud.forEach(i => { if (i.ID) cloudMap[i.ID] = i; });

    const localMap = {};
    let fallbackGlobalDiff = false;

    bahamaLocal.forEach(i => {
        if (!i.ID) { fallbackGlobalDiff = true; return; }
        localMap[i.ID] = i;
        if (!cloudMap[i.ID]) {
            changes.push({ key: `add-${i.ID}`, title: 'BaHaMa: Lades Till', desc: `${i.ID} - ${i.TYP} ${i.STORLEK || ''}`, icon: '+', color: 'var(--success)' });
        } else if (JSON.stringify(i) !== JSON.stringify(cloudMap[i.ID])) {
            changes.push({ key: `upd-${i.ID}`, title: 'BaHaMa: Ändrades', desc: i.ID, icon: 'upd', color: 'var(--primary)' });
        }
    });

    bahamaCloud.forEach(i => {
        if (i.ID && !localMap[i.ID]) {
            changes.push({ key: `del-${i.ID}`, title: 'BaHaMa: Togs Bort', desc: i.ID, icon: '-', color: 'var(--danger)' });
        }
    });

    if (fallbackGlobalDiff && JSON.stringify(bahamaLocal) !== JSON.stringify(bahamaCloud)) {
        changes.push({ key: 'mass-update', title: 'BaHaMa', desc: 'Massuppdatering via Excel', icon: 'i', color: 'var(--primary)' });
    }

    // ClickitUP diffs
    const cLocal = inventoryData.clickitup || {};
    const cCloud = cloudInventoryData.clickitup || {};

    for (const size in cLocal) {
        const fields = ['sektion', 'dorr_h', 'dorr_v', 'hane_h', 'hane_v'];
        fields.forEach(f => {
            const locVal = cLocal[size]?.[f] || 0;
            const cloVal = cCloud[size]?.[f] || 0;
            const delta = locVal - cloVal;
            if (delta !== 0) {
                const fName = f.replace('_h', ' Höger').replace('_v', ' Vänster').replace('dorr', 'Dörr').replace('hane', 'Hane').replace('sektion', 'Sektion');
                const sign = delta > 0 ? '+' : '';
                const color = delta > 0 ? 'var(--success)' : 'var(--danger)';
                changes.push({ key: `cu-${size}-${f}`, title: `ClickitUP ${size}`, desc: fName, icon: `${sign}${delta}`, color });
            }
        });
    }

    const hasChanges = changes.length > 0;

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-text-primary uppercase m-0">Väntande Ändringar</h4>
                {hasChanges && (
                    <span className="bg-primary text-white text-xs font-bold rounded-full px-2.5 py-0.5">
                        {changes.length}
                    </span>
                )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto mb-4">
                {hasChanges ? (
                    changes.map(c => (
                        <DiffTag key={c.key} title={c.title} description={c.desc} icon={c.icon} color={c.color} />
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
