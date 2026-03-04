// features/stepPricing.js - Step 3: Pricing & Discounts

import { state } from '../services/stateManager.js';
import { parseLocalFloat, formatLocalFloat, getUnitSekPrice, escapeHtml } from './utils.js';

/**
 * Render the pricing table in Step 3.
 * @param {object} DOM - The cached DOM references object
 */
export function renderPricingStep(DOM) {
    DOM.pricingContainer.innerHTML = '';
    DOM.globalDiscount.value = state.globalDiscountPct;

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Modell/Beskrivning</th>
                <th>Storlek</th>
                <th class="text-right">Pris/enhet (Exkl. moms)</th>
                <th>Antal</th>
                <th class="text-right">Rek Utpris (SEK)</th>
                <th>Rabatt i %</th>
                <th class="text-right">Ert Pris (SEK)</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    const fmt = (num) => Math.round(num).toLocaleString('sv-SE');

    // 1. Render Builder Items
    state.builderItems.forEach((item, index) => {
        const tr = document.createElement('tr');

        let baseEur = 0;
        if (item.line && item.model && item.size) {
            const mData = catalogData[item.line]?.models[item.model];
            const sData = mData?.sizes[item.size];
            baseEur = parseLocalFloat(sData?.price || 0);
        }

        let baseSek = getUnitSekPrice(baseEur, item.line);
        let reklUtpris = baseSek * item.qty;

        tr.innerHTML = `
            <td><strong>${escapeHtml(item.line)}:</strong> ${escapeHtml(item.model)}</td>
            <td>${escapeHtml(item.size)}</td>
            <td class="text-right">${fmt(baseSek)}</td>
            <td>${item.qty}</td>
            <td class="text-right">${fmt(reklUtpris)}</td>
            <td>
                <input type="text" value="${item.discountPct}" style="width: 80px;" class="discount-input ${item.discountPct !== state.globalDiscountPct ? 'custom-discount' : ''}">
            </td>
            <td class="text-right" id="ert_builder_${item.id}">${fmt(reklUtpris * (1 - (item.discountPct / 100)))}</td>
        `;

        const discInput = tr.querySelector('.discount-input');
        discInput.addEventListener('input', (e) => {
            item.discountPct = parseLocalFloat(e.target.value);
            const ertPrisCell = document.getElementById(`ert_builder_${item.id}`);
            if (ertPrisCell) ertPrisCell.textContent = fmt(reklUtpris * (1 - (item.discountPct / 100)));
        });
        discInput.addEventListener('blur', (e) => {
            e.target.value = formatLocalFloat(item.discountPct);
        });

        tbody.appendChild(tr);

        // Builder Addons
        if (item.addons && item.addons.length > 0) {
            item.addons.forEach((addon, aIdx) => {
                const subTr = document.createElement('tr');
                subTr.style.background = 'rgba(255,255,255,0.02)';

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

                let aBaseEur = addonDef ? addonDef.price : 0;
                let aBaseSek = getUnitSekPrice(aBaseEur, item.line);
                let aRekUtpris = aBaseSek * addon.qty;

                if (addon.discountPct === undefined) addon.discountPct = 0;

                subTr.innerHTML = `
                    <td style="padding-left: 2rem;">+ ${escapeHtml(addonDef ? addonDef.name : addon.id)}</td>
                    <td>-</td>
                    <td class="text-right" style="font-size: 0.875rem;">${fmt(aBaseSek)}</td>
                    <td style="font-size: 0.875rem;">${addon.qty}</td>
                    <td class="text-right" style="font-size: 0.875rem;">${fmt(aRekUtpris)}</td>
                    <td>
                        <input type="text" value="${addon.discountPct}" style="width: 80px; padding:0.5rem;" class="addon-discount-input ${addon.discountPct !== state.globalDiscountPct ? 'custom-discount' : ''}">
                    </td>
                    <td class="text-right" id="ert_baddon_${item.id}_${aIdx}">${fmt(aRekUtpris * (1 - (addon.discountPct / 100)))}</td>
                `;

                const aDiscInput = subTr.querySelector('.addon-discount-input');
                aDiscInput.addEventListener('input', (e) => {
                    addon.discountPct = parseLocalFloat(e.target.value);
                    const ertCell = document.getElementById(`ert_baddon_${item.id}_${aIdx}`);
                    if (ertCell) ertCell.textContent = fmt(aRekUtpris * (1 - (addon.discountPct / 100)));
                });
                aDiscInput.addEventListener('blur', (e) => {
                    e.target.value = formatLocalFloat(addon.discountPct);
                });

                tbody.appendChild(subTr);
            });
        }
    });

    // 2. Render Grid Items
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

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(line)}:</strong> ${escapeHtml(model)}</td>
                <td>${escapeHtml(size)}</td>
                <td class="text-right">${fmt(baseSek)}</td>
                <td>${gItem.qty}</td>
                <td class="text-right">${fmt(rekUtpris)}</td>
                <td>
                    <input type="text" value="${gItem.discountPct}" style="width: 80px;" class="grid-discount-input ${gItem.discountPct !== state.globalDiscountPct ? 'custom-discount' : ''}">
                </td>
                <td class="text-right" id="ert_grid_${key.replace(/[^a-zA-Z0-9]/g, "_")}">${fmt(rekUtpris * (1 - (gItem.discountPct / 100)))}</td>
            `;

            const discInput = tr.querySelector('.grid-discount-input');
            discInput.addEventListener('input', (e) => {
                gItem.discountPct = parseLocalFloat(e.target.value);
                document.getElementById(`ert_grid_${key.replace(/[^a-zA-Z0-9]/g, "_")}`).textContent = fmt(rekUtpris * (1 - (gItem.discountPct / 100)));
            });
            discInput.addEventListener('blur', (e) => {
                e.target.value = formatLocalFloat(gItem.discountPct);
            });
            tbody.appendChild(tr);
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

            const tr = document.createElement('tr');
            tr.style.background = 'rgba(255,255,255,0.02)';
            tr.innerHTML = `
                <td style="padding-left: 2rem;">+ ${escapeHtml(name)}</td>
                <td>-</td>
                <td class="text-right" style="font-size: 0.875rem;">${fmt(baseSek)}</td>
                <td style="font-size: 0.875rem;">${gAddon.qty}</td>
                <td class="text-right" style="font-size: 0.875rem;">${fmt(rekUtpris)}</td>
                <td>
                    <input type="text" value="${gAddon.discountPct}" style="width: 80px; padding:0.5rem;" class="grid-discount-input ${gAddon.discountPct !== state.globalDiscountPct ? 'custom-discount' : ''}">
                </td>
                <td class="text-right" id="ert_gaddon_${id}">${fmt(rekUtpris * (1 - (gAddon.discountPct / 100)))}</td>
            `;

            const discInput = tr.querySelector('.grid-discount-input');
            discInput.addEventListener('input', (e) => {
                gAddon.discountPct = parseLocalFloat(e.target.value);
                document.getElementById(`ert_gaddon_${id}`).textContent = fmt(rekUtpris * (1 - (gAddon.discountPct / 100)));
            });
            discInput.addEventListener('blur', (e) => {
                e.target.value = formatLocalFloat(gAddon.discountPct);
            });
            tbody.appendChild(tr);
        });
    });

    DOM.pricingContainer.appendChild(table);
    renderCustomCosts(DOM);
}

/**
 * Render the custom costs section under the pricing table.
 * @param {object} DOM - The cached DOM references object
 */
export function renderCustomCosts(DOM) {
    if (!DOM.customCostsContainer) return;
    DOM.customCostsContainer.innerHTML = '';

    if (state.customCosts.length === 0) {
        DOM.customCostsContainer.innerHTML = '<p style="color:var(--text-secondary);font-size:0.875rem;">Inga ovriga kostnader tillagda.</p>';
        return;
    }

    state.customCosts.forEach((cost, idx) => {
        const row = document.createElement('div');
        row.className = 'flex-row';
        row.style.marginBottom = '0.75rem';
        row.style.alignItems = 'flex-end';
        row.draggable = true;

        row.innerHTML = `
            <div style="cursor:grab; padding-bottom: 0.8rem; margin-right: 0.5rem; color:var(--text-secondary);">≡</div>
            <div class="form-group flex-1" style="margin-bottom:0;">
                <label>Beskrivning</label>
                <input type="text" value="${escapeHtml(cost.description)}" class="cc-desc" placeholder="T.ex. Frakt">
            </div>
            <div class="form-group" style="width:120px; margin-bottom:0;">
                <label>Pris (SEK)</label>
                <input type="text" value="${escapeHtml(cost.price)}" class="cc-price">
            </div>
            <div class="form-group" style="width:80px; margin-bottom:0;">
                <label>Antal</label>
                <input type="number" value="${escapeHtml(cost.qty)}" min="1" class="cc-qty">
            </div>
            <button class="btn-remove-cost" style="background:transparent; border:1px solid var(--danger-color); color:var(--danger-color); padding:0.75rem; border-radius:8px; cursor:pointer; height:46px;">X</button>
        `;

        row.querySelector('.cc-desc').addEventListener('input', e => cost.description = e.target.value);
        const priceInput = row.querySelector('.cc-price');
        priceInput.addEventListener('input', e => cost.price = parseLocalFloat(e.target.value));
        priceInput.addEventListener('blur', e => e.target.value = formatLocalFloat(cost.price));
        row.querySelector('.cc-qty').addEventListener('input', e => cost.qty = parseInt(e.target.value) || 1);

        row.querySelector('.btn-remove-cost').addEventListener('click', () => {
            state.customCosts.splice(idx, 1);
            renderCustomCosts(DOM);
        });

        row.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/custom-cost', idx.toString());
            e.dataTransfer.effectAllowed = 'move';
            row.style.opacity = '0.5';
        });
        row.addEventListener('dragend', () => row.style.opacity = '1');
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('application/custom-cost');
            if (!data) return;
            const draggedIndex = parseInt(data);
            if (draggedIndex !== idx && !isNaN(draggedIndex)) {
                const draggedItem = state.customCosts.splice(draggedIndex, 1)[0];
                state.customCosts.splice(idx, 0, draggedItem);
                renderCustomCosts(DOM);
            }
        });

        DOM.customCostsContainer.appendChild(row);
    });
}
