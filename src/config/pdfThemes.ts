import type { PdfThemeId } from '../types/contracts';

export const DEFAULT_PDF_THEME_ID: PdfThemeId = 'brixx';

export const PDF_THEME_OPTIONS: Array<{ id: PdfThemeId; label: string }> = [
    { id: 'brixx', label: 'BRIXX' },
    { id: 'custom', label: 'Eget tema' },
    { id: 'roslagsmarkisen', label: 'Roslagsmarkisen' }
];

export function normalizePdfThemeId(value: unknown): PdfThemeId {
    return value === 'custom' || value === 'brixx' || value === 'roslagsmarkisen'
        ? value
        : DEFAULT_PDF_THEME_ID;
}
