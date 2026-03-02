// features/stepSummary.js — Step 4: Summary, Totals, Customer Info

import { state } from '../services/stateManager.js';
import { parseLocalFloat, getUnitSekPrice } from './utils.js';

/**
 * Calculate all totals from the current state.
 * @returns {{ totals, grossTotalSek, totalDiscountSek, finalTotalSek, globalDiscountAmt }}
 */
export function calculateTotals() {
    let totals = [];
    let grossTotalSek = 0;
    let totalDiscountSek = 0;

    // Builder
    state.builderItems.forEach((item) => {
        let baseEur = 0;
        if (item.line && item.model && item.size) {
            const mData = catalogData[item.line]?.models[item.model];
            const sData = mData?.sizes[item.size];
            baseEur = parseLocalFloat(sData?.price || 0);
        }
        let baseSek = getUnitSekPrice(baseEur, item.line);
        let qty = parseInt(item.qty) || 1;
        let reklUtpris = baseSek * qty;
        let discPct = parseLocalFloat(item.discountPct);
        let discSek = reklUtpris * (discPct / 100);
        let ertPris = reklUtpris - discSek;

        grossTotalSek += reklUtpris;
        totalDiscountSek += discSek;

        totals.push({
            model: `${item.line} ${item.model}`,
            size: item.size,
            unitPrice: baseSek,
            qty: item.qty,
            gross: reklUtpris,
            discountPct: discPct,
            discountSek: discSek,
            net: ertPris,
            isAddon: false
        });

        if (item.addons) {
            item.addons.forEach(addon => {
                const modelData = catalogData[item.line].models[item.model];
                let addonDef = null;

                if (modelData.addonCategories) {
                    for (const cat of modelData.addonCategories) {
                        addonDef = cat.items.find(a => a.id === addon.id);
                        if (addonDef) break;
                    }
                } else if (modelData.addons) {
                    addonDef = modelData.addons.find(a => a.id === addon.id);
                }

                let aBaseEur = addonDef ? parseLocalFloat(addonDef.price) : 0;
                let aBaseSek = getUnitSekPrice(aBaseEur, item.line);
                let aQty = parseInt(addon.qty) || 1;
                let aRekUtpris = aBaseSek * aQty;
                let aDiscPct = parseLocalFloat(addon.discountPct);
                let aDiscSek = aRekUtpris * (aDiscPct / 100);
                let aNet = aRekUtpris - aDiscSek;

                grossTotalSek += aRekUtpris;
                totalDiscountSek += aDiscSek;

                totals.push({
                    model: `  + Tillval: ${addonDef ? addonDef.name : addon.id}`,
                    size: "-",
                    unitPrice: aBaseSek,
                    qty: addon.qty,
                    gross: aRekUtpris,
                    discountPct: aDiscPct,
                    discountSek: aDiscSek,
                    net: aNet,
                    isAddon: true
                });
            });
        }
    });

    // Grid
    Object.keys(state.gridSelections).forEach(line => {
        const lineData = catalogData[line];
        const gState = state.gridSelections[line];

        Object.keys(gState.items).forEach(key => {
            const [model, size] = key.split("|");
            const gItem = gState.items[key];

            let basePrice = 0;
            lineData.gridItems.forEach(group => {
                if (group.model === model) {
                    const sz = group.sizes.find(s => s.size === size);
                    if (sz) basePrice = parseLocalFloat(sz.price);
                }
            });

            let baseSek = getUnitSekPrice(basePrice, line);
            let rekUtpris = baseSek * gItem.qty;
            let discSek = rekUtpris * (gItem.discountPct / 100);
            let ertPris = rekUtpris - discSek;

            grossTotalSek += rekUtpris;
            totalDiscountSek += discSek;

            totals.push({
                model: model,
                size: size,
                unitPrice: baseSek,
                qty: gItem.qty,
                gross: rekUtpris,
                discountPct: gItem.discountPct,
                discountSek: discSek,
                net: ertPris,
                isAddon: false
            });
        });

        Object.keys(gState.addons).forEach(id => {
            const gAddon = gState.addons[id];

            let basePrice = 0;
            let name = "";
            lineData.addonCategories.forEach(cat => {
                const aDef = cat.items.find(i => i.id === id);
                if (aDef) { basePrice = parseLocalFloat(aDef.price); name = aDef.name; }
            });

            let baseSek = getUnitSekPrice(basePrice, line);
            let rekUtpris = baseSek * gAddon.qty;
            let discSek = rekUtpris * (gAddon.discountPct / 100);
            let ertPris = rekUtpris - discSek;

            grossTotalSek += rekUtpris;
            totalDiscountSek += discSek;

            totals.push({
                model: `  + Tillval: ${name}`,
                size: "-",
                unitPrice: baseSek,
                qty: gAddon.qty,
                gross: rekUtpris,
                discountPct: gAddon.discountPct,
                discountSek: discSek,
                net: ertPris,
                isAddon: true
            });
        });
    });

    // Custom Costs
    state.customCosts.forEach(cost => {
        let cPrice = parseLocalFloat(cost.price);
        let cQty = parseInt(cost.qty) || 1;
        let cTotal = cPrice * cQty;

        grossTotalSek += cTotal;

        totals.push({
            model: `Övrigt: ${cost.description || 'Kostnad'}`,
            size: "-",
            unitPrice: cPrice,
            qty: cQty,
            gross: cTotal,
            discountPct: 0,
            discountSek: 0,
            net: cTotal,
            isAddon: false,
            isCustom: true
        });
    });

    // Global discount is used as an editor helper for line discounts only.
    // It must not be applied as an additional discount in final totals.
    let globalDiscountAmt = 0;
    let finalTotalSek = grossTotalSek - totalDiscountSek;

    return { totals, grossTotalSek, totalDiscountSek, finalTotalSek, globalDiscountAmt };
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

    summaryData.totals.forEach(t => {
        const tr = document.createElement('tr');
        if (t.isAddon) tr.style.color = "var(--text-secondary)";
        if (t.isCustom) tr.style.fontStyle = "italic";
        tr.innerHTML = `
            <td>${t.model}</td>
            <td>${t.size}</td>
            <td class="text-right">${fmt(t.unitPrice)} SEK</td>
            <td>${t.qty}</td>
            <td class="text-right" style="font-weight:600;">${fmt(t.net)} SEK</td>
            <td class="text-right">${fmt(t.gross)} SEK</td>
            <td class="text-right" style="color:var(--danger-color)">- ${fmt(t.discountSek)} SEK</td>
            <td class="text-right" style="color:var(--danger-color)">${t.discountPct}%</td>
        `;
        tbody.appendChild(tr);
    });

    if (summaryData.globalDiscountAmt > 0) {
        const globalTr = document.createElement('tr');
        globalTr.innerHTML = `
            <td colspan="5"><i>Övergripande Offertrabatt (${state.globalDiscountPct}%)</i></td>
            <td class="text-right">-</td>
            <td class="text-right" style="color:var(--danger-color)">- ${fmt(summaryData.globalDiscountAmt)} SEK</td>
            <td class="text-right">-</td>
        `;
        tbody.appendChild(globalTr);
    }

    const totalTr = document.createElement('tr');
    totalTr.innerHTML = `
        <td colspan="4" style="font-weight: 600;">Totalt Exkl. Moms</td>
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
            <td colspan="4">TOTALT ATT BETALA (Ink. Moms)</td>
            <td class="text-right" style="color:var(--success-color); font-size:1.25rem;">${fmt(grossWithVat)} SEK</td>
            <td colspan="3"></td>
        `;
        tbody.appendChild(totalIncVatTr);
    } else {
        totalTr.className = 'total-row';
        totalTr.querySelector('td:first-child').textContent = 'TOTALBELOPP';
        totalTr.querySelector('td:nth-child(2)').style.color = "var(--success-color)";
        totalTr.querySelector('td:nth-child(2)').style.fontSize = "1.25rem";
    }

    DOM.summaryContainer.appendChild(table);
    setTimeout(updatePDFPreview, 200);
}

/**
 * Populate the customer info input fields from state (handles hydration from saved quotes).
 */
export function initCustomerInfoFields() {
    const fields = ['custName', 'custCompany', 'custReference', 'custDate', 'custValidity'];
    fields.forEach(id => {
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
