import React from 'react';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

interface StatusChipProps {
    children: React.ReactNode;
    tone?: StatusTone;
}

const TONE_CLASSES: Record<StatusTone, string> = {
    neutral: 'border-border bg-hover text-text-muted',
    success: 'border-success-border bg-success-bg text-success-text',
    warning: 'border-warning-border bg-warning-bg text-warning-text',
    danger: 'border-danger-border bg-danger-bg text-danger-text'
};

export function StatusChip({ children, tone = 'neutral' }: StatusChipProps) {
    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
            {children}
        </span>
    );
}
