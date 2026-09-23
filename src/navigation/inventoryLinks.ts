import type { BahamaRackNumber } from '../services/bahamaStorageLocation';

export type InventoryView = 'map' | 'list' | 'rack';

export interface InventoryRouteState {
    view: InventoryView;
    rack: BahamaRackNumber;
}

export type ClickitupInventoryTab = 'sections' | 'accessories';

export function readClickitupInventoryRoute(search: string | URLSearchParams): { line: 'bahama' | 'clickitup'; tab: ClickitupInventoryTab } {
    const params = typeof search === 'string' ? new URLSearchParams(search) : search;
    return {
        line: params.get('line') === 'clickitup' ? 'clickitup' : 'bahama',
        tab: params.get('tab') === 'accessories' ? 'accessories' : 'sections'
    };
}

export function getClickitupInventoryRouteSearch(tab: ClickitupInventoryTab = 'sections'): string {
    return `?line=clickitup&tab=${tab}`;
}

function parseRackNumber(value: string | null): BahamaRackNumber {
    const rack = Number(value);
    return [1, 2, 3, 4].includes(rack) ? rack as BahamaRackNumber : 1;
}

export function readInventoryRouteState(search: string | URLSearchParams): InventoryRouteState {
    const params = typeof search === 'string' ? new URLSearchParams(search) : search;
    const view = params.get('view');

    if (view === 'list') {
        return { view: 'list', rack: 1 };
    }
    if (view === 'rack') {
        return { view: 'rack', rack: parseRackNumber(params.get('rack')) };
    }
    return { view: 'map', rack: 1 };
}

export function getInventoryRouteSearch(view: InventoryView, rack: BahamaRackNumber = 1): string {
    if (view === 'map') {
        return '';
    }

    const params = new URLSearchParams({ view });
    if (view === 'rack') {
        params.set('rack', String(rack));
    }
    return `?${params.toString()}`;
}
