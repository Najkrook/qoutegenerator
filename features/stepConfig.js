// features/stepConfig.js — Step 2: Product Configuration (Builder + Grid)

import { state } from '../services/stateManager.js';

/**
 * Generate a short unique ID for builder items
 */
function generateId() { return Math.random().toString(36).substr(2, 9); }

/**
 * Add a new builder item to state for the given product line
 * @param {string} lineName
 */
export function addNewBuilderItem(lineName) {
    const models = Object.keys(catalogData[lineName].models);
    const defaultModel = models.length > 0 ? models[0] : null;
    const sizes = defaultModel ? Object.keys(catalogData[lineName].models[defaultModel].sizes) : [];
    const defaultSize = sizes.length > 0 ? sizes[0] : null;

    state.builderItems.push({
        id: generateId(),
        line: lineName,
        model: defaultModel,
        size: defaultSize,
        qty: 1,
        addons: [],
        discountPct: 0
    });
}

/**
 * Render the full Step 2 configuration UI (builder items + grid views)
 * @param {object} DOM - The cached DOM references object
 */
export function renderConfigStep(DOM) {
    DOM.configContainer.innerHTML = '';
    const builderLines = state.selectedLines.filter(l => catalogData[l].type === 'builder');
    const gridLines = state.selectedLines.filter(l => catalogData[l].type === 'grid');

    if (builderLines.length === 0) {
        DOM.btnAddItem.style.display = 'none';
    } else {
        DOM.btnAddItem.style.display = 'flex';
    }

    // 1. Render Builder Items (BaHaMa etc)
    state.builderItems.forEach((item, index) => {
        const section = document.createElement('div');
        section.className = 'config-section';
        section.draggable = true;

        const header = document.createElement('h3');
        header.style.cursor = "grab";
        header.innerHTML = `<span style="margin-right:0.5rem; color:var(--text-secondary);">≡</span><span>Builder Rad ${index + 1} (${item.line})</span> <button class="btn-remove-item" data-id="${item.id}">Ta bort</button>`;
        section.appendChild(header);

        section.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/builder-item', index.toString());
            e.dataTransfer.effectAllowed = 'move';
            section.style.opacity = '0.5';
        });

        section.addEventListener('dragend', () => {
            section.style.opacity = '1';
        });

        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        section.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('application/builder-item');
            if (!data) return;
            const draggedIndex = parseInt(data);
            if (draggedIndex !== index && !isNaN(draggedIndex)) {
                const draggedItem = state.builderItems.splice(draggedIndex, 1)[0];
                state.builderItems.splice(index, 0, draggedItem);
                renderConfigStep(DOM);
            }
        });

        header.querySelector('.btn-remove-item').addEventListener('click', () => {
            state.builderItems = state.builderItems.filter(i => i.id !== item.id);
            renderConfigStep(DOM);
        });

        const flexRow = document.createElement('div');
        flexRow.className = 'flex-row';

        // Line Select
        const lineGroup = document.createElement('div');
        lineGroup.className = 'form-group flex-1';
        lineGroup.innerHTML = `<label>Produktlinje</label>`;
        const lineSelect = document.createElement('select');
        builderLines.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l;
            opt.textContent = catalogData[l].name;
            if (l === item.line) opt.selected = true;
            lineSelect.appendChild(opt);
        });
        lineGroup.appendChild(lineSelect);
        flexRow.appendChild(lineGroup);

        lineSelect.addEventListener('change', (e) => {
            item.line = e.target.value;
            const newModels = Object.keys(catalogData[item.line].models);
            item.model = newModels.length > 0 ? newModels[0] : null;
            const newSizes = item.model ? Object.keys(catalogData[item.line].models[item.model].sizes) : [];
            item.size = newSizes.length > 0 ? newSizes[0] : null;
            item.addons = [];
            renderConfigStep(DOM);
        });

        // Model Select
        const modelGroup = document.createElement('div');
        modelGroup.className = 'form-group flex-1';
        modelGroup.innerHTML = `<label>Modell</label>`;
        const modelSelect = document.createElement('select');
        if (item.line) {
            Object.keys(catalogData[item.line].models).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = catalogData[item.line].models[m].name;
                if (m === item.model) opt.selected = true;
                modelSelect.appendChild(opt);
            });
        }
        modelGroup.appendChild(modelSelect);
        flexRow.appendChild(modelGroup);

        modelSelect.addEventListener('change', (e) => {
            item.model = e.target.value;
            const newSizes = item.model ? Object.keys(catalogData[item.line].models[item.model].sizes) : [];
            item.size = newSizes.length > 0 ? newSizes[0] : null;
            item.addons = [];
            renderConfigStep(DOM);
        });

        // Size Select
        const sizeGroup = document.createElement('div');
        sizeGroup.className = 'form-group flex-1';
        sizeGroup.innerHTML = `<label>Storlek</label>`;
        const sizeSelect = document.createElement('select');
        if (item.line && item.model) {
            const sizesObj = catalogData[item.line].models[item.model].sizes;
            const groups = {};
            const noGroup = [];

            Object.keys(sizesObj).forEach(s => {
                let matchedGroup = null;
                if (s.includes('Kvadrat')) matchedGroup = 'Kvadrat';
                else if (s.includes('Runda')) matchedGroup = 'Runda';
                else if (s.includes('Rektangel')) matchedGroup = 'Rektangel';

                if (matchedGroup) {
                    if (!groups[matchedGroup]) groups[matchedGroup] = [];
                    groups[matchedGroup].push(s);
                } else {
                    noGroup.push(s);
                }
            });

            noGroup.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                if (s === item.size) opt.selected = true;
                sizeSelect.appendChild(opt);
            });

            Object.keys(groups).forEach(gName => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = `--- ${gName.toUpperCase()} ---`;
                groups[gName].forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (s === item.size) opt.selected = true;
                    optgroup.appendChild(opt);
                });
                sizeSelect.appendChild(optgroup);
            });
        }
        sizeGroup.appendChild(sizeSelect);
        flexRow.appendChild(sizeGroup);

        sizeSelect.addEventListener('change', (e) => {
            item.size = e.target.value;
            if (typeof updateBuilderSum === 'function') updateBuilderSum();
        });

        // Qty Input
        const qtyGroup = document.createElement('div');
        qtyGroup.className = 'form-group';
        qtyGroup.style.width = '100px';
        qtyGroup.innerHTML = `<label>Antal</label>`;
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.value = item.qty;
        qtyGroup.appendChild(qtyInput);
        flexRow.appendChild(qtyGroup);

        // Price Summary
        const sumGroup = document.createElement('div');
        sumGroup.className = 'form-group';
        sumGroup.style.minWidth = '120px';
        sumGroup.innerHTML = `<label>Summa</label>`;
        const sumLabel = document.createElement('div');
        sumLabel.style.cssText = 'font-size:0.95rem; font-weight:600; color:var(--text-primary); padding:0.5rem 0;';
        sumGroup.appendChild(sumLabel);
        flexRow.appendChild(sumGroup);

        const updateBuilderSum = () => {
            if (item.line && item.model && item.size) {
                const sizeData = catalogData[item.line]?.models?.[item.model]?.sizes?.[item.size];
                if (sizeData) {
                    const currency = catalogData[item.line].currency || 'EUR';
                    const EUR_TO_SEK = 12.2;
                    const priceSEK = currency === 'EUR' ? Math.round(sizeData.price * EUR_TO_SEK) : sizeData.price;
                    const total = priceSEK * item.qty;
                    sumLabel.textContent = `${total.toLocaleString('sv-SE')} SEK`;
                    return;
                }
            }
            sumLabel.textContent = '';
        };
        updateBuilderSum();

        qtyInput.addEventListener('change', (e) => {
            item.qty = parseInt(e.target.value) || 1;
            updateBuilderSum();
        });

        section.appendChild(flexRow);

        // Addons Box
        if (item.line && item.model) {
            const modelData = catalogData[item.line].models[item.model];
            const hasCategories = modelData.addonCategories && modelData.addonCategories.length > 0;
            const hasFlatAddons = modelData.addons && modelData.addons.length > 0;

            if (hasCategories || hasFlatAddons) {
                const addonsWrapper = document.createElement('div');
                addonsWrapper.innerHTML = `<label style="color:var(--text-secondary); font-size:0.875rem; font-weight:500;">Tillval</label>`;
                const addonList = document.createElement('div');
                addonList.className = 'addon-list';

                const EUR_TO_SEK = 12.2;
                const renderAddonFields = (addonDef, container) => {
                    const addonItem = document.createElement('div');
                    addonItem.className = 'addon-item';
                    addonItem.style.cssText = 'display:grid; grid-template-columns: 1fr auto auto auto; align-items:center; gap:0.75rem;';

                    const existingAddon = item.addons.find(a => a.id === addonDef.id);
                    const isChecked = !!existingAddon;
                    const addonQty = isChecked ? existingAddon.qty : 1;

                    // Convert to SEK if needed
                    const currency = catalogData[item.line]?.currency || 'EUR';
                    const priceSEK = currency === 'EUR' ? Math.round(addonDef.price * EUR_TO_SEK) : addonDef.price;

                    // Checkbox + Name
                    const labelEl = document.createElement('label');
                    labelEl.style.cssText = 'display:flex; align-items:center; gap:0.4rem; cursor:pointer;';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = addonDef.id;
                    checkbox.checked = isChecked;
                    labelEl.appendChild(checkbox);
                    labelEl.append(addonDef.name);

                    // Pris
                    const prisEl = document.createElement('span');
                    prisEl.style.cssText = 'font-size:1rem; color:var(--text-secondary); white-space:nowrap;';
                    prisEl.textContent = `${priceSEK.toLocaleString('sv-SE')} SEK`;

                    // Antal
                    const qtyField = document.createElement('input');
                    qtyField.type = 'number';
                    qtyField.className = 'addon-qty';
                    qtyField.value = addonQty;
                    qtyField.min = '1';
                    qtyField.disabled = !isChecked;
                    qtyField.style.cssText = 'width:65px; font-size:1rem; padding:0.3rem 0.4rem;';

                    // Summa
                    const sumEl = document.createElement('span');
                    sumEl.style.cssText = 'font-size:1rem; font-weight:600; color:var(--text-primary); white-space:nowrap; min-width:110px; text-align:right;';
                    const updateAddonSum = () => {
                        if (checkbox.checked) {
                            const qty = parseInt(qtyField.value) || 1;
                            const total = priceSEK * qty;
                            sumEl.textContent = `= ${total.toLocaleString('sv-SE')} SEK`;
                        } else {
                            sumEl.textContent = '';
                        }
                    };
                    updateAddonSum();

                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            qtyField.disabled = false;
                            item.addons.push({ id: addonDef.id, qty: parseInt(qtyField.value) || 1 });
                        } else {
                            qtyField.disabled = true;
                            item.addons = item.addons.filter(a => a.id !== addonDef.id);
                        }
                        updateAddonSum();
                    });

                    qtyField.addEventListener('change', (e) => {
                        const tgt = item.addons.find(a => a.id === addonDef.id);
                        if (tgt) tgt.qty = parseInt(e.target.value) || 1;
                        updateAddonSum();
                    });

                    addonItem.append(labelEl, prisEl, qtyField, sumEl);
                    container.appendChild(addonItem);
                };

                if (hasCategories) {
                    modelData.addonCategories.forEach(cat => {
                        const details = document.createElement('details');
                        details.style.cssText = 'background: rgba(0,0,0,0.1); border-radius: 6px; padding: 0.5rem 1rem; margin-top: 0.75rem; border: 1px solid var(--panel-border);';

                        const summary = document.createElement('summary');
                        summary.textContent = cat.name;
                        summary.style.cssText = 'font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; font-weight: 600; outline: none; margin-bottom: 0.5rem;';

                        const innerList = document.createElement('div');
                        innerList.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;';

                        details.appendChild(summary);
                        details.appendChild(innerList);
                        addonList.appendChild(details);

                        cat.items.forEach(addonDef => renderAddonFields(addonDef, innerList));
                    });
                } else if (hasFlatAddons) {
                    modelData.addons.forEach(addonDef => renderAddonFields(addonDef, addonList));
                }

                addonsWrapper.appendChild(addonList);
                section.appendChild(addonsWrapper);
            }
        }
        DOM.configContainer.appendChild(section);
    });

    // 2. Render Grid Lines (ClickitUP)
    gridLines.forEach(line => {
        const data = catalogData[line];
        const section = document.createElement('div');
        section.className = 'config-section';
        section.innerHTML = `<h3><span>Grid View: ${data.name}</span></h3>
        <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:1rem;">Lista för ${data.name}. Fyll i Antal för de artiklar som ska ingå.</p>`;

        const table = document.createElement('table');
        table.style.cssText = 'width:100%; table-layout:fixed;';
        table.innerHTML = `
            <thead style="background:rgba(0,0,0,0.2);">
                <tr>
                    <th style="padding:0.5rem; text-align:left;">Modell</th>
                    <th style="padding:0.5rem; text-align:left;">Storlek</th>
                    <th style="padding:0.5rem; text-align:right; width:180px;">Pris/enhet (Exkl. moms)</th>
                    <th style="padding:0.5rem; width:200px;">Antal</th>
                    <th style="padding:0.5rem; text-align:right; width:130px;">Summa</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        const updateGridSummary = () => {
            let totalQty = 0;
            let totalValue = 0;
            Object.entries(state.gridSelections[line].items).forEach(([key, item]) => {
                totalQty += item.qty;
                // Find price for this item
                const [model, size] = key.split('|');
                const group = data.gridItems.find(g => g.model === model);
                const sz = group?.sizes.find(s => s.size === size);
                if (sz) totalValue += sz.price * item.qty;
            });
            const summaryEl = document.getElementById(`grid-summary-${line}`);
            if (summaryEl) summaryEl.textContent = totalQty;

            // Addon values
            Object.entries(state.gridSelections[line].addons).forEach(([addonId, addonState]) => {
                let addonPrice = 0;
                data.addonCategories.forEach(cat => {
                    const found = cat.items.find(a => a.id === addonId);
                    if (found) addonPrice = found.price;
                });
                totalValue += addonPrice * addonState.qty;
            });

            // Update grand total
            const grandEl = document.getElementById(`grid-grand-total-${line}`);
            if (grandEl) grandEl.textContent = totalValue > 0 ? `${totalValue.toLocaleString('sv-SE')} SEK` : '';

            data.addonCategories.forEach(cat => {
                cat.items.forEach(addon => {
                    if (addon.autoScale) {
                        const addonTd = document.getElementById(`addon-input-${line}-${addon.id}`);
                        if (addonTd) {
                            const addonInput = addonTd.querySelector('input');
                            if (totalQty > 0) {
                                if (addonInput) addonInput.value = totalQty;
                                state.gridSelections[line].addons[addon.id] = { qty: totalQty, discountPct: state.gridSelections[line].addons[addon.id]?.discountPct || 0 };
                            } else {
                                if (addonInput) addonInput.value = 0;
                                delete state.gridSelections[line].addons[addon.id];
                            }
                        }
                    }
                });
            });
        };


        // Items Grid
        data.gridItems.forEach(group => {
            group.sizes.forEach(sz => {
                const key = `${group.model}|${sz.size}`;
                const val = state.gridSelections[line].items[key] || { qty: '', discountPct: 0 };

                const tr = document.createElement('tr');

                // Build cells
                const tdModel = document.createElement('td');
                tdModel.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); font-size:0.875rem;';
                tdModel.textContent = group.model;

                const tdSize = document.createElement('td');
                tdSize.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); font-size:0.875rem;';
                tdSize.textContent = sz.size;

                const tdPrice = document.createElement('td');
                tdPrice.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); text-align:right; font-size:0.875rem;';
                tdPrice.textContent = `${sz.price.toLocaleString('sv-SE')} SEK`;

                // Stepper TD
                const tdQty = document.createElement('td');
                tdQty.style.cssText = 'padding:0.4rem 0.5rem; border-bottom:1px solid var(--panel-border);';

                const currentQty = val.qty || 0;
                const inputStyle = 'width:44px; text-align:center; font-weight:bold; padding:0.15rem 0.2rem; border-radius:4px; border:1px solid var(--panel-border); background:var(--input-bg, rgba(255,255,255,0.07)); color:var(--text-primary);';
                const qtyInput = document.createElement('input');
                qtyInput.type = 'number';
                qtyInput.min = '0';
                qtyInput.value = currentQty;
                qtyInput.style.cssText = inputStyle;
                const btnStyle = 'padding:0.2rem 0.45rem; border-radius:4px; border:1px solid var(--panel-border); background:var(--panel-bg); color:var(--text-primary); cursor:pointer;';
                const btnSmallStyle = btnStyle + ' font-size:0.75rem;';

                // Summa TD
                const tdSum = document.createElement('td');
                tdSum.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); text-align:right; font-size:0.875rem; font-weight:600;';
                const updateSum = (qty) => {
                    const sum = sz.price * qty;
                    tdSum.textContent = sum > 0 ? `${sum.toLocaleString('sv-SE')} SEK` : '';
                };
                updateSum(currentQty);

                const setTint = (qty) => { qtyInput.style.color = qty > 0 ? '#4ade80' : ''; };
                setTint(currentQty);

                qtyInput.addEventListener('change', (e) => {
                    const next = Math.max(0, parseInt(e.target.value) || 0);
                    qtyInput.value = next;
                    if (next > 0) {
                        state.gridSelections[line].items[key] = { qty: next, discountPct: val.discountPct };
                    } else {
                        delete state.gridSelections[line].items[key];
                    }
                    setTint(next);
                    updateSum(next);
                    updateGridSummary();
                });

                const applyDelta = (delta) => {
                    const current = state.gridSelections[line].items[key]?.qty || 0;
                    const next = Math.max(0, current + delta);
                    qtyInput.value = next;
                    if (next > 0) {
                        state.gridSelections[line].items[key] = { qty: next, discountPct: val.discountPct };
                    } else {
                        delete state.gridSelections[line].items[key];
                    }
                    setTint(next);
                    updateSum(next);
                    updateGridSummary();
                };

                const btnM6 = document.createElement('button');
                btnM6.textContent = '-6'; btnM6.style.cssText = btnSmallStyle;
                btnM6.addEventListener('click', () => applyDelta(-6));

                const btnM1 = document.createElement('button');
                btnM1.textContent = '-'; btnM1.style.cssText = btnStyle;
                btnM1.addEventListener('click', () => applyDelta(-1));

                const btnP1 = document.createElement('button');
                btnP1.textContent = '+'; btnP1.style.cssText = btnStyle;
                btnP1.addEventListener('click', () => applyDelta(1));

                const btnP6 = document.createElement('button');
                btnP6.textContent = '+6'; btnP6.style.cssText = btnSmallStyle;
                btnP6.addEventListener('click', () => applyDelta(6));

                const stepperWrap = document.createElement('div');
                stepperWrap.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:0.3rem;';
                stepperWrap.append(btnM6, btnM1, qtyInput, btnP1, btnP6);
                tdQty.appendChild(stepperWrap);

                tr.append(tdModel, tdSize, tdPrice, tdQty, tdSum);
                tbody.appendChild(tr);
            });
        });

        const trSummary = document.createElement('tr');
        trSummary.innerHTML = `
            <td colspan="3" style="padding:0.75rem 0.5rem; text-align:right; font-weight:600; font-size:0.875rem; border-bottom:1px solid var(--panel-border); background:rgba(255,255,255,0.02)">Sektioner Totalt</td>
            <td style="padding:0.75rem 0.5rem; border-bottom:1px solid var(--panel-border); font-weight:600; text-align:center; background:rgba(255,255,255,0.02)" id="grid-summary-${line}">0</td>
            <td style="border-bottom:1px solid var(--panel-border); background:rgba(255,255,255,0.02)"></td>
        `;
        tbody.appendChild(trSummary);

        // Addons Grid Separators
        data.addonCategories.forEach(cat => {
            const trHeader = document.createElement('tr');
            trHeader.innerHTML = `<td colspan="5" style="padding:0.5rem; background:rgba(255,255,255,0.05); font-weight:bold; font-size:0.875rem; border-bottom:1px solid var(--panel-border);">${cat.name}</td>`;
            tbody.appendChild(trHeader);

            cat.items.forEach(addon => {
                const key = addon.id;
                let defaultDisc = 0;
                const val = state.gridSelections[line].addons[key] || { qty: '', discountPct: defaultDisc };

                const tr = document.createElement('tr');

                const tdName = document.createElement('td');
                tdName.colSpan = 2;
                tdName.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); font-size:0.875rem; padding-left:1rem;';
                tdName.textContent = addon.name;

                const tdAddonPrice = document.createElement('td');
                tdAddonPrice.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); text-align:right; font-size:0.875rem;';
                tdAddonPrice.textContent = `${addon.price.toLocaleString('sv-SE')} SEK`;

                // Stepper TD for addon
                const tdAddonQty = document.createElement('td');
                tdAddonQty.style.cssText = 'padding:0.4rem 0.5rem; border-bottom:1px solid var(--panel-border);';
                tdAddonQty.id = `addon-input-${line}-${addon.id}`;

                const aBtnStyle = 'padding:0.2rem 0.45rem; border-radius:4px; border:1px solid var(--panel-border); background:var(--panel-bg); color:var(--text-primary); cursor:pointer;';
                const aBtnSmallStyle = aBtnStyle + ' font-size:0.75rem;';
                const aInputStyle = 'width:44px; text-align:center; font-weight:bold; padding:0.15rem 0.2rem; border-radius:4px; border:1px solid var(--panel-border); background:var(--input-bg, rgba(255,255,255,0.07)); color:var(--text-primary);';
                const addonQtyInput = document.createElement('input');
                addonQtyInput.type = 'number';
                addonQtyInput.min = '0';
                addonQtyInput.value = val.qty || 0;
                addonQtyInput.style.cssText = aInputStyle;

                // Addon Summa TD
                const tdAddonSum = document.createElement('td');
                tdAddonSum.style.cssText = 'padding:0.5rem; border-bottom:1px solid var(--panel-border); text-align:right; font-size:0.875rem; font-weight:600;';
                const updateAddonSum = (qty) => {
                    const sum = addon.price * qty;
                    tdAddonSum.textContent = sum > 0 ? `${sum.toLocaleString('sv-SE')} SEK` : '';
                };
                updateAddonSum(val.qty || 0);

                addonQtyInput.addEventListener('change', (e) => {
                    const next = Math.max(0, parseInt(e.target.value) || 0);
                    addonQtyInput.value = next;
                    if (next > 0) {
                        state.gridSelections[line].addons[key] = { qty: next, discountPct: val.discountPct };
                    } else {
                        delete state.gridSelections[line].addons[key];
                    }
                    setAddonTint(next);
                    updateAddonSum(next);
                    updateGridSummary();
                });

                const setAddonTint = (qty) => { addonQtyInput.style.color = qty > 0 ? '#4ade80' : ''; };
                setAddonTint(val.qty || 0);

                const applyAddonDelta = (delta) => {
                    const current = state.gridSelections[line].addons[key]?.qty || 0;
                    const next = Math.max(0, current + delta);
                    addonQtyInput.value = next;
                    if (next > 0) {
                        state.gridSelections[line].addons[key] = { qty: next, discountPct: val.discountPct };
                    } else {
                        delete state.gridSelections[line].addons[key];
                    }
                    setAddonTint(next);
                    updateAddonSum(next);
                    updateGridSummary();
                };

                const aM6 = document.createElement('button'); aM6.textContent = '-6'; aM6.style.cssText = aBtnSmallStyle; aM6.addEventListener('click', () => applyAddonDelta(-6));
                const aM1 = document.createElement('button'); aM1.textContent = '-'; aM1.style.cssText = aBtnStyle; aM1.addEventListener('click', () => applyAddonDelta(-1));
                const aP1 = document.createElement('button'); aP1.textContent = '+'; aP1.style.cssText = aBtnStyle; aP1.addEventListener('click', () => applyAddonDelta(1));
                const aP6 = document.createElement('button'); aP6.textContent = '+6'; aP6.style.cssText = aBtnSmallStyle; aP6.addEventListener('click', () => applyAddonDelta(6));

                const aStepperWrap = document.createElement('div');
                aStepperWrap.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:0.3rem;';
                aStepperWrap.append(aM6, aM1, addonQtyInput, aP1, aP6);
                tdAddonQty.appendChild(aStepperWrap);

                tr.append(tdName, tdAddonPrice, tdAddonQty, tdAddonSum);
                tbody.appendChild(tr);
            });
        });

        // Grand Total Row
        const trGrandTotal = document.createElement('tr');
        trGrandTotal.innerHTML = `
            <td colspan="4" style="padding:0.75rem 0.5rem; text-align:right; font-weight:700; font-size:1rem; border-top:2px solid var(--primary); background:rgba(255,255,255,0.03);">Totalt</td>
            <td style="padding:0.75rem 0.5rem; font-weight:700; font-size:1rem; text-align:right; border-top:2px solid var(--primary); background:rgba(255,255,255,0.03); color:#4ade80;" id="grid-grand-total-${line}"></td>
        `;
        tbody.appendChild(trGrandTotal);

        section.appendChild(table);
        DOM.configContainer.appendChild(section);
        updateGridSummary();
    });
}
