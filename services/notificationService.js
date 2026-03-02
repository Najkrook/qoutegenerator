let containersReady = false;
let toastContainer = null;
let confirmOverlay = null;
let confirmDialog = null;
let confirmTitle = null;
let confirmMessage = null;
let confirmCancelBtn = null;
let confirmOkBtn = null;
let lastFocusedElement = null;
let confirmResolver = null;
let removeConfirmTrap = null;

function createToastContainer() {
    toastContainer = document.createElement('div');
    toastContainer.id = 'appToastContainer';
    toastContainer.className = 'app-toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'false');
}

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

    confirmCancelBtn = document.createElement('button');
    confirmCancelBtn.type = 'button';
    confirmCancelBtn.className = 'app-confirm-cancel';
    confirmCancelBtn.textContent = 'Avbryt';

    confirmOkBtn = document.createElement('button');
    confirmOkBtn.type = 'button';
    confirmOkBtn.className = 'app-confirm-ok';
    confirmOkBtn.textContent = 'Bekräfta';

    actions.append(confirmCancelBtn, confirmOkBtn);
    confirmDialog.append(confirmTitle, confirmMessage, actions);
    confirmOverlay.appendChild(confirmDialog);
}

function onConfirmKeydown(event) {
    if (!confirmOverlay || confirmOverlay.hidden) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirm(false);
        return;
    }

    if (event.key !== 'Tab') return;
    const focusable = confirmDialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

function openConfirm() {
    if (!confirmOverlay) return;
    lastFocusedElement = document.activeElement;
    confirmOverlay.hidden = false;
    removeConfirmTrap = onConfirmKeydown;
    document.addEventListener('keydown', removeConfirmTrap);
    confirmOkBtn.focus();
}

function closeConfirm(result) {
    if (!confirmOverlay) return;
    confirmOverlay.hidden = true;
    if (removeConfirmTrap) {
        document.removeEventListener('keydown', removeConfirmTrap);
        removeConfirmTrap = null;
    }
    if (confirmResolver) {
        confirmResolver(Boolean(result));
        confirmResolver = null;
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
}

export function initNotifications() {
    if (containersReady || !document.body) return;

    createToastContainer();
    createConfirmDialog();

    document.body.append(toastContainer, confirmOverlay);

    confirmCancelBtn.addEventListener('click', () => closeConfirm(false));
    confirmOkBtn.addEventListener('click', () => closeConfirm(true));
    confirmOverlay.addEventListener('click', (event) => {
        if (event.target === confirmOverlay) {
            closeConfirm(false);
        }
    });

    containersReady = true;
}

export function notify({ type = 'info', message = '', timeoutMs = 3500 } = {}) {
    initNotifications();
    if (!toastContainer || !message) return;

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));

    const remove = () => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 180);
    };

    setTimeout(remove, timeoutMs);
    toast.addEventListener('click', remove);
}

export function notifySuccess(message) { notify({ type: 'success', message }); }
export function notifyError(message) { notify({ type: 'error', message, timeoutMs: 5000 }); }
export function notifyInfo(message) { notify({ type: 'info', message }); }
export function notifyWarn(message) { notify({ type: 'warn', message, timeoutMs: 4500 }); }

export function confirmAction({
    title = 'Bekräfta',
    message = 'Är du säker?',
    confirmText = 'Bekräfta',
    cancelText = 'Avbryt',
    tone = 'danger'
} = {}) {
    initNotifications();
    if (!confirmOverlay || !confirmDialog) {
        return Promise.resolve(false);
    }

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = confirmText;
    confirmCancelBtn.textContent = cancelText;
    confirmOkBtn.classList.toggle('app-confirm-ok-danger', tone === 'danger');
    confirmOkBtn.classList.toggle('app-confirm-ok-neutral', tone !== 'danger');

    return new Promise((resolve) => {
        confirmResolver = resolve;
        openConfirm();
    });
}

