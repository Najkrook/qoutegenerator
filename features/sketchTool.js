// features/sketchTool.js
import { formatLocalFloat } from "./utils.js";
import { state, saveState, markStateDirty } from "../services/stateManager.js";
import { notifyError, notifyWarn, notifyInfo } from "../services/notificationService.js";



// Options from catalog (standard widths for ClickitUP)
// Minimum section size is 1000mm.
const STANDARD_SIZES = [2000, 1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000];
const MIN_SECTION_SIZE = 1000;

// State
let sketchWidth = 7000;
let sketchDepth = 2300;
let includeBack = false;
let targetLength = 1500;
let doorEdges = new Set(); // Set of edge names: 'front', 'left', 'right', 'back'
let doorSize = 1000; // 1000 or 1100
let prioMode = 'symmetrical'; // 'target', 'convenient', 'symmetrical'

// DOM Elements
let domSvg, domList, btnExport, btnExportPdf;
let inputTarget;
let previewKeyHandler = null;
let previewLastFocus = null;

// Interactive Drag State
let activeDragEdge = null;
let dragStartY = 0;
let dragStartX = 0;
let initialSketchDepth = 0;
let initialSketchWidth = 0;
// We establish a scale factor to roughly map pixels to mm. 
// A typical SVG viewBox is padded out to ~10000x5000 units drawn in a maybe 800px wide box.
const pixelToMmScaleX = 10;
const pixelToMmScaleY = 10;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const inputW = document.getElementById('sketchWidth');
    const inputD = document.getElementById('sketchDepth');
    const inputBack = document.getElementById('sketchIncludeBack');
    inputTarget = document.getElementById('sketchTargetLength');

    domSvg = document.getElementById('sketchSvg');
    domList = document.getElementById('sketchBomList');
    btnExport = document.getElementById('btnExportSketch');
    btnExportPdf = document.getElementById('btnExportPdf');

    if (inputW) {
        inputW.addEventListener('input', (e) => {
            sketchWidth = parseInt(e.target.value) || 0;
            updateSketch();
        });
    }
    if (inputD) {
        inputD.addEventListener('input', (e) => {
            sketchDepth = parseInt(e.target.value) || 0;
            updateSketch();
        });
    }
    if (inputBack) {
        inputBack.addEventListener('change', (e) => {
            includeBack = e.target.checked;
            // Show/hide back door checkbox
            const backLabel = document.getElementById('doorBackLabel');
            if (backLabel) {
                backLabel.style.display = includeBack ? 'flex' : 'none';
                // Uncheck back door if we're hiding it
                if (!includeBack) {
                    const backCb = backLabel.querySelector('input');
                    if (backCb) backCb.checked = false;
                    doorEdges.delete('back');
                }
            }
            updateSketch();
        });
    }
    if (inputTarget) {
        inputTarget.addEventListener('change', (e) => {
            targetLength = parseInt(e.target.value) || 1500;
            updateSketch();
        });
    }

    // Prioritization mode selector
    const inputPrioMode = document.getElementById('sketchPrioMode');
    if (inputPrioMode) {
        inputPrioMode.addEventListener('change', (e) => {
            prioMode = e.target.value;

            // Show/hide the target length picker
            const targetGroup = document.getElementById('targetLengthGroup');
            if (targetGroup) {
                targetGroup.style.display = prioMode === 'target' ? 'block' : 'none';
            }

            // Update description text
            const desc = document.getElementById('prioModeDesc');
            if (desc) {
                const descriptions = {
                    target: 'Maximerar antalet sektioner av den valda storleken.',
                    convenient: 'Använder störst möjliga sektioner för minsta antal delar.',
                    symmetrical: 'Alla sektioner får samma storlek för jämn symmetri.'
                };
                desc.textContent = descriptions[prioMode] || '';
            }

            updateSketch();
        });
    }

    // Door checkboxes (multiple)
    const doorCheckboxes = document.querySelectorAll('.sketchDoorCheck');
    doorCheckboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                doorEdges.add(e.target.value);
            } else {
                doorEdges.delete(e.target.value);
            }
            updateSketch();
        });
    });

    // Door size selector
    const inputDoorSize = document.getElementById('sketchDoorSize');
    if (inputDoorSize) {
        inputDoorSize.addEventListener('change', (e) => {
            doorSize = parseInt(e.target.value) || 1000;
            updateSketch();
        });
    }
    if (btnExport) {
        btnExport.addEventListener('click', exportToQuote);
    }
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportSketchToPdf);
        const isPdfReady = typeof window.html2pdf === 'function';
        btnExportPdf.disabled = !isPdfReady;
        if (!isPdfReady) {
            btnExportPdf.title = 'PDF-export ar tillfalligt otillganglig (html2pdf saknas).';
        }
    }

    // SVG Drag Listeners
    // Attach mousedown to window to bypass SVG pointer-events bugs
    if (domSvg) {
        window.addEventListener('mousedown', handleSvgMouseDown);
        window.addEventListener('mousemove', handleSvgMouseMove);
        window.addEventListener('mouseup', handleSvgMouseUp);
    }

    // Initial render
    updateSketch();
});

function handleSvgMouseDown(e) {
    if (!domSvg) return;

    // Fast check if click was near the SVG area at all
    const svgRect = domSvg.getBoundingClientRect();
    if (e.clientX < svgRect.left - 50 || e.clientX > svgRect.right + 50 ||
        e.clientY < svgRect.top - 50 || e.clientY > svgRect.bottom + 50) {
        return;
    }

    // Find all drag handles
    const handles = domSvg.querySelectorAll('.sketch-drag-handle');
    let hitHandle = null;

    // Mathematically check if the mouse is within the bounding box of any handle
    // This bypasses ALL SVG pointer-events / z-index issues
    for (let i = 0; i < handles.length; i++) {
        const hRect = handles[i].getBoundingClientRect();

        // Expand the hit area slightly for usability
        const padding = 20;

        if (e.clientX >= hRect.left - padding && e.clientX <= hRect.right + padding &&
            e.clientY >= hRect.top - padding && e.clientY <= hRect.bottom + padding) {
            hitHandle = handles[i];
            break;
        }
    }

    if (!hitHandle) return;

    activeDragEdge = hitHandle.dataset.edge || hitHandle.getAttribute('data-edge');
    // Prevent default to stop text selection while dragging
    e.preventDefault();

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialSketchDepth = sketchDepth;
    initialSketchWidth = sketchWidth;
}

function handleSvgMouseMove(e) {
    if (!activeDragEdge) return;

    // Use a rough scale based on typical viewport vs viewBox ratio. 
    const rect = domSvg.getBoundingClientRect();
    const viewBox = domSvg.viewBox.baseVal;

    // Fallbacks just in case rect is 0
    const ratioX = rect.width ? (viewBox.width / rect.width) : 10;
    const ratioY = rect.height ? (viewBox.height / rect.height) : 10;

    const deltaX = (e.clientX - dragStartX) * ratioX;
    const deltaY = (e.clientY - dragStartY) * ratioY;

    if (activeDragEdge === 'front') {
        // Dragging front edge modifies depth (Y axis)
        let newDepth = initialSketchDepth + deltaY;
        // Snap to nearest 100
        newDepth = Math.round(newDepth / 100) * 100;
        // Restrict minimum
        if (newDepth >= 1000 && newDepth !== sketchDepth) {
            sketchDepth = newDepth;
            document.getElementById('sketchDepth').value = sketchDepth;
            updateSketch();
        }
    } else if (activeDragEdge === 'right') {
        // Dragging right edge modifies width (X axis)
        let newWidth = initialSketchWidth + deltaX;
        newWidth = Math.round(newWidth / 100) * 100;
        if (newWidth >= 1000 && newWidth !== sketchWidth) {
            sketchWidth = newWidth;
            document.getElementById('sketchWidth').value = sketchWidth;
            updateSketch();
        }
    } else if (activeDragEdge === 'left') {
        // Dragging left edge outwards (left) means negative deltaX adds to width
        let newWidth = initialSketchWidth - deltaX;
        newWidth = Math.round(newWidth / 100) * 100;
        if (newWidth >= 1000 && newWidth !== sketchWidth) {
            sketchWidth = newWidth;
            document.getElementById('sketchWidth').value = sketchWidth;
            updateSketch();
        }
    }
}

function handleSvgMouseUp(e) {
    if (activeDragEdge) {
        activeDragEdge = null;
    }
}

/**
 * Calculates the best combination of glass sections to fill a given length.
 * Strategy depends on prioMode:
 *   'target'      â€” maximize the number of targetLength sections
 *   'convenient'  â€” fewest total sections (use largest sizes first)
 *   'symmetrical' â€” all sections the same standard size
 * @param {number} totalLengthMilli 
 * @param {boolean} needsDoor 
 * @returns {Array} Array of section lengths in mm. Doors are marked as strings.
 */
function calculateSectionsForEdge(totalLengthMilli, needsDoor = false) {
    if (totalLengthMilli <= 0) return [];

    let remaining = totalLengthMilli;
    let sections = [];

    // If we need a door, we reserve doorSize mm for it immediately
    if (needsDoor) {
        if (remaining >= doorSize) {
            sections.push(`Dörr ${doorSize}`);
            remaining -= doorSize;
        } else {
            return [];
        }
    }

    if (remaining === 0) return sections;

    if (prioMode === 'convenient') {
        // â”€â”€ MOST CONVENIENT: fewest pieces, largest sizes first â”€â”€
        // Key constraint: every piece must be >= MIN_SECTION_SIZE
        const sizesDescending = [...STANDARD_SIZES].sort((a, b) => b - a);
        while (remaining > 0) {
            if (remaining <= 2000 && remaining >= MIN_SECTION_SIZE && STANDARD_SIZES.includes(remaining)) {
                // Remaining is itself a valid standard size â€” use it and finish
                sections.push(remaining);
                remaining = 0;
                break;
            }

            let placed = false;
            for (const sz of sizesDescending) {
                if (sz <= remaining) {
                    const leftover = remaining - sz;
                    // Only place this size if the leftover is 0 or >= MIN_SECTION_SIZE
                    if (leftover === 0 || leftover >= MIN_SECTION_SIZE) {
                        sections.push(sz);
                        remaining = leftover;
                        placed = true;
                        break;
                    }
                    // Otherwise skip this size â€” it would leave too small a remainder
                }
            }

            if (!placed) {
                // No single standard size works without leaving a bad remainder.
                // Split remaining into two roughly equal standard halves.
                let half = Math.round(remaining / 2 / 100) * 100;
                if (half < MIN_SECTION_SIZE) half = MIN_SECTION_SIZE;
                if (half > 2000) half = 2000;
                sections.push(half);
                remaining -= half;
                if (remaining > 0 && remaining < MIN_SECTION_SIZE) {
                    // Absorb into the last pushed section if possible
                    sections[sections.length - 1] += remaining;
                    remaining = 0;
                }
            }
        }
        return sections;

    } else if (prioMode === 'symmetrical') {
        // â”€â”€ MOST SYMMETRICAL: all sections same standard size â”€â”€
        // CONSTRAINT: total must NEVER exceed remaining. Use floor, not round.
        let bestSize = 1500;
        let bestDiff = Infinity;
        let bestCount = 1;

        for (const sz of STANDARD_SIZES) {
            // Only use floor to ensure we never exceed the edge length
            const count = Math.floor(remaining / sz);
            if (count < 1) continue;
            const total = count * sz;
            if (total > remaining) continue; // Safety: never exceed
            const diff = remaining - total;  // Always >= 0
            if (diff < bestDiff) {
                bestDiff = diff;
                bestSize = sz;
                bestCount = count;
            }
        }

        // Fill with bestCount sections of bestSize
        for (let i = 0; i < bestCount; i++) {
            sections.push(bestSize);
        }
        const leftover = remaining - (bestCount * bestSize);

        // Handle leftover (always >= 0 and < bestSize)
        if (leftover > 0) {
            if (leftover >= MIN_SECTION_SIZE && STANDARD_SIZES.includes(leftover)) {
                sections.push(leftover);
            } else if (leftover >= MIN_SECTION_SIZE) {
                sections.push(leftover); // Non-standard but valid size
            } else {
                // Leftover is < MIN_SECTION_SIZE. Redistribute:
                // Remove one bestSize and split (bestSize + leftover) into two pieces
                if (sections.length > 0) {
                    sections.pop();
                    const combined = bestSize + leftover;
                    const half1 = Math.ceil(combined / 2 / 100) * 100;
                    const half2 = combined - half1;
                    if (half1 >= MIN_SECTION_SIZE) sections.push(half1);
                    if (half2 >= MIN_SECTION_SIZE) sections.push(half2);
                    if (half1 < MIN_SECTION_SIZE && half2 < MIN_SECTION_SIZE) {
                        // Edge case: just push combined back
                        sections.push(combined);
                    }
                } else {
                    sections.push(remaining); // Nothing else we can do
                }
            }
        }
        return sections;

    } else {
        // â”€â”€ TARGET MODE (original behavior): maximize targetLength â”€â”€
        while (remaining >= targetLength * 2) {
            sections.push(targetLength);
            remaining -= targetLength;
        }

        if (remaining === 0) {
            return optimizeSections(sections, targetLength);
        }

        if (STANDARD_SIZES.includes(remaining)) {
            sections.push(remaining);
            return optimizeSections(sections, targetLength);
        }

        if (remaining > 2000) {
            let half1 = Math.floor(remaining / 2 / 100) * 100;
            let half2 = remaining - half1;
            if (half1 >= MIN_SECTION_SIZE && half1 <= 2000) sections.push(half1);
            else sections.push(remaining / 2);
            if (half2 >= MIN_SECTION_SIZE && half2 <= 2000) sections.push(half2);
            else sections.push(remaining / 2);
            return optimizeSections(sections, targetLength);
        }

        sections.push(remaining);
        return optimizeSections(sections, targetLength);
    }
}

/**
 * Helper to optionally shuffle the door to the middle of the array 
 * for better visual symmetry, if desired.
 */
function optimizeSections(sections, targetLength) {
    // Optionally sort so that the door is somewhat central
    // Just returning the array sorted for now to keep standard sizes first
    return sections;
}

function updateSketch() {
    if (!domSvg || !domList) return;

    // Run math for edges, passing down the door requirement
    const leftEdge = calculateSectionsForEdge(sketchDepth, doorEdges.has('left'));
    const rightEdge = calculateSectionsForEdge(sketchDepth, doorEdges.has('right'));
    const frontEdge = calculateSectionsForEdge(sketchWidth, doorEdges.has('front'));

    let backEdge = [];
    if (includeBack) {
        backEdge = calculateSectionsForEdge(sketchWidth, doorEdges.has('back'));
    }

    const allSections = [...leftEdge, ...rightEdge, ...frontEdge, ...backEdge];

    // Calculate Support Legs
    // 1 Slimline per door
    const doorCount = allSections.filter(s => String(s).includes('Dörr')).length;
    let slimlineCount = doorCount;

    // 1 Stödben 45 per loose end
    // If includeBack is false, we have a U-shape, which means 2 loose ends (top left, top right)
    let stodbenCount = includeBack ? 0 : 2;

    renderBoM(allSections, slimlineCount, stodbenCount);
    renderSvg(leftEdge, rightEdge, frontEdge, backEdge, doorCount, stodbenCount);
}

function renderBoM(allSections, slimlineCount, stodbenCount) {
    // Count occurrences
    const counts = {};
    let totalLength = 0;

    allSections.forEach(s => {
        counts[s] = (counts[s] || 0) + 1;
        // Only sum numeric lengths, doors are not added to 'total length glas'
        if (typeof s === 'number') {
            totalLength += s;
        }
    });

    let html = `<ul style="list-style: none; padding: 0; margin: 0;">`;

    // Convert keys to string array and sort descending
    Object.keys(counts).sort((a, b) => {
        // Handle "Dörr 1000" strings vs numbers
        if (typeof a === 'string' && a.includes('Dörr')) return -1; // Doors at top
        if (typeof b === 'string' && b.includes('Dörr')) return 1;
        return parseFloat(b) - parseFloat(a);
    }).forEach(size => {
        const isDoor = String(size).includes('Dörr');
        const labelName = isDoor ? size : `ClickitUP Sektion <b>${size}</b> mm`;
        html += `<li style="padding: 0.5rem 0; border-bottom: 1px solid var(--panel-border); display: flex; justify-content: space-between;">
            <span>${labelName}</span>
            <span style="font-weight: bold;">${counts[size]} st</span>
        </li>`;
    });

    if (slimlineCount > 0) {
        html += `<li style="padding: 0.5rem 0; border-bottom: 1px dashed var(--panel-border); display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Slimline (stöd för dörr)</span>
            <span style="font-weight: bold;">${slimlineCount} st</span>
        </li>`;
    }

    if (stodbenCount > 0) {
        html += `<li style="padding: 0.5rem 0; border-bottom: 1px dashed var(--panel-border); display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Stödben 45&deg; (för fri ände)</span>
            <span style="font-weight: bold;">${stodbenCount} st</span>
        </li>`;
    }

    html += `</ul>`;
    html += `<div style="margin-top: 1rem; text-align: right; font-size: 1.1rem;">
        Total längd glas: <b>${formatLocalFloat(totalLength / 1000)} löpmeter</b>
    </div>`;

    domList.innerHTML = html;
}

function renderSvg(leftEdge, rightEdge, frontEdge, backEdge, doorCount, stodbenCount) {
    // Clear
    domSvg.innerHTML = '';

    // Calculate maximum dimensions
    const totalWidth = sketchWidth;
    const totalDepth = sketchDepth;

    // Add padding around the drawing (e.g., 1000mm padding on all sides)
    const padding = 1500;

    // ViewBox: min-x, min-y, width, height
    // We'll place the top-left corner of the back wall at (0,0)
    domSvg.setAttribute('viewBox', `${-padding} ${-padding} ${totalWidth + padding * 2} ${totalDepth + padding * 2}`);

    // Colors
    const colorBlock = '#1e293b'; // Darker gray/blue for the glass sections
    const colorText = '#64748b';

    // Draw edges
    // Front edge (drawn along the bottom from left to right)
    drawEdgeObjects(frontEdge, 0, totalDepth, 'E', domSvg, colorBlock, colorText);

    // Left edge (drawn along the left side from top to bottom)
    // Note: To match a top-down view extending outwards, Y increases downwards
    drawEdgeObjects(leftEdge, 0, 0, 'S', domSvg, colorBlock, colorText);

    // Right edge (drawn along the right side from top to bottom)
    drawEdgeObjects(rightEdge, totalWidth, 0, 'S', domSvg, colorBlock, colorText);

    // Back edge (top wall)
    if (includeBack) {
        drawEdgeObjects(backEdge, 0, 0, 'E', domSvg, colorBlock, colorText);
    } else {
        // Draw dashed wall line indicating the house/restaurant wall
        const wall = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        wall.setAttribute('x1', -500);
        wall.setAttribute('y1', 0);
        wall.setAttribute('x2', totalWidth + 500);
        wall.setAttribute('y2', 0);
        wall.setAttribute('stroke', '#cbd5e1');
        wall.setAttribute('stroke-width', '40');
        wall.setAttribute('stroke-dasharray', '200,100');
        domSvg.appendChild(wall);

        // Add "Vägg" text
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', totalWidth / 2);
        textElement.setAttribute('y', -100);
        textElement.setAttribute('fill', '#94a3b8');
        textElement.setAttribute('font-size', '200');
        textElement.setAttribute('font-family', 'sans-serif');
        textElement.setAttribute('font-weight', 'bold');
        textElement.setAttribute('text-anchor', 'middle');
        textElement.textContent = 'Befintlig Vägg / Fasad';
        domSvg.appendChild(textElement);

        // Stödben are tracked in BoM but not drawn on the SVG
    }

    // Add Drag Handles
    // Front Handle (Height/Depth resize)
    drawDragHandle(totalWidth / 2, totalDepth, 'E', domSvg, 'front');

    // Left Handle (Width resize, extending left)
    drawDragHandle(0, totalDepth / 2, 'S', domSvg, 'left');

    // Right Handle (Width resize, extending right)
    drawDragHandle(totalWidth, totalDepth / 2, 'S', domSvg, 'right');
}

function drawDragHandle(x, y, orientation, svg, edgeId) {
    const handleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handleGroup.style.cursor = orientation === 'E' ? 'ns-resize' : 'ew-resize';
    handleGroup.setAttribute('class', 'sketch-drag-handle');
    handleGroup.setAttribute('data-edge', edgeId); // Fallback for dataset
    handleGroup.dataset.edge = edgeId;

    // The group itself should be the target
    handleGroup.style.pointerEvents = 'all';

    // Invisible hit box for easier grabbing
    const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hitbox.setAttribute('x', x - 400);
    hitbox.setAttribute('y', y - 400);
    hitbox.setAttribute('width', 800);
    hitbox.setAttribute('height', 800);
    hitbox.setAttribute('fill', 'transparent');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 120);
    circle.setAttribute('fill', '#3b82f6');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '30');

    // Add hover effect directly via SVG attributes
    handleGroup.addEventListener('mouseenter', () => circle.setAttribute('fill', '#2563eb'));
    handleGroup.addEventListener('mouseleave', () => circle.setAttribute('fill', '#3b82f6'));

    handleGroup.appendChild(hitbox);
    handleGroup.appendChild(circle);
    svg.appendChild(handleGroup);
}

/**
 * Draws discrete rectangles for an array of sections
 * startX, startY is the starting coordinate
 * direction is 'E' (East/Right) or 'S' (South/Down)
 */
function drawEdgeObjects(sections, startX, startY, direction, svg, colorBlock, colorText) {
    const thickness = 100; // visual thickness of glass/post
    let currentX = startX;
    let currentY = startY;

    // Start with a corner/end post
    drawPost(currentX, currentY, thickness, svg, colorBlock);

    sections.forEach(item => {
        const isDoor = String(item).includes('Dörr');
        const len = isDoor ? parseInt(String(item).replace(/\D/g, '')) || doorSize : parseFloat(item);

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.style.cursor = 'pointer';

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

        if (isDoor) {
            rect.setAttribute('fill', 'rgba(34, 197, 94, 0.3)'); // Greenish
            rect.setAttribute('stroke', '#166534'); // Dark green border

            // Draw Slimline indicator
            const slimline = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            slimline.setAttribute('r', '80');
            slimline.setAttribute('fill', '#ef4444'); // Red dot for Slimline

            if (direction === 'E') {
                slimline.setAttribute('cx', currentX + 500);
                slimline.setAttribute('cy', currentY - thickness);
            } else {
                slimline.setAttribute('cx', currentX - thickness);
                slimline.setAttribute('cy', currentY + 500);
            }

            const slimlineTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            slimlineTitle.textContent = `Slimline Support`;
            slimline.appendChild(slimlineTitle);

            group.appendChild(slimline);

        } else {
            rect.setAttribute('fill', 'rgba(56, 189, 248, 0.2)'); // Light blue transparent glass
            rect.setAttribute('stroke', colorBlock);
        }

        rect.setAttribute('stroke-width', '20');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('fill', '#1a1a2e');
        text.setAttribute('font-size', '220');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-weight', 'bold');
        text.textContent = isDoor ? 'DÖRR' : len;

        // Background rect behind text for contrast
        const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        textBg.setAttribute('fill', 'rgba(255, 255, 255, 0.85)');
        textBg.setAttribute('rx', '40');

        let postX = 0, postY = 0;

        if (direction === 'E') {
            // Draw East (Right)
            rect.setAttribute('x', currentX);
            rect.setAttribute('y', currentY - thickness / 2);
            rect.setAttribute('width', len);
            rect.setAttribute('height', thickness);

            const tx = currentX + len / 2;
            const ty = currentY + thickness + 200;
            text.setAttribute('x', tx);
            text.setAttribute('y', ty);

            // Position background behind text
            const labelWidth = String(isDoor ? 'DÖRR' : len).length * 130 + 80;
            textBg.setAttribute('x', tx - labelWidth / 2);
            textBg.setAttribute('y', ty - 130);
            textBg.setAttribute('width', labelWidth);
            textBg.setAttribute('height', 260);

            currentX += len;
            postX = currentX;
            postY = currentY;

        } else if (direction === 'S') {
            // Draw South (Down)
            rect.setAttribute('x', currentX - thickness / 2);
            rect.setAttribute('y', currentY);
            rect.setAttribute('width', thickness);
            rect.setAttribute('height', len);

            const tx = currentX - thickness - 200;
            const ty = currentY + len / 2;
            text.setAttribute('x', tx);
            text.setAttribute('y', ty);

            // Position background behind text
            const labelWidth = String(isDoor ? 'DÖRR' : len).length * 130 + 80;
            textBg.setAttribute('x', tx - labelWidth / 2);
            textBg.setAttribute('y', ty - 130);
            textBg.setAttribute('width', labelWidth);
            textBg.setAttribute('height', 260);

            currentY += len;
            postX = currentX;
            postY = currentY;
        }

        // Add tooltip
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = isDoor ? item : `ClickitUP Sektion ${len} mm`;
        group.appendChild(title);

        group.appendChild(rect);
        group.appendChild(textBg);
        group.appendChild(text);
        svg.appendChild(group);

        // Draw the connecting post at the end of this section
        drawPost(postX, postY, thickness, svg, colorBlock);
    });
}

function drawPost(x, y, size, svg, color) {
    const post = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    post.setAttribute('x', x - size);
    post.setAttribute('y', y - size);
    post.setAttribute('width', size * 2);
    post.setAttribute('height', size * 2);
    post.setAttribute('fill', color);
    post.setAttribute('rx', '30'); // slight rounding
    svg.appendChild(post);
}

function drawStodben(x, y, cornerType, svg, color) {
    const size = 600; // visual length of the support leg
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

    // Origin is the corner center
    line.setAttribute('x1', x);
    line.setAttribute('y1', y);

    // Calculate 45 degree angle inward
    if (cornerType === 'L') {
        // Top-left corner, angled down and right (+x, +y)
        line.setAttribute('x2', x + size);
        line.setAttribute('y2', y + size);
    } else if (cornerType === 'R') {
        // Top-right corner, angled down and left (-x, +y)
        line.setAttribute('x2', x - size);
        line.setAttribute('y2', y + size);
    }

    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '40');
    line.setAttribute('stroke-linecap', 'round');

    // Add a title tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = "Stödben 45 rakt glas";
    line.appendChild(title);

    svg.appendChild(line);
}

function openPreviewOverlay(overlay, confirmBtn, cancelBtn) {
    previewLastFocus = document.activeElement;
    overlay.style.display = 'flex';

    previewKeyHandler = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closePreviewOverlay(overlay);
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [confirmBtn, cancelBtn].filter(Boolean);
        if (!focusable.length) return;
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
    };

    document.addEventListener('keydown', previewKeyHandler);
    if (confirmBtn) confirmBtn.focus();
}

function closePreviewOverlay(overlay) {
    overlay.style.display = 'none';
    if (previewKeyHandler) {
        document.removeEventListener('keydown', previewKeyHandler);
        previewKeyHandler = null;
    }
    if (previewLastFocus && typeof previewLastFocus.focus === 'function') {
        previewLastFocus.focus();
    }
}

function exportToQuote() {
    // Collect all current sections, passing down the door requirements
    const leftEdge = calculateSectionsForEdge(sketchDepth, doorEdges.has('left'));
    const rightEdge = calculateSectionsForEdge(sketchDepth, doorEdges.has('right'));
    const frontEdge = calculateSectionsForEdge(sketchWidth, doorEdges.has('front'));

    let backEdge = [];
    if (includeBack) {
        backEdge = calculateSectionsForEdge(sketchWidth, doorEdges.has('back'));
    }

    const allSections = [...leftEdge, ...rightEdge, ...frontEdge, ...backEdge];
    const doorCount = allSections.filter(s => String(s).includes('Dörr')).length;
    let slimlineCount = doorCount;
    let stodbenCount = includeBack ? 0 : 2;

    // â”€â”€ Build Requirements Map â”€â”€
    const requirements = {}; // key: "Sektion|1500" or "Dörr|1000", value: count
    allSections.forEach(item => {
        if (String(item).includes('Dörr')) {
            const key = `Dörr|${doorSize}`;
            requirements[key] = (requirements[key] || 0) + 1;
        } else {
            const key = `Sektion|${item}`;
            requirements[key] = (requirements[key] || 0) + 1;
        }
    });

    // â”€â”€ Build Comparison Table â”€â”€
    const stock = (state.inventoryData && state.inventoryData.clickitup) || {};
    let hasShortfall = false;

    let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
                <tr style="border-bottom: 2px solid var(--panel-border, #444);">
                    <th style="padding: 0.5rem; text-align: left;">Typ</th>
                    <th style="padding: 0.5rem; text-align: center;">Storlek</th>
                    <th style="padding: 0.5rem; text-align: center;">Behov</th>
                    <th style="padding: 0.5rem; text-align: center;">I Lager</th>
                    <th style="padding: 0.5rem; text-align: center;">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.entries(requirements).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, needed]) => {
        const [type, size] = key.split('|');
        const sizeData = stock[size] || {};

        let inStock = 0;
        if (type === 'Sektion') {
            inStock = sizeData.sektion || 0;
        } else if (type === 'Dörr') {
            // Sum both door orientations
            inStock = (sizeData.dorr_h || 0) + (sizeData.dorr_v || 0);
        }

        const diff = inStock - needed;
        const isShort = diff < 0;
        if (isShort) hasShortfall = true;

        const statusIcon = isShort ? '❌' : '✅';
        const statusText = isShort ? `Brist: ${Math.abs(diff)}` : 'OK';
        const rowBg = isShort ? 'rgba(255, 80, 80, 0.1)' : 'rgba(80, 255, 80, 0.05)';
        const statusColor = isShort ? '#ff6b6b' : '#4ade80';

        tableHtml += `
            <tr style="border-bottom: 1px solid var(--panel-border, #333); background: ${rowBg};">
                <td style="padding: 0.5rem; font-weight: 600;">${type}</td>
                <td style="padding: 0.5rem; text-align: center;">${size} mm</td>
                <td style="padding: 0.5rem; text-align: center; font-weight: bold;">${needed}</td>
                <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: ${inStock > 0 ? '#4ade80' : '#888'};">${inStock}</td>
                <td style="padding: 0.5rem; text-align: center; color: ${statusColor}; font-weight: 600;">
                    ${statusIcon} ${statusText}
                </td>
            </tr>
        `;
    });

    // Add addon rows (support legs)
    if (stodbenCount > 0) {
        tableHtml += `
            <tr style="border-bottom: 1px solid var(--panel-border, #333); background: rgba(255, 165, 0, 0.05);">
                <td style="padding: 0.5rem; font-weight: 600;">Stödben 45°</td>
                <td style="padding: 0.5rem; text-align: center;">-</td>
                <td style="padding: 0.5rem; text-align: center; font-weight: bold;">${stodbenCount}</td>
                <td style="padding: 0.5rem; text-align: center; color: #888;">-</td>
                <td style="padding: 0.5rem; text-align: center; color: #f39c12;">Tillval</td>
            </tr>
        `;
    }
    if (slimlineCount > 0) {
        tableHtml += `
            <tr style="border-bottom: 1px solid var(--panel-border, #333); background: rgba(255, 165, 0, 0.05);">
                <td style="padding: 0.5rem; font-weight: 600;">Slimline</td>
                <td style="padding: 0.5rem; text-align: center;">-</td>
                <td style="padding: 0.5rem; text-align: center; font-weight: bold;">${slimlineCount}</td>
                <td style="padding: 0.5rem; text-align: center; color: #888;">-</td>
                <td style="padding: 0.5rem; text-align: center; color: #f39c12;">Tillval</td>
            </tr>
        `;
    }

    tableHtml += `</tbody></table>`;

    if (hasShortfall) {
        tableHtml += `<p style="margin-top: 0.75rem; padding: 0.5rem; background: rgba(255, 80, 80, 0.15); border-radius: 6px; font-size: 0.8rem; color: #ff6b6b;">
            ⚠️ Det finns lagerbrist för en eller flera storlekar. Du kan fortfarande lägga till i offerten.
        </p>`;
    }

    // â”€â”€ Show the overlay â”€â”€
    const overlay = document.getElementById('inventoryPreviewOverlay');
    const content = document.getElementById('inventoryPreviewContent');
    if (overlay && content) {
        content.innerHTML = tableHtml;

        // Wire up buttons (replace old listeners to avoid duplicates)
        const btnConfirm = document.getElementById('btnConfirmExport');
        const btnCancel = document.getElementById('btnCancelExport');

        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        const newCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        openPreviewOverlay(overlay, newConfirm, newCancel);

        newConfirm.addEventListener('click', () => {
            closePreviewOverlay(overlay);
            commitExportToQuote(allSections, slimlineCount, stodbenCount);
        });

        newCancel.addEventListener('click', () => {
            closePreviewOverlay(overlay);
        });
    } else {
        // Fallback: if overlay doesn't exist, just commit directly
        commitExportToQuote(allSections, slimlineCount, stodbenCount);
    }
}

function commitExportToQuote(allSections, slimlineCount, stodbenCount) {
    // Ensure ClickitUP is selected in state
    if (!state.selectedLines.includes('ClickitUP')) {
        state.selectedLines.push('ClickitUP');
    }

    // Initialize the grid object if it doesn't exist
    if (!state.gridSelections['ClickitUP']) {
        state.gridSelections['ClickitUP'] = { items: {}, addons: {} };
    }

    // Clear old ClickitUP standard sections? No, user might be adding to an existing quote.
    // Instead, increment existing or set new.
    allSections.forEach(item => {
        let key = '';
        if (String(item).includes('Dörr')) {
            key = `ClickitUp Dörr|${doorSize}`; // Must match data.js model name exactly
        } else {
            key = `ClickitUp Sektion|${item}`; // Must match data.js model name exactly
        }

        if (!state.gridSelections['ClickitUP'].items[key]) {
            state.gridSelections['ClickitUP'].items[key] = { qty: 0, discountPct: 0 };
        }
        state.gridSelections['ClickitUP'].items[key].qty += 1;
    });

    // Inject Support Legs into Addons if they exist
    // Keys must match the addon `id` field in data.js, NOT the display name
    if (slimlineCount > 0) {
        if (!state.gridSelections['ClickitUP'].addons['stodben_litet']) {
            state.gridSelections['ClickitUP'].addons['stodben_litet'] = { qty: 0, discountPct: 0 };
        }
        state.gridSelections['ClickitUP'].addons['stodben_litet'].qty += slimlineCount;
    }

    if (stodbenCount > 0) {
        if (!state.gridSelections['ClickitUP'].addons['stodben_stort']) {
            state.gridSelections['ClickitUP'].addons['stodben_stort'] = { qty: 0, discountPct: 0 };
        }
        state.gridSelections['ClickitUP'].addons['stodben_stort'].qty += stodbenCount;
    }

    markStateDirty();
    saveState();

    // Close modal
    if (typeof window.closeSketchTool === 'function') {
        window.closeSketchTool();
    }

    // Ensure the ClickitUP checkbox is visually checked on Step 1
    const checkboxes = document.querySelectorAll('#productLinesGroup input[type="checkbox"]');
    checkboxes.forEach(cb => {
        if (cb.value === 'ClickitUP') cb.checked = true;
    });

    // Enable the Next button (it's disabled until a product line is selected)
    const step1NextBtn = document.getElementById('btnNext1');
    if (step1NextBtn) {
        step1NextBtn.disabled = false;
        // Click it to jump directly to Step 2 (Konfiguration)
        step1NextBtn.click();
    }
}

function exportSketchToPdf() {
    if (typeof window.html2pdf !== 'function') {
        notifyError('PDF-export ar inte tillganglig just nu. Ladda om sidan och forsok igen.');
        if (btnExportPdf) {
            btnExportPdf.disabled = true;
            btnExportPdf.title = 'PDF-export ar otillganglig (html2pdf saknas).';
        }
        return;
    }

    const element = document.getElementById('sketchCanvasContainer');
    if (!element) return;

    // Temporarily hide the drag handles for the PDF print to keep it clean
    const handles = element.querySelectorAll('.sketch-drag-handle');
    handles.forEach(h => h.style.display = 'none');

    // Make the background explicitly white for the PDF
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#ffffff';

    const opt = {
        margin: 10,
        filename: `Uteservering_Skiss_${sketchWidth}x${sketchDepth}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    window.html2pdf().set(opt).from(element).save()
        .then(() => {
            handles.forEach(h => h.style.display = '');
            element.style.backgroundColor = originalBg;
            notifyInfo('Skiss-PDF har laddats ner.');
        })
        .catch((err) => {
            handles.forEach(h => h.style.display = '');
            element.style.backgroundColor = originalBg;
            notifyError('Kunde inte skapa PDF: ' + (err?.message || 'okant fel'));
        });
}

