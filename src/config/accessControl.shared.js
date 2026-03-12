export const ADMIN_UIDS = Object.freeze([
    'ZPxZusAiyfY6cf2LSn1ynP5A7rG3',
    'XolYJ2aOCdZPgiTg4WKVSOcRPmO2',
    'cNXpQsFClscsPGURl0gedehYcFo2'
]);

export const SKETCH_ONLY_UIDS = Object.freeze([
    // Add Firebase Auth UIDs here for users that may only access "Rita Uteservering".
    'VpHpMybaN0VbmSsDkz57Jryyx3v1'
]);

const ADMIN_UID_SET = new Set(ADMIN_UIDS);
const SKETCH_ONLY_UID_SET = new Set(SKETCH_ONLY_UIDS);

export function isFullAccessUser(user) {
    return Boolean(user?.uid) && ADMIN_UID_SET.has(user.uid);
}

export function isSketchOnlyUser(user) {
    return Boolean(user?.uid) && SKETCH_ONLY_UID_SET.has(user.uid);
}

export function resolveAccessLevelFromUser(user) {
    if (!user?.uid) return 'guest';
    if (isFullAccessUser(user)) return 'full';
    if (isSketchOnlyUser(user)) return 'sketch-only';
    return 'quote-only';
}

export function canAccessQuoteHistoryLevel(accessLevel) {
    return accessLevel === 'full' || accessLevel === 'quote-only';
}

export function canAccessQuoteHistoryUser(user) {
    return canAccessQuoteHistoryLevel(resolveAccessLevelFromUser(user));
}
