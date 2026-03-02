// features/stepProductLines.js — Step 1: Product Line Selection

import { state, saveState } from '../services/stateManager.js';

/**
 * Renders the product line checkboxes in Step 1.
 * @param {object} DOM - The cached DOM references object
 */
export function renderProductLines(DOM) {
    DOM.productLinesGroup.innerHTML = '';
    const lines = Object.keys(catalogData);

    lines.forEach(line => {
        const label = document.createElement('label');
        label.className = 'card-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = line;

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.selectedLines.push(line);
            } else {
                state.selectedLines = state.selectedLines.filter(l => l !== line);
                state.builderItems = state.builderItems.filter(item => item.line !== line);
                delete state.gridSelections[line];
            }
            DOM.btnNext1.disabled = state.selectedLines.length === 0;
            saveState();
        });

        const span = document.createElement('span');
        span.textContent = catalogData[line].name;

        label.appendChild(checkbox);
        label.appendChild(span);
        DOM.productLinesGroup.appendChild(label);
    });
}
