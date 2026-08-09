import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import type { BahamaInventoryV2Item, QrLabelLayout } from '../types/contracts';
import { getBahamaQrUrl } from './bahamaQrService';

export const DEFAULT_QR_LABEL_LAYOUT: QrLabelLayout = {
    widthMm: 70,
    heightMm: 50,
    marginMm: 10,
    gapMm: 3
};

export const MIN_QR_LABEL_WIDTH_MM = 60;
export const MIN_QR_LABEL_HEIGHT_MM = 40;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const RENDER_DPI = 300;
const PX_PER_MM = RENDER_DPI / 25.4;

export interface A4LabelGrid {
    columns: number;
    rows: number;
    labelsPerPage: number;
}

export function getA4LabelGrid(layout: QrLabelLayout): A4LabelGrid {
    const usableWidth = A4_WIDTH_MM - layout.marginMm * 2;
    const usableHeight = A4_HEIGHT_MM - layout.marginMm * 2;
    const columns = Math.max(0, Math.floor((usableWidth + layout.gapMm) / (layout.widthMm + layout.gapMm)));
    const rows = Math.max(0, Math.floor((usableHeight + layout.gapMm) / (layout.heightMm + layout.gapMm)));
    return { columns, rows, labelsPerPage: columns * rows };
}

export function validateQrLabelLayout(layout: QrLabelLayout): string | null {
    if (!Object.values(layout).every((value) => Number.isFinite(value))) {
        return 'Alla mått måste vara giltiga tal.';
    }
    if (layout.widthMm < MIN_QR_LABEL_WIDTH_MM || layout.heightMm < MIN_QR_LABEL_HEIGHT_MM) {
        return `Etiketten måste vara minst ${MIN_QR_LABEL_WIDTH_MM} × ${MIN_QR_LABEL_HEIGHT_MM} mm.`;
    }
    if (layout.marginMm < 0 || layout.gapMm < 0) {
        return 'Marginal och mellanrum kan inte vara negativa.';
    }
    if (getA4LabelGrid(layout).labelsPerPage === 0) {
        return 'Etiketten får inte plats på ett A4-ark med de här inställningarna.';
    }
    return null;
}

function displayValue(value: string): string {
    return value.trim() || '—';
}

function drawFittedLine(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    weight = 600
): void {
    let size = fontSize;
    do {
        context.font = `${weight} ${size}px Inter, Arial, sans-serif`;
        if (context.measureText(text).width <= maxWidth || size <= 17) break;
        size -= 1;
    } while (size > 17);
    context.fillText(text, x, y, maxWidth);
}

export async function renderBahamaLabelDataUrl(
    item: BahamaInventoryV2Item,
    layout: QrLabelLayout,
    origin: string
): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.widthMm * PX_PER_MM);
    canvas.height = Math.round(layout.heightMm * PX_PER_MM);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Webbläsaren kan inte rendera etiketten.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#121827';

    const padding = Math.round(canvas.width * 0.045);
    const qrSize = Math.min(
        Math.round(canvas.height * 0.68),
        Math.round(canvas.width * 0.39)
    );
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, getBahamaQrUrl(item.qrId, origin), {
        errorCorrectionLevel: 'Q',
        margin: 3,
        width: qrSize,
        color: { dark: '#10131a', light: '#ffffff' }
    });

    context.drawImage(qrCanvas, padding, Math.round((canvas.height - qrSize) / 2), qrSize, qrSize);
    const textX = padding + qrSize + Math.round(canvas.width * 0.035);
    const textWidth = canvas.width - textX - padding;

    context.fillStyle = '#111827';
    context.font = `800 ${Math.round(canvas.height * 0.075)}px Inter, Arial, sans-serif`;
    context.fillText('BRIXX', textX, Math.round(canvas.height * 0.13), textWidth);

    drawFittedLine(context, item.id, textX, Math.round(canvas.height * 0.27), textWidth, Math.round(canvas.height * 0.09), 800);
    drawFittedLine(context, `${displayValue(item.type)} · ${displayValue(item.size)}`, textX, Math.round(canvas.height * 0.38), textWidth, Math.round(canvas.height * 0.047), 700);

    const rows = [
        ['Stativ', item.properties.stativ],
        ['Textil', item.properties.textil],
        ['Belysning', item.properties.belysning],
        ['Värme', item.properties.varme]
    ];
    const startY = Math.round(canvas.height * 0.52);
    const lineHeight = Math.round(canvas.height * 0.095);
    rows.forEach(([label, value], index) => {
        context.fillStyle = '#667085';
        context.font = `600 ${Math.round(canvas.height * 0.033)}px Inter, Arial, sans-serif`;
        context.fillText(label.toUpperCase(), textX, startY + index * lineHeight, textWidth * 0.34);
        context.fillStyle = '#1f2937';
        drawFittedLine(
            context,
            displayValue(value),
            textX + textWidth * 0.35,
            startY + index * lineHeight,
            textWidth * 0.65,
            Math.round(canvas.height * 0.037),
            650
        );
    });

    return canvas.toDataURL('image/png');
}

function dataUrlToBlob(dataUrl: string): Blob {
    const [metadata, base64] = dataUrl.split(',', 2);
    const mimeType = metadata.match(/^data:([^;]+)/)?.[1] || 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
}

function safeFilename(value: string): string {
    return value.trim().replace(/[^a-z0-9åäö_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'parasol';
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportBahamaLabelsAsPng(
    items: BahamaInventoryV2Item[],
    layout: QrLabelLayout,
    origin: string
): Promise<void> {
    if (items.length === 0) return;
    if (items.length === 1) {
        const dataUrl = await renderBahamaLabelDataUrl(items[0], layout, origin);
        downloadBlob(dataUrlToBlob(dataUrl), `brixx-qr-${safeFilename(items[0].id)}.png`);
        return;
    }

    const zip = new JSZip();
    for (const item of items) {
        const dataUrl = await renderBahamaLabelDataUrl(item, layout, origin);
        zip.file(`brixx-qr-${safeFilename(item.id)}.png`, dataUrl.split(',', 2)[1], { base64: true });
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'brixx-qr-etiketter.zip');
}

export async function exportBahamaLabelsAsPdf(
    items: BahamaInventoryV2Item[],
    layout: QrLabelLayout,
    origin: string
): Promise<void> {
    const grid = getA4LabelGrid(layout);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    for (let index = 0; index < items.length; index += 1) {
        if (index > 0 && index % grid.labelsPerPage === 0) {
            pdf.addPage('a4', 'portrait');
        }
        const pageIndex = index % grid.labelsPerPage;
        const column = pageIndex % grid.columns;
        const row = Math.floor(pageIndex / grid.columns);
        const x = layout.marginMm + column * (layout.widthMm + layout.gapMm);
        const y = layout.marginMm + row * (layout.heightMm + layout.gapMm);
        const dataUrl = await renderBahamaLabelDataUrl(items[index], layout, origin);
        pdf.addImage(dataUrl, 'PNG', x, y, layout.widthMm, layout.heightMm, undefined, 'FAST');
    }

    downloadBlob(pdf.output('blob'), `brixx-qr-etiketter-${new Date().toISOString().slice(0, 10)}.pdf`);
}
