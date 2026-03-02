// app.js

import { db, doc, getDoc, setDoc, updateDoc, increment, collection, writeBatch, query, orderBy, limit, getDocs, deleteDoc, runTransaction } from "./services/firebase.js";
import { currentUser, logout } from './services/authService.js';
import { state, loadState, clearState, initStatePersistence, markStateDirty, flushStateNow } from "./services/stateManager.js";
import { createQuoteRepository } from './services/quoteRepository.js';
import {
    fetchInventory,
    fetchActivityLogs,
    renderBasket,
    initInventoryManager,
    handleInventoryUpload,
    filterInventory,
    openInventoryModal,
    closeInventoryModal,
    saveInventoryItem
} from './features/inventoryManager.js';
import { generatePDF } from "./features/pdfExport.js?v=20260302-4";
import { generateExcel } from "./features/excelExport.js";
import { parseLocalFloat, formatLocalFloat } from "./features/utils.js";
import { renderProductLines as _renderProductLines } from "./features/stepProductLines.js";
import { renderConfigStep as _renderConfigStep, addNewBuilderItem as _addNewBuilderItem } from "./features/stepConfig.js";
import { renderPricingStep as _renderPricingStep, renderCustomCosts as _renderCustomCosts } from "./features/stepPricing.js";
import { calculateTotals as _calculateTotals, renderSummaryStep as _renderSummaryStep, initCustomerInfoFields as _initCustomerInfoFields } from "./features/stepSummary.js";
import { initNotifications, notifySuccess, notifyError, notifyWarn, notifyInfo } from "./services/notificationService.js";

const DOM = {
    steps: [
        document.getElementById('step0'),
        document.getElementById('step1'),
        document.getElementById('step2'),
        document.getElementById('step3'),
        document.getElementById('step4')
    ],
    indicators: document.querySelectorAll('.step-indicator'),

    // Step 1
    productLinesGroup: document.getElementById('productLinesGroup'),
    btnUploadPrices: document.getElementById('btnUploadPrices'),
    excelUpload: document.getElementById('excelUpload'),
    btnNext1: document.getElementById('btnNext1'),

    // Inventory elements
    inventorySection: document.getElementById('inventorySection'),
    btnUploadInventory: document.getElementById('btnUploadInventory'),
    inventoryUpload: document.getElementById('inventoryUpload'),
    inventorySearch: document.getElementById('inventorySearch'),
    inventoryTableBody: document.getElementById('inventoryTableBody'),
    btnNewInventoryItem: document.getElementById('btnNewInventoryItem'),

    // ClickitUP Inventory elements
    clickitupInventorySection: document.getElementById('clickitupInventorySection'),
    clickitupInventoryToggleIcon: document.getElementById('clickitupInventoryToggleIcon'),
    clickitupInventoryContent: document.getElementById('clickitupInventoryContent'),
    clickitupInventoryTableBody: document.getElementById('clickitupInventoryTableBody'),

    // Pending Changes Panel
    pendingChangesPanel: document.getElementById('pendingChangesPanel'),
    pendingChangesList: document.getElementById('pendingChangesList'),
    pendingChangesCount: document.getElementById('pendingChangesCount'),
    btnSaveInventoryChanges: document.getElementById('btnSaveInventoryChanges'),
    pendingChangesEmptyState: document.getElementById('pendingChangesEmptyState'),

    // Inventory Modal
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

    // Step 2
    configContainer: document.getElementById('configContainer'),
    btnAddItem: document.getElementById('btnAddItem'),
    btnPrev2: document.getElementById('btnPrev2'),
    btnNext2: document.getElementById('btnNext2'),

    // Step 3
    pricingContainer: document.getElementById('pricingContainer'),
    customCostsContainer: document.getElementById('customCostsContainer'),
    btnAddCustomCost: document.getElementById('btnAddCustomCost'),
    globalDiscount: document.getElementById('globalDiscount'),
    globalExchangeRate: document.getElementById('globalExchangeRate'),
    btnPrev3: document.getElementById('btnPrev3'),
    btnNext3: document.getElementById('btnNext3'),

    // Step 4
    summaryContainer: document.getElementById('summaryContainer'),
    btnPrev4: document.getElementById('btnPrev4'),
    toggleVat: document.getElementById('toggleVat'),
    btnSaveQuote: document.getElementById('btnSaveQuote'),
    btnExportPDF: document.getElementById('btnExportPDF'),
    btnExportExcel: document.getElementById('btnExportExcel'),

    // Shopping Basket
    shoppingBasket: document.getElementById('shoppingBasket'),
    basketCount: document.getElementById('basketCount'),
    basketItems: document.getElementById('basketItems')
};

// Numeric parsing & formatting imported from features/utils.js
const quoteLifecycleEnabled = typeof window === 'undefined'
    ? true
    : window.FEATURE_QUOTE_LIFECYCLE !== false;

const modalState = {
    activeModal: null,
    triggerEl: null,
    keyHandler: null
};

const quoteRepository = createQuoteRepository({
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    runTransaction
});

function setupModalAccessibility(modalId, closeHandler) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeHandler();
        }
    });
}

function trapFocusInModal(modal) {
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const keyHandler = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            if (modal.id === 'sketchModal') closeSketchTool();
            if (modal.id === 'inventoryPreviewOverlay') closeInventoryPreviewOverlay();
            return;
        }

        if (event.key !== 'Tab') return;
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    };

    if (modalState.keyHandler) document.removeEventListener('keydown', modalState.keyHandler);
    modalState.keyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);
    first.focus();
}

function releaseModalFocus() {
    if (modalState.keyHandler) {
        document.removeEventListener('keydown', modalState.keyHandler);
        modalState.keyHandler = null;
    }
    if (modalState.triggerEl && typeof modalState.triggerEl.focus === 'function') {
        modalState.triggerEl.focus();
    }
    modalState.triggerEl = null;
    modalState.activeModal = null;
}

// Initialize
function init() {
    initNotifications();
    initStatePersistence({ debounceMs: 750 });
    initInventoryManager({ goToStep, onStateChange: markStateDirty });
    setupModalAccessibility('sketchModal', closeSketchTool);
    setupModalAccessibility('inventoryPreviewOverlay', closeInventoryPreviewOverlay);
    setupModalAccessibility('inventoryModal', closeInventoryModal);

    // Load custom catalog if exists
    try {
        const storedCatalog = localStorage.getItem('Offertverktyg_CatalogData');
        if (storedCatalog) {
            window.catalogData = JSON.parse(storedCatalog);
        }
    } catch (e) {
        console.error("Failed to load custom catalog", e);
    }

    loadState();
    renderProductLines();
    setupEventListeners();
    fetchInventory(); // Loads Firestore DB on startup
    fetchActivityLogs(); // Loads Dashboard Activity Feed

    // If we have saved state, restore the UI to the correct step
    if (state.selectedLines.length > 0) {
        // Re-check the product line checkboxes
        const checkboxes = DOM.productLinesGroup.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (state.selectedLines.includes(cb.value)) cb.checked = true;
        });
        DOM.btnNext1.disabled = false;

        if (state.step >= 2) {
            // Initialize grid state objects if necessary
            const gridLines = state.selectedLines.filter(l => catalogData[l].type === 'grid');
            gridLines.forEach(l => {
                if (!state.gridSelections[l]) {
                    state.gridSelections[l] = { items: {}, addons: {} };
                }
            });
            renderConfigStep();
        }
        if (state.step >= 3) renderPricingStep();
        if (state.step >= 4) {
            renderSummaryStep();
            initCustomerInfoFields();
            if (DOM.toggleVat) DOM.toggleVat.checked = state.includesVat;
            // Restore T&C state
            const termsArea = document.getElementById('termsTextArea');
            const termsToggle = document.getElementById('toggleTerms');
            if (termsArea) termsArea.value = state.termsText || '';
            if (termsToggle) termsToggle.checked = state.includeTerms !== false;
        }

        goToStep(state.step);
    } else {
        // Force the app to show the dashboard if no state exists
        goToStep(0);
    }
}

function startNewQuote() {
    state.step = 1;
    state.activeQuoteId = null;
    state.activeQuoteVersion = 0;
    state.quoteStatus = 'draft';
    flushStateNow();

    // Ensure the inventory panel is hidden if it was left open
    if (DOM.inventorySection) DOM.inventorySection.style.display = 'none';
    if (DOM.clickitupInventorySection) DOM.clickitupInventorySection.style.display = 'none';

    goToStep(1);

    // Explicitly hide STEP 0 to ensure clean transition
    if (DOM.steps[0]) DOM.steps[0].classList.remove('active');
}

function openInventoryManager() {
    state.step = 1; // Technically Step 1 layout, but purposed for inventory
    flushStateNow();

    // Force open tables
    if (DOM.inventorySection) DOM.inventorySection.style.display = 'block';
    if (DOM.clickitupInventorySection) DOM.clickitupInventorySection.style.display = 'block';

    goToStep(1);

    if (DOM.steps[0]) DOM.steps[0].classList.remove('active');

    // Scroll to the inventory tables
    if (DOM.inventorySection) {
        DOM.inventorySection.scrollIntoView({ behavior: 'smooth' });
    }
}

function openSketchTool(triggerEl = null) {
    const modal = document.getElementById('sketchModal');
    if (!modal) return;
    modalState.triggerEl = triggerEl || document.activeElement;
    modalState.activeModal = modal;
    modal.style.display = 'flex';
    trapFocusInModal(modal);
}

function closeSketchTool() {
    const modal = document.getElementById('sketchModal');
    if (!modal) return;
    modal.style.display = 'none';
    releaseModalFocus();
}

function closeInventoryPreviewOverlay() {
    const overlay = document.getElementById('inventoryPreviewOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    releaseModalFocus();
}

async function saveQuoteToHistory() {
    const user = currentUser();
    if (!user) {
        notifyWarn('Du maste vara inloggad for att spara offerter.');
        return;
    }

    const summaryData = calculateTotals();
    const basePayload = {
        user,
        state,
        summary: summaryData,
        customerInfo: state.customerInfo || {},
        status: state.quoteStatus || 'draft'
    };

    try {
        if (!quoteLifecycleEnabled) {
            const quoteId = `quote_${Date.now()}`;
            const snapshot = {
                timestamp: new Date().toISOString(),
                customerName: state.customerInfo.name || 'Okänd kund',
                company: state.customerInfo.company || '',
                reference: state.customerInfo.reference || '-',
                totalSek: summaryData.finalTotalSek,
                savedBy: user.email,
                savedByUid: user.uid,
                state: JSON.parse(JSON.stringify(state))
            };
            const docRef = doc(db, 'users', user.uid, 'quotes', quoteId);
            await setDoc(docRef, snapshot);
            notifySuccess('Offerten har sparats till "Mina Offerter".');
            return;
        }

        let saved;
        if (!state.activeQuoteId) {
            saved = await quoteRepository.createQuote(basePayload);
            state.activeQuoteId = saved.quoteId;
        } else {
            saved = await quoteRepository.saveQuoteRevision({
                ...basePayload,
                quoteId: state.activeQuoteId
            });
        }

        state.activeQuoteVersion = saved?.metadata?.latestVersion || saved?.revision?.version || 1;
        state.quoteStatus = saved?.metadata?.status || state.quoteStatus || 'draft';
        markStateDirty();
        notifySuccess(`Offerten sparades (version ${state.activeQuoteVersion}) i "Mina Offerter".`);
    } catch (err) {
        console.error('Failed to save quote:', err);
        notifyError('Kunde inte spara offerten: ' + err.message);
    }
}

function handleActionKeyboard(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    if (actionEl.tagName === 'A' && event.key === ' ') {
        event.preventDefault();
        actionEl.click();
        return;
    }

    if (actionEl.getAttribute('role') === 'button') {
        event.preventDefault();
        actionEl.click();
    }
}

async function handleAppAction(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    if (!action) return;
    if (actionEl.tagName === 'A') event.preventDefault();

    switch (action) {
        case 'clear-state':
            clearState();
            break;
        case 'logout':
            await logout();
            window.location.href = 'login.html';
            break;
        case 'start-quote':
            startNewQuote();
            break;
        case 'open-inventory':
            openInventoryManager();
            break;
        case 'open-sketch':
            openSketchTool(actionEl);
            break;
        case 'close-sketch':
            closeSketchTool();
            break;
        default:
            break;
    }
}

function setupEventListeners() {
    document.body.addEventListener('click', handleAppAction);
    document.body.addEventListener('keydown', handleActionKeyboard);

    // Navigation
    DOM.btnNext1.addEventListener('click', () => {
        // Initialize builder items if necessary
        const builderLines = state.selectedLines.filter(l => catalogData[l].type === 'builder');
        if (builderLines.length > 0 && state.builderItems.length === 0) {
            addNewBuilderItem(builderLines[0]);
        }

        // Initialize grid state objects if necessary
        const gridLines = state.selectedLines.filter(l => catalogData[l].type === 'grid');
        gridLines.forEach(l => {
            if (!state.gridSelections[l]) {
                state.gridSelections[l] = { items: {}, addons: {} };
            }
        });

        renderConfigStep();
        goToStep(2);
        markStateDirty();
    });

    DOM.btnPrev2.addEventListener('click', () => goToStep(1));
    DOM.btnNext2.addEventListener('click', () => {
        renderPricingStep();
        goToStep(3);
        markStateDirty();
    });

    DOM.btnPrev3.addEventListener('click', () => goToStep(2));
    DOM.btnNext3.addEventListener('click', () => {
        renderSummaryStep();
        initCustomerInfoFields();
        goToStep(4);
        markStateDirty();
    });

    DOM.btnPrev4.addEventListener('click', () => goToStep(3));

    // Actions
    DOM.btnAddItem.addEventListener('click', () => {
        const builderLines = state.selectedLines.filter(l => catalogData[l].type === 'builder');
        if (builderLines.length > 0) {
            addNewBuilderItem(builderLines[0]);
            renderConfigStep();
            markStateDirty();
        }
    });

    DOM.globalDiscount.addEventListener('input', (e) => {
        const val = parseLocalFloat(e.target.value);
        const prevVal = state.prevGlobalDiscountPct;
        state.globalDiscountPct = val;

        // Auto-scale individual discounts ONLY if they match the previous global discount
        // (This preserves manually entered individual discounts)
        state.builderItems.forEach(item => {
            if (item.discountPct === prevVal) item.discountPct = val;
            if (item.addons) {
                item.addons.forEach(a => {
                    if (a.discountPct === prevVal) a.discountPct = val;
                });
            }
        });

        Object.keys(state.gridSelections).forEach(line => {
            const gState = state.gridSelections[line];
            Object.keys(gState.items).forEach(key => {
                if (gState.items[key].discountPct === prevVal) gState.items[key].discountPct = val;
            });
            Object.keys(gState.addons).forEach(key => {
                if (gState.addons[key].discountPct === prevVal) gState.addons[key].discountPct = val;
            });
        });

        state.prevGlobalDiscountPct = val;

        // Re-render to show updated values visually
        if (state.step === 3) {
            renderPricingStep();
        }
        markStateDirty();
    });

    DOM.globalDiscount.addEventListener('blur', (e) => {
        e.target.value = formatLocalFloat(state.globalDiscountPct);
    });

    if (DOM.globalExchangeRate) {
        DOM.globalExchangeRate.addEventListener('input', (e) => {
            const val = parseLocalFloat(e.target.value);
            if (val > 0) {
                state.exchangeRate = val;
                if (state.step === 3) {
                    renderPricingStep();
                }
                markStateDirty();
            }
        });
        DOM.globalExchangeRate.addEventListener('blur', (e) => {
            e.target.value = formatLocalFloat(state.exchangeRate);
        });
    }

    if (DOM.btnAddCustomCost) {
        DOM.btnAddCustomCost.addEventListener('click', () => {
            state.customCosts.push({ description: '', price: 0, qty: 1 });
            renderCustomCosts();
            markStateDirty();
        });
    }

    DOM.btnExportPDF.addEventListener('click', async () => {
        await exportPDFToDisk();
    });
    DOM.btnExportExcel.addEventListener('click', () => exportExcel());
    if (DOM.btnSaveQuote) {
        DOM.btnSaveQuote.addEventListener('click', saveQuoteToHistory);
    }

    if (DOM.btnUploadPrices && DOM.excelUpload) {
        DOM.btnUploadPrices.addEventListener('click', () => {
            DOM.excelUpload.click();
        });
        DOM.excelUpload.addEventListener('change', handleExcelUpload);
    }

    if (DOM.btnUploadInventory && DOM.inventoryUpload) {
        DOM.btnUploadInventory.addEventListener('click', () => {
            DOM.inventoryUpload.click();
        });
        DOM.inventoryUpload.addEventListener('change', handleInventoryUpload);
    }

    if (DOM.inventorySearch) {
        DOM.inventorySearch.addEventListener('input', filterInventory);
    }

    // Modal Handlers
    if (DOM.btnNewInventoryItem) {
        DOM.btnNewInventoryItem.addEventListener('click', () => {
            openInventoryModal();
        });
    }
    if (DOM.btnCancelInvModal) {
        DOM.btnCancelInvModal.addEventListener('click', () => {
            closeInventoryModal();
        });
    }
    if (DOM.btnSaveInvModal) {
        DOM.btnSaveInvModal.addEventListener('click', () => {
            saveInventoryItem();
        });
    }

    // Customer Info listeners
    ['custName', 'custCompany', 'custReference', 'custDate', 'custValidity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                const key = id.replace('cust', '').toLowerCase();
                state.customerInfo[key] = e.target.value;
                markStateDirty();

                // Debounce PDF update to avoid freezing while typing
                clearTimeout(window.pdfPreviewTimeout);
                window.pdfPreviewTimeout = setTimeout(updatePDFPreview, 300);
            });
        }
    });

    // VAT Toggle
    if (DOM.toggleVat) {
        DOM.toggleVat.addEventListener('change', (e) => {
            state.includesVat = e.target.checked;
            renderSummaryStep();
            updatePDFPreview();
            markStateDirty();
        });
    }

    // Terms & Conditions
    const termsToggle = document.getElementById('toggleTerms');
    const termsArea = document.getElementById('termsTextArea');
    if (termsToggle) {
        termsToggle.addEventListener('change', (e) => {
            state.includeTerms = e.target.checked;
            markStateDirty();
            updatePDFPreview();
        });
    }
    if (termsArea) {
        // Populate on first render
        if (!termsArea.value && state.termsText) {
            termsArea.value = state.termsText;
        }
        termsArea.addEventListener('input', (e) => {
            state.termsText = e.target.value;
            markStateDirty();
        });
        // Update PDF preview on blur (not every keystroke to avoid lag)
        termsArea.addEventListener('blur', () => {
            updatePDFPreview();
        });
    }
}

function goToStep(stepNum) {
    state.step = stepNum;
    markStateDirty();

    // The DOM.steps array now has 5 elements (index 0 is step0)
    // The DOM.indicators array still has 4 elements (step1, step2, step3, step4)

    DOM.steps.forEach((el, index) => {
        if (index === stepNum) el.classList.add('active');
        else if (el) el.classList.remove('active');
    });

    DOM.indicators.forEach((el, index) => {
        if (stepNum > 0 && index + 1 === stepNum) el.classList.add('active');
        else if (el) el.classList.remove('active');
    });

    // Handle basket visibility globally based on step
    if (typeof renderBasket === 'function') {
        const basketWrap = document.getElementById('basketWrapper');
        if (basketWrap) {
            if (stepNum === 0 || stepNum === 4) {
                basketWrap.style.display = 'none'; // Hide on dashboard and final summary
            } else {
                basketWrap.style.display = 'block';
                renderBasket();
            }
        } else {
            renderBasket();
        }
    }
}

// ---------------------------
// STEP 1: Product Lines (delegated to features/stepProductLines.js)
// ---------------------------
function renderProductLines() {
    _renderProductLines(DOM);
}

// ---------------------------
// STEP 2: Configuration (delegated to features/stepConfig.js)
// ---------------------------
function addNewBuilderItem(lineName) {
    _addNewBuilderItem(lineName);
}

function renderConfigStep() {
    _renderConfigStep(DOM);
}

// getUnitSekPrice imported from features/utils.js

// ---------------------------
// STEP 3: Pricing & Discounts (delegated to features/stepPricing.js)
// ---------------------------
function renderPricingStep() { _renderPricingStep(DOM); }
function renderCustomCosts() { _renderCustomCosts(DOM); }

// ---------------------------
// STEP 4: Summary & Export (delegated to features/stepSummary.js)
// ---------------------------
function calculateTotals() { return _calculateTotals(); }
function renderSummaryStep() { _renderSummaryStep(DOM, updatePDFPreview); }
function initCustomerInfoFields() { _initCustomerInfoFields(); }

// ---------------------------
// EXPORTS
// ---------------------------
let isExportingPdf = false;

function buildPdfFileName() {
    const rawRef = state.customerInfo?.reference?.trim();
    const rawName = state.customerInfo?.name?.trim();
    const date = state.customerInfo?.date || new Date().toISOString().slice(0, 10);

    const base = rawRef || rawName || 'Offert';
    const safeBase = base
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);

    return `${safeBase || 'Offert'}-${date}.pdf`;
}

function downloadBlob(blob, fileName) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
}

async function saveBlobWithPicker(blob, fileName) {
    if (typeof window.showSaveFilePicker !== 'function') {
        return 'unavailable';
    }

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
                {
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] }
                }
            ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return 'saved';
    } catch (err) {
        if (err && err.name === 'AbortError') {
            return 'canceled';
        }
        console.error('showSaveFilePicker failed, using download fallback:', err);
        return 'failed';
    }
}

function exportPDF(returnBlob = false) {
    const summaryData = calculateTotals();
    const pdfBlob = generatePDF(state, summaryData, true);
    if (!pdfBlob) return null;
    if (returnBlob) return pdfBlob;

    downloadBlob(pdfBlob, buildPdfFileName());
    return null;
}

async function exportPDFToDisk() {
    const fileName = buildPdfFileName();
    const pdfBlob = exportPDF(true);
    if (!pdfBlob) {
        notifyError('Kunde inte skapa PDF.');
        return;
    }

    isExportingPdf = true;
    try {
        const pickerResult = await saveBlobWithPicker(pdfBlob, fileName);
        if (pickerResult === 'saved') {
            notifyInfo(`PDF sparad: ${fileName}`);
            return;
        }
        if (pickerResult === 'canceled') {
            notifyWarn('PDF-export avbröts.');
            return;
        }

        if (pickerResult === 'failed') {
            notifyWarn('Kunde inte öppna spara-dialog. Använder nedladdning istället.');
        }
        if (pickerResult === 'failed' || pickerResult === 'unavailable') {
            downloadBlob(pdfBlob, fileName);
            notifyInfo(`PDF nedladdad: ${fileName}`);
        }
    } finally {
        isExportingPdf = false;
    }
}

function updatePDFPreview() {
    if (isExportingPdf) return;
    const iframe = document.getElementById('pdfPreviewFrame');
    if (!iframe) return;
    const pdfBlob = exportPDF(true);
    if (!pdfBlob) return;

    const previousUrl = iframe.dataset.previewUrl;
    if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
    }

    const blobUrl = URL.createObjectURL(pdfBlob);
    iframe.dataset.previewUrl = blobUrl;
    iframe.src = `${blobUrl}#toolbar=0&navpanes=0&statusbar=0&view=FitH`;
}

function exportExcel() {
    const summaryData = calculateTotals();
    generateExcel(state, summaryData);
}
function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let updatedCount = 0;

            // Update BaHaMa Jumbrella
            if (workbook.Sheets['BaHaMa Jumbrella']) {
                const sheet = workbook.Sheets['BaHaMa Jumbrella'];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Expecting column 0 = Size (e.g. "3x3 Kvadrat"), column 1 = Price
                json.forEach(row => {
                    if (row.length >= 2) {
                        const size = row[0];
                        const price = parseFloat(row[1]);
                        if (size && !isNaN(price) && catalogData.BaHaMa.models.Jumbrella.sizes[size]) {
                            catalogData.BaHaMa.models.Jumbrella.sizes[size].price = price;
                            updatedCount++;
                        }
                    }
                });
            }

            // Update ClickitUP
            if (workbook.Sheets['ClickitUP']) {
                const sheet = workbook.Sheets['ClickitUP'];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Expecting column 0 = id/name, column 1 = Price
                json.forEach(row => {
                    if (row.length >= 2) {
                        const id = String(row[0]).trim();
                        const price = parseFloat(row[1]);

                        if (id && !isNaN(price)) {
                            // Search all ClickitUP items recursively
                            let found = false;

                            // Check base grid items
                            catalogData.ClickitUP.gridItems.forEach(group => {
                                group.sizes.forEach(sizeRow => {
                                    if (`${group.model}|${sizeRow.size}` === id || group.model === id || sizeRow.size === id) {
                                        sizeRow.price = price;
                                        updatedCount++;
                                        found = true;
                                    }
                                });
                            });

                            // Check addons
                            if (!found && catalogData.ClickitUP.addonCategories) {
                                catalogData.ClickitUP.addonCategories.forEach(category => {
                                    category.items.forEach(item => {
                                        if (item.id === id || item.name === id) {
                                            item.price = price;
                                            updatedCount++;
                                            found = true;
                                        }
                                    });
                                });
                            }
                        }
                    }
                });
            }

            if (updatedCount > 0) {
                localStorage.setItem('Offertverktyg_CatalogData', JSON.stringify(catalogData));
                notifySuccess(`Prislistan uppdaterad! ${updatedCount} priser uppdaterades.`);
                location.reload();
            } else {
                notifyWarn("Kunde inte hitta matchande produkter/storlekar att uppdatera i Excel-filen.");
            }
        } catch (err) {
            console.error(err);
            notifyError("Ett fel uppstod vid inlasning av Excel-filen: " + err.message);
        }

        // Reset file input so it can be re-selected
        DOM.excelUpload.value = "";
    };
    reader.readAsArrayBuffer(file);
}

// Deprecated compatibility shims for legacy hooks.
window.openSketchTool = () => openSketchTool();
window.closeSketchTool = closeSketchTool;
window.startNewQuote = startNewQuote;
window.openInventoryManager = openInventoryManager;
window.clearState = clearState;
window.exportPDF = exportPDF;
window.exportExcel = exportExcel;

// Boot
document.addEventListener('DOMContentLoaded', init);
