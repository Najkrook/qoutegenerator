// features/stepSummary.js - Step 4: Summary, Totals, Customer Info

import { state } from '../services/stateManager.js';
import { computeQuoteTotals } from '../services/calculationEngine.js';
import { escapeHtml } from './utils.js';

/**
 * Calculate all totals from the current state.
 * @returns {{ totals, grossTotalSek, totalDiscountSek, finalTotalSek, globalDiscountAmt }}
 */
export function calculateTotals() {
    const sourceCatalog = (typeof window !== 'undefined' && window.catalogData)
        ? window.catalogData
        : (typeof globalThis !== 'undefined' ? globalThis.catalogData : {});

    return computeQuoteTotals({
        state,
        catalogData: sourceCatalog
    });
}

/**
 * Render the Step 4 summary table.
 * @param {object} DOM - The cached DOM references object
 * @param {function} updatePDFPreview - Function to trigger PDF preview update
 */
export function renderSummaryStep(DOM, updatePDFPreview) {
    DOM.summaryContainer.innerHTML = '';

    const summaryData = calculateTotals();
    const fmt = (num) => Math.round(num).toLocaleString('sv-SE');

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Modell</th>
                <th>Storlek</th>
                <th class="text-right">Pris/enhet</th>
                <th>Antal</th>
                <th class="text-right">Ert Pris</th>
                <th class="text-right">Rek Utpris</th>
                <th class="text-right">Rabatt i SEK</th>
                <th class="text-right">Rabatt %</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    summaryData.totals.forEach((t) => {
        const tr = document.createElement('tr');
        if (t.isAddon) tr.style.color = 'var(--text-secondary)';
        if (t.isCustom) tr.style.fontStyle = 'italic';
        tr.innerHTML = `
            <td>${escapeHtml(t.model)}</td>
            <td>${escapeHtml(t.size)}</td>
            <td class="text-right">${fmt(t.unitPrice)} SEK</td>
            <td>${t.qty}</td>
            <td class="text-right" style="font-weight:600;">${fmt(t.net)} SEK</td>
            <td class="text-right">${fmt(t.gross)} SEK</td>
            <td class="text-right" style="color:var(--danger-color)">- ${fmt(t.discountSek)} SEK</td>
            <td class="text-right" style="color:var(--danger-color)">${escapeHtml(t.discountPct)}%</td>
        `;
        tbody.appendChild(tr);
    });

    if (summaryData.globalDiscountAmt > 0) {
        const globalTr = document.createElement('tr');
        globalTr.innerHTML = `
            <td colspan="5"><i>Overgripande offertrabatt (${state.globalDiscountPct}%)</i></td>
            <td class="text-right">-</td>
            <td class="text-right" style="color:var(--danger-color)">- ${fmt(summaryData.globalDiscountAmt)} SEK</td>
            <td class="text-right">-</td>
        `;
        tbody.appendChild(globalTr);
    }

    const totalTr = document.createElement('tr');
    totalTr.innerHTML = `
        <td colspan="4" style="font-weight: 600;">Totalt exkl. moms</td>
        <td class="text-right" style="font-weight:600;">${fmt(summaryData.finalTotalSek)} SEK</td>
        <td class="text-right">${fmt(summaryData.grossTotalSek)} SEK</td>
        <td class="text-right" style="color:var(--danger-color)">- ${fmt(summaryData.totalDiscountSek)} SEK</td>
        <td class="text-right">-</td>
    `;
    tbody.appendChild(totalTr);

    if (state.includesVat) {
        const vatAmount = summaryData.finalTotalSek * 0.25;
        const grossWithVat = summaryData.finalTotalSek + vatAmount;

        const vatTr = document.createElement('tr');
        vatTr.innerHTML = `
            <td colspan="4">Moms 25%</td>
            <td class="text-right">${fmt(vatAmount)} SEK</td>
            <td colspan="3"></td>
        `;
        tbody.appendChild(vatTr);

        const totalIncVatTr = document.createElement('tr');
        totalIncVatTr.className = 'total-row';
        totalIncVatTr.innerHTML = `
            <td colspan="4">TOTALT ATT BETALA (inkl. moms)</td>
            <td class="text-right" style="color:var(--success-color); font-size:1.25rem;">${fmt(grossWithVat)} SEK</td>
            <td colspan="3"></td>
        `;
        tbody.appendChild(totalIncVatTr);
    } else {
        totalTr.className = 'total-row';
        totalTr.querySelector('td:first-child').textContent = 'TOTALBELOPP';
        totalTr.querySelector('td:nth-child(2)').style.color = 'var(--success-color)';
        totalTr.querySelector('td:nth-child(2)').style.fontSize = '1.25rem';
    }

    DOM.summaryContainer.appendChild(table);
    setTimeout(updatePDFPreview, 200);
}

/**
 * Populate the customer info input fields from state (handles hydration from saved quotes).
 */
export function initCustomerInfoFields() {
    const fields = ['custName', 'custCompany', 'custEmail', 'custReference', 'custDate', 'custValidity'];
    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const key = id.replace('cust', '').toLowerCase();

        if (state.customerInfo[key]) {
            el.value = state.customerInfo[key];
        } else if (key === 'date') {
            const today = new Date().toISOString().split('T')[0];
            el.value = today;
            state.customerInfo.date = today;
        }

        state.customerInfo[key] = el.value;
    });
}
