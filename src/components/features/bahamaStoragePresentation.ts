import type { BahamaInventoryV2Item } from '../../types/contracts';

function getStativColor(stativ: string): string {
    return stativ.trim().replace(/^RAL\s*/iu, '');
}

export function getBahamaTubeLabel(item: BahamaInventoryV2Item): string {
    const size = item.size.trim();
    const stativ = getStativColor(item.properties.stativ);
    if (size && stativ) {
        return `${size} – ${stativ}`;
    }
    return size || stativ || 'Uppgifter saknas';
}
