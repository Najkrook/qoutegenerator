export function applyVat(value: number | string | null | undefined, includesVat: boolean): number {
    const numericValue = Number(value) || 0;
    const isVatIncluded = Boolean(includesVat);
    return isVatIncluded ? numericValue * 1.25 : numericValue;
}
