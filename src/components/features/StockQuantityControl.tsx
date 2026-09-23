import React, { useEffect, useState } from 'react';
import { notifyWarn } from '../../services/notificationService';

interface StockQuantityControlProps {
    label: string;
    value: number;
    onSet: (value: number) => void;
    showSix?: boolean;
    compact?: boolean;
    pendingDelta?: number;
}

export function StockQuantityControl({ label, value, onSet, showSix = false, compact = false, pendingDelta = 0 }: StockQuantityControlProps) {
    const [text, setText] = useState(String(value));

    useEffect(() => setText(String(value)), [value]);

    const commit = () => {
        const normalized = text.trim();
        const parsed = Number(normalized);
        if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(parsed)) {
            setText(String(value));
            notifyWarn('Ange ett heltal som är 0 eller större.');
            return;
        }
        setText(String(parsed));
        if (parsed !== value) onSet(parsed);
    };

    const adjust = (delta: number) => {
        const typed = text.trim();
        const parsed = Number(typed);
        const base = /^\d+$/.test(typed) && Number.isSafeInteger(parsed) ? parsed : value;
        const next = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, base + delta));
        setText(String(next));
        if (next !== value) onSet(next);
    };

    const buttonClass = compact
        ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-sm font-semibold text-slate-200 transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8e1d4]'
        : 'flex h-11 min-w-11 items-center justify-center rounded-lg border border-white/15 bg-[#202a32] px-2 font-semibold text-slate-100 transition-colors hover:bg-[#30404a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8e1d4]';
    const sixButtonClass = compact
        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8e1d4]'
        : `${buttonClass} hidden sm:flex`;

    return (
        <div className={`flex items-center ${compact ? 'gap-1 whitespace-nowrap' : 'flex-wrap gap-1.5'}`}>
            {showSix ? <button type="button" className={sixButtonClass} onClick={() => adjust(-6)} aria-label={`Minska ${label} med 6`}>−6</button> : null}
            <button type="button" className={buttonClass} onClick={() => adjust(-1)} aria-label={`Minska ${label} med 1`}>−</button>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Antal ${label}`}
                title={pendingDelta !== 0 ? `Osparat ${pendingDelta > 0 ? `+${pendingDelta}` : pendingDelta}` : undefined}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                className={compact
                    ? `h-9 w-12 shrink-0 rounded-md border bg-[#0c1217] px-1 text-center text-sm font-semibold tabular-nums text-white outline-none focus:border-[#e8e1d4] focus-visible:ring-2 focus-visible:ring-[#e8e1d4]/40 ${pendingDelta !== 0 ? 'border-amber-300/65' : 'border-white/15'}`
                    : 'h-11 w-16 rounded-lg border border-white/20 bg-[#0c1217] px-2 text-center text-base font-bold text-white outline-none focus:border-[#e8e1d4] focus-visible:ring-2 focus-visible:ring-[#e8e1d4]/40'}
            />
            <button type="button" className={buttonClass} onClick={() => adjust(1)} aria-label={`Öka ${label} med 1`}>+</button>
            {showSix ? <button type="button" className={sixButtonClass} onClick={() => adjust(6)} aria-label={`Öka ${label} med 6`}>+6</button> : null}
        </div>
    );
}
