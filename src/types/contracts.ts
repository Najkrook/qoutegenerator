import type { UserCredential } from 'firebase/auth';
import type { ReactNode } from 'react';

export type QuoteStatus = 'draft' | 'sent' | 'won' | 'lost' | 'archived';

export type OrderRequestStatus = 'new' | 'reviewing' | 'completed';
export type RetailerDocumentKind = 'color-chart' | 'installation-instructions';

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

export type UnknownRecord = Record<string, unknown>;

export interface ErrorLike extends UnknownRecord {
    name?: unknown;
    code?: unknown;
    message?: unknown;
}

export interface SnapshotSource<TData = unknown> {
    id?: unknown;
    data?: (() => TData | undefined) | TData | undefined;
}

export interface AccessUser {
    uid?: string | null;
    email?: string | null;
    [key: string]: unknown;
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

export interface RawPersistedCustomerInfo extends UnknownRecord {
    name?: unknown;
    company?: unknown;
    email?: unknown;
    reference?: unknown;
    customerReference?: unknown;
    date?: unknown;
    validity?: unknown;
    extraNotes?: unknown;
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

export interface RawClickitupStockEntry extends UnknownRecord {
    sektion?: unknown;
    dorr_h?: unknown;
    dorr_v?: unknown;
    hane_h?: unknown;
    hane_v?: unknown;
}

export type ClickitupStockMap = Record<string, ClickitupStockEntry>;

export interface InventoryData {
    bahama: BahamaInventoryItem[];
    clickitup: ClickitupStockMap;
    notes?: string;
}

export interface RawPersistedInventoryData extends UnknownRecord {
    bahama?: unknown;
    clickitup?: unknown;
}

export interface GridCustomAddonRow {
    id: string;
    name: string;
    price: number;
    qty: number;
    discountPct: number;
}

export interface GridCustomItemRow {
    id: string;
    name: string;
    size: string;
    price: number;
    qty: number;
    discountPct: number;
}

export type GridAddonSyncMode = 'auto' | 'manual';

export type GridAddonDiscountSyncMode = 'global' | 'manual';

export interface GridItemSelectionState {
    qty: number;
    discountPct: number;
}

export interface GridAddonState {
    qty: number;
    discountPct: number;
    syncMode?: GridAddonSyncMode;
    discountSyncMode?: GridAddonDiscountSyncMode;
}

export interface EffectiveGridAddonState extends GridAddonState {
    qty: number;
    discountPct: number;
    syncMode: GridAddonSyncMode;
    discountSyncMode: GridAddonDiscountSyncMode;
    isAutoScaled: boolean;
}

export interface GridLineSelection {
    items: Record<string, GridItemSelectionState>;
    addons: Record<string, GridAddonState>;
    customAddonsByCategory: Record<string, GridCustomAddonRow[]>;
    customItems?: GridCustomItemRow[];
    [key: string]: unknown;
}

export type GridSelections = Record<string, GridLineSelection>;

export interface CatalogBuilderAddon {
    id: string;
    qty: number;
    discountPct: number;
    displayName?: string;
}

export interface CustomBuilderAddon extends CatalogBuilderAddon {
    isCustom: true;
    name: string;
    price: number;
    categoryId: string;
    displayName?: string;
}

export type BuilderAddon = CatalogBuilderAddon | CustomBuilderAddon;

export interface RawPersistedBuilderAddon extends UnknownRecord {
    id?: unknown;
    qty?: unknown;
    discountPct?: unknown;
    isCustom?: unknown;
    name?: unknown;
    price?: unknown;
    categoryId?: unknown;
    displayName?: unknown;
}

export interface BuilderCatalogSizeOption {
    price: number;
}

export interface BuilderCatalogAddonOption {
    id: string;
    name: string;
    price: number;
}

export interface BuilderCatalogAddonCategory {
    id?: string;
    name: string;
    items: BuilderCatalogAddonOption[];
}

export interface BuilderCatalogModelData {
    name: string;
    sizes: Record<string, BuilderCatalogSizeOption>;
    addons?: BuilderCatalogAddonOption[];
    addonCategories?: BuilderCatalogAddonCategory[];
}

export interface BuilderCatalogLineData {
    name: string;
    type: 'builder';
    currency: string;
    models: Record<string, BuilderCatalogModelData>;
}

export interface GridCatalogSizeOption {
    size: string;
    price: number;
}

export interface GridCatalogItemGroup {
    model: string;
    sizes: GridCatalogSizeOption[];
}

export interface GridCatalogAddonOption extends BuilderCatalogAddonOption {
    autoScale?: boolean;
}

export interface GridCatalogAddonCategory {
    id?: string;
    categoryId?: string;
    name: string;
    items: GridCatalogAddonOption[];
}

export interface GridCatalogLineData {
    name: string;
    type: 'grid';
    currency: string;
    gridItems: GridCatalogItemGroup[];
    addonCategories: GridCatalogAddonCategory[];
}

export type CatalogLineData = BuilderCatalogLineData | GridCatalogLineData;

export type CatalogData = Record<string, CatalogLineData>;

export type CatalogLineId = string;

export interface BuilderItem {
    id: string;
    line: string;
    model: string;
    size: string;
    qty: number;
    discountPct: number;
    addons: BuilderAddon[];
    displayName?: string;
    source?: string;
    sourceType?: string;
    [key: string]: unknown;
}

export interface RawPersistedBuilderItem extends UnknownRecord {
    id?: unknown;
    line?: unknown;
    model?: unknown;
    size?: unknown;
    qty?: unknown;
    discountPct?: unknown;
    addons?: unknown;
    displayName?: unknown;
}

export interface EffectiveGridLineSelection {
    items: GridLineSelection['items'];
    addons: Record<string, EffectiveGridAddonState>;
    itemsQtyTotal: number;
}

export type PricingGridItemsMap = GridLineSelection['items'];

export type PricingGridAddonsMap = GridLineSelection['addons'];

export type PricingEffectiveGridAddonsMap = EffectiveGridLineSelection['addons'];

export interface SketchMeta {
    addedBahamaLine: boolean;
    addedFiestaLine: boolean;
}

export interface RawPersistedSketchMeta extends UnknownRecord {
    addedBahamaLine?: unknown;
    addedFiestaLine?: unknown;
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
    quoteNumber: string | null;
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

export interface RawPersistedGridLineSelection extends UnknownRecord {
    items?: unknown;
    addons?: unknown;
    customAddonsByCategory?: unknown;
}

export type HydratedQuoteStatePayload = Partial<QuoteState> | UnknownRecord | null | undefined;

export type QuoteStatePatch = Partial<QuoteState> | UnknownRecord;

export type CustomerInfoPatch = Partial<CustomerInfo> | UnknownRecord;

export interface QuoteIdentityPatch {
    activeQuoteId: string | null;
    quoteNumber: string | null;
    activeQuoteVersion: number;
    quoteStatus: QuoteStatus;
}

export interface SavedQuoteStatePatch extends QuoteIdentityPatch {
    scriveEnabled?: boolean;
    scriveStatus: ScriveStatus;
    scriveDocumentId: string | null;
    scriveSignerName: string;
    scriveSignerEmail: string;
    scriveLastError: string | null;
    scriveSentAtMs: number | null;
    scriveLastEventAtMs: number | null;
    scriveCompletedAtMs: number | null;
}

export interface HistoryOpenQuotePayload extends QuoteIdentityPatch {
    customerInfo: CustomerInfoPatch;
    [key: string]: unknown;
}

export interface SketchDraftStatePatch {
    sketchDraft: SketchDraft;
    sketchMeta?: SketchMeta;
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
    quoteNumber: string | null;
    quoteDateKey: string | null;
    quoteSequence: number | null;
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
    state?: RepositoryQuoteStatePayload | null;
    summary?: RepositoryQuoteSummaryPayload | null;
}

export interface QuoteRevision {
    revisionId: string;
    quoteId: string;
    version: number;
    savedAtMs: number;
    savedBy: string;
    savedByUid: string;
    state: RepositoryQuoteStatePayload;
    summary: RepositoryQuoteSummaryPayload;
    changeNote: string;
}

export interface OrderRequestRecord {
    id: string;
    quoteOwnerUid: string;
    quoteId: string;
    quoteNumber: string;
    quoteVersion: number;
    retailerId: string;
    retailerName: string;
    retailerEmail: string;
    customerName: string;
    company: string;
    reference: string;
    customerReference: string;
    selectedLines: string[];
    totalSek: number;
    status: OrderRequestStatus;
    createdAtMs: number;
    updatedAtMs: number;
    createdByUid: string;
    createdByEmail: string;
    statusUpdatedByUid: string;
    statusUpdatedByEmail: string;
}

export interface RetailerLineDocument {
    id: string;
    title: string;
    kind: RetailerDocumentKind;
    url: string;
    fileName: string;
    description?: string;
    sortOrder: number;
}

export interface RawRetailerLineDocument extends UnknownRecord {
    id?: unknown;
    title?: unknown;
    kind?: unknown;
    url?: unknown;
    fileName?: unknown;
    description?: unknown;
    sortOrder?: unknown;
}

export interface RetailerLineDocumentsRecord {
    lineId: string;
    documents: RetailerLineDocument[];
    updatedAt: number;
    updatedBy: string;
    updatedByUid: string;
}

export interface RawRetailerLineDocumentsDoc extends UnknownRecord {
    lineId?: unknown;
    documents?: unknown;
    updatedAt?: unknown;
    updatedBy?: unknown;
    updatedByUid?: unknown;
}

export interface QuoteFilters {
    status?: string;
    search?: string;
}

export interface QuoteRevisionSaveInput {
    user: AccessUser;
    quoteId: string;
    state: RepositoryQuoteStatePayload;
    summary: Partial<QuoteSummary> | RawQuoteSummary;
    customerInfo?: Partial<CustomerInfo>;
    status?: QuoteStatus | string;
    scrive?: ScrivePatchInput;
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
    scrive?: ScrivePatchInput;
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

export interface GetQuoteRevisionByVersionInput {
    userId: string;
    quoteId: string;
    version: number;
}

export interface DeleteQuoteInput {
    userId: string;
    quoteId: string;
}

export interface QuoteLatestRevisionResult {
    metadata: QuoteMetadata;
    revision: QuoteRevision | null;
}

export type RepositoryQuoteStatePayload = QuoteState | UnknownRecord;

export interface RawQuoteSummary extends UnknownRecord {
    finalTotalSek?: unknown;
    grossTotalSek?: unknown;
    totalDiscountSek?: unknown;
}

export type RepositoryQuoteSummaryPayload = QuoteSummary | RawQuoteSummary;

export interface RawQuoteMetadataDoc extends UnknownRecord {
    quoteNumber?: unknown;
    quoteDateKey?: unknown;
    quoteSequence?: unknown;
    customerName?: unknown;
    company?: unknown;
    reference?: unknown;
    customerReference?: unknown;
    status?: unknown;
    timestamp?: unknown;
    createdAtMs?: unknown;
    updatedAtMs?: unknown;
    savedBy?: unknown;
    savedByUid?: unknown;
    latestVersion?: unknown;
    latestRevisionId?: unknown;
    totalSek?: unknown;
    retailerName?: unknown;
    searchText?: unknown;
    state?: RepositoryQuoteStatePayload | null;
    summary?: RepositoryQuoteSummaryPayload | null;
    scriveEnabled?: unknown;
    scriveStatus?: unknown;
    scriveDocumentId?: unknown;
    scriveSignerName?: unknown;
    scriveSignerEmail?: unknown;
    scriveLastError?: unknown;
    scriveSentAtMs?: unknown;
    scriveLastEventAtMs?: unknown;
    scriveCompletedAtMs?: unknown;
}

export interface RawQuoteRevisionDoc extends UnknownRecord {
    quoteId?: unknown;
    version?: unknown;
    savedAtMs?: unknown;
    createdAt?: unknown;
    savedBy?: unknown;
    savedByUid?: unknown;
    state?: RepositoryQuoteStatePayload;
    summary?: RepositoryQuoteSummaryPayload;
    changeNote?: unknown;
}

export interface ScrivePatchInput extends UnknownRecord {
    enabled?: boolean;
    status?: ScriveStatus | string;
    documentId?: string | null;
    signerName?: string;
    signerEmail?: string;
    lastError?: string | null;
    sentAtMs?: number | null;
    lastEventAtMs?: number | null;
    completedAtMs?: number | null;
}

export interface SavedQuoteLike {
    quoteId?: string | null;
    metadata?: Partial<QuoteMetadata> | null;
    revision?: Partial<Pick<QuoteRevision, 'version'>> | null;
}

export interface SaveQuoteToRepositoryResult {
    saved: SavedQuoteLike;
    isNewQuote: boolean;
    statePatch: SavedQuoteStatePatch;
}

export interface SaveQuoteToRepositoryParams {
    quoteRepository: Pick<QuoteRepository, 'createQuote' | 'saveQuoteRevision'>;
    user: AccessUser | null;
    retailer?: RetailerRecord | null;
    state: QuoteState;
    summary: QuoteSummary | QuoteTotalsResult;
}

export interface CreateOrderRequestInput {
    user: AccessUser | null;
    retailer: RetailerRecord | null;
    state: QuoteState;
    summary: QuoteSummary | QuoteTotalsResult;
}

export interface GetOrderRequestByQuoteVersionInput {
    quoteId: string;
    quoteVersion: number;
}

export interface GetRetailerLineDocumentsInput {
    lineId: string;
}

export interface GetRetailerDocumentsForLinesInput {
    lineIds: string[];
}

export type RetailerLineDocumentWriteSource = Partial<RetailerLineDocument> | UnknownRecord;

export interface SaveRetailerLineDocumentsInput {
    lineId: string;
    documents: RetailerLineDocumentWriteSource[];
    user: AccessUser | null;
}

export interface ListOrderRequestsInput {
    limit?: number;
}

export interface UpdateOrderRequestStatusInput {
    id: string;
    status: OrderRequestStatus | string;
    user: AccessUser | null;
}

export interface RawOrderRequestDoc extends UnknownRecord {
    quoteOwnerUid?: unknown;
    quoteId?: unknown;
    quoteNumber?: unknown;
    quoteVersion?: unknown;
    retailerId?: unknown;
    retailerName?: unknown;
    retailerEmail?: unknown;
    customerName?: unknown;
    company?: unknown;
    reference?: unknown;
    customerReference?: unknown;
    selectedLines?: unknown;
    totalSek?: unknown;
    status?: unknown;
    createdAtMs?: unknown;
    updatedAtMs?: unknown;
    createdByUid?: unknown;
    createdByEmail?: unknown;
    statusUpdatedByUid?: unknown;
    statusUpdatedByEmail?: unknown;
}

export type ExportSummaryState = Partial<Pick<
    QuoteState,
    'customerInfo' | 'includesVat' | 'globalDiscountPct' | 'hideZeroDiscountReferencesInPdf'
>>;

export type ExportSummaryInput = Partial<QuoteTotalsResult>;

export interface ExportSummaryResult {
    finalTotalSek: number;
    grossTotalSek: number;
    totalDiscountSek: number;
    vatAmount: number;
    totalWithVat: number;
}

export interface PdfTableOptions {
    hideDiscountColumns?: boolean;
    hideRecommendedPriceColumn?: boolean;
}

export type PdfTableRow = string[];

export interface PdfExportModule {
    generatePDF: (state: QuoteState, summaryData: QuoteTotalsResult, returnBlob?: boolean) => Blob | Promise<Blob | null> | null;
}

export interface ExcelExportModule {
    generateExcel: (state: QuoteState, summaryData: QuoteTotalsResult) => Promise<void> | void;
}

export interface QuoteRepository {
    createQuote(input: CreateQuoteInput): Promise<{ quoteId: string; metadata: QuoteMetadata; revision: QuoteRevision }>;
    saveQuoteRevision(input: QuoteRevisionSaveInput): Promise<{ metadata: QuoteMetadata; revision: QuoteRevision }>;
    getUserQuotes(input: GetUserQuotesInput): Promise<Array<QuoteMetadata>>;
    getQuoteLatestRevision(input: GetQuoteLatestRevisionInput): Promise<QuoteLatestRevisionResult | null>;
    getQuoteRevisionByVersion(input: GetQuoteRevisionByVersionInput): Promise<QuoteRevision | null>;
    getQuoteRevisions(input: GetQuoteRevisionsInput): Promise<Array<QuoteRevision>>;
    deleteQuote(input: DeleteQuoteInput): Promise<void>;
    updateQuoteStatus(input: UpdateQuoteStatusInput): Promise<QuoteMetadata>;
    updateQuoteScrive(input: UpdateQuoteScriveInput): Promise<QuoteMetadata>;
    getAllUsersQuotes(input?: GetAllUsersQuotesInput): Promise<Array<QuoteMetadata & { ownerUid: string }>>;
}

export interface OrderRequestService {
    createOrderRequest(input: CreateOrderRequestInput): Promise<OrderRequestRecord>;
    getOrderRequestByQuoteVersion(input: GetOrderRequestByQuoteVersionInput): Promise<OrderRequestRecord | null>;
    listRecentOrderRequests(input?: ListOrderRequestsInput): Promise<OrderRequestRecord[]>;
    listOrderRequests(input?: ListOrderRequestsInput): Promise<OrderRequestRecord[]>;
    updateOrderRequestStatus(input: UpdateOrderRequestStatusInput): Promise<OrderRequestRecord>;
}

export interface RetailerDocumentService {
    getRetailerLineDocuments(input: GetRetailerLineDocumentsInput): Promise<RetailerLineDocumentsRecord>;
    getRetailerDocumentsForLines(input: GetRetailerDocumentsForLinesInput): Promise<RetailerLineDocumentsRecord[]>;
    listRetailerLineDocuments(): Promise<RetailerLineDocumentsRecord[]>;
    saveRetailerLineDocuments(input: SaveRetailerLineDocumentsInput): Promise<RetailerLineDocumentsRecord>;
}

export interface FirestoreDocRef {
    path?: string;
    id?: string;
    parent?: {
        path?: string;
        parent?: {
            id?: string;
        };
    };
}

export interface FirestoreCollectionRef {
    path?: string;
    kind?: string;
    collectionId?: string;
}

export interface FirestoreQueryConstraint {
    kind?: string;
    field?: string;
    direction?: 'asc' | 'desc';
    size?: number;
}

export interface FirestoreQueryRef extends FirestoreCollectionRef {
    constraints?: FirestoreQueryConstraint[];
    isGroup?: boolean;
}

export interface FirestoreDocSnapshot<TDoc = UnknownRecord> {
    exists(): boolean;
    data(): TDoc | undefined;
    id?: string;
    ref?: FirestoreDocRef;
}

export interface FirestoreQuerySnapshot<TDoc = UnknownRecord> {
    docs: Array<FirestoreDocSnapshot<TDoc>>;
    empty?: boolean;
    forEach?: (callback: (docSnap: FirestoreDocSnapshot<TDoc>) => void) => void;
}

export interface FirestoreWriteBatch {
    set?: (ref: FirestoreDocRef, payload: UnknownRecord, options?: { merge?: boolean }) => void;
    delete: (ref: FirestoreDocRef) => void;
    commit: () => Promise<unknown>;
}

export interface FirestoreTransaction {
    get: (ref: FirestoreDocRef) => Promise<FirestoreDocSnapshot>;
    set: (ref: FirestoreDocRef, data: UnknownRecord, options?: { merge?: boolean }) => void;
}

export interface QuoteRepositoryDeps {
    db?: unknown;
    doc?: (db: unknown, ...segments: string[]) => FirestoreDocRef;
    getDoc?: (ref: FirestoreDocRef) => Promise<FirestoreDocSnapshot>;
    setDoc?: (ref: FirestoreDocRef, payload: UnknownRecord, options?: { merge?: boolean }) => Promise<unknown>;
    updateDoc?: (ref: FirestoreDocRef, payload: UnknownRecord) => Promise<unknown>;
    deleteDoc?: (ref: FirestoreDocRef) => Promise<unknown>;
    collection?: (db: unknown, ...segments: string[]) => unknown;
    collectionGroup?: (db: unknown, collectionId: string) => unknown;
    getDocs?: (ref: unknown) => Promise<FirestoreQuerySnapshot>;
    query?: (source: unknown, ...constraints: unknown[]) => unknown;
    orderBy?: (field: string, direction?: 'asc' | 'desc') => unknown;
    limit?: (size: number) => unknown;
    where?: (...args: unknown[]) => unknown;
    startAfter?: (...args: unknown[]) => unknown;
    addDoc?: (collectionRef: unknown, payload: UnknownRecord) => Promise<unknown>;
    writeBatch?: (db: unknown) => FirestoreWriteBatch;
    runTransaction?: <T>(
        db: unknown,
        updateFn: (transaction: FirestoreTransaction) => Promise<T>
    ) => Promise<T>;
}

export type QuoteReducerAction =
    | { type: 'SET_STEP'; payload: StepInput }
    | { type: 'HYDRATE_STATE'; payload: HydratedQuoteStatePayload }
    | { type: 'UPDATE_STATE'; payload: QuoteStatePatch }
    | { type: 'SET_CUSTOMER_INFO'; payload: CustomerInfoPatch }
    | { type: 'UPDATE_CUSTOMER_INFO'; payload: CustomerInfoPatch }
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
    onOpenHistory?: () => void;
    onOpenInventory?: () => void;
    onOpenSketch?: () => void;
    onOpenPlanner?: () => void;
    onOpenActivity?: () => void;
    onOpenRetailers?: () => void;
    onOpenRetailerOrders?: () => void;
    onOpenRetailerDocuments?: () => void;
}

export interface ProductLineSelectionProps {
    onNext: () => void;
}

export interface BuilderConfigProps {}

export interface BuilderItemProps {
    item: BuilderItem;
    index: number;
    onRemove: (id: string) => void;
}

export interface GridConfigProps {
    lineId: string;
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

export interface HistoryProps {
    onBack?: () => void;
    onOpenQuote?: (payload: HistoryOpenQuotePayload) => void;
}

export interface PlannerProps {
    onBack?: () => void;
}

export interface PlannerProjectDetailsPatch {
    address: string;
    phone: string;
    notes: string;
    assignees: string[];
    [key: `${string}.${string}`]: string | undefined;
}

export interface TermsAndPaymentPanelProps {
    summaryData: QuoteTotalsResult;
}

export interface ErrorBoundaryProps {
    children?: ReactNode;
    resetHref?: string;
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

export type RetailerWriteSource = Partial<RetailerWriteInput> | UnknownRecord;

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

export interface RetailerOrderRequestsProps {
    onBack?: () => void;
}

export interface RetailerDocumentsProps {
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

export interface ActivityLogWriteRef {
    id?: string;
}

export interface ActivityLogSnapshotLike extends SnapshotSource {}

export type ActivityLogSource = ActivityLogSnapshotLike | UnknownRecord;

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

export type PlannerContractor = '' | 'Stabil' | 'Tavi';

export type PlannerPriority = 'Låg' | 'Normal' | 'Hög';

export interface PlannerProject {
    id: string;
    title: string;
    done: boolean;
    contractor: PlannerContractor;
    priority: PlannerPriority;
    createdAt: number;
    createdBy: string;
    week: string;
    address?: string;
    phone?: string;
    notes?: string;
    assignees?: string[];
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
    login: (email: string, password: string) => Promise<UserCredential>;
    logout: () => Promise<void>;
    retailer: RetailerRecord | null;
    isRetailer: boolean;
}

export interface AuthChangeUser {
    uid: string;
    email: string | null;
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

export interface RawDoorSegment extends UnknownRecord {
    index?: unknown;
    size?: unknown;
    doorSize?: unknown;
}

export interface ManualSectionPin {
    index: number;
    size: number;
}

export interface RawManualSectionPin extends UnknownRecord {
    index?: unknown;
    size?: unknown;
}

export type DoorSegmentsByEdge = Partial<Record<SketchEdgeKey, DoorSegment[]>>;

export type ManualSectionsByEdge = Partial<Record<SketchEdgeKey, ManualSectionPin[]>>;

export type SectionCountByEdge = Partial<Record<SketchEdgeKey, number>>;

export type RawDoorSegmentsByEdge = Partial<Record<SketchEdgeKey, unknown>>;

export type RawManualSectionsByEdge = Partial<Record<SketchEdgeKey, unknown>>;

export type RawSectionCountByEdge = Partial<Record<SketchEdgeKey, unknown>>;

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
    onExportToQuoteComplete?: () => void;
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
    hoverPreviewLayout?: ComputedLayoutResult | null;
    undo?: () => void;
    redo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    manualSectionsByEdge?: ManualSectionsByEdge;
    doorSegmentsByEdge?: DoorSegmentsByEdge;
    onSetManualPin?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number | null) => void;
    onClearManualPins?: (edgeKey: SketchEdgeKey) => void;
    onSetDoorSegmentSize?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number) => void;
    onResetDoorSegment?: (edgeKey: SketchEdgeKey, segmentIndex: number) => void;
    onResize?: (dims: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>>) => void;
    onResizePreview?: (dims: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>> | null) => void;
    onResizeCommit?: (dims: Partial<Pick<SketchConfigState, 'width' | 'depth' | 'depthLeft' | 'depthRight'>>) => void;
    onSelectEdge?: (edgeKey: SketchEdgeKey) => void;
    onSelectSection?: (edgeKey: SketchEdgeKey, segmentIndex: number | null) => void;
    onApplySuggestion?: (suggestionId: string) => void;
    onHoverSuggestion?: (suggestion: LayoutSuggestion | null) => void;
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

export interface SketchSetupPanelProps {
    config: SketchConfigState;
    onChange: (partial: Partial<SketchConfigState>) => void;
    edgeSummaries?: Partial<Record<SketchEdgeKey, EdgeSummary>>;
    onSetSectionCount?: (edgeKey: SketchEdgeKey, count: number) => void;
    onClearSectionCount?: (edgeKey: SketchEdgeKey) => void;
}

export interface SketchInspectorPanelProps {
    config: SketchConfigState;
    onChange: (partial: Partial<SketchConfigState>) => void;
    selectedEdge: SketchEdgeKey | null;
    selectedSegmentIndex: number | null;
    edgeSummaries?: Partial<Record<SketchEdgeKey, EdgeSummary>>;
    suggestions?: LayoutSuggestion[];
    onSetManualPin?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number | null) => void;
    onClearManualPins?: (edgeKey: SketchEdgeKey) => void;
    onConvertSegmentToDoor?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number) => void;
    onSetDoorSegmentSize?: (edgeKey: SketchEdgeKey, segmentIndex: number, size: number) => void;
    onResetDoorSegment?: (edgeKey: SketchEdgeKey, segmentIndex: number) => void;
    onApplySuggestion?: (suggestionId: string) => void;
    onHoverSuggestion?: (suggestion: LayoutSuggestion | null) => void;
    onDeleteParasol?: (id: string) => void;
    onRotateParasol?: (id: string, rotationDeg: 0 | 90) => void;
    onDeleteFiesta?: (id: string) => void;
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

export interface SketchReviewRow {
    id: string;
    label: string;
    qty: number;
    tone?: 'default' | 'secondary';
}

export interface SketchReviewState {
    health: 'ready' | 'attention' | 'blocked';
    healthLabel: string;
    healthText: string;
    criticalWarnings: LayoutWarning[];
    recommendationWarnings: LayoutWarning[];
    suggestions: LayoutSuggestion[];
    invalidEdges: Array<[SketchEdgeKey, EdgeDiagnostic]>;
    autoAdjustedEdges: Array<[SketchEdgeKey, EdgeDiagnostic]>;
    parasolWarnings: Array<{ id: string; text: string }>;
    materialRows: SketchReviewRow[];
    totalGlassLength: number;
    sectionCount: number;
    parasolCount: number;
    fiestaCount: number;
    exportReady: boolean;
    hasInvalidEdges: boolean;
}

export interface SketchReviewPanelProps {
    reviewState: SketchReviewState;
    canExportToQuote?: boolean;
    onApplySuggestion?: (suggestionId: string) => void;
    onHoverSuggestion?: (suggestion: LayoutSuggestion | null) => void;
    onExport?: () => void;
    onExportImage?: () => void;
}

export interface SketchBomProps {
    counts: Record<string, number>;
    totalGlassLength: number;
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
