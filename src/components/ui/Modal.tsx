import React, { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

interface ModalProps {
    children: React.ReactNode;
    description?: React.ReactNode;
    dismissible?: boolean;
    footer?: React.ReactNode;
    maxWidthClassName?: string;
    onClose: () => void;
    open?: boolean;
    title: React.ReactNode;
}

export function Modal({
    children,
    description,
    dismissible = true,
    footer,
    maxWidthClassName = 'max-w-2xl',
    onClose,
    open = true,
    title
}: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const onCloseRef = useRef(onClose);
    const dismissibleRef = useRef(dismissible);
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (dismissibleRef.current) {
            closeButtonRef.current?.focus();
        } else {
            panelRef.current?.focus();
        }

        const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
            const openDialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
            if (openDialogs.item(openDialogs.length - 1) !== dialogRef.current) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                if (dismissibleRef.current) {
                    onCloseRef.current();
                }
                return;
            }

            if (event.key !== 'Tab' || !panelRef.current) {
                return;
            }

            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        };
    }, [open]);

    if (!open) {
        return null;
    }

    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (dismissible && event.currentTarget === event.target) {
                    onClose();
                }
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-panel border border-border bg-surface-raised shadow-2xl ${maxWidthClassName}`}
            >
                <header className="flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        <h2 id={titleId} className="m-0 text-xl font-semibold text-text">{title}</h2>
                        {description && (
                            <p id={descriptionId} className="mb-0 mt-1 text-sm text-text-muted">
                                {description}
                            </p>
                        )}
                    </div>
                    {dismissible && (
                        <Button ref={closeButtonRef} onClick={onClose} size="sm" variant="ghost">
                            Stäng
                        </Button>
                    )}
                </header>
                <div className="min-h-0 overflow-y-auto">{children}</div>
                {footer && (
                    <footer className="border-t border-border bg-surface px-5 py-4 sm:px-6">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
}
