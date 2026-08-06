import React from 'react';

interface PageHeaderProps {
    actions?: React.ReactNode;
    description?: React.ReactNode;
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
}

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                        {eyebrow}
                    </p>
                )}
                <h1 className="m-0 mt-1 text-3xl font-semibold tracking-tight text-text">{title}</h1>
                {description && <p className="mb-0 mt-2 text-sm text-text-muted">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
