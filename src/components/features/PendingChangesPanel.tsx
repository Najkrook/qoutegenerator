import React from 'react';
import type { PendingChangesPanelProps } from '../../types/contracts';

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

export function PendingChangesPanel({ changes, onCommit, isSaving }: PendingChangesPanelProps) {
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
