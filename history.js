// history.js - Firestore-backed quote history (per-user)
import { db, collection, getDocs, getDoc, doc, deleteDoc, query, orderBy } from './services/firebase.js';
import { currentUser, onAuthChange, logout } from './services/authService.js';
import { initNotifications, notifyError, notifyInfo, notifySuccess, confirmAction } from './services/notificationService.js';

const DOM = {
    historyContainer: document.getElementById('historyContainer')
};

async function renderHistory() {
    const user = currentUser();
    if (!user) {
        DOM.historyContainer.innerHTML = '<div class="loading-state">Vantar pa autentisering...</div>';
        return;
    }

    DOM.historyContainer.innerHTML = '<div class="loading-state">Laddar offerter...</div>';

    try {
        const quotesRef = collection(db, 'users', user.uid, 'quotes');
        const q = query(quotesRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            DOM.historyContainer.innerHTML = `
                <div class="empty-state">
                    <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Inga sparade offerter annu</h3>
                    <p>Nar du skapar en offert kan du klicka pa "Spara Offert" for att hitta den har senare.</p>
                </div>
            `;
            return;
        }

        DOM.historyContainer.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const quote = docSnap.data();
            const id = docSnap.id;
            const dateObj = quote.timestamp?.toDate ? quote.timestamp.toDate() : new Date(quote.timestamp);
            const dateStr = dateObj.toLocaleDateString('sv-SE', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const fmt = (num) => Math.round(num).toLocaleString('sv-SE');

            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-details">
                    <h3>${quote.customerName || 'Okand Kund'}</h3>
                    <p>
                        <strong>Referens:</strong> ${quote.reference || '-'} &nbsp;|&nbsp;
                        <strong>Sparad:</strong> ${dateStr}
                    </p>
                    <div style="margin-top: 0.5rem; color: var(--success-color); font-weight: 600;">
                        Totalt: ${fmt(quote.totalSek || 0)} SEK
                    </div>
                </div>
                <div class="history-actions">
                    <button class="primary btn-sm" data-action="open" data-id="${id}">Oppna Offert</button>
                    <button data-action="delete" data-id="${id}" style="background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color);" class="btn-sm">Ta bort</button>
                </div>
            `;

            card.querySelector('[data-action="open"]').addEventListener('click', () => openQuote(id));
            card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteQuote(id));
            DOM.historyContainer.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load quotes:', err);
        DOM.historyContainer.innerHTML = `
            <div class="empty-state">
                <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Kunde inte ladda offerter</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

async function openQuote(id) {
    const user = currentUser();
    if (!user) return;

    try {
        const docRef = doc(db, 'users', user.uid, 'quotes', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            notifyInfo('Offerten hittades inte.');
            return;
        }

        const quote = docSnap.data();
        localStorage.setItem('offertverktyg_state', JSON.stringify(quote.state));
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Failed to open quote:', err);
        notifyError('Kunde inte oppna offerten: ' + err.message);
    }
}

async function deleteQuote(id) {
    const ok = await confirmAction({
        title: 'Ta bort offert',
        message: 'Ar du saker pa att du vill ta bort den har offerten?',
        confirmText: 'Ta bort',
        cancelText: 'Avbryt',
        tone: 'danger'
    });
    if (!ok) return;

    const user = currentUser();
    if (!user) return;

    try {
        const docRef = doc(db, 'users', user.uid, 'quotes', id);
        await deleteDoc(docRef);
        notifySuccess('Offerten togs bort.');
        renderHistory();
    } catch (err) {
        console.error('Failed to delete quote:', err);
        notifyError('Kunde inte ta bort offerten: ' + err.message);
    }
}

async function handleHeaderAction(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const { action } = actionEl.dataset;

    if (action === 'logout') {
        await logout();
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initNotifications();
    document.body.addEventListener('click', handleHeaderAction);
});

onAuthChange((user) => {
    if (user) renderHistory();
});


