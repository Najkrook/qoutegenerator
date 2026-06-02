import type {
    MarginSettingsService,
    QuoteMarginLineId,
    QuoteMarginSettings,
    RawQuoteMarginSettingsDoc,
    SaveQuoteMarginSettingsInput,
    UnknownRecord
} from '../types/contracts';
import { db, doc, getDoc, setDoc } from './firebase';
import { readSnapshotData } from '../utils/runtime';

const APP_SETTINGS_COLLECTION = 'app_settings';
const QUOTE_MARGINS_DOC_ID = 'quote_margins';

export const QUOTE_MARGIN_LINE_IDS: QuoteMarginLineId[] = ['BaHaMa', 'ClickitUp', 'Fiesta'];

export const DEFAULT_QUOTE_MARGINS_BY_LINE: Record<QuoteMarginLineId, number> = {
    BaHaMa: 40,
    ClickitUp: 32,
    Fiesta: 30
};

interface MarginSettingsServiceDeps {
    db?: unknown;
    doc?: (db: unknown, ...segments: string[]) => { path?: string };
    getDoc?: (ref: { path?: string }) => Promise<{ exists(): boolean; data(): RawQuoteMarginSettingsDoc | undefined }>;
    setDoc?: (ref: { path?: string }, payload: UnknownRecord, options?: { merge?: boolean }) => Promise<unknown>;
}

function isObject(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampMarginPct(value: unknown, fallback = 0): number {
    const parsed = toNumber(value, fallback);
    return Math.max(0, Math.min(100, parsed));
}

export function normalizeQuoteMarginsByLine(value: unknown): Record<QuoteMarginLineId, number> {
    const source = isObject(value) ? value : {};
    return QUOTE_MARGIN_LINE_IDS.reduce<Record<QuoteMarginLineId, number>>((acc, lineId) => {
        acc[lineId] = clampMarginPct(source[lineId], DEFAULT_QUOTE_MARGINS_BY_LINE[lineId]);
        return acc;
    }, { ...DEFAULT_QUOTE_MARGINS_BY_LINE });
}

export function normalizeQuoteMarginSettings(source: unknown): QuoteMarginSettings {
    const raw = readSnapshotData<RawQuoteMarginSettingsDoc>(source);

    return {
        marginsByLine: normalizeQuoteMarginsByLine(raw.marginsByLine),
        updatedAt: Math.max(0, toNumber(raw.updatedAt, 0)),
        updatedBy: String(raw.updatedBy || ''),
        updatedByUid: String(raw.updatedByUid || '')
    };
}

function createDefaultQuoteMarginSettings(): QuoteMarginSettings {
    return {
        marginsByLine: { ...DEFAULT_QUOTE_MARGINS_BY_LINE },
        updatedAt: 0,
        updatedBy: '',
        updatedByUid: ''
    };
}

export function createMarginSettingsService(deps: MarginSettingsServiceDeps = {}): MarginSettingsService {
    const {
        db: dbRef,
        doc: makeDoc,
        getDoc: readDoc,
        setDoc: writeDoc
    } = deps;

    function assertDeps(names: string[]): void {
        const missing = names.filter((name) => {
            switch (name) {
                case 'db':
                    return !dbRef;
                case 'doc':
                    return typeof makeDoc !== 'function';
                case 'getDoc':
                    return typeof readDoc !== 'function';
                case 'setDoc':
                    return typeof writeDoc !== 'function';
                default:
                    return true;
            }
        });

        if (missing.length > 0) {
            throw new Error(`marginSettingsService requires Firestore dependencies: ${missing.join(', ')}`);
        }
    }

    function getQuoteMarginsRef() {
        assertDeps(['db', 'doc']);
        return makeDoc(dbRef, APP_SETTINGS_COLLECTION, QUOTE_MARGINS_DOC_ID);
    }

    async function getQuoteMarginSettings(): Promise<QuoteMarginSettings> {
        assertDeps(['db', 'doc', 'getDoc']);
        const snap = await readDoc(getQuoteMarginsRef());

        if (!snap.exists()) {
            return createDefaultQuoteMarginSettings();
        }

        return normalizeQuoteMarginSettings({ id: QUOTE_MARGINS_DOC_ID, data: () => snap.data() });
    }

    async function saveQuoteMarginSettings({
        marginsByLine,
        user
    }: SaveQuoteMarginSettingsInput): Promise<QuoteMarginSettings> {
        assertDeps(['db', 'doc', 'setDoc']);
        if (!user?.uid) {
            throw new Error('Saving quote margin settings requires an authenticated user.');
        }

        const nowMs = Date.now();
        const payload: QuoteMarginSettings = {
            marginsByLine: normalizeQuoteMarginsByLine(marginsByLine),
            updatedAt: nowMs,
            updatedBy: String(user.email || ''),
            updatedByUid: String(user.uid || '')
        };

        await writeDoc(getQuoteMarginsRef(), payload as unknown as UnknownRecord, { merge: true });
        return payload;
    }

    return {
        getQuoteMarginSettings,
        saveQuoteMarginSettings
    };
}

export const marginSettingsService = createMarginSettingsService({
    db,
    doc,
    getDoc,
    setDoc
});
