import type { ReactNode } from 'react';

export type QuoteStatus = 'draft' | 'sent' | 'won' | 'lost' | 'archived';

export type ScriveStatus =
    | 'not_sent'
    | 'preparation'
    | 'pending'
    | 'closed'
    | 'rejected'
    | 'canceled'
    | 'timedout'
    | 'failed';

export type AccessLevel = 'guest' | 'full' | 'quote-only' | 'sketch-only' | 'retailer';

export type QuoteStep =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 'inventory'
    | 'inventory-logs'
    | 'activity-logs'
    | 'planner'
    | 'retailers'
    | 'sketch'
    | 'history';

export type QuoteFlowStep = 1 | 2 | 3 | 4;

export type AdminStep =
    | 'inventory'
    | 'inventory-logs'
    | 'activity-logs'
    | 'planner'
    | 'retailers';

export type StepInput = QuoteStep | number | string;

export interface AccessUser {
    uid?: string | null;
    email?: string | null;
    [key: string]: any;
}

export interface AccessCapabilities {
    canViewEverything: boolean;
    canStartQuote: boolean;
    canAccessSketch: boolean;
    canAccessQuoteHistory: boolean;
    canExportSketchToQuote: boolean;
}

export interface CustomerInfo {
    name: string;
    company: string;
    email: string;
    reference: string;
    customerReference: string;
    date: string;
    validity: string;
    extraNotes: string;
}

export interface CustomCostRow {
    description: string;
    price: number;
    qty: number;
    discountPct: number;
}

export interface BahamaInventoryItem {
    ID?: string;
    TYP?: string;
    STORLEK?: string;
    TEXTIL?: string;
    BESKRIVNING?: string;
    Kommentar?: string;
    [key: string]: unknown;
}

export type InventoryBasketItem = BahamaInventoryItem;

export type ClickitupFieldKey = 'sektion' | 'dorr_h' | 'dorr_v' | 'hane_h' | 'hane_v';

export interface ClickitupStockEntry {
    sektion: number;
    dorr_h: number;
    dorr_v: number;
    hane_h: number;
    hane_v: number;
}

export type ClickitupStockMap = Record<string, ClickitupStockEntry>;

export interface InventoryData {
    bahama: BahamaInventoryItem[];
    clickitup: ClickitupStockMap;
    notes?: string;
}

export interface GridCustomAddonRow {
    id: string;
    name: string;
    price: number;
    qty: number;
    discountPct: number;
}

export interface GridLineSelection {
    items: Record<string, any>;
    addons: Record<string, any>;
    customAddonsByCategory: Record<string, GridCustomAddonRow[]>;
    customItems?: any[];
    [key: string]: any;
}

export type GridSelections = Record<string, GridLineSelection>;

export interface CatalogBuilderAddon {
    id: string;
    qty: number;
    discountPct: number;
}

export interface CustomBuilderAddon extends CatalogBuilderAddon {
    isCustom: true;
    name: string;
    price: number;
    categoryId: string;
}

export type BuilderAddon = CatalogBuilderAddon | CustomBuilderAddon;

export interface BuilderItem {
    id: string;
    line: string;
    model: string;
    size: string;
    qty: number;
    discountPct: number;
    addons: BuilderAddon[];
    source?: string;
    sourceType?: string;
    [key: string]: any;
}

export interface SketchMeta {
    addedBahamaLine: boolean;
    addedFiestaLine: boolean;
}

export interface QuoteState {
    stateVersion: number;
    step: StepInput;
    selectedLines: string[];
    builderItems: BuilderItem[];
    gridSelections: GridSelections;
    customCosts: CustomCostRow[];
    includesVat: boolean;
    globalDiscountPct: number;
    prevGlobalDiscountPct: number;
    exchangeRate: number;
    customerInfo: CustomerInfo;
    inventoryData: InventoryData;
    cloudInventoryData: InventoryData;
    sketchDraft: SketchDraft | null;
    sketchMeta: SketchMeta;
    inventoryBasket: InventoryBasketItem[];
    activeQuoteId: string | null;
    activeQuoteVersion: number;
    quoteStatus: QuoteStatus;
    includeTerms: boolean;
    termsText: string;
    termsTemplateId: string;
    termsCustomized: boolean;
    includeSignatureBlock: boolean;
    includePaymentBox: boolean;
    hideZeroDiscountReferencesInPdf: boolean;
    paymentTermsDays: number;
    quoteValidityDays: number;
    scriveEnabled: boolean;
    scriveStatus: ScriveStatus;
    scriveDocumentId: string | null;
    scriveSignerName: string;
    scriveSignerEmail: string;
    scriveLastError: string | null;
    scriveSentAtMs: number | null;
    scriveLastEventAtMs: number | null;
    scriveCompletedAtMs: number | null;
}

export interface QuoteSummary {
    finalTotalSek: number;
    grossTotalSek: number;
    totalDiscountSek: number;
}

export interface LegalTemplateOption {
    id: string;
    label: string;
    body: string;
    ownerUid?: string;
    ownerEmail?: string;
    createdAt?: string;
}

export type QuoteTotalsRowSortKind = 'number' | 'dimension' | 'text' | 'empty';

export type QuoteTotalsRowSource =
    | { type: 'builder'; itemId: string }
    | { type: 'builder-addon'; itemId: string; addonId: string }
    | { type: 'builder-custom-addon'; itemId: string; rowId: string; categoryId: string }
    | { type: 'grid'; lineId: string; key: string }
    | { type: 'grid-addon'; lineId: string; addonId: string }
    | { type: 'grid-custom-addon'; lineId: string; categoryId: string; rowId: string }
    | { type: 'grid-custom-item'; lineId: string; rowId: string }
    | { type: 'custom'; index: number };

export interface QuoteTotalsRow {
    model: string;
    size: string;
    unitPrice: number;
    qty: number;
    gross: number;
    discountPct: number;
    discountSek: number;
    net: number;
    isAddon: boolean;
    isCustom?: boolean;
    source: QuoteTotalsRowSource;
    line: string;
    sortModel: string;
    sortSizeRaw: string;
    sortKind: QuoteTotalsRowSortKind;
    sortDimensions: number[];
    originalIndex: number;
}

export interface QuoteTotalsResult extends QuoteSummary {
    totals: QuoteTotalsRow[];
    globalDiscountAmt: number;
}

export interface ScriveMetadata {
    scriveEnabled: boolean;
    scriveStatus: ScriveStatus;
    scriveDocumentId: string | null;
    scriveSignerName: string;
    scriveSignerEmail: string;
    scriveLastError: string | null;
    scriveSentAtMs: number | null;
    scriveLastEventAtMs: number | null;
    scriveCompletedAtMs: number | null;
}

export interface QuoteMetadata extends ScriveMetadata {
    quoteId: string;
    customerName: string;
    company: string;
    reference: string;
    customerReference: string;
    status: QuoteStatus;
    createdAtMs: number;
    updatedAtMs: number;
    savedBy: string;
    savedByUid: string;
    latestVersion: number;
    latestRevisionId: string;
    totalSek: number;
    retailerName?: string | null;
    searchText: string;
    state?: QuoteState | Record<string, any> | null;
    summary?: QuoteSummary | Record<string, any> | null;
}

export interface QuoteRevision {
    revisionId: string;
    quoteId: string;
    version: number;
    savedAtMs: number;
    savedBy: string;
    savedByUid: string;
    state: QuoteState | Record<string, any>;
    summary: QuoteSummary | Record<string, any>;
    changeNote: string;
}

export interface QuoteFilters {
    status?: string;
    search?: string;
}

export interface QuoteRevisionSaveInput {
    user: AccessUser;
    quoteId: string;
    state: QuoteState | Record<string, any>;
    summary: Partial<QuoteSummary> | Record<string, any>;
    customerInfo?: Partial<CustomerInfo>;
    status?: QuoteStatus | string;
    scrive?: Partial<{
        enabled: boolean;
        status: ScriveStatus | string;
        documentId: string | null;
        signerName: string;
        signerEmail: string;
        lastError: string | null;
        sentAtMs: number | null;
        lastEventAtMs: number | null;
        completedAtMs: number | null;
    }>;
    changeNote?: string;
    retailerName?: string | null;
}

export interface CreateQuoteInput extends Omit<QuoteRevisionSaveInput, 'quoteId'> {}

export interface UpdateQuoteStatusInput {
    userId: string;
    quoteId: string;
    status: QuoteStatus | string;
}

export interface UpdateQuoteScriveInput {
    userId: string;
    quoteId: string;
    scrive?: QuoteRevisionSaveInput['scrive'];
}

export interface GetUserQuotesInput extends QuoteFilters {
    userId: string;
}

export interface GetAllUsersQuotesInput extends QuoteFilters {}

export interface GetQuoteRevisionsInput {
    userId: string;
    quoteId: string;
    limit?: number;
}

export interface GetQuoteLatestRevisionInput {
    userId: string;
    quoteId: string;
}

export interface DeleteQuoteInput {
    userId: string;
    quoteId: string;
}

export interface QuoteLatestRevisionResult {
    metadata: QuoteMetadata;
    revision: QuoteRevision | null;
}

export interface SaveQuoteToRepositoryResult {
    saved: { quoteId?: string; metadata?: QuoteMetadata; revision?: QuoteRevision };
    isNewQuote: boolean;
    statePatch: Partial<QuoteState>;
}

export interface QuoteRepository {
    createQuote(input: CreateQuoteInput): Promise<{ quoteId: string; metadata: QuoteMetadata; revision: QuoteRevision }>;
    saveQuoteRevision(input: QuoteRevisionSaveInput): Promise<{ metadata: QuoteMetadata; revision: QuoteRevision }>;
    getUserQuotes(input: GetUserQuotesInput): Promise<Array<QuoteMetadata>>;
    getQuoteLatestRevision(input: GetQuoteLatestRevisionInput): Promise<QuoteLatestRevisionResult | null>;
    getQuoteRevisions(input: GetQuoteRevisionsInput): Promise<Array<QuoteRevision>>;
    deleteQuote(input: DeleteQuoteInput): Promise<void>;
    updateQuoteStatus(input: UpdateQuoteStatusInput): Promise<QuoteMetadata>;
    updateQuoteScrive(input: UpdateQuoteScriveInput): Promise<QuoteMetadata>;
    getAllUsersQuotes(input?: GetAllUsersQuotesInput): Promise<Array<QuoteMetadata & { ownerUid: string }>>;
}

export interface QuoteRepositoryDeps {
    db?: any;
    doc?: (...args: any[]) => any;
    getDoc?: (...args: any[]) => Promise<{
        exists(): boolean;
        data(): Record<string, any> | undefined;
        id?: string;
        ref?: any;
    }>;
    setDoc?: (...args: any[]) => Promise<any>;
    updateDoc?: (...args: any[]) => Promise<any>;
    deleteDoc?: (...args: any[]) => Promise<any>;
    collection?: (...args: any[]) => any;
    collectionGroup?: (...args: any[]) => any;
    getDocs?: (...args: any[]) => Promise<{
        docs: Array<{
            id: string;
            data(): Record<string, any> | undefined;
            ref?: {
                parent?: {
                    parent?: {
                        id?: string;
                    };
                };
            };
        }>;
        empty?: boolean;
        forEach?: (callback: (docSnap: { ref: any }) => void) => void;
    }>;
    query?: (...args: any[]) => any;
    orderBy?: (...args: any[]) => any;
    limit?: (...args: any[]) => any;
    where?: (...args: any[]) => any;
    startAfter?: (...args: any[]) => any;
    addDoc?: (...args: any[]) => Promise<any>;
    writeBatch?: (...args: any[]) => {
        delete: (ref: any) => void;
        commit: () => Promise<any>;
    };
    runTransaction?: (
        db: any,
        updateFn: (transaction: {
            get: (ref: any) => Promise<{
                exists(): boolean;
                data(): Record<string, any> | undefined;
            }>;
            set: (ref: any, data: any, options?: any) => void;
        }) => Promise<unknown>
    ) => Promise<unknown>;
}

export type QuoteReducerAction =
    | { type: 'SET_STEP'; payload: StepInput }
    | { type: 'HYDRATE_STATE'; payload: Partial<QuoteState> | Record<string, any> | null | undefined }
    | { type: 'UPDATE_STATE'; payload: Partial<QuoteState> | Record<string, any> }
    | { type: 'SET_CUSTOMER_INFO'; payload: Partial<CustomerInfo> | Record<string, any> }
    | { type: 'UPDATE_CUSTOMER_INFO'; payload: Partial<CustomerInfo> | Record<string, any> }
    | { type: 'SET_INCLUDES_VAT'; payload: boolean }
    | { type: 'SET_GLOBAL_DISCOUNT'; payload: number }
    | { type: 'SET_EXCHANGE_RATE'; payload: number }
    | { type: 'SET_SELECTED_LINES'; payload: string[] }
    | { type: 'SET_BUILDER_ITEMS'; payload: BuilderItem[] }
    | { type: 'SET_GRID_SELECTIONS'; payload: GridSelections }
    | { type: 'SET_CUSTOM_COSTS'; payload: CustomCostRow[] }
    | { type: 'SET_INVENTORY_DATA'; payload: InventoryData }
    | { type: 'SET_CLOUD_INVENTORY_DATA'; payload: InventoryData }
    | { type: 'SET_INVENTORY_BASKET'; payload: InventoryBasketItem[] }
    | { type: 'SET_INCLUDE_TERMS'; payload: boolean }
    | { type: 'SET_TERMS_TEXT'; payload: string }
    | { type: 'SET_TERMS_TEMPLATE_ID'; payload: string }
    | { type: 'SET_TERMS_CUSTOMIZED'; payload: boolean }
    | { type: 'SET_INCLUDE_PAYMENT_BOX'; payload: boolean }
    | { type: 'SET_INCLUDE_SIGNATURE_BLOCK'; payload: boolean }
    | { type: 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF'; payload: boolean }
    | { type: 'SET_PAYMENT_TERMS_DAYS'; payload: number }
    | { type: 'SET_QUOTE_VALIDITY_DAYS'; payload: number }
    | { type: 'RESET_STATE' };

export interface QuoteContextValue {
    state: QuoteState;
    dispatch: (action: QuoteReducerAction) => void;
}

export interface HeaderProps {
    currentStep?: StepInput;
}

export interface DashboardProps {
    onStartQuote?: () => void;
    onOpenInventory?: () => void;
    onOpenSketch?: () => void;
    onOpenPlanner?: () => void;
    onOpenActivity?: () => void;
    onOpenRetailers?: () => void;
}

export interface ProductLineSelectionProps {
    onNext: () => void;
}

export interface ConfigurationProps {
    onNext: () => void;
    onPrev: () => void;
    onBackToSketch?: () => void;
}

export interface PricingProps {
    onNext: () => void;
    onPrev: () => void;
}

export interface SummaryExportProps {
    onPrev?: () => void;
    onBackToSketch?: () => void;
}

export type HydratedQuoteStatePayload = Partial<QuoteState> | Record<string, any>;

export interface HistoryProps {
    onBack?: () => void;
    onOpenQuote?: (payload: HydratedQuoteStatePayload) => void;
}

export interface TermsAndPaymentPanelProps {
    summaryData: QuoteTotalsResult;
}

export interface ErrorBoundaryProps {
    children?: ReactNode;
}

export interface ErrorBoundaryState {
    hasError: boolean;
}

export interface HistoryOwnerOption {
    uid: string;
    email: string;
    retailerName?: string | null;
    quoteCount: number;
}

export type HistoryQuoteRow = QuoteMetadata & { ownerUid?: string };

export interface RetailerProductLineConfig {
    enabled: boolean;
    discountPct: number;
}

export interface RetailerProductLineDraftConfig {
    enabled: boolean;
    discountPct: number | '';
}

export interface RetailerWriteInput {
    name: string;
    email: string;
    password?: string;
    notes: string;
    productLines: Record<string, RetailerProductLineDraftConfig>;
}

export interface RetailerFormState extends RetailerWriteInput {}

export interface RetailerRecord {
    id?: string;
    name?: string;
    email?: string;
    notes?: string;
    productLines?: Record<string, RetailerProductLineConfig>;
    createdAt?: number;
    updatedAt?: number;
    createdBy?: string;
    createdByUid?: string;
    updatedBy?: string;
    updatedByUid?: string;
    [key: string]: unknown;
}

export interface InventoryTableProps {
    items: BahamaInventoryItem[];
    searchTerm: string;
    onAddToBasket: (item: BahamaInventoryItem) => void;
    onEdit: (index: number, item: BahamaInventoryItem) => void;
    onDelete: (index: number, item: BahamaInventoryItem) => void;
}

export interface InventoryItemModalProps {
    item: BahamaInventoryItem | null;
    editIndex: number;
    onSave: (item: BahamaInventoryItem, editIndex: number) => void;
    onClose: () => void;
}

export interface PendingChangesPanelProps {
    inventoryData: InventoryData;
    cloudInventoryData: InventoryData;
    onCommit: () => void | Promise<void>;
    isSaving: boolean;
}

export interface ClickitupStockGridProps {
    inventoryData: InventoryData;
    cloudInventoryData: InventoryData;
    onUpdateStock: (size: string, field: ClickitupFieldKey, delta: number) => void;
}

export interface RetailerManagerProps {
    onBack?: () => void;
}

export interface InventoryManagerProps {
    onBack?: () => void;
}

export interface InventoryLogsProps {
    onBack?: () => void;
}

export interface ActivityLogsProps {
    onBack?: () => void;
}

export interface InventoryLogRow {
    id: string;
    timestampMs: number;
    createdAtMs: number;
    resolvedMs: number;
    category: string;
    action: string;
    targetId: string;
    delta: number | null;
    user: string;
    userUid: string;
    details: string;
}

export interface InventoryLogFilters {
    fromDate: string;
    toDate: string;
    category: string;
    action: string;
    actor: string;
    search: string;
}

export interface ActivityLogMetadata {
    [key: string]: unknown;
}

export interface ActivityLogRow {
    id: string;
    createdAtMs: number;
    timestampMs: number;
    resolvedMs: number;
    eventType: string;
    system: string;
    targetType: string;
    targetId: string;
    user: string;
    userUid: string;
    details: string;
    metadata: ActivityLogMetadata;
}

export interface ActivityLogFilters {
    fromDate: string;
    toDate: string;
    system: string;
    eventType: string;
    actor: string;
    search: string;
}

export interface ActivityEventDefinition {
    label: string;
    icon: string;
    color: string;
}

export interface PaginatedLogPageState<Row> {
    loading: boolean;
    pageIndex: number;
    pageStarts: Array<unknown | null>;
    hasNext: boolean;
    rows: Row[];
    error?: boolean;
}

export interface AuthContextValue {
    user: AccessUser | null;
    loading: boolean;
    accessLevel: AccessLevel;
    canViewEverything: boolean;
    canStartQuote: boolean;
    canAccessSketch: boolean;
    canAccessQuoteHistory: boolean;
    canExportSketchToQuote: boolean;
    login: (email: string, password: string) => Promise<any>;
    logout: () => Promise<any>;
    retailer: RetailerRecord | null;
    isRetailer: boolean;
}

export type SketchEdgeKey = 'front' | 'left' | 'right' | 'back';

export type SketchDensity = 'desktop' | 'touch';

export type SketchMode = 'clickitup' | 'parasol' | 'fiesta';

export type SketchPriorityMode = 'symmetrical' | 'convenient' | 'target';

export type SketchSectionEntry = number | string;

export interface DoorSegment {
    index: number;
    size: number;
}

export interface ManualSectionPin {
    index: number;
    size: number;
}

export type DoorSegmentsByEdge = Partial<Record<SketchEdgeKey, DoorSegment[]>>;

export type ManualSectionsByEdge = Partial<Record<SketchEdgeKey, ManualSectionPin[]>>;

export type SectionCountByEdge = Partial<Record<SketchEdgeKey, number>>;

export interface SketchAreaPoint {
    x: number;
    y: number;
}

export interface SketchPolygon {
    points: SketchAreaPoint[];
}

export interface SketchCamera {
    zoom: number;
    panX: number;
    panY: number;
}

export interface SketchSelection {
    edgeKey: SketchEdgeKey;
    segmentIndex: number | null;
}

export interface SketchWorkspace {
    camera: SketchCamera;
    selection: SketchSelection;
    uiDensity: SketchDensity;
}

export type FiestaLayer = 'above' | 'below';

export interface SketchExportableItem {
    id: string;
    exportLine: string;
    exportModel: string;
    exportSize: string;
}

export interface ParasolPreset {
    id: string;
    label: string;
    widthMm: number;
    depthMm: number;
    shapeCategory: string;
    exportLine: string;
    exportModel: string;
    exportSize: string;
}

export interface PlacedParasol extends SketchExportableItem {
    presetId: string;
    label: string;
    widthMm: number;
    depthMm: number;
    rotationDeg: 0 | 90;
    xMm: number;
    yMm: number;
}

export interface PlacedFiesta extends SketchExportableItem {
    diameterMm: number;
    xMm: number;
    yMm: number;
    zLayer: FiestaLayer;
}

export interface SketchConfigState {
    width: number;
    depth: number;
    depthLeft: number;
    depthRight: number;
    equalDepth: boolean;
    includeBack: boolean;
    prioMode: SketchPriorityMode;
    targetLength: number;
    doorSegmentsByEdge: DoorSegmentsByEdge;
    manualSectionsByEdge: ManualSectionsByEdge;
    sectionCountByEdge: SectionCountByEdge;
    activeMode: SketchMode;
    parasols: PlacedParasol[];
    selectedParasolId: string | null;
    selectedParasolPresetId: string;
    fiestaItems: PlacedFiesta[];
    selectedFiestaId: string | null;
    doorEdges?: SketchEdgeKey[] | Set<SketchEdgeKey>;
    doorSizeByEdge?: Partial<Record<SketchEdgeKey, number>>;
    [key: string]: unknown;
}

export interface SketchDraft {
    config: SketchConfigState;
    workspace: SketchWorkspace;
}

export type EdgeDiagnosticErrorCode = 'NO_DOOR_COMBINATION' | 'NO_SECTION_SOLUTION' | 'WRONG_COUNT' | null;

export interface EdgeDiagnostic {
    valid: boolean;
    requestedDoorSize: number | null;
    resolvedDoorSize: number | null;
    autoAdjusted: boolean;
    errorCode: EdgeDiagnosticErrorCode;
}

export type LayoutWarningLevel = 'none' | 'warning' | 'critical';

export interface LayoutWarning {
    id: string;
    level: Exclude<LayoutWarningLevel, 'none'>;
    code: string;
    edge: SketchEdgeKey;
    text: string;
}

export type LayoutSuggestionPriority = 'high' | 'medium' | 'low';

export type LayoutSuggestion =
    | {
          id: string;
          type: 'setDoorSegmentSize';
          edge: SketchEdgeKey;
          index: number;
          value: number;
          priority: LayoutSuggestionPriority;
          text: string;
      }
    | {
          id: string;
          type: 'removeDoorSegment';
          edge: SketchEdgeKey;
          index: number;
          priority: LayoutSuggestionPriority;
          text: string;
      }
    | {
          id: string;
          type: 'setDimension';
          edge: SketchEdgeKey;
          dimension: 'width' | 'depth' | 'depthLeft' | 'depthRight';
          value: number;
          priority: LayoutSuggestionPriority;
          text: string;
      }
    | {
          id: string;
          type: 'setSectionCount';
          edge: SketchEdgeKey;
          value: number;
          priority: LayoutSuggestionPriority;
          text: string;
      }
    | {
          id: string;
          type: 'clearSectionCount';
          edge: SketchEdgeKey;
          priority: LayoutSuggestionPriority;
          text: string;
      };

export interface SketchRenderedSegment {
    index: number;
    key: string;
    type: 'door' | 'section';
    length: number;
    label: string;
    isDoor: boolean;
}

export interface EdgeGeometry {
    setbackMm: number;
    leadingPostMm: number;
}

export interface EdgeSummary {
    edge: SketchEdgeKey;
    enabled: boolean;
    requestedLength: number;
    effectiveLength: number;
    solverLength: number;
    setbackMm: number;
    leadingPostMm: number;
    valid: boolean;
    warningLevel: LayoutWarningLevel;
    requestedDoorSize: number | null;
    resolvedDoorSize: number | null;
    autoAdjusted: boolean;
    errorCode: EdgeDiagnosticErrorCode;
    segments: SketchRenderedSegment[];
    sectionCount: number;
    doorCount: number;
}

export interface StockComparisonRow {
    type: string;
    size: string;
    needed: number;
    inStock: number;
    isShort: boolean;
    diff: number;
    shortfall: number;
}

export interface ComputedLayoutResult {
    requestedDimensions: {
        width: number;
        depth: number;
        depthLeft: number;
        depthRight: number;
    };
    effectiveDimensions: Record<SketchEdgeKey, number>;
    solverDimensions: Record<SketchEdgeKey, number>;
    edgeGeometry: Record<SketchEdgeKey, EdgeGeometry>;
    width: number;
    depth: number;
    depthLeft: number;
    depthRight: number;
    targetLength: number;
    doorSegmentsByEdge: DoorSegmentsByEdge;
    manualSectionsByEdge: ManualSectionsByEdge;
    sectionCountByEdge: SectionCountByEdge;
    leftEdge: SketchSectionEntry[];
    rightEdge: SketchSectionEntry[];
    frontEdge: SketchSectionEntry[];
    backEdge: SketchSectionEntry[];
    allSections: SketchSectionEntry[];
    doorCount: number;
    slimlineCount: number;
    stodbenCount: number;
    counts: Record<string, number>;
    totalGlassLength: number;
    edgeDiagnostics: Record<SketchEdgeKey, EdgeDiagnostic>;
    edgeSummaries: Record<SketchEdgeKey, EdgeSummary>;
    layoutWarnings: LayoutWarning[];
    suggestions: LayoutSuggestion[];
    hasInvalidEdges: boolean;
}

export interface SketchToolProps {
    onBack?: () => void;
}

export interface SketchCanvasProps {
    width: number;
    depth: number;
    depthLeft?: number;
    depthRight?: number;
    equalDepth?: boolean;
    includeBack: boolean;
    leftEdge: SketchSectionEntry[];
    rightEdge: SketchSectionEntry[];
    frontEdge: SketchSectionEntry[];
    backEdge: SketchSectionEntry[];
    edgeDiagnostics?: Partial<Record<SketchEdgeKey, EdgeDiagnostic>>;
    edgeSummaries?: Partial<Record<SketchEdgeKey, EdgeSummary>>;
    layoutWarnings?: LayoutWarning[];
    suggestions?: LayoutSuggestion[];
    camera?: SketchCamera;
    selection?: SketchSelection;
    uiDensity?: SketchDensity;
    activeMode?: SketchMode;
    parasols?: PlacedParasol[];
    selectedParasolId?: string | null;
    fiestaItems?: PlacedFiesta[];
    selectedFiestaId?: string | null;
    onResize?: (dims: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>>) => void;
    onResizePreview?: (dims: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>> | null) => void;
    onResizeCommit?: (dims: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>>) => void;
    onSelectEdge?: (edgeKey: SketchEdgeKey) => void;
    onSelectSection?: (edgeKey: SketchEdgeKey, segmentIndex: number | null) => void;
    onApplySuggestion?: (suggestionId: string) => void;
    onCameraChange?: (camera: SketchCamera) => void;
    onChangeMode?: (mode: SketchMode) => void;
    onPlaceParasol?: (xMm: number, yMm: number) => void;
    onSelectParasol?: (id: string | null) => void;
    onMoveParasol?: (id: string, xMm: number, yMm: number) => void;
    onPlaceFiesta?: (xMm: number, yMm: number) => void;
    onSelectFiesta?: (id: string | null) => void;
    onMoveFiesta?: (id: string, xMm: number, yMm: number) => void;
    onReset?: () => void;
}

export interface SketchConfigProps {
    config: SketchConfigState;
    onChange: (partial: Partial<SketchConfigState>) => void;
    selectedEdge: SketchEdgeKey | null;
    selectedSegmentIndex: number | null;
    onSelectEdge?: (edgeKey: SketchEdgeKey) => void;
    onSetManualPin?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number | null) => void;
    onClearManualPins?: (edgeKey: SketchEdgeKey) => void;
    onConvertSegmentToDoor?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number) => void;
    onSetDoorSegmentSize?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number) => void;
    onResetDoorSegment?: (edgeKey: SketchEdgeKey, segmentIndex: number) => void;
    edgeSummaries?: Partial<Record<SketchEdgeKey, EdgeSummary>>;
    onDeleteParasol?: (id: string) => void;
    onRotateParasol?: (id: string, rotationDeg: 0 | 90) => void;
    onDeleteFiesta?: (id: string) => void;
    onSetSectionCount?: (edgeKey: SketchEdgeKey, count: number) => void;
    onClearSectionCount?: (edgeKey: SketchEdgeKey) => void;
}

export interface SketchBomProps {
    counts: Record<string, number>;
    totalGlassLength: number;
    slimlineCount: number;
    stodbenCount: number;
    hasInvalidEdges: boolean;
    invalidEdges: Array<[SketchEdgeKey, EdgeDiagnostic]>;
    autoAdjustedEdges: Array<[SketchEdgeKey, EdgeDiagnostic]>;
    parasols?: PlacedParasol[];
    fiestaItems?: PlacedFiesta[];
    parasolWarnings?: Array<{ id: string; text: string }>;
    canExportToQuote?: boolean;
    onExport?: () => void;
    onExportImage?: () => void;
}

export interface StockComparisonModalProps {
    allSections: SketchSectionEntry[];
    slimlineCount: number;
    stodbenCount: number;
    clickitupStock: ClickitupStockMap;
    onConfirm: () => void;
    onCancel: () => void;
}

export interface SketchExportBuilderItem extends BuilderItem {
    source: 'sketch';
    sourceType: 'parasol' | 'fiesta';
}

export interface SketchExportStateResult {
    selectedLines: string[];
    builderItems: BuilderItem[];
    sketchMeta: SketchMeta;
}
