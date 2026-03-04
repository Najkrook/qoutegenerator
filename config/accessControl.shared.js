export const ADMIN_UIDS = Object.freeze([
    'ZPxZusAiyfY6cf2LSn1ynP5A7rG3',
    'XolYJ2aOCdZPgiTg4WKVSOcRPmO2',
    'cNXpQsFClscsPGURl0gedehYcFo2'
]);

const ADMIN_UID_SET = new Set(ADMIN_UIDS);

export function isFullAccessUser(user) {
    return Boolean(user?.uid) && ADMIN_UID_SET.has(user.uid);
}

export function resolveAccessLevelFromUser(user) {
    if (!user?.uid) return 'guest';
    return isFullAccessUser(user) ? 'full' : 'quote-only';
}

