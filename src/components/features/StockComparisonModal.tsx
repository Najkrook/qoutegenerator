import type { StockComparisonModalProps, StockComparisonRow } from '../../types/contracts';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

function extractDoorSize(item: string | number): number | null {
    const match = /Dörr\s+(\d+)/i.exec(String(item));
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
}

export function StockComparisonModal({
    allSections,
    slimlineCount,
    stodbenCount,
    clickitupStock,
    onConfirm,
    onCancel
}: StockComparisonModalProps) {
    const requirements = allSections.reduce<Record<string, number>>((acc, item) => {
        const doorSize = extractDoorSize(item);
        const key = doorSize ? `Dörr|${doorSize}` : `Sektion|${item}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    let hasShortfall = false;

    const rows = Object.entries(requirements)
        .map<StockComparisonRow>(([key, needed]) => {
            const [type, size] = key.split('|');
            const sizeData = clickitupStock[size] || {
                sektion: 0,
                dorr_h: 0,
                dorr_v: 0,
                hane_h: 0,
                hane_v: 0
            };

            const inStock =
                type === 'Sektion'
                    ? sizeData.sektion || 0
                    : (sizeData.dorr_h || 0) + (sizeData.dorr_v || 0);

            const diff = inStock - needed;
            const isShort = diff < 0;
            const shortfall = isShort ? Math.abs(diff) : 0;
            if (isShort) hasShortfall = true;

            return { type, size, needed, inStock, isShort, diff, shortfall };
        })
        .sort((a, b) => {
            if (a.isShort !== b.isShort) return a.isShort ? -1 : 1;
            if (a.shortfall !== b.shortfall) return b.shortfall - a.shortfall;
            if (a.type !== b.type) return a.type.localeCompare(b.type, 'sv');
            return a.size.localeCompare(b.size, 'sv', { numeric: true });
        });

    return (
        <Modal
            onClose={onCancel}
            title="Lagerjämförelse"
            description="Jämför skissens behov med aktuellt lagersaldo innan export."
            maxWidthClassName="max-w-3xl"
            footer={(
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button onClick={onCancel}>Avbryt</Button>
                    <Button onClick={onConfirm} variant="primary">Exportera till offert</Button>
                </div>
            )}
        >
            <div className="p-5 sm:p-6">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b-2 border-panel-border">
                                <th className="p-2.5 text-left text-xs font-semibold text-text-secondary uppercase">Typ</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Storlek</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Behov</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">I lager</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Bristgrad</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={`${row.type}-${row.size}`}
                                    className={`border-b border-border ${row.isShort ? 'bg-danger-bg' : 'bg-success-bg'}`}
                                >
                                    <td className="p-2.5 font-semibold text-text-primary">{row.type}</td>
                                    <td className="p-2.5 text-center text-text-primary">{row.size} mm</td>
                                    <td className="p-2.5 text-center font-bold text-text-primary">{row.needed}</td>
                                    <td className={`p-2.5 text-center font-bold ${row.inStock > 0 ? 'text-success-text' : 'text-text-muted'}`}>
                                        {row.inStock}
                                    </td>
                                    <td className={`p-2.5 text-center font-semibold ${row.isShort ? 'text-danger-text' : 'text-success-text'}`}>
                                        {row.isShort ? `${row.shortfall} st` : '0 st'}
                                    </td>
                                    <td className={`p-2.5 text-center font-semibold ${row.isShort ? 'text-danger-text' : 'text-success-text'}`}>
                                        {row.isShort ? 'Kritisk' : 'OK'}
                                    </td>
                                </tr>
                            ))}

                            {stodbenCount > 0 && (
                                <tr className="border-b border-border bg-warning-bg">
                                    <td className="p-2.5 font-semibold text-text-primary">Stödben 45°</td>
                                    <td className="p-2.5 text-center text-text-primary">-</td>
                                    <td className="p-2.5 text-center font-bold text-text-primary">{stodbenCount}</td>
                                    <td className="p-2.5 text-center text-text-muted">
                                        -
                                    </td>
                                    <td className="p-2.5 text-center text-warning-text">
                                        -
                                    </td>
                                    <td className="p-2.5 text-center text-warning-text">
                                        Tillval
                                    </td>
                                </tr>
                            )}

                            {slimlineCount > 0 && (
                                <tr className="border-b border-border bg-warning-bg">
                                    <td className="p-2.5 font-semibold text-text-primary">Slimline</td>
                                    <td className="p-2.5 text-center text-text-primary">-</td>
                                    <td className="p-2.5 text-center font-bold text-text-primary">{slimlineCount}</td>
                                    <td className="p-2.5 text-center text-text-muted">
                                        -
                                    </td>
                                    <td className="p-2.5 text-center text-warning-text">
                                        -
                                    </td>
                                    <td className="p-2.5 text-center text-warning-text">
                                        Tillval
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {hasShortfall && (
                    <p role="alert" className="m-0 mt-4 rounded-panel border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
                        Det finns lagerbrist för en eller flera storlekar. Du kan fortfarande exportera till offerten.
                    </p>
                )}
            </div>
        </Modal>
    );
}
