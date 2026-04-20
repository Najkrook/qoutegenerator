import type {
    AccessUser,
    ActivityEventDefinition,
    ActivityLogMetadata,
    ActivityLogRow,
    ActivityLogSource,
    ActivityLogWriteRef,
    UnknownRecord
} from '../types/contracts';
import { addDoc, collection, db } from './firebase';
import { cloneSerializable, getErrorInfo, isUnknownRecord, readSnapshotData } from '../utils/runtime';

interface ActivityLogError {
    name: string;
    code: string;
    message: string;
}

interface ActivityLogEntryInput {
    user?: AccessUser | null;
    eventType?: string;
    system?: string;
    targetType?: string;
    targetId?: string | number | null;
    details?: string;
    metadata?: ActivityLogMetadata;
}

interface ActivityLogEntry {
    createdAt: number;
    timestamp: string;
    eventType: string;
    system: string;
    targetType: string;
    targetId: string;
    user: string;
    userUid: string;
    details: string;
    metadata: ActivityLogMetadata;
}

interface ActivityLogSuccessResult {
    ok: true;
    id: string | null;
    ref: ActivityLogWriteRef | null;
    eventType: string;
    system: string;
}

interface ActivityLogFailureResult {
    ok: false;
    id: null;
    eventType: string;
    system: string;
    error: ActivityLogError;
}

type ActivityLogResult = ActivityLogSuccessResult | ActivityLogFailureResult;

export const ACTIVITY_SYSTEM_DEFINITIONS: Record<string, { label: string }> = {
    quote: { label: 'Offert' },
    sketch: { label: 'Ritning' },
    planner: { label: 'Projekt' },
    template: { label: 'Mall' },
    auth: { label: 'Auth' },
    retailer: { label: 'Återförsäljare' }
};

export const ACTIVITY_EVENT_DEFINITIONS: Record<string, ActivityEventDefinition> = {
    quote_created: { label: 'Offert skapad', icon: '📄', color: 'var(--color-success)' },
    quote_revision_saved: { label: 'Ny offertversion sparad', icon: '↻', color: 'var(--color-primary)' },
    quote_export_pdf: { label: 'PDF exporterad', icon: '📄', color: 'var(--color-primary)' },
    quote_export_excel: { label: 'Excel exporterad', icon: '📊', color: 'var(--color-success)' },
    sketch_export_to_quote: { label: 'Ritning exporterad till offert', icon: '✏️', color: 'var(--color-primary)' },
    sketch_export_image: { label: 'Ritningsbild nedladdad', icon: '🖼️', color: 'var(--color-success)' },
    retailer_created: { label: 'Återförsäljare skapad', icon: '🏪', color: 'var(--color-success)' },
    retailer_updated: { label: 'Återförsäljare uppdaterad', icon: '🏪', color: 'var(--color-primary)' },
    retailer_deleted: { label: 'Återförsäljare borttagen', icon: '🗑️', color: 'var(--color-error, #e74c3c)' }
};

function toActivityLogRaw(source: ActivityLogSource | null | undefined): UnknownRecord {
    return readSnapshotData(source);
}

function buildActivityLogError(error: unknown): ActivityLogError {
    const safeError = getErrorInfo(error);
    return {
        name: String(safeError.name || 'Error'),
        code: String(safeError.code || 'unknown'),
        message: String(safeError.message || 'Unknown activity log failure.')
    };
}

export function buildActivityLogSuccessResult(ref: ActivityLogWriteRef | null, params: ActivityLogEntryInput = {}): ActivityLogSuccessResult {
    return {
        ok: true,
        id: ref?.id || null,
        ref: ref || null,
        eventType: String(params.eventType || ''),
        system: String(params.system || '')
    };
}

export function buildActivityLogFailureResult(error: unknown, params: ActivityLogEntryInput = {}): ActivityLogFailureResult {
    return {
        ok: false,
        id: null,
        eventType: String(params.eventType || ''),
        system: String(params.system || ''),
        error: buildActivityLogError(error)
    };
}

function sanitizeMetadata(metadata: unknown): ActivityLogMetadata {
    try {
        const cloned = cloneSerializable(metadata || {});
        return isUnknownRecord(cloned) ? cloned : {};
    } catch {
        return {};
    }
}

function toEpochMs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (isUnknownRecord(value) && typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
}

export function getActivitySystemLabel(system: unknown): string {
    return ACTIVITY_SYSTEM_DEFINITIONS[String(system || '').toLowerCase()]?.label || String(system || '-');
}

export function getActivityEventDefinition(eventType: unknown): ActivityEventDefinition {
    return ACTIVITY_EVENT_DEFINITIONS[String(eventType || '').trim()] || {
        label: String(eventType || 'Aktivitet'),
        icon: 'i',
        color: 'var(--color-primary)'
    };
}

export function formatActivityMetadata(metadata: ActivityLogMetadata = {}): string {
    const safe = sanitizeMetadata(metadata);
    const parts: string[] = [];

    if (safe.customerName) parts.push(String(safe.customerName));
    if (safe.reference) parts.push(`Ref: ${safe.reference}`);
    if (safe.version != null) parts.push(`v${safe.version}`);
    if (safe.format) parts.push(String(safe.format).toUpperCase());
    if (safe.sectionCount != null) parts.push(`${safe.sectionCount} sektioner`);
    if (safe.parasolCount != null) parts.push(`${safe.parasolCount} parasoller`);

    return parts.join(' · ');
}

export function buildActivityLogEntry({
    user,
    eventType,
    system,
    targetType = 'unknown',
    targetId = '-',
    details = '',
    metadata = {}
}: ActivityLogEntryInput = {}): ActivityLogEntry {
    if (!user?.uid) {
        throw new Error('Activity log requires an authenticated user.');
    }
    if (!eventType) {
        throw new Error('Activity log requires eventType.');
    }
    if (!system) {
        throw new Error('Activity log requires system.');
    }

    const nowMs = Date.now();
    const eventDefinition = getActivityEventDefinition(eventType);

    return {
        createdAt: nowMs,
        timestamp: new Date(nowMs).toISOString(),
        eventType: String(eventType),
        system: String(system),
        targetType: String(targetType),
        targetId: targetId == null || targetId === '' ? '-' : String(targetId),
        user: String(user.email || ''),
        userUid: String(user.uid),
        details: String(details || eventDefinition.label),
        metadata: sanitizeMetadata(metadata)
    };
}

export function normalizeActivityLog(source: ActivityLogSource | null | undefined): ActivityLogRow {
    const raw = toActivityLogRaw(source);
    const createdAtMs = toEpochMs(raw.createdAt);
    const timestampMs = toEpochMs(raw.timestamp);

    return {
        id: isUnknownRecord(source) ? String(source.id || raw.id || '') : String(raw.id || ''),
        createdAtMs,
        timestampMs,
        resolvedMs: createdAtMs || timestampMs || 0,
        eventType: String(raw.eventType || 'unknown'),
        system: String(raw.system || 'unknown').toLowerCase(),
        targetType: String(raw.targetType || 'unknown'),
        targetId: String(raw.targetId || '-'),
        user: String(raw.user || '-'),
        userUid: String(raw.userUid || '-'),
        details: String(raw.details || '-'),
        metadata: sanitizeMetadata(raw.metadata)
    };
}

export function getActivityLogVisual(entry: Pick<ActivityLogRow, 'eventType'> | null | undefined): ActivityEventDefinition {
    const definition = getActivityEventDefinition(entry?.eventType);
    return {
        icon: definition.icon,
        color: definition.color,
        label: definition.label
    };
}

export function isActivityLogFailure(result: ActivityLogResult | null | undefined): result is ActivityLogFailureResult {
    return Boolean(result) && result.ok === false;
}

export async function logActivity(params: ActivityLogEntryInput): Promise<ActivityLogWriteRef> {
    const entry = buildActivityLogEntry(params);
    return addDoc(collection(db, 'activity_logs'), entry);
}

export async function safeLogActivity(params: ActivityLogEntryInput): Promise<ActivityLogResult> {
    try {
        const ref = await logActivity(params);
        return buildActivityLogSuccessResult(ref, params);
    } catch (err) {
        const failure = buildActivityLogFailureResult(err, params);
        console.error('Failed to log activity:', failure, err);
        return failure;
    }
}
