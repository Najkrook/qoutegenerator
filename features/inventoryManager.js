import { db, doc, getDoc, setDoc, collection, writeBatch, query, orderBy, limit, getDocs } from "../services/firebase.js";
import { state, markStateDirty } from "../services/stateManager.js";
import { currentUser } from '../services/authService.js';
import { notifySuccess, notifyError, notifyWarn, confirmAction } from "../services/notificationService.js";

const hooks = {
    goToStep: null,
    onStateChange: null
};

let handlersBound = false;
let inventoryModalLastFocus = null;
let inventoryModalKeyHandler = null;

const DOM_INV = {
    inventorySection: document.getElementById('inventorySection'),
    btnUploadInventory: document.getElementById('btnUploadInventory'),
    inventoryUpload: document.getElementById('inventoryUpload'),
    inventorySearch: document.getElementById('inventorySearch'),
    inventoryTableBody: document.getElementById('inventoryTableBody'),
    btnNewInventoryItem: document.getElementById('btnNewInventoryItem'),

    clickitupInventorySection: document.getElementById('clickitupInventorySection'),
    clickitupInventoryToggleIcon: document.getElementById('clickitupInventoryToggleIcon'),
    clickitupInventoryContent: document.getElementById('clickitupInventoryContent'),
    clickitupInventoryTableBody: document.getElementById('clickitupInventoryTableBody'),

    pendingChangesPanel: document.getElementById('pendingChangesPanel'),
    pendingChangesList: document.getElementById('pendingChangesList'),
    pendingChangesCount: document.getElementById('pendingChangesCount'),
    btnSaveInventoryChanges: document.getElementById('btnSaveInventoryChanges'),
    pendingChangesEmptyState: document.getElementById('pendingChangesEmptyState'),

    inventoryModal: document.getElementById('inventoryModal'),
    inventoryModalTitle: document.getElementById('inventoryModalTitle'),
    invModalEditIndex: document.getElementById('invModalEditIndex'),
    invModalId: document.getElementById('invModalId'),
    invModalTyp: document.getElementById('invModalTyp'),
    invModalSize: document.getElementById('invModalSize'),
    invModalColor: document.getElementById('invModalColor'),
    invModalDesc: document.getElementById('invModalDesc'),
    invModalComment: document.getElementById('invModalComment'),
    btnCancelInvModal: document.getElementById('btnCancelInvModal'),
    btnSaveInvModal: document.getElementById('btnSaveInvModal'),

    shoppingBasket: document.getElementById('shoppingBasket'),
    basketCount: document.getElementById('basketCount'),
    basketItems: document.getElementById('basketItems')
};

function onStateMutated() {
    if (typeof hooks.onStateChange === 'function') {
        hooks.onStateChange();
        return;
    }
    markStateDirty();
}

export function initInventoryManager({ goToStep = null, onStateChange = null } = {}) {
    hooks.goToStep = goToStep;
    hooks.onStateChange = onStateChange;

    if (handlersBound) return;

    const invToggleBtn = document.getElementById('inventoryToggleBtn');
    const clickitupToggleBtn = document.getElementById('clickitupInventoryToggleBtn');

    if (invToggleBtn) invToggleBtn.addEventListener('click', toggleInventory);
    if (clickitupToggleBtn) clickitupToggleBtn.addEventListener('click', toggleClickitupInventory);
    if (DOM_INV.btnSaveInventoryChanges) DOM_INV.btnSaveInventoryChanges.addEventListener('click', commitInventoryChanges);

    handlersBound = true;
}

export async function fetchInventory() {
    try {
        const docRef = doc(db, "stock", "main_inventory");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            state.cloudInventoryData = JSON.parse(JSON.stringify(data || { bahama: [], clickitup: {} }));
            state.inventoryData = JSON.parse(JSON.stringify(state.cloudInventoryData));
            DOM_INV.inventorySection.style.display = 'block';
            if (DOM_INV.clickitupInventorySection) DOM_INV.clickitupInventorySection.style.display = 'block';
            renderInventory(DOM_INV.inventorySearch ? DOM_INV.inventorySearch.value : "");
            renderClickitupInventory();
            renderPendingChanges();
        } else {
            // First time ever booting up the Firestore, set defaults
            state.cloudInventoryData = { bahama: [], clickitup: {} };
            state.inventoryData = { bahama: [], clickitup: {} };
        }
    } catch (err) {
        console.error("Failed to load Firestore DB:", err);
        state.cloudInventoryData = { bahama: [], clickitup: {} };
        state.inventoryData = { bahama: [], clickitup: {} };
    }
}

export function handleInventoryUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });

            // Assume data is on the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Read as json array of arrays
            const jsonArr = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Find the header row (contains "TYP", "STORLEK", "BESKRIVNING")
            let headerIdx = -1;
            for (let i = 0; i < Math.min(jsonArr.length, 10); i++) {
                if (jsonArr[i] && jsonArr[i].includes("BESKRIVNING")) {
                    headerIdx = i;
                    break;
                }
            }

            if (headerIdx === -1) {
                notifyWarn("Kunde inte hitta kolumnen 'BESKRIVNING'. Kontrollera att det ar ratt lagersaldo-fil.");
                return;
            }

            const headers = jsonArr[headerIdx];
            const inventory = [];

            // Parse rows below header
            for (let i = headerIdx + 1; i < jsonArr.length; i++) {
                const row = jsonArr[i];
                if (!row || row.length === 0) continue;

                // Build object
                let item = {};
                let hasData = false;
                headers.forEach((h, colIdx) => {
                    if (h && typeof h === 'string') {
                        const val = row[colIdx];
                        item[h.trim()] = val;
                        if (val !== undefined && val !== "") hasData = true;
                    }
                });

                if (hasData && item['BESKRIVNING']) {
                    inventory.push(item);
                }
            }

            // Reroute to local staging
            state.inventoryData.bahama = inventory;
            onStateMutated();
            notifySuccess(`Lagersaldo inlast: ${inventory.length} artiklar hittades. Klicka "Spara andringar" till hoger for att synkronisera med molnet.`);
            DOM_INV.inventorySection.style.display = 'block';
            renderInventory(DOM_INV.inventorySearch ? DOM_INV.inventorySearch.value : "");
            renderPendingChanges();

        } catch (err) {
            console.error(err);
            notifyError("Ett fel uppstod vid inlasning av lagersaldo: " + err.message);
        }

        DOM_INV.inventoryUpload.value = "";
    };
    reader.readAsArrayBuffer(file);
}

export function filterInventory(e) {
    const term = e.target.value;
    renderInventory(term);
}

function renderInventory(searchTerm = "") {
    if (!DOM_INV.inventoryTableBody) return;
    DOM_INV.inventoryTableBody.innerHTML = '';

    const lowerTerm = searchTerm.toLowerCase();

    const filtered = (state.inventoryData.bahama || []).filter(item => {
        if (!searchTerm) return true;

        const typ = (item['TYP'] || "").toString().toLowerCase();
        const size = (item['STORLEK'] || "").toString().toLowerCase();
        const desc = (item['BESKRIVNING'] || "").toString().toLowerCase();
        const id = (item['ID'] || "").toString().toLowerCase();
        const color = (item['TEXTIL'] || "").toString().toLowerCase();
        const kommentar = (item['Kommentar'] || "").toString().toLowerCase();

        return typ.includes(lowerTerm) || size.includes(lowerTerm) || desc.includes(lowerTerm) || id.includes(lowerTerm) || color.includes(lowerTerm) || kommentar.includes(lowerTerm);
    });

    // Apply sorting: Alphanumerically by ID (e.g., 32.1, 32.10, 32.2)
    filtered.sort((a, b) => {
        const idA = (a['ID'] || "").toString();
        const idB = (b['ID'] || "").toString();
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

    let currentGrenstall = null;

    filtered.forEach((item, originalIndexInState) => {
        // We need the ACTUAL index in state.inventoryData.bahama to properly edit/delete
        const actualIndex = state.inventoryData.bahama.findIndex(i => i === item);

        const id = item['ID'] || "-";

        // Extract Grenställ prefix 
        let prefix = "Övrigt";
        const upperId = id.toUpperCase();

        if (id !== "-" && id.includes('.')) {
            const potentialPrefix = upperId.split('.')[0];
            const validNumeric = ['3', '4', '5', '6'];

            if (potentialPrefix === 'MAIN' || upperId.startsWith('M')) {
                prefix = "Main";
            } else if (potentialPrefix === 'LOD' || upperId.startsWith('L')) {
                prefix = "Lod";
            } else if (potentialPrefix === 'BLACK' || upperId.startsWith('B')) {
                prefix = "Black";
            } else if (validNumeric.includes(potentialPrefix)) {
                prefix = potentialPrefix;
            } else {
                prefix = "Övrigt";
            }
        } else if (id !== "-") {
            // Handle edge cases where there is no dot
            if (upperId === 'MAIN' || upperId.startsWith('M')) prefix = "Main";
            else if (upperId === 'LOD' || upperId.startsWith('L')) prefix = "Lod";
            else if (upperId === 'BLACK' || upperId.startsWith('B')) prefix = "Black";
            else if (['3', '4', '5', '6'].includes(id)) prefix = id;
            else prefix = "Övrigt";
        }

        // Check if we need to render a new Grenställ Header
        if (prefix !== currentGrenstall) {
            currentGrenstall = prefix;

            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
                <td colspan="6" style="padding: 1rem; background: var(--bg-color); border-bottom: 2px solid var(--primary); color: var(--primary); font-weight: bold; font-size: 1rem; text-transform: uppercase;">
                    Grenställ: ${prefix}
                </td>
            `;
            DOM_INV.inventoryTableBody.appendChild(headerRow);
        }
        const typ = item['TYP'] || "BA";
        const size = item['STORLEK'] || "Okänd";
        const desc = item['BESKRIVNING'] || "";
        const kommentar = item['Kommentar'] || "";

        const komUpper = kommentar.toString().toUpperCase();
        const isReserved = komUpper.includes("SALES LAPP") || komUpper.includes("AHLGRENS") || komUpper.includes("ENOCLUB") || komUpper.includes("RESERVERAD");
        const isUsed = komUpper.includes("INBYTES") || komUpper.includes("BEGAGNAD");
        const isMissingParts = komUpper.includes("SAKNAR") || komUpper.includes("KOLLA");

        let rowClass = "inventory-row";
        if (isReserved || isMissingParts) rowClass += " reserved";
        if (isUsed) rowClass += " used";

        const tr = document.createElement('tr');
        tr.className = rowClass;

        tr.innerHTML = `
            <td style="padding: 0.75rem; border-bottom: 1px solid var(--panel-border); font-weight: 500;">${id}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid var(--panel-border);">${typ}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid var(--panel-border);">${size}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid var(--panel-border); max-width: 400px; white-space: normal;">${desc}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid var(--panel-border);"><em>${kommentar}</em></td>
        `;

        const tdAction = document.createElement('td');
        tdAction.style = "padding: 0.75rem; border-bottom: 1px solid var(--panel-border); text-align: center; display: flex; gap: 0.5rem; justify-content: center;";

        const btnAdd = document.createElement('button');
        btnAdd.className = "add-item-btn";
        btnAdd.style = "width: auto; padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--panel-bg); color: var(--text-primary); border: 1px solid var(--panel-border);";
        btnAdd.textContent = "+ Lägg i Korg";
        btnAdd.addEventListener('click', () => addInventoryToBasket(item, btnAdd));

        const btnEdit = document.createElement('button');
        btnEdit.style = "width: auto; padding: 0.4rem 0.6rem; font-size: 0.75rem; background: transparent; color: var(--primary); border: 1px solid var(--primary); border-radius: 4px; cursor: pointer;";
        btnEdit.textContent = "✎";
        btnEdit.title = "Redigera Artikel";
        btnEdit.setAttribute('aria-label', `Redigera artikel ${id}`);
        btnEdit.addEventListener('click', () => openInventoryModal(actualIndex, item));

        const btnDelete = document.createElement('button');
        btnDelete.style = "width: auto; padding: 0.4rem 0.6rem; font-size: 0.75rem; background: transparent; color: var(--danger); border: 1px solid var(--danger); border-radius: 4px; cursor: pointer;";
        btnDelete.textContent = "🗑";
        btnDelete.title = "Ta bort Artikel";
        btnDelete.setAttribute('aria-label', `Ta bort artikel ${id}`);
        btnDelete.addEventListener('click', async () => {
            const ok = await confirmAction({
                title: 'Ta bort artikel',
                message: `Är du säker på att du vill ta bort artikel ID: ${id} permanent från databasen?`,
                confirmText: 'Ta bort',
                cancelText: 'Avbryt',
                tone: 'danger'
            });
            if (ok) {
                deleteInventoryItem(actualIndex);
            }
        });

        tdAction.appendChild(btnAdd);
        tdAction.appendChild(btnEdit);
        tdAction.appendChild(btnDelete);
        tr.appendChild(tdAction);

        DOM_INV.inventoryTableBody.appendChild(tr);
    });
}

function addInventoryToBasket(item, sourceButton = null) {
    state.inventoryBasket.push(item);
    onStateMutated();
    renderBasket();

    // Visual feedback
    const addBtn = sourceButton;
    if (addBtn) {
        const originalText = addBtn.textContent;
        addBtn.textContent = "✓ Tillagd";
        addBtn.style.background = "var(--success)";
        addBtn.style.color = "white";
        setTimeout(() => {
            if (addBtn) {
                addBtn.textContent = originalText;
                addBtn.style.background = "var(--panel-bg)";
                addBtn.style.color = "var(--text-primary)";
            }
        }, 1500);
    }

    if (typeof hooks.goToStep === 'function') hooks.goToStep(2);
}

function removeInventoryFromBasket(index) {
    state.inventoryBasket.splice(index, 1);
    onStateMutated();
    renderBasket();
}

export function renderBasket() {
    if (!DOM_INV.shoppingBasket || !DOM_INV.basketItems || !DOM_INV.basketCount) return;

    DOM_INV.basketCount.textContent = state.inventoryBasket.length;

    if (state.inventoryBasket.length === 0) {
        DOM_INV.basketItems.innerHTML = `<p style="color: var(--text-secondary); text-align: center; font-size: 0.875rem; margin: 0;">Inga artiklar valda.</p>`;
        // Hide basket if empty and not on step 1
        if (state.step > 1) {
            DOM_INV.shoppingBasket.style.display = 'none';
        }
        return;
    }

    // Show basket if we are on step 2, 3, or 4
    if (state.step > 1) {
        DOM_INV.shoppingBasket.style.display = 'flex';
    } else {
        DOM_INV.shoppingBasket.style.display = 'none';
    }

    DOM_INV.basketItems.innerHTML = '';

    state.inventoryBasket.forEach((item, index) => {
        const id = item['ID'] || "-";
        const desc = item['BESKRIVNING'] || "Ingen beskrivning";

        const card = document.createElement('div');
        card.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); border-radius: 4px; padding: 0.75rem; position: relative;";

        card.innerHTML = `
            <div style="font-size: 0.75rem; color: var(--primary); font-weight: bold; margin-bottom: 0.25rem;">ID: ${id}</div>
            <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">${desc}</div>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '✕';
        removeBtn.style.cssText = "position: absolute; top: 0.5rem; right: 0.5rem; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1rem; line-height: 1;";
        removeBtn.setAttribute('aria-label', `Ta bort artikel ${id} från korgen`);
        removeBtn.addEventListener('click', () => removeInventoryFromBasket(index));

        card.appendChild(removeBtn);
        DOM_INV.basketItems.appendChild(card);
    });
}

export function openInventoryModal(index = -1, item = null) {
    if (!DOM_INV.inventoryModal) return;
    DOM_INV.invModalEditIndex.value = index;

    if (index >= 0 && item) {
        // Edit Mode
        DOM_INV.inventoryModalTitle.textContent = "Redigera Artikel";
        DOM_INV.invModalId.value = item['ID'] || "";
        DOM_INV.invModalTyp.value = item['TYP'] || "";
        DOM_INV.invModalSize.value = item['STORLEK'] || "";
        DOM_INV.invModalColor.value = item['TEXTIL'] || "";
        DOM_INV.invModalDesc.value = item['BESKRIVNING'] || "";
        DOM_INV.invModalComment.value = item['Kommentar'] || "";
    } else {
        // Add Mode
        DOM_INV.inventoryModalTitle.textContent = "Ny BaHaMa Artikel";
        DOM_INV.invModalId.value = "";
        DOM_INV.invModalTyp.value = "JUMB";
        DOM_INV.invModalSize.value = "";
        DOM_INV.invModalColor.value = "";
        DOM_INV.invModalDesc.value = "";
        DOM_INV.invModalComment.value = "";
    }

    inventoryModalLastFocus = document.activeElement;
    DOM_INV.inventoryModal.style.display = 'flex';
    bindInventoryModalFocusTrap();
}

export function closeInventoryModal() {
    if (!DOM_INV.inventoryModal) return;
    DOM_INV.inventoryModal.style.display = 'none';
    releaseInventoryModalFocusTrap();
}

function bindInventoryModalFocusTrap() {
    if (!DOM_INV.inventoryModal) return;
    if (inventoryModalKeyHandler) {
        document.removeEventListener('keydown', inventoryModalKeyHandler);
        inventoryModalKeyHandler = null;
    }
    const focusable = DOM_INV.inventoryModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable.length ? focusable[0] : null;
    const last = focusable.length ? focusable[focusable.length - 1] : null;

    inventoryModalKeyHandler = (event) => {
        if (DOM_INV.inventoryModal.style.display === 'none') return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeInventoryModal();
            return;
        }
        if (event.key !== 'Tab') return;
        if (!first || !last) return;

        const active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    document.addEventListener('keydown', inventoryModalKeyHandler);
    if (first) first.focus();
}

function releaseInventoryModalFocusTrap() {
    if (inventoryModalKeyHandler) {
        document.removeEventListener('keydown', inventoryModalKeyHandler);
        inventoryModalKeyHandler = null;
    }
    if (inventoryModalLastFocus && typeof inventoryModalLastFocus.focus === 'function') {
        inventoryModalLastFocus.focus();
    }
    inventoryModalLastFocus = null;
}

export function saveInventoryItem() {
    const editIndex = parseInt(DOM_INV.invModalEditIndex.value, 10);

    const newItem = {
        'ID': DOM_INV.invModalId.value.trim(),
        'TYP': DOM_INV.invModalTyp.value.trim().toUpperCase(),
        'STORLEK': DOM_INV.invModalSize.value.trim(),
        'TEXTIL': DOM_INV.invModalColor.value.trim(),
        'BESKRIVNING': DOM_INV.invModalDesc.value.trim(),
        'Kommentar': DOM_INV.invModalComment.value.trim()
    };

    if (!newItem['ID'] || !newItem['BESKRIVNING']) {
        notifyWarn("Du maste minst ange ID och beskrivning.");
        return;
    }

    if (editIndex >= 0) {
        // Update existing item
        state.inventoryData.bahama[editIndex] = { ...state.inventoryData.bahama[editIndex], ...newItem };
    } else {
        // Add new item
        state.inventoryData.bahama.push(newItem);
    }

    renderInventory(DOM_INV.inventorySearch ? DOM_INV.inventorySearch.value : "");
    renderPendingChanges();
    onStateMutated();
    closeInventoryModal();
}

function deleteInventoryItem(index) {
    if (index >= 0 && index < state.inventoryData.bahama.length) {
        state.inventoryData.bahama.splice(index, 1);
        renderInventory(DOM_INV.inventorySearch ? DOM_INV.inventorySearch.value : "");
        renderPendingChanges();
        onStateMutated();
    }
}

function toggleInventory() {
    const content = document.getElementById('inventoryContent');
    const icon = document.getElementById('inventoryToggleIcon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function toggleClickitupInventory() {
    const content = DOM_INV.clickitupInventoryContent;
    const icon = DOM_INV.clickitupInventoryToggleIcon;
    if (!content || !icon) return;
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

function updateClickitupStock(size, field, delta) {
    if (!state.inventoryData.clickitup) state.inventoryData.clickitup = {};
    if (!state.inventoryData.clickitup[size]) state.inventoryData.clickitup[size] = { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 };

    // Prevent physical negatives locally based on the actual staged amount
    const currentVal = state.inventoryData.clickitup[size][field] || 0;
    if (currentVal + delta < 0) return; // Silent abort if trying to go into negative stock

    // Optimistic UI update (staged)
    state.inventoryData.clickitup[size][field] += delta;
    renderClickitupInventory();
    renderPendingChanges();
    onStateMutated();
}

async function runFirebaseMigration() {
    try {
        console.log("Starting Firebase migration...");
        const res = await fetch('http://localhost:8000/inventory_db.json');

        if (!res.ok) {
            throw new Error("HTTP error " + res.status + " while fetching inventory_db.json");
        }

        const localData = await res.json();

        const docRef = doc(db, "stock", "main_inventory");
        await setDoc(docRef, localData);

        console.log("✅ Migration successful! The local JSON has been written to Cloud Firestore.");
        notifySuccess("Migrering lyckades! Uppdatera sidan.");
    } catch (err) {
        console.error("Migration failed:", err);
        fetch('/log', {
            method: 'POST',
            body: err.stack || err.message || err.toString()
        }).catch(e => console.error("Could not send log to server", e));

        notifyError("Migrering misslyckades. Se konsolen för detaljer.");
    }
}

function generateDiffTag(title, description, icon, color) {
    return `
        <div style="background: rgba(255,255,255,0.03); border-left: 3px solid ${color}; padding: 0.5rem 0.75rem; border-radius: 4px; display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">${title}</div>
            <div style="font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                <span>${description}</span>
                <span style="font-weight: bold; color: ${color};">${icon}</span>
            </div>
        </div>
    `;
}

function renderPendingChanges() {
    if (!DOM_INV.pendingChangesList) return;

    let changes = [];

    // Check BaHaMa differences mapping by ID
    const bahamaLocal = state.inventoryData.bahama || [];
    const bahamaCloud = state.cloudInventoryData.bahama || [];

    const cloudMap = {};
    bahamaCloud.forEach(i => { if (i.ID) cloudMap[i.ID] = i; });

    const localMap = {};
    let fallbackGlobalDiff = false;

    bahamaLocal.forEach(i => {
        if (!i.ID) { fallbackGlobalDiff = true; return; }
        localMap[i.ID] = i;

        if (!cloudMap[i.ID]) {
            changes.push(generateDiffTag("BaHaMa: Lades Till", `${i.ID} - ${i.TYP} ${i.STORLEK || ''}`, "+", "var(--success)"));
        } else if (JSON.stringify(i) !== JSON.stringify(cloudMap[i.ID])) {
            changes.push(generateDiffTag("BaHaMa: Ändrades", `${i.ID}`, "✍", "var(--primary)"));
        }
    });

    bahamaCloud.forEach(i => {
        if (i.ID && !localMap[i.ID]) {
            changes.push(generateDiffTag("BaHaMa: Togs Bort", `${i.ID}`, "−", "var(--danger)"));
        }
    });

    if (fallbackGlobalDiff && JSON.stringify(bahamaLocal) !== JSON.stringify(bahamaCloud)) {
        changes.push(generateDiffTag("BaHaMa", "Massuppdatering via Excel", "ℹ", "var(--primary)"));
    }

    // Check ClickitUP differences
    const cLocal = state.inventoryData.clickitup || {};
    const cCloud = state.cloudInventoryData.clickitup || {};

    for (const size in cLocal) {
        const fields = ["sektion", "dorr_h", "dorr_v", "hane_h", "hane_v"];
        fields.forEach(f => {
            const locVal = cLocal[size][f] || 0;
            const cloVal = (cCloud[size] && cCloud[size][f]) || 0;
            const delta = locVal - cloVal;

            if (delta !== 0) {
                const fName = f.replace('_h', ' Höger').replace('_v', ' Vänster').replace('dorr', 'Dörr').replace('hane', 'Hane').replace('sektion', 'Sektion');
                const sign = delta > 0 ? '+' : '';
                const color = delta > 0 ? 'var(--success)' : 'var(--danger)';
                changes.push(generateDiffTag(`ClickitUP ${size}`, fName, `${sign}${delta}`, color));
            }
        });
    }

    if (changes.length > 0) {
        DOM_INV.pendingChangesList.innerHTML = changes.join('');
        if (DOM_INV.pendingChangesEmptyState) DOM_INV.pendingChangesEmptyState.style.display = 'none';
        DOM_INV.btnSaveInventoryChanges.style.display = 'block';
        DOM_INV.pendingChangesCount.textContent = changes.length;
        DOM_INV.pendingChangesCount.style.display = 'inline-block';
    } else {
        DOM_INV.pendingChangesList.innerHTML = `<p id="pendingChangesEmptyState" style="color: var(--text-secondary); text-align: center; font-size: 0.875rem; margin: 0; padding: 2rem 0;">Inga ändringar gjorda ännu.</p>`;
        DOM_INV.btnSaveInventoryChanges.style.display = 'none';
        DOM_INV.pendingChangesCount.style.display = 'none';
    }
}

async function commitInventoryChanges() {
    DOM_INV.btnSaveInventoryChanges.textContent = "Sparar till molnet...";
    DOM_INV.btnSaveInventoryChanges.disabled = true;

    try {
        const batch = writeBatch(db);
        const invRef = doc(db, "stock", "main_inventory");

        // 1. Stage the master inventory overwrite
        batch.set(invRef, state.inventoryData);

        // 2. Generate Audit Logs for every detected change
        const logsRef = collection(db, "inventory_logs");
        const user = currentUser();
        const userEmail = user?.email || 'unknown';
        const userUid = user?.uid || null;

        // 2a. BaHaMa Diffs
        const bahamaLocal = state.inventoryData.bahama || [];
        const bahamaCloud = state.cloudInventoryData.bahama || [];
        const cloudMap = {};
        bahamaCloud.forEach(i => { if (i.ID) cloudMap[i.ID] = i; });
        const localMap = {};
        let fallbackGlobalDiff = false;

        bahamaLocal.forEach(i => {
            if (!i.ID) { fallbackGlobalDiff = true; return; }
            localMap[i.ID] = i;
            if (!cloudMap[i.ID]) {
                const newLog = doc(logsRef);
                batch.set(newLog, {
                    timestamp: new Date().toISOString(),
                    createdAt: Date.now(),
                    action: "Lades Till",
                    system: "BaHaMa",
                    category: "bahama",
                    targetType: "item",
                    targetId: String(i.ID || ''),
                    element: i.ID,
                    details: `${i.TYP} ${i.STORLEK || ''}`,
                    user: userEmail,
                    userUid,
                    delta: null
                });
            } else if (JSON.stringify(i) !== JSON.stringify(cloudMap[i.ID])) {
                const newLog = doc(logsRef);
                batch.set(newLog, {
                    timestamp: new Date().toISOString(),
                    createdAt: Date.now(),
                    action: "Ändrades",
                    system: "BaHaMa",
                    category: "bahama",
                    targetType: "item",
                    targetId: String(i.ID || ''),
                    element: i.ID,
                    details: "Attribut uppdaterade",
                    user: userEmail,
                    userUid,
                    delta: null
                });
            }
        });

        bahamaCloud.forEach(i => {
            if (i.ID && !localMap[i.ID]) {
                const newLog = doc(logsRef);
                batch.set(newLog, {
                    timestamp: new Date().toISOString(),
                    createdAt: Date.now(),
                    action: "Togs Bort",
                    system: "BaHaMa",
                    category: "bahama",
                    targetType: "item",
                    targetId: String(i.ID || ''),
                    element: i.ID,
                    details: "-",
                    user: userEmail,
                    userUid,
                    delta: null
                });
            }
        });

        if (fallbackGlobalDiff && JSON.stringify(bahamaLocal) !== JSON.stringify(bahamaCloud)) {
            const newLog = doc(logsRef);
            batch.set(newLog, {
                timestamp: new Date().toISOString(),
                createdAt: Date.now(),
                action: "Massuppdatering",
                system: "BaHaMa",
                category: "bahama",
                targetType: "batch",
                targetId: "excel-upload",
                element: "Excel Uppladdning",
                details: `${bahamaLocal.length} rader`,
                user: userEmail,
                userUid,
                delta: null
            });
        }

        // 2b. ClickitUP Diffs
        const cLocal = state.inventoryData.clickitup || {};
        const cCloud = state.cloudInventoryData.clickitup || {};
        for (const size in cLocal) {
            const fields = ["sektion", "dorr_h", "dorr_v", "hane_h", "hane_v"];
            fields.forEach(f => {
                const locVal = cLocal[size][f] || 0;
                const cloVal = (cCloud[size] && cCloud[size][f]) || 0;
                const delta = locVal - cloVal;
                if (delta !== 0) {
                    const fName = f.replace('_h', ' Höger').replace('_v', ' Vänster').replace('dorr', 'Dörr').replace('hane', 'Hane').replace('sektion', 'Sektion');
                    const sign = delta > 0 ? '+' : '';
                    const newLog = doc(logsRef);
                    batch.set(newLog, {
                        timestamp: new Date().toISOString(),
                        createdAt: Date.now(),
                        action: "Justering",
                        system: "ClickitUP",
                        category: "clickitup",
                        targetType: "size",
                        targetId: String(size),
                        element: size,
                        details: `${fName} (${sign}${delta})`,
                        user: userEmail,
                        userUid,
                        delta
                    });
                }
            });
        }

        // 3. Commit the batch
        await batch.commit();

        // Re-baseline the local staging map
        state.cloudInventoryData = JSON.parse(JSON.stringify(state.inventoryData));
        renderPendingChanges();
        onStateMutated();

        // Refresh the Dashboard feed if it exists
        fetchActivityLogs();

        DOM_INV.btnSaveInventoryChanges.textContent = "✓ Sparat!";
        DOM_INV.btnSaveInventoryChanges.style.background = "var(--panel-bg)";
        setTimeout(() => {
            DOM_INV.btnSaveInventoryChanges.textContent = "Spara ändringar";
            DOM_INV.btnSaveInventoryChanges.style.background = "var(--success)";
            DOM_INV.btnSaveInventoryChanges.disabled = false;
        }, 2000);

    } catch (err) {
        console.error("Misslyckades att spara ändringar:", err);
        notifyError("Natverksfel. Kontrollera din internetuppkoppling.");
        DOM_INV.btnSaveInventoryChanges.textContent = "Spara ändringar";
        DOM_INV.btnSaveInventoryChanges.disabled = false;
    }
}

function renderClickitupInventory() {
    if (!DOM_INV.clickitupInventoryTableBody) return;
    DOM_INV.clickitupInventoryTableBody.innerHTML = '';

    const sizes = ["700", "1000", "1100", "1200", "1300", "1400", "1500", "1600", "1700", "1800", "1900", "2000", "980 special"];
    const fields = [
        { key: "sektion", color: "rgba(100, 200, 100, 0.1)" },
        { key: "dorr_h", color: "rgba(255, 150, 100, 0.2)" },
        { key: "dorr_v", color: "rgba(255, 150, 100, 0.2)" },
        { key: "hane_h", color: "rgba(100, 150, 255, 0.2)" },
        { key: "hane_v", color: "rgba(100, 150, 255, 0.2)" }
    ];

    sizes.forEach(size => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--panel-border)";

        const tdSize = document.createElement('td');
        tdSize.style.padding = "0.75rem";
        tdSize.style.fontWeight = "bold";
        tdSize.textContent = size;
        tr.appendChild(tdSize);

        const dataObj = (state.inventoryData.clickitup && state.inventoryData.clickitup[size]) || { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 };

        fields.forEach(f => {
            const td = document.createElement('td');
            td.style.padding = "0.5rem";
            td.style.textAlign = "center";
            td.style.background = f.color;

            const val = dataObj[f.key] || 0;
            const controls = document.createElement('div');
            controls.style.cssText = "display:flex; align-items:center; justify-content:center; gap:0.3rem;";

            const createBtn = (text, delta, small = false) => {
                const btn = document.createElement('button');
                btn.className = 'btn-remove-item';
                btn.type = 'button';
                btn.textContent = text;
                btn.setAttribute('aria-label', `${delta > 0 ? 'Öka' : 'Minska'} ${f.key} ${size} med ${Math.abs(delta)}`);
                btn.style.cssText = `padding: 0.2rem ${small ? '0.4rem' : '0.5rem'}; border-radius: 4px; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--text-primary); cursor: pointer; ${small ? 'font-size:0.75rem;' : ''}`;
                btn.addEventListener('click', () => updateClickitupStock(size, f.key, delta));
                return btn;
            };

            const valueEl = document.createElement('span');
            valueEl.style.cssText = `min-width:20px; font-weight:bold; text-align:center; color:${val > 0 ? '#4ade80' : ''};`;
            valueEl.textContent = String(val);

            controls.append(
                createBtn('-6', -6, true),
                createBtn('-', -1, false),
                valueEl,
                createBtn('+', 1, false),
                createBtn('+6', 6, true)
            );
            td.appendChild(controls);
            tr.appendChild(td);
        });

        DOM_INV.clickitupInventoryTableBody.appendChild(tr);
    });
};

function getLogTimeValue(entry) {
    if (typeof entry.createdAt === 'number') return entry.createdAt;
    const parsed = Date.parse(entry.timestamp || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function getLogVisual(entry) {
    let icon = "📝";
    let color = "var(--primary)";

    if (entry.action === "Lades Till" || (entry.action === "Justering" && Number(entry.delta) > 0)) {
        icon = "📦";
        color = "var(--success)";
    } else if (entry.action === "Togs Bort" || (entry.action === "Justering" && Number(entry.delta) < 0)) {
        icon = "🔻";
        color = "var(--danger)";
    } else if (entry.action === "Massuppdatering") {
        icon = "🔄";
        color = "var(--primary)";
    }

    return { icon, color };
}

async function fetchRecentLogDocs(maxRows = 20) {
    const logsRef = collection(db, "inventory_logs");

    try {
        const byTimestamp = query(logsRef, orderBy("timestamp", "desc"), limit(maxRows));
        return await getDocs(byTimestamp);
    } catch (err) {
        const byCreatedAt = query(logsRef, orderBy("createdAt", "desc"), limit(maxRows));
        return await getDocs(byCreatedAt);
    }
}

export async function fetchActivityLogs() {
    const logContainer = document.getElementById('dashboardActivityLog');
    if (!logContainer) return;

    try {
        const querySnapshot = await fetchRecentLogDocs(20);
        if (querySnapshot.empty) {
            logContainer.innerHTML = `<p style="color: var(--text-secondary); text-align: center; font-style: italic;">Inga loggade händelser ännu.</p>`;
            return;
        }

        const logs = querySnapshot.docs.map((docSnap) => docSnap.data());
        logs.sort((a, b) => getLogTimeValue(b) - getLogTimeValue(a));

        let html = '';
        logs.forEach((data) => {
            const date = new Date(getLogTimeValue(data) || Date.now());
            const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
            const { icon, color } = getLogVisual(data);
            const label = data.targetId || data.element || '-';

            html += `
                <div style="background: rgba(255,255,255,0.03); border-left: 3px solid ${color}; padding: 0.75rem 1rem; border-radius: 6px; display: flex; align-items: flex-start; gap: 1rem;">
                    <div style="font-size: 1.25rem; line-height: 1;">${icon}</div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${data.system}: ${data.action}</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">${dateStr} ${timeStr}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 0.15rem;">${label}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${data.details || '-'}</div>
                    </div>
                </div>
            `;
        });

        logContainer.innerHTML = html;

    } catch (err) {
        console.error("Failed to fetch activity logs:", err);
        logContainer.innerHTML = `<p style="color: var(--danger); text-align: center; font-size: 0.875rem;">Kunde inte ladda loggar.</p>`;
    }
}

// Deprecated compatibility shims for non-core legacy bindings.
window.handleInventoryUpload = handleInventoryUpload;
window.filterInventory = filterInventory;
window.addInventoryToBasket = addInventoryToBasket;
window.removeInventoryFromBasket = removeInventoryFromBasket;
window.openInventoryModal = openInventoryModal;
window.closeInventoryModal = closeInventoryModal;
window.saveInventoryItem = saveInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;
window.toggleInventory = toggleInventory;
window.toggleClickitupInventory = toggleClickitupInventory;
window.updateClickitupStock = updateClickitupStock;
window.runFirebaseMigration = runFirebaseMigration;
window.renderPendingChanges = renderPendingChanges;
window.commitInventoryChanges = commitInventoryChanges;
window.fetchActivityLogs = fetchActivityLogs;



