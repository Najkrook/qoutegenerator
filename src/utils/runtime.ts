import type { ErrorLike, SnapshotSource, UnknownRecord } from '../types/contracts';

export function isUnknownRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function cloneSerializable<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function readSnapshotData<TRecord extends UnknownRecord = UnknownRecord>(
    source: SnapshotSource | null | undefined
): TRecord {
    const rawValue = typeof source?.data === 'function' ? source.data() : source?.data;
    return isUnknownRecord(rawValue) ? rawValue as TRecord : {} as TRecord;
}

export function getErrorInfo(error: unknown): ErrorLike {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            ...((isUnknownRecord(error) ? error : {}) as UnknownRecord)
        };
    }

    return isUnknownRecord(error) ? error as ErrorLike : {};
}

export function getErrorMessage(error: unknown, fallback: string): string {
    const message = getErrorInfo(error).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
}

export function getErrorCode(error: unknown): string {
    const code = getErrorInfo(error).code;
    return typeof code === 'string' && code.trim() ? code : '';
}

export function normalizeAllowedValue<T extends string>(
    value: string,
    allowedValues: readonly T[],
    fallback: T
): T {
    return allowedValues.find((allowedValue) => allowedValue === value) ?? fallback;
}
