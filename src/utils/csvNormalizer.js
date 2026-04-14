export function normalizeInventoryText(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Excel CSV exports on Swedish Windows often get read incorrectly by XLSX 
    // unless codepages are strictly managed. This intercepts the common Double-UTF8/ANSI 
    // mojibake combinations and standardizes them back to native UTF-8 Swedish characters.
    return text
        .replaceAll('\u00e3\u00a4', 'ä')
        .replaceAll('\u00e3\u00b6', 'ö')
        .replaceAll('\u00e3\u00a5', 'å')
        .replaceAll('\u00c3\u00a4', 'ä')
        .replaceAll('\u00c3\u00b6', 'ö')
        .replaceAll('\u00c3\u00a5', 'å')
        .replaceAll('\u00c3\u201e', 'Ä')
        .replaceAll('\u00c3\u2013', 'Ö')
        .replaceAll('\u00c3\u2026', 'Å')
        .replaceAll('\u00c3\u00a9', 'é')
        .replaceAll('\u00c3\u00a7', 'ç')
        .replaceAll('\u00c3\u00bc', 'ü');
}

export function normalizeInventoryItem(item) {
    if (!item || typeof item !== 'object') return item;
    
    const normalized = {};
    for (const [key, value] of Object.entries(item)) {
        const cleanKey = normalizeInventoryText(key?.trim ? key.trim() : key);
        const cleanValue = typeof value === 'string' ? normalizeInventoryText(value) : value;
        normalized[cleanKey] = cleanValue;
    }
    return normalized;
}

export function normalizeInventoryList(jsonArr) {
    if (!Array.isArray(jsonArr)) return [];
    return jsonArr.map(normalizeInventoryItem);
}
