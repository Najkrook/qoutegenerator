import React from 'react';
import toast, { type Toast } from 'react-hot-toast';

type NotificationType = 'success' | 'error' | 'info' | 'warn';
export type ConfirmActionChoice = 'cancel' | 'confirm' | 'secondary';

interface NotificationOptions {
    id?: string;
    durationMs?: number;
}

interface NotificationUpdateOptions extends NotificationOptions {
    type?: NotificationType;
    message: string;
}

interface ActionNotificationOptions {
    message: string;
    actionLabel: string;
    onAction: () => void | Promise<void>;
    onDismiss?: () => void | Promise<void>;
    dismissLabel?: string;
    durationMs?: number;
}

const DEFAULT_NOTIFICATION_DURATIONS: Record<NotificationType, number> = {
    success: 3500,
    error: 5000,
    info: 3500,
    warn: 4500
};

const DEFAULT_ACTION_DURATION_MS = 5000;

let containersReady = false;
let confirmOverlay: HTMLDivElement | null = null;
let confirmDialog: HTMLDivElement | null = null;
let confirmTitle: HTMLHeadingElement | null = null;
let confirmMessage: HTMLParagraphElement | null = null;
let confirmSecondaryBtn: HTMLButtonElement | null = null;
let confirmCancelBtn: HTMLButtonElement | null = null;
let confirmOkBtn: HTMLButtonElement | null = null;
let lastFocusedElement: Element | null = null;
let confirmResolver: ((value: ConfirmActionChoice) => void) | null = null;
let removeConfirmTrap: ((event: KeyboardEvent) => void) | null = null;

function createConfirmDialog() {
    confirmOverlay = document.createElement('div');
    confirmOverlay.id = 'appConfirmOverlay';
    confirmOverlay.className = 'app-confirm-overlay';
    confirmOverlay.hidden = true;

    confirmDialog = document.createElement('div');
    confirmDialog.className = 'app-confirm-dialog';
    confirmDialog.setAttribute('role', 'dialog');
    confirmDialog.setAttribute('aria-modal', 'true');
    confirmDialog.setAttribute('aria-labelledby', 'appConfirmTitle');
    confirmDialog.setAttribute('aria-describedby', 'appConfirmMessage');
    confirmDialog.tabIndex = -1;

    confirmTitle = document.createElement('h3');
    confirmTitle.id = 'appConfirmTitle';
    confirmTitle.className = 'app-confirm-title';

    confirmMessage = document.createElement('p');
    confirmMessage.id = 'appConfirmMessage';
    confirmMessage.className = 'app-confirm-message';

    const actions = document.createElement('div');
    actions.className = 'app-confirm-actions';

    confirmSecondaryBtn = document.createElement('button');
    confirmSecondaryBtn.type = 'button';
    confirmSecondaryBtn.className = 'app-confirm-secondary';
    confirmSecondaryBtn.textContent = 'Fortsätt';
    confirmSecondaryBtn.hidden = true;

    confirmCancelBtn = document.createElement('button');
    confirmCancelBtn.type = 'button';
    confirmCancelBtn.className = 'app-confirm-cancel';
    confirmCancelBtn.textContent = 'Avbryt';

    confirmOkBtn = document.createElement('button');
    confirmOkBtn.type = 'button';
    confirmOkBtn.className = 'app-confirm-ok';
    confirmOkBtn.textContent = 'Bekräfta';

    actions.append(confirmSecondaryBtn, confirmCancelBtn, confirmOkBtn);
    confirmDialog.append(confirmTitle, confirmMessage, actions);
    confirmOverlay.appendChild(confirmDialog);
}

function onConfirmKeydown(event: KeyboardEvent) {
    if (!confirmOverlay || confirmOverlay.hidden || !confirmDialog) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirm('cancel');
        return;
    }

    if (event.key !== 'Tab') return;
    const focusable = confirmDialog.querySelectorAll(
        'button:not([hidden]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
        event.preventDefault();
        (last as HTMLElement).focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        (first as HTMLElement).focus();
    }
}

function openConfirm() {
    if (!confirmOverlay || !confirmOkBtn) return;
    lastFocusedElement = document.activeElement;
    confirmOverlay.hidden = false;
    removeConfirmTrap = onConfirmKeydown;
    document.addEventListener('keydown', removeConfirmTrap);
    confirmOkBtn.focus();
}

function closeConfirm(result: ConfirmActionChoice) {
    if (!confirmOverlay) return;
    confirmOverlay.hidden = true;
    if (removeConfirmTrap) {
        document.removeEventListener('keydown', removeConfirmTrap);
        removeConfirmTrap = null;
    }
    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
    if (lastFocusedElement && typeof (lastFocusedElement as HTMLElement).focus === 'function') {
        (lastFocusedElement as HTMLElement).focus();
    }
}

export function initNotifications() {
    if (containersReady || !document.body) return;

    createConfirmDialog();
    if (!confirmOverlay || !confirmSecondaryBtn || !confirmCancelBtn || !confirmOkBtn) {
        return;
    }

    document.body.append(confirmOverlay);

    confirmSecondaryBtn.addEventListener('click', () => closeConfirm('secondary'));
    confirmCancelBtn.addEventListener('click', () => closeConfirm('cancel'));
    confirmOkBtn.addEventListener('click', () => closeConfirm('confirm'));
    confirmOverlay.addEventListener('click', (event) => {
        if (event.target === confirmOverlay) {
            closeConfirm('cancel');
        }
    });

    containersReady = true;
}

function getNotificationDuration(type: NotificationType, durationMs?: number): number {
    return typeof durationMs === 'number' ? durationMs : DEFAULT_NOTIFICATION_DURATIONS[type];
}

function showNotification(type: NotificationType, message: string, options: NotificationOptions = {}): string {
    const toastOptions = {
        id: options.id,
        duration: getNotificationDuration(type, options.durationMs)
    };

    switch (type) {
        case 'success':
            return toast.success(message, toastOptions);
        case 'error':
            return toast.error(message, toastOptions);
        case 'warn':
            return toast(message, {
                ...toastOptions,
                icon: '⚠️'
            });
        case 'info':
        default:
            return toast(message, {
                ...toastOptions,
                icon: '!'
            });
    }
}

export function notify({
    type = 'info',
    message = '',
    timeoutMs
}: { type?: NotificationType; message?: string; timeoutMs?: number } = {}): string | undefined {
    if (!message) return undefined;
    return showNotification(type, message, { durationMs: timeoutMs });
}

export function notifySuccess(message: string, options: NotificationOptions = {}): string {
    return showNotification('success', message, options);
}

export function notifyError(message: string, options: NotificationOptions = {}): string {
    return showNotification('error', message, options);
}

export function notifyInfo(message: string, options: NotificationOptions = {}): string {
    return showNotification('info', message, options);
}

export function notifyWarn(message: string, options: NotificationOptions = {}): string {
    return showNotification('warn', message, options);
}

export function notifyLoading(message: string, options: NotificationOptions = {}): string {
    return toast.loading(message, {
        id: options.id
    });
}

export function updateNotification(id: string, { type = 'info', message, durationMs }: NotificationUpdateOptions): string {
    return showNotification(type, message, { id, durationMs });
}

export function dismissNotification(id?: string): void {
    toast.dismiss(id);
}

function ActionNotificationToast({
    toastState,
    message,
    actionLabel,
    dismissLabel,
    onAction,
    onDismiss
}: {
    toastState: Toast;
    message: string;
    actionLabel: string;
    dismissLabel: string;
    onAction: () => void | Promise<void>;
    onDismiss?: () => void | Promise<void>;
}) {
    const actionTriggeredRef = React.useRef(false);
    const dismissHandledRef = React.useRef(false);

    React.useEffect(() => {
        if (!toastState.visible && !dismissHandledRef.current) {
            dismissHandledRef.current = true;
            if (!actionTriggeredRef.current) {
                void onDismiss?.();
            }
        }
    }, [onDismiss, toastState.visible]);

    const handleAction = () => {
        actionTriggeredRef.current = true;
        dismissHandledRef.current = true;
        void onAction();
        toast.dismiss(toastState.id);
    };

    return React.createElement(
        'div',
        {
            className: 'flex items-center gap-4 rounded-xl border border-panel-border bg-bg px-5 py-3 text-text-primary shadow-2xl'
        },
        React.createElement(
            'p',
            {
                className: 'm-0 max-w-[240px] truncate text-sm font-medium'
            },
            message
        ),
        React.createElement(
            'div',
            {
                className: 'flex items-center gap-2 border-l border-panel-border pl-4'
            },
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleAction,
                    className: 'rounded border-none bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20 cursor-pointer'
                },
                actionLabel
            ),
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: () => toast.dismiss(toastState.id),
                    className: 'cursor-pointer border-none bg-transparent p-1 text-text-secondary transition-colors hover:text-text-primary',
                    'aria-label': dismissLabel,
                    title: dismissLabel
                },
                'X'
            )
        )
    );
}

export function notifyAction({
    message,
    actionLabel,
    onAction,
    onDismiss,
    dismissLabel = 'Stäng',
    durationMs = DEFAULT_ACTION_DURATION_MS
}: ActionNotificationOptions): string {
    return toast.custom(
        (toastState) => React.createElement(ActionNotificationToast, {
            toastState,
            message,
            actionLabel,
            dismissLabel,
            onAction,
            onDismiss
        }),
        { duration: durationMs }
    );
}

export function confirmChoiceAction({
    title = 'Bekräfta',
    message = 'Är du säker?',
    confirmText = 'Bekräfta',
    cancelText = 'Avbryt',
    secondaryText,
    tone = 'danger'
}: {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    secondaryText?: string;
    tone?: 'danger' | 'neutral';
} = {}): Promise<ConfirmActionChoice> {
    initNotifications();
    if (!confirmOverlay || !confirmDialog || !confirmTitle || !confirmMessage || !confirmSecondaryBtn || !confirmOkBtn || !confirmCancelBtn) {
        return Promise.resolve('cancel');
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = confirmText;
    confirmCancelBtn.textContent = cancelText;
    confirmSecondaryBtn.textContent = secondaryText || '';
    confirmSecondaryBtn.hidden = !secondaryText;
    confirmOkBtn.classList.toggle('app-confirm-ok-danger', tone === 'danger');
    confirmOkBtn.classList.toggle('app-confirm-ok-neutral', tone !== 'danger');

    return new Promise((resolve) => {
        confirmResolver = resolve;
        openConfirm();
    });
}

export async function confirmAction({
    title = 'Bekräfta',
    message = 'Är du säker?',
    confirmText = 'Bekräfta',
    cancelText = 'Avbryt',
    tone = 'danger'
}: {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    tone?: 'danger' | 'neutral';
} = {}): Promise<boolean> {
    const choice = await confirmChoiceAction({
        title,
        message,
        confirmText,
        cancelText,
        tone
    });

    return choice === 'confirm';
}
