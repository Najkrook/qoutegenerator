import React, { type HTMLAttributes } from 'react';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    description?: React.ReactNode;
    title?: React.ReactNode;
}

export function Panel({
    children,
    className = '',
    description,
    title,
    ...props
}: PanelProps) {
    return (
        <section
            className={[
                'rounded-panel border border-border bg-surface-raised shadow-panel',
                className
            ].join(' ')}
            {...props}
        >
            {(title || description) && (
                <header className="border-b border-border px-5 py-4">
                    {title && <h2 className="m-0 text-lg font-semibold text-text">{title}</h2>}
                    {description && <p className="mb-0 mt-1 text-sm text-text-muted">{description}</p>}
                </header>
            )}
            {children}
        </section>
    );
}
