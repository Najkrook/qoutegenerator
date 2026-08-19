import { DEFAULT_PDF_THEME_ID, PDF_THEME_OPTIONS, normalizePdfThemeId } from '../config/pdfThemes';
import type {
    AdvancedEdge,
    AdvancedNode,
    AdvancedSketchDraft,
    BahamaInventoryItem,
    BahamaInventoryV2Item,
    BuilderAddon,
    BuilderItem,
    CatalogData,
    ClickitupStockMap,
    ContractingWorkState,
    CustomerInfo,
    GridLineSelection,
    InventoryBasketItem,
    InventoryData,
    PdfThemeId,
    PlacedFiesta,
    PlacedParasol,
    QuoteCommercialSnapshot,
    QuoteExportLanguage,
    QuoteState,
    QuoteStatus,
    QuoteTotalsResult,
    QuoteTotalsRow,
    SketchConfigState,
    SketchDraft,
    SketchEdgeKey,
    SketchWorkspace
} from '../types/contracts';
import { catalogData as defaultCatalogData } from '../data/catalog';
import { calculateContractingWorkSummary } from './contractingWork';
import { normalizeExportLanguage, translateQuoteTotalsRowModel } from './exportLocalization';
import { normalizeQuoteCommercialSnapshot } from './quoteCommercialSnapshot';

const SEK_RECONCILIATION_TOLERANCE = 1;
export const MAX_QUOTE_PRODUCT_ROWS = 200;
export const MAX_QUOTE_CONTRACTING_WORK_ROWS = 100;

export interface QuotePreparationAudience {
    isRetailer: boolean;
    allowedPdfThemes?: readonly unknown[];
}

export interface PreparedQuoteProductRow {
    model: string;
    size: string;
    unitPrice: number;
    qty: number;
    gross: number;
    discountPct: number;
    discountSek: number;
    net: number;
    isAddon: boolean;
    isCustom: boolean;
    priceUponRequest: boolean;
    source: QuoteTotalsRow['source'];
    line: string;
    sortModel: string;
    sortSizeRaw: string;
    sortKind: QuoteTotalsRow['sortKind'];
    sortDimensions: number[];
    originalIndex: number;
}

export interface PreparedQuoteContractingWork {
    projectName: string;
    rows: Array<{
        id: string;
        workPackage: string;
        scope: string;
        unit: string;
        priceExVatSek: number;
    }>;
    baseTotalSek: number;
    ataEnabled: boolean;
    ataPercent: number;
    allowanceSek: number;
    lowerIndicativeSek: number;
    upperIndicativeSek: number;
}

export interface PreparedQuote {
    presentation: {
        exportLanguage: QuoteExportLanguage;
        pdfThemeId: PdfThemeId;
        allowedPdfThemeIds: PdfThemeId[];
        equivalenceKey: string;
    };
    commercial: {
        productRows: PreparedQuoteProductRow[];
        productTotals: {
            includesVat: boolean;
            grossTotalSek: number;
            totalDiscountSek: number;
            finalTotalSek: number;
            globalDiscountAmt: number;
            globalDiscountPct: number;
            vatBasisSek: number;
            vatAmountSek: number;
            totalWithVatSek: number;
        };
        contractingWork: PreparedQuoteContractingWork | null;
    };
    agreement: {
        customerInfo: CustomerInfo;
        effectiveQuoteDate: string;
        quoteIdentity: {
            quoteId: string | null;
            quoteNumber: string | null;
            version: number;
            status: QuoteStatus;
        };
        legalTerms: {
            included: boolean;
            text: string;
            templateId: string;
            customized: boolean;
        };
        paymentTermsDays: number;
        validityDays: number;
        includePaymentBox: boolean;
        includeSignatureBlock: boolean;
    };
    visibility: {
        contractingWork: 'visible' | 'absent' | 'suppressed-retailer';
        discountReferenceEligibility: 'eligible-zero' | 'ineligible';
        discountReferences: 'visible' | 'hidden-zero';
        legalTerms: 'visible' | 'hidden';
        paymentBox: 'visible' | 'hidden';
        signatureBlock: 'visible' | 'hidden';
    };
    persistenceSnapshot: QuoteState;
}

export class QuotePreparationError extends Error {
    readonly code = 'INVALID_COMMERCIAL_DATA' as const;
    readonly field: string;

    constructor(field: string, message: string) {
        super(message);
        this.name = 'QuotePreparationError';
        this.field = field;
    }
}

function invalidCommercial(field: string, reason: string): never {
    throw new QuotePreparationError(field, `Invalid commercial data at ${field}: ${reason}`);
}

function requireFinite(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return invalidCommercial(field, 'expected a finite number');
    }
    return value;
}

function requireReconciled(actual: number, expected: number, field: string): void {
    if (Math.abs(actual - expected) > SEK_RECONCILIATION_TOLERANCE) {
        invalidCommercial(field, `expected ${expected} SEK from the supplied rows, received ${actual} SEK`);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function cloneAllowedInventoryString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value === 'boolean') {
        return String(value);
    }
    return undefined;
}

const BAHAMA_INVENTORY_KEYS = [
    'ID', 'TYP', 'STORLEK', 'Stativ', 'TEXTIL', 'Fot',
    'Belysning', 'Värme', 'BESKRIVNING', 'Kommentar'
] as const;

function cloneBahamaInventoryItem(value: unknown): BahamaInventoryItem {
    const source = isRecord(value) ? value : {};
    const result: BahamaInventoryItem = {};
    for (const key of BAHAMA_INVENTORY_KEYS) {
        const cloned = cloneAllowedInventoryString(source[key]);
        if (cloned !== undefined) {
            result[key] = cloned;
        }
    }
    return result;
}

function cloneBahamaInventoryV2Item(value: unknown): BahamaInventoryV2Item {
    const source = isRecord(value) ? value : {};
    const properties = isRecord(source.properties) ? source.properties : {};
    const supportedStatuses = ['available', 'reserved', 'needs-review', 'used', 'sold'] as const;
    const status = supportedStatuses.includes(source.status as typeof supportedStatuses[number])
        ? source.status as typeof supportedStatuses[number]
        : 'needs-review';

    return {
        qrId: stringValue(source.qrId),
        id: stringValue(source.id),
        type: stringValue(source.type),
        size: stringValue(source.size),
        status,
        location: stringValue(source.location),
        properties: {
            stativ: stringValue(properties.stativ),
            textil: stringValue(properties.textil),
            fot: stringValue(properties.fot),
            belysning: stringValue(properties.belysning),
            varme: stringValue(properties.varme)
        },
        comment: stringValue(source.comment),
        createdAt: stringValue(source.createdAt),
        updatedAt: stringValue(source.updatedAt),
        updatedByUid: stringValue(source.updatedByUid),
        updatedByEmail: stringValue(source.updatedByEmail)
    };
}

function cloneClickitupStockMap(value: unknown): ClickitupStockMap {
    if (!isRecord(value)) {
        return {};
    }
    return Object.fromEntries(Object.entries(value).map(([size, entry]) => {
        const source = isRecord(entry) ? entry : {};
        return [size, {
            sektion: finiteNumber(source.sektion),
            dorr_h: finiteNumber(source.dorr_h),
            dorr_v: finiteNumber(source.dorr_v),
            hane_h: finiteNumber(source.hane_h),
            hane_v: finiteNumber(source.hane_v)
        }];
    }));
}

function cloneInventoryData(value: unknown): InventoryData {
    const source = isRecord(value) ? value : {};
    return {
        bahama: Array.isArray(source.bahama) ? source.bahama.map(cloneBahamaInventoryItem) : [],
        bahamaV2: Array.isArray(source.bahamaV2) ? source.bahamaV2.map(cloneBahamaInventoryV2Item) : [],
        clickitup: cloneClickitupStockMap(source.clickitup),
        notes: stringValue(source.notes)
    };
}

function cloneInventoryBasket(value: unknown): InventoryBasketItem[] {
    return Array.isArray(value) ? value.map(cloneBahamaInventoryItem) : [];
}

const SKETCH_EDGE_KEYS: SketchEdgeKey[] = ['front', 'left', 'right', 'back'];

function cloneDoorSegmentsByEdge(value: unknown): SketchConfigState['doorSegmentsByEdge'] {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(SKETCH_EDGE_KEYS.flatMap((edge) => {
        const rows = source[edge];
        return Array.isArray(rows) ? [[edge, rows.map((row) => {
            const item = isRecord(row) ? row : {};
            return { index: finiteNumber(item.index), size: finiteNumber(item.size) };
        })]] : [];
    }));
}

function cloneManualSectionsByEdge(value: unknown): SketchConfigState['manualSectionsByEdge'] {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(SKETCH_EDGE_KEYS.flatMap((edge) => {
        const rows = source[edge];
        return Array.isArray(rows) ? [[edge, rows.map((row) => {
            const item = isRecord(row) ? row : {};
            return { index: finiteNumber(item.index), size: finiteNumber(item.size) };
        })]] : [];
    }));
}

function cloneSectionCountsByEdge(value: unknown): SketchConfigState['sectionCountByEdge'] {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries(SKETCH_EDGE_KEYS.flatMap((edge) => (
        typeof source[edge] === 'number' && Number.isFinite(source[edge])
            ? [[edge, source[edge]]]
            : []
    )));
}

function clonePlacedParasol(value: unknown): PlacedParasol {
    const source = isRecord(value) ? value : {};
    return {
        id: stringValue(source.id),
        presetId: stringValue(source.presetId),
        label: stringValue(source.label),
        widthMm: finiteNumber(source.widthMm),
        depthMm: finiteNumber(source.depthMm),
        rotationDeg: source.rotationDeg === 90 ? 90 : 0,
        xMm: finiteNumber(source.xMm),
        yMm: finiteNumber(source.yMm),
        exportLine: stringValue(source.exportLine),
        exportModel: stringValue(source.exportModel),
        exportSize: stringValue(source.exportSize)
    };
}

function clonePlacedFiesta(value: unknown): PlacedFiesta {
    const source = isRecord(value) ? value : {};
    return {
        id: stringValue(source.id),
        diameterMm: finiteNumber(source.diameterMm),
        xMm: finiteNumber(source.xMm),
        yMm: finiteNumber(source.yMm),
        zLayer: source.zLayer === 'above' ? 'above' : 'below',
        exportLine: stringValue(source.exportLine),
        exportModel: stringValue(source.exportModel),
        exportSize: stringValue(source.exportSize)
    };
}

function cloneSketchWorkspace(value: unknown): SketchWorkspace {
    const source = isRecord(value) ? value : {};
    const camera = isRecord(source.camera) ? source.camera : {};
    const selection = isRecord(source.selection) ? source.selection : {};
    return {
        camera: {
            zoom: finiteNumber(camera.zoom, 1),
            panX: finiteNumber(camera.panX),
            panY: finiteNumber(camera.panY)
        },
        selection: {
            edgeKey: SKETCH_EDGE_KEYS.includes(selection.edgeKey as SketchEdgeKey)
                ? selection.edgeKey as SketchEdgeKey
                : 'front',
            segmentIndex: typeof selection.segmentIndex === 'number' && Number.isFinite(selection.segmentIndex)
                ? selection.segmentIndex
                : null
        },
        uiDensity: source.uiDensity === 'touch' ? 'touch' : 'desktop'
    };
}

function cloneSketchDraft(value: unknown): SketchDraft | null {
    if (!isRecord(value) || !isRecord(value.config) || !isRecord(value.workspace)) {
        return null;
    }
    const source = value.config;
    const priorityModes = ['symmetrical', 'convenient', 'target'] as const;
    const activeModes = ['clickitup', 'parasol', 'fiesta'] as const;
    const config: SketchConfigState = {
        width: finiteNumber(source.width),
        depth: finiteNumber(source.depth),
        depthLeft: finiteNumber(source.depthLeft),
        depthRight: finiteNumber(source.depthRight),
        equalDepth: source.equalDepth === true,
        includeBack: source.includeBack === true,
        prioMode: priorityModes.includes(source.prioMode as typeof priorityModes[number])
            ? source.prioMode as typeof priorityModes[number]
            : 'symmetrical',
        targetLength: finiteNumber(source.targetLength),
        doorSegmentsByEdge: cloneDoorSegmentsByEdge(source.doorSegmentsByEdge),
        manualSectionsByEdge: cloneManualSectionsByEdge(source.manualSectionsByEdge),
        sectionCountByEdge: cloneSectionCountsByEdge(source.sectionCountByEdge),
        activeMode: activeModes.includes(source.activeMode as typeof activeModes[number])
            ? source.activeMode as typeof activeModes[number]
            : 'clickitup',
        parasols: Array.isArray(source.parasols) ? source.parasols.map(clonePlacedParasol) : [],
        selectedParasolId: typeof source.selectedParasolId === 'string' ? source.selectedParasolId : null,
        selectedParasolPresetId: stringValue(source.selectedParasolPresetId),
        fiestaItems: Array.isArray(source.fiestaItems) ? source.fiestaItems.map(clonePlacedFiesta) : [],
        selectedFiestaId: typeof source.selectedFiestaId === 'string' ? source.selectedFiestaId : null
    };
    return { config, workspace: cloneSketchWorkspace(value.workspace) };
}

function cloneAdvancedNode(value: unknown): AdvancedNode {
    const source = isRecord(value) ? value : {};
    return { id: stringValue(source.id), x: finiteNumber(source.x), y: finiteNumber(source.y) };
}

function cloneAdvancedEdge(value: unknown): AdvancedEdge {
    const source = isRecord(value) ? value : {};
    return {
        id: stringValue(source.id),
        startNodeId: stringValue(source.startNodeId),
        endNodeId: stringValue(source.endNodeId),
        ...(typeof source.hasDoor === 'boolean' ? { hasDoor: source.hasDoor } : {}),
        ...(typeof source.doorSize === 'number' && Number.isFinite(source.doorSize) ? { doorSize: source.doorSize } : {}),
        ...(['convenient', 'symmetrical', 'target'].includes(String(source.prioMode))
            ? { prioMode: source.prioMode as NonNullable<AdvancedEdge['prioMode']> }
            : {}),
        ...(typeof source.targetLength === 'number' && Number.isFinite(source.targetLength)
            ? { targetLength: source.targetLength }
            : {})
    };
}

function cloneAdvancedSketchDraft(value: unknown): AdvancedSketchDraft | null {
    if (!isRecord(value) || !isRecord(value.config) || !isRecord(value.workspace)) {
        return null;
    }
    const config = value.config;
    const workspace = value.workspace;
    const camera = isRecord(workspace.camera) ? workspace.camera : {};
    return {
        config: {
            nodes: Array.isArray(config.nodes) ? config.nodes.map(cloneAdvancedNode) : [],
            edges: Array.isArray(config.edges) ? config.edges.map(cloneAdvancedEdge) : []
        },
        workspace: {
            camera: {
                zoom: finiteNumber(camera.zoom, 1),
                panX: finiteNumber(camera.panX),
                panY: finiteNumber(camera.panY)
            },
            uiDensity: workspace.uiDensity === 'touch' ? 'touch' : 'desktop'
        }
    };
}

function cloneRowSource(source: QuoteTotalsRow['source']): QuoteTotalsRow['source'] {
    switch (source?.type) {
        case 'builder':
            return { type: source.type, itemId: String(source.itemId) };
        case 'builder-addon':
            return { type: source.type, itemId: String(source.itemId), addonId: String(source.addonId) };
        case 'builder-custom-addon':
            return {
                type: source.type,
                itemId: String(source.itemId),
                rowId: String(source.rowId),
                categoryId: String(source.categoryId)
            };
        case 'grid':
            return { type: source.type, lineId: String(source.lineId), key: String(source.key) };
        case 'grid-addon':
            return { type: source.type, lineId: String(source.lineId), addonId: String(source.addonId) };
        case 'grid-custom-addon':
            return {
                type: source.type,
                lineId: String(source.lineId),
                categoryId: String(source.categoryId),
                rowId: String(source.rowId)
            };
        case 'grid-custom-item':
            return { type: source.type, lineId: String(source.lineId), rowId: String(source.rowId) };
        case 'custom':
            return { type: source.type, index: Number(source.index) };
        default:
            return { type: 'custom', index: -1 };
    }
}

function normalizeEffectiveQuoteDate(value: unknown, fallbackDate: unknown): string {
    const requested = String(value || '').trim();
    const fallback = String(fallbackDate || '').trim();
    for (const candidate of [requested, fallback]) {
        const parsed = /^\d{4}-\d{2}-\d{2}$/u.test(candidate)
            ? new Date(`${candidate}T00:00:00Z`)
            : null;
        if (parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate) {
            return candidate;
        }
    }
    return invalidCommercial('customerInfo.date', 'expected a valid YYYY-MM-DD date or explicit fallbackDate');
}

function cloneCustomerInfo(customerInfo: QuoteState['customerInfo']): CustomerInfo {
    return {
        name: String(customerInfo?.name || ''),
        company: String(customerInfo?.company || ''),
        email: String(customerInfo?.email || ''),
        reference: String(customerInfo?.reference || ''),
        customerReference: String(customerInfo?.customerReference || ''),
        date: String(customerInfo?.date || ''),
        validity: String(customerInfo?.validity || ''),
        extraNotes: String(customerInfo?.extraNotes || '')
    };
}

function cloneBuilderAddon(addon: BuilderAddon): BuilderAddon {
    const base = {
        id: String(addon.id),
        qty: addon.qty,
        discountPct: addon.discountPct,
        ...(addon.displayName !== undefined ? { displayName: String(addon.displayName) } : {})
    };

    return 'isCustom' in addon && addon.isCustom === true
        ? {
            ...base,
            isCustom: true,
            name: String(addon.name),
            price: addon.price,
            categoryId: String(addon.categoryId)
        }
        : base;
}

function cloneBuilderItem(item: BuilderItem): BuilderItem {
    return {
        id: String(item.id),
        line: String(item.line),
        model: String(item.model),
        size: String(item.size),
        qty: item.qty,
        discountPct: item.discountPct,
        addons: Array.isArray(item.addons) ? item.addons.map(cloneBuilderAddon) : [],
        ...(item.displayName !== undefined ? { displayName: String(item.displayName) } : {}),
        ...(item.source !== undefined ? { source: String(item.source) } : {}),
        ...(item.sourceType !== undefined ? { sourceType: String(item.sourceType) } : {})
    };
}

function cloneGridLineSelection(selection: GridLineSelection): GridLineSelection {
    return {
        items: Object.fromEntries(Object.entries(selection?.items || {}).map(([key, item]) => [key, {
            qty: item.qty,
            discountPct: item.discountPct
        }])),
        addons: Object.fromEntries(Object.entries(selection?.addons || {}).map(([key, addon]) => [key, {
            qty: addon.qty,
            discountPct: addon.discountPct,
            ...(addon.syncMode !== undefined ? { syncMode: addon.syncMode } : {}),
            ...(addon.discountSyncMode !== undefined ? { discountSyncMode: addon.discountSyncMode } : {})
        }])),
        customAddonsByCategory: Object.fromEntries(
            Object.entries(selection?.customAddonsByCategory || {}).map(([categoryId, rows]) => [
                categoryId,
                Array.isArray(rows) ? rows.map((row) => ({
                    id: String(row.id),
                    name: String(row.name),
                    price: row.price,
                    qty: row.qty,
                    discountPct: row.discountPct
                })) : []
            ])
        ),
        ...(Array.isArray(selection?.customItems) ? {
            customItems: selection.customItems.map((row) => ({
                id: String(row.id),
                name: String(row.name),
                size: String(row.size),
                price: row.price,
                qty: row.qty,
                discountPct: row.discountPct
            }))
        } : {})
    };
}

function cloneContractingWork(contractingWork: ContractingWorkState): ContractingWorkState {
    return {
        enabled: contractingWork?.enabled === true,
        projectName: String(contractingWork?.projectName || ''),
        rows: Array.isArray(contractingWork?.rows) ? contractingWork.rows.map((row) => ({
            id: String(row.id),
            workPackage: String(row.workPackage),
            scope: String(row.scope),
            unit: String(row.unit),
            priceExVatSek: row.priceExVatSek
        })) : [],
        margin: {
            enabled: contractingWork?.margin?.enabled === true,
            percent: contractingWork?.margin?.percent
        },
        ata: {
            enabled: contractingWork?.ata?.enabled === true,
            percent: contractingWork?.ata?.percent
        }
    };
}

function createSuppressedContractingWork(): ContractingWorkState {
    return {
        enabled: false,
        projectName: '',
        rows: [],
        margin: { enabled: false, percent: 15 },
        ata: { enabled: false, percent: 15 }
    };
}

function createPersistenceSnapshot(
    state: QuoteState,
    presentation: { exportLanguage: QuoteExportLanguage; pdfThemeId: PdfThemeId },
    isRetailer: boolean,
    effectiveQuoteDate: string
): QuoteState {
    return {
        stateVersion: state.stateVersion,
        step: state.step,
        draftUpdatedAtMs: state.draftUpdatedAtMs,
        selectedLines: Array.isArray(state.selectedLines) ? state.selectedLines.map(String) : [],
        builderItems: Array.isArray(state.builderItems) ? state.builderItems.map(cloneBuilderItem) : [],
        gridSelections: Object.fromEntries(
            Object.entries(state.gridSelections || {}).map(([lineId, selection]) => [
                lineId,
                cloneGridLineSelection(selection)
            ])
        ),
        customCosts: Array.isArray(state.customCosts) ? state.customCosts.map((row) => ({
            description: String(row.description),
            price: row.price,
            qty: row.qty,
            discountPct: row.discountPct
        })) : [],
        contractingWork: isRetailer
            ? createSuppressedContractingWork()
            : cloneContractingWork(state.contractingWork),
        includesVat: state.includesVat === true,
        globalDiscountPct: state.globalDiscountPct,
        prevGlobalDiscountPct: state.prevGlobalDiscountPct,
        exchangeRate: state.exchangeRate,
        customerInfo: {
            ...cloneCustomerInfo(state.customerInfo),
            date: effectiveQuoteDate
        },
        inventoryData: cloneInventoryData(state.inventoryData),
        cloudInventoryData: cloneInventoryData(state.cloudInventoryData),
        sketchDraft: cloneSketchDraft(state.sketchDraft),
        advancedSketchDraft: cloneAdvancedSketchDraft(state.advancedSketchDraft),
        sketchMeta: {
            addedBahamaLine: state.sketchMeta?.addedBahamaLine === true,
            addedFiestaLine: state.sketchMeta?.addedFiestaLine === true
        },
        inventoryBasket: cloneInventoryBasket(state.inventoryBasket),
        activeQuoteId: state.activeQuoteId ? String(state.activeQuoteId) : null,
        quoteNumber: state.quoteNumber ? String(state.quoteNumber) : null,
        activeQuoteVersion: state.activeQuoteVersion,
        quoteStatus: state.quoteStatus,
        includeTerms: state.includeTerms === true,
        termsText: String(state.termsText || ''),
        termsTemplateId: String(state.termsTemplateId || ''),
        termsCustomized: state.termsCustomized === true,
        includeSignatureBlock: state.includeSignatureBlock === true,
        includePaymentBox: state.includePaymentBox === true,
        hideZeroDiscountReferencesInPdf: state.hideZeroDiscountReferencesInPdf === true,
        pdfThemeId: presentation.pdfThemeId,
        exportLanguage: presentation.exportLanguage,
        paymentTermsDays: state.paymentTermsDays,
        quoteValidityDays: state.quoteValidityDays
    };
}

function normalizePresentation(state: QuoteState, audience: QuotePreparationAudience): {
    exportLanguage: QuoteExportLanguage;
    pdfThemeId: PdfThemeId;
    allowedPdfThemeIds: PdfThemeId[];
} {
    const exportLanguage = normalizeExportLanguage(state.exportLanguage);
    const requestedTheme = normalizePdfThemeId(state.pdfThemeId);
    if (!audience.isRetailer) {
        return {
            exportLanguage,
            pdfThemeId: requestedTheme,
            allowedPdfThemeIds: PDF_THEME_OPTIONS.map((option) => option.id)
        };
    }

    const allowedThemes = new Set<PdfThemeId>([DEFAULT_PDF_THEME_ID]);
    for (const candidate of audience.allowedPdfThemes || []) {
        const normalized = normalizePdfThemeId(candidate);
        if (candidate === normalized) {
            allowedThemes.add(normalized);
        }
    }

    return {
        exportLanguage,
        pdfThemeId: allowedThemes.has(requestedTheme) ? requestedTheme : DEFAULT_PDF_THEME_ID,
        allowedPdfThemeIds: [...allowedThemes]
    };
}

function prepareProductRows(
    totals: QuoteTotalsResult,
    exportLanguage: QuoteExportLanguage,
    quoteCatalogData: CatalogData,
    maximumDiscountPct: number
): PreparedQuoteProductRow[] {
    if (!Array.isArray(totals?.totals)) {
        invalidCommercial('totals', 'expected an array');
    }
    return totals.totals.map((row, index) => {
        const qty = requireFinite(row?.qty, `totals[${index}].qty`);
        if (qty <= 0) {
            invalidCommercial(`totals[${index}].qty`, 'expected a positive quantity');
        }
        const discountPct = requireFinite(row?.discountPct, `totals[${index}].discountPct`);
        if (discountPct < 0 || discountPct > maximumDiscountPct) {
            invalidCommercial(
                `totals[${index}].discountPct`,
                `expected a percentage between 0 and ${maximumDiscountPct}`
            );
        }
        const unitPrice = requireFinite(row?.unitPrice, `totals[${index}].unitPrice`);
        const gross = requireFinite(row?.gross, `totals[${index}].gross`);
        const discountSek = requireFinite(row?.discountSek, `totals[${index}].discountSek`);
        const net = requireFinite(row?.net, `totals[${index}].net`);
        requireReconciled(gross, unitPrice * qty, `totals[${index}].gross`);
        requireReconciled(discountSek, gross * discountPct / 100, `totals[${index}].discountSek`);
        requireReconciled(net, gross - discountSek, `totals[${index}].net`);

        return {
            model: translateQuoteTotalsRowModel(row, exportLanguage, quoteCatalogData),
            size: String(row?.size || ''),
            unitPrice,
            qty,
            gross,
            discountPct,
            discountSek,
            net,
            isAddon: row?.isAddon === true,
            isCustom: row?.isCustom === true,
            priceUponRequest: row?.priceUponRequest === true,
            source: cloneRowSource(row.source),
            line: String(row?.line || ''),
            sortModel: String(row?.sortModel || ''),
            sortSizeRaw: String(row?.sortSizeRaw || ''),
            sortKind: row?.sortKind,
            sortDimensions: Array.isArray(row?.sortDimensions) ? row.sortDimensions.map(Number) : [],
            originalIndex: row?.originalIndex
        };
    });
}

function validateAndPrepareProductTotals(
    state: QuoteState,
    totals: QuoteTotalsResult,
    rows: PreparedQuoteProductRow[]
): PreparedQuote['commercial']['productTotals'] {
    const grossTotalSek = requireFinite(totals.grossTotalSek, 'grossTotalSek');
    const totalDiscountSek = requireFinite(totals.totalDiscountSek, 'totalDiscountSek');
    const finalTotalSek = requireFinite(totals.finalTotalSek, 'finalTotalSek');
    const globalDiscountAmt = requireFinite(totals.globalDiscountAmt, 'globalDiscountAmt');
    const globalDiscountPct = requireFinite(state.globalDiscountPct, 'globalDiscountPct');
    if (globalDiscountPct < 0 || globalDiscountPct > 100) {
        invalidCommercial('globalDiscountPct', 'expected a percentage between 0 and 100');
    }
    const rowGrossTotal = rows.reduce((sum, row) => sum + row.gross, 0);
    const rowDiscountTotal = rows.reduce((sum, row) => sum + row.discountSek, 0);
    const rowNetTotal = rows.reduce((sum, row) => sum + row.net, 0);

    requireReconciled(grossTotalSek, rowGrossTotal, 'grossTotalSek');
    requireReconciled(totalDiscountSek, rowDiscountTotal, 'totalDiscountSek');
    requireReconciled(finalTotalSek, rowNetTotal - globalDiscountAmt, 'finalTotalSek');

    const vatBasisSek = finalTotalSek;
    const vatAmountSek = state.includesVat ? vatBasisSek * 0.25 : 0;
    requireFinite(vatAmountSek, 'vatAmountSek');

    return {
        includesVat: state.includesVat === true,
        grossTotalSek,
        totalDiscountSek,
        finalTotalSek,
        globalDiscountAmt,
        globalDiscountPct,
        vatBasisSek,
        vatAmountSek,
        totalWithVatSek: vatBasisSek + vatAmountSek
    };
}

function prepareContractingWork(
    state: QuoteState,
    audience: QuotePreparationAudience
): PreparedQuoteContractingWork | null {
    if (audience.isRetailer) {
        return null;
    }

    const activeRows = state.contractingWork?.enabled === true && Array.isArray(state.contractingWork.rows)
        ? state.contractingWork.rows.filter((row) => String(row?.workPackage || '').trim().length > 0)
        : [];
    if (activeRows.length === 0) {
        return null;
    }
    activeRows.forEach((row, index) => {
        requireFinite(row.priceExVatSek, `contractingWork.rows[${index}].priceExVatSek`);
    });
    const summary = calculateContractingWorkSummary(state.contractingWork);
    const numericTotals = [
        ['baseTotalSek', summary.baseTotalSek],
        ['allowanceSek', summary.allowanceSek],
        ['lowerIndicativeSek', summary.lowerIndicativeSek],
        ['upperIndicativeSek', summary.upperIndicativeSek]
    ] as const;
    numericTotals.forEach(([field, value]) => requireFinite(value, `contractingWork.${field}`));

    return {
        projectName: String(state.contractingWork.projectName || ''),
        rows: summary.customerRows.map((row) => ({
            id: String(row.id),
            workPackage: String(row.workPackage),
            scope: String(row.scope),
            unit: String(row.unit),
            priceExVatSek: row.priceExVatSek
        })),
        baseTotalSek: summary.baseTotalSek,
        ataEnabled: summary.ataEnabled,
        ataPercent: summary.ataPercent,
        allowanceSek: summary.allowanceSek,
        lowerIndicativeSek: summary.lowerIndicativeSek,
        upperIndicativeSek: summary.upperIndicativeSek
    };
}

function hasOnlyZeroDiscounts(rows: PreparedQuoteProductRow[], totalDiscountSek: number): boolean {
    return rows.length > 0 && totalDiscountSek === 0 && rows.every((row) => (
        row.discountPct === 0 && row.discountSek === 0
    ));
}

function canonicalStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalStringify).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => (
            `${JSON.stringify(key)}:${canonicalStringify(record[key])}`
        )).join(',')}}`;
    }
    return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const nested of Object.values(value as Record<string, unknown>)) {
            deepFreeze(nested);
        }
    }
    return value;
}

export function prepareQuote({
    state,
    totals,
    audience,
    fallbackDate,
    catalogData = defaultCatalogData
}: {
    state: QuoteState;
    totals: QuoteTotalsResult;
    audience: QuotePreparationAudience;
    fallbackDate?: string;
    catalogData?: CatalogData;
}): PreparedQuote {
    const normalizedPresentation = normalizePresentation(state, audience);
    const productRows = prepareProductRows(
        totals,
        normalizedPresentation.exportLanguage,
        catalogData,
        audience.isRetailer ? 100 : 200
    );
    const productTotals = validateAndPrepareProductTotals(state, totals, productRows);
    const contractingWork = prepareContractingWork(state, audience);
    const canHideDiscountReferences = hasOnlyZeroDiscounts(productRows, productTotals.totalDiscountSek);
    const discountReferences: PreparedQuote['visibility']['discountReferences'] = state.hideZeroDiscountReferencesInPdf === true
        && canHideDiscountReferences
        ? 'hidden-zero'
        : 'visible';
    const customerInfo = cloneCustomerInfo(state.customerInfo);
    const effectiveQuoteDate = normalizeEffectiveQuoteDate(customerInfo.date, fallbackDate);
    const persistenceSnapshot = createPersistenceSnapshot(
        state,
        normalizedPresentation,
        audience.isRetailer,
        effectiveQuoteDate
    );
    const preparedMeaning = {
        presentation: {
            exportLanguage: normalizedPresentation.exportLanguage,
            pdfThemeId: normalizedPresentation.pdfThemeId
        },
        commercial: {
            productRows,
            productTotals,
            contractingWork
        },
        agreement: {
            customerInfo,
            effectiveQuoteDate,
            quoteIdentity: {
                quoteId: state.activeQuoteId ? String(state.activeQuoteId) : null,
                quoteNumber: state.quoteNumber ? String(state.quoteNumber) : null,
                version: state.activeQuoteVersion,
                status: state.quoteStatus
            },
            legalTerms: {
                included: state.includeTerms === true,
                text: String(state.termsText || ''),
                templateId: String(state.termsTemplateId || ''),
                customized: state.termsCustomized === true
            },
            paymentTermsDays: state.paymentTermsDays,
            validityDays: state.quoteValidityDays,
            includePaymentBox: state.includePaymentBox === true,
            includeSignatureBlock: state.includeSignatureBlock === true
        },
        visibility: {
            contractingWork: audience.isRetailer
                ? 'suppressed-retailer' as const
                : contractingWork
                    ? 'visible' as const
                    : 'absent' as const,
            discountReferenceEligibility: canHideDiscountReferences ? 'eligible-zero' as const : 'ineligible' as const,
            discountReferences,
            legalTerms: state.includeTerms === true ? 'visible' as const : 'hidden' as const,
            paymentBox: state.includePaymentBox === true ? 'visible' as const : 'hidden' as const,
            signatureBlock: state.includeSignatureBlock === true ? 'visible' as const : 'hidden' as const
        }
    };
    const result: PreparedQuote = {
        presentation: {
            ...normalizedPresentation,
            equivalenceKey: canonicalStringify(preparedMeaning)
        },
        commercial: preparedMeaning.commercial,
        agreement: preparedMeaning.agreement,
        visibility: preparedMeaning.visibility,
        persistenceSnapshot
    };

    return deepFreeze(result);
}

export function createQuoteCommercialSnapshot(prepared: PreparedQuote): QuoteCommercialSnapshot {
    if (prepared.commercial.productRows.length > MAX_QUOTE_PRODUCT_ROWS) {
        invalidCommercial(
            'commercialSnapshot.productRows',
            `supports at most ${MAX_QUOTE_PRODUCT_ROWS} customer-visible product rows; reduce the quote before saving`
        );
    }
    if ((prepared.commercial.contractingWork?.rows.length || 0) > MAX_QUOTE_CONTRACTING_WORK_ROWS) {
        invalidCommercial(
            'commercialSnapshot.contractingWork.rows',
            `supports at most ${MAX_QUOTE_CONTRACTING_WORK_ROWS} customer-visible contracting-work rows; reduce the quote before saving`
        );
    }

    return {
        schemaVersion: 1,
        presentation: {
            exportLanguage: prepared.presentation.exportLanguage,
            pdfThemeId: prepared.presentation.pdfThemeId,
            allowedPdfThemeIds: [...prepared.presentation.allowedPdfThemeIds]
        },
        effectiveQuoteDate: prepared.agreement.effectiveQuoteDate,
        productRows: prepared.commercial.productRows.map((row) => ({
            model: row.model,
            size: row.size,
            unitPrice: row.unitPrice,
            qty: row.qty,
            gross: row.gross,
            discountPct: row.discountPct,
            discountSek: row.discountSek,
            net: row.net,
            isAddon: row.isAddon,
            isCustom: row.isCustom,
            priceUponRequest: row.priceUponRequest,
            line: row.line
        })),
        productTotals: { ...prepared.commercial.productTotals },
        contractingWork: prepared.commercial.contractingWork
            ? {
                ...prepared.commercial.contractingWork,
                rows: prepared.commercial.contractingWork.rows.map((row) => ({ ...row }))
            }
            : null,
        visibility: {
            contractingWork: prepared.visibility.contractingWork,
            discountReferences: prepared.visibility.discountReferences
        }
    };
}

export function restorePreparedQuote({
    state,
    commercialSnapshot,
    quoteIdentity,
    audience
}: {
    state: QuoteState;
    commercialSnapshot: unknown;
    quoteIdentity?: PreparedQuote['agreement']['quoteIdentity'];
    audience?: QuotePreparationAudience;
}): PreparedQuote {
    const snapshot = normalizeQuoteCommercialSnapshot(commercialSnapshot);
    if (!snapshot) {
        throw new QuotePreparationError('commercialSnapshot', 'Saved Quote Revision has no valid commercial snapshot.');
    }

    const isRetailer = snapshot.visibility.contractingWork === 'suppressed-retailer';
    const presentation = normalizePresentation({
        ...state,
        exportLanguage: snapshot.presentation.exportLanguage,
        pdfThemeId: snapshot.presentation.pdfThemeId
    }, audience || {
        isRetailer,
        allowedPdfThemes: snapshot.presentation.allowedPdfThemeIds
    });
    const customerInfo = cloneCustomerInfo(state.customerInfo);
    customerInfo.date = snapshot.effectiveQuoteDate;
    const productRows: PreparedQuoteProductRow[] = snapshot.productRows.map((row, index) => ({
        ...row,
        source: { type: 'custom', index },
        sortModel: row.model,
        sortSizeRaw: row.size,
        sortKind: 'text',
        sortDimensions: [],
        originalIndex: index
    }));
    const persistenceSnapshot = createPersistenceSnapshot(
        state,
        presentation,
        isRetailer,
        snapshot.effectiveQuoteDate
    );
    const agreement: PreparedQuote['agreement'] = {
        customerInfo,
        effectiveQuoteDate: snapshot.effectiveQuoteDate,
        quoteIdentity: quoteIdentity || {
            quoteId: state.activeQuoteId ? String(state.activeQuoteId) : null,
            quoteNumber: state.quoteNumber ? String(state.quoteNumber) : null,
            version: state.activeQuoteVersion,
            status: state.quoteStatus
        },
        legalTerms: {
            included: state.includeTerms === true,
            text: String(state.termsText || ''),
            templateId: String(state.termsTemplateId || ''),
            customized: state.termsCustomized === true
        },
        paymentTermsDays: state.paymentTermsDays,
        validityDays: state.quoteValidityDays,
        includePaymentBox: state.includePaymentBox === true,
        includeSignatureBlock: state.includeSignatureBlock === true
    };
    const commercial: PreparedQuote['commercial'] = {
        productRows,
        productTotals: { ...snapshot.productTotals },
        contractingWork: snapshot.contractingWork
            ? { ...snapshot.contractingWork, rows: snapshot.contractingWork.rows.map((row) => ({ ...row })) }
            : null
    };
    const visibility: PreparedQuote['visibility'] = {
        contractingWork: snapshot.visibility.contractingWork,
        discountReferenceEligibility: hasOnlyZeroDiscounts(
            productRows,
            snapshot.productTotals.totalDiscountSek
        ) ? 'eligible-zero' : 'ineligible',
        discountReferences: snapshot.visibility.discountReferences,
        legalTerms: state.includeTerms === true ? 'visible' : 'hidden',
        paymentBox: state.includePaymentBox === true ? 'visible' : 'hidden',
        signatureBlock: state.includeSignatureBlock === true ? 'visible' : 'hidden'
    };
    const preparedMeaning = {
        presentation: {
            exportLanguage: presentation.exportLanguage,
            pdfThemeId: presentation.pdfThemeId
        },
        commercial,
        agreement,
        visibility
    };

    return deepFreeze({
        presentation: {
            ...presentation,
            equivalenceKey: canonicalStringify(preparedMeaning)
        },
        commercial,
        agreement,
        visibility,
        persistenceSnapshot
    });
}
