import { catalogData } from '../../data/catalog';

export interface InventoryOptionGroup {
    label: string;
    options: string[];
}

export const BAHAMA_TYPE_OPTIONS = ['Pure', 'Jumbrella', 'XL'];
export const BAHAMA_FRAME_OPTIONS = ['7016', '9016'];
export const BAHAMA_FOOT_OPTIONS = ['Tipping', '0451', 'Ingen'];
export const BAHAMA_LIGHTING_OPTIONS = ['Classic', 'Magic', 'Ingen'];
export const BAHAMA_HEAT_OPTIONS = ['Heaters', 'Ingen'];

export const BAHAMA_LOCATION_OPTION_GROUPS: InventoryOptionGroup[] = Array.from(
    { length: 6 },
    (_, rackIndex) => {
        const rack = rackIndex + 1;
        return {
            label: `Grenställ ${rack}`,
            options: Array.from({ length: 7 }, (_, floorIndex) => `Grenställ ${rack} våning ${floorIndex + 1}`)
        };
    }
);

export const BAHAMA_LOCATION_OPTIONS = BAHAMA_LOCATION_OPTION_GROUPS.flatMap((group) => group.options);

export function formatBahamaLocationOptionLabel(location: string): string {
    const match = location.match(/^Grenställ \d+ (våning \d+)$/i);
    if (!match) {
        return location;
    }
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}

export const BAHAMA_BETEX_TEXTILE_OPTIONS = [
    '9527 - carrot',
    '9577 - snow',
    '9926 - lime',
    '9710 - forest',
    '9853 - raven',
    '9545 - midnight',
    '9879 - merlot',
    '9654 - whale',
    '9965 - atlantic',
    '9675 - chili',
    '9665 - thunderstorm',
    '9866 - blueberry',
    '9671 - tomato',
    '9801 - concrete',
    '9767 - emerald',
    '9937 - moon',
    '9816 - sesame',
    '9875 - beach',
    '9712 - wheat',
    '9947 - mushroom',
    '9823 - prosecco',
    '9957 - hemp',
    '9932 - salmon',
    '9922 - apricot',
    '9526 - buttercup',
    '9946 - linden',
    '9904 - plum',
    '9956 - birch'
];

export const BAHAMA_AKRYL_TEXTILE_OPTIONS = [
    '2821 - Silver',
    '8488 - Anthracite',
    '2042 - White',
    '2296 - Oat',
    '2979 - Pearl',
    '2143 - Marfil',
    '3000 - Eucalyptus',
    '2209 - Merlot',
    '1473 - Generation Red',
    '1470 - Taupe',
    '20196 - Naxos',
    '3605 - Stone',
    '2777 - Naval',
    '1068 - Coal',
    '2018 - Blue',
    '1468 - Hay',
    '1071 - Sand',
    '3580 - Oats Tweed',
    '2829 - Lemon',
    '8785 - Lavender',
    '2274 - Arena',
    '2836 - Tomato',
    '1067 - Grape',
    '2170 - Black'
];

export const BAHAMA_TEXTILE_OPTION_GROUPS: InventoryOptionGroup[] = [
    { label: 'Betex 05', options: BAHAMA_BETEX_TEXTILE_OPTIONS },
    { label: 'Akryl', options: BAHAMA_AKRYL_TEXTILE_OPTIONS }
];

export const BAHAMA_TEXTILE_OPTIONS = BAHAMA_TEXTILE_OPTION_GROUPS.flatMap((group) => group.options);

function getBahamaModelKey(typeValue: string): string {
    const normalized = typeValue.trim().toLowerCase();
    if (normalized === 'xl' || normalized === 'jumbrella xl') {
        return 'Jumbrella XL';
    }
    if (normalized === 'pure') {
        return 'Pure';
    }
    if (normalized === 'jumbrella') {
        return 'Jumbrella';
    }
    return '';
}

export function getBahamaSizeOptions(typeValue: string): string[] {
    const modelKey = getBahamaModelKey(typeValue);
    const bahamaLine = catalogData.BaHaMa;
    if (bahamaLine?.type !== 'builder' || !modelKey) {
        return [];
    }

    return Object.keys(bahamaLine.models[modelKey]?.sizes || {});
}

export function getBahamaGroupedSizeOptions(typeValue: string): InventoryOptionGroup[] {
    const options = getBahamaSizeOptions(typeValue);
    const groups: InventoryOptionGroup[] = [];
    const ungrouped: string[] = [];
    const byGroup = new Map<string, string[]>();

    options.forEach((sizeLabel) => {
        const lower = sizeLabel.toLowerCase();
        let groupName = '';

        if (lower.includes('kvadrat')) {
            groupName = 'Kvadrat';
        } else if (lower.includes('runda') || sizeLabel.includes('*') || sizeLabel.includes('Ø')) {
            groupName = 'Runda';
        } else if (lower.includes('rektangel')) {
            groupName = 'Rektangel';
        } else if (sizeLabel.includes('x')) {
            const parts = sizeLabel.split('x').map((part) => part.trim());
            if (parts.length === 2) {
                groupName = parts[0] === parts[1] ? 'Kvadrat' : 'Rektangel';
            }
        }

        if (!groupName) {
            ungrouped.push(sizeLabel);
            return;
        }

        byGroup.set(groupName, [...(byGroup.get(groupName) || []), sizeLabel]);
    });

    if (ungrouped.length > 0) {
        groups.push({ label: '', options: ungrouped });
    }

    ['Kvadrat', 'Runda', 'Rektangel'].forEach((label) => {
        const groupOptions = byGroup.get(label) || [];
        if (groupOptions.length > 0) {
            groups.push({ label, options: groupOptions });
        }
    });

    return groups;
}
