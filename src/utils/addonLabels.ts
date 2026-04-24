export const DEFAULT_ADDON_FALLBACK_NAME = 'Egen rad';
export const DEFAULT_UNKNOWN_ADDON_NAME = 'Okant tillval';

export function formatAddonLabel(name: string | null | undefined, fallback = DEFAULT_ADDON_FALLBACK_NAME): string {
    return `Tillval: ${String(name || '').trim() || fallback}`;
}
