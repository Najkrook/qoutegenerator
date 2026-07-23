import type {
    ContractingWorkState,
    ContractingWorkSummary
} from '../types/contracts';

const DEFAULT_ATA_PERCENT = 15;
const DEFAULT_MARGIN_PERCENT = 15;

function normalizeNonNegativeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeAtaPercent(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.min(100, Math.max(0, parsed))
        : DEFAULT_ATA_PERCENT;
}

function normalizeMarginPercent(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.min(100, Math.max(0, parsed))
        : DEFAULT_MARGIN_PERCENT;
}

export function hasConfiguredContractingWork(contractingWork: ContractingWorkState | null | undefined): boolean {
    return contractingWork?.enabled === true
        && Array.isArray(contractingWork.rows)
        && contractingWork.rows.some((row) => typeof row?.workPackage === 'string' && row.workPackage.trim().length > 0);
}

export function calculateContractingWorkSummary(
    contractingWork: ContractingWorkState | null | undefined
): ContractingWorkSummary {
    const isEnabled = contractingWork?.enabled === true;
    const rows = isEnabled && Array.isArray(contractingWork?.rows) ? contractingWork.rows : [];
    const activeRows = rows.filter(
        (row) => typeof row?.workPackage === 'string' && row.workPackage.trim().length > 0
    );
    const costTotalSek = activeRows.reduce(
        (sum, row) => sum + normalizeNonNegativeNumber(row.priceExVatSek),
        0
    );
    const marginEnabled = isEnabled && contractingWork?.margin?.enabled === true;
    const marginPercent = normalizeMarginPercent(contractingWork?.margin?.percent);
    const marginMultiplier = marginEnabled ? 1 + marginPercent / 100 : 1;
    const customerRows = activeRows.map((row) => ({
        ...row,
        priceExVatSek: Math.round(normalizeNonNegativeNumber(row.priceExVatSek) * marginMultiplier)
    }));
    const baseTotalSek = customerRows.reduce((sum, row) => sum + row.priceExVatSek, 0);
    const marginAmountSek = marginEnabled
        ? Math.max(0, baseTotalSek - Math.round(costTotalSek))
        : 0;
    const ataEnabled = isEnabled && contractingWork?.ata?.enabled === true;
    const ataPercent = normalizeAtaPercent(contractingWork?.ata?.percent);
    const allowanceSek = ataEnabled ? baseTotalSek * ataPercent / 100 : 0;

    return {
        activeRows,
        customerRows,
        costTotalSek,
        baseTotalSek,
        marginEnabled,
        marginPercent,
        marginAmountSek,
        allowanceSek,
        lowerIndicativeSek: baseTotalSek - allowanceSek,
        upperIndicativeSek: baseTotalSek + allowanceSek,
        ataEnabled,
        ataPercent
    };
}
