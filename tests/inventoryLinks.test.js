import { describe, expect, it } from 'vitest';
import {
    getClickitupInventoryRouteSearch,
    getInventoryRouteSearch,
    readClickitupInventoryRoute,
    readInventoryRouteState
} from '../src/navigation/inventoryLinks';

describe('inventory URL state', () => {
    it('routes ClickitUp sections and accessories without changing BaHaMa defaults', () => {
        expect(readClickitupInventoryRoute('')).toEqual({ line: 'bahama', tab: 'sections' });
        expect(readClickitupInventoryRoute(getClickitupInventoryRouteSearch('accessories'))).toEqual({ line: 'clickitup', tab: 'accessories' });
        expect(readClickitupInventoryRoute('?line=clickitup&tab=bad')).toEqual({ line: 'clickitup', tab: 'sections' });
    });
    it('uses the Lagerkarta as the stable default and keeps Lista compact', () => {
        expect(readInventoryRouteState('')).toEqual({ view: 'map', rack: 1 });
        expect(readInventoryRouteState('?view=list')).toEqual({ view: 'list', rack: 1 });
        expect(getInventoryRouteSearch('map')).toBe('');
        expect(getInventoryRouteSearch('list')).toBe('?view=list');
    });

    it('round-trips a selected Grenställ and safely normalizes invalid query values', () => {
        expect(getInventoryRouteSearch('rack', 4)).toBe('?view=rack&rack=4');
        expect(readInventoryRouteState('?view=rack&rack=4')).toEqual({ view: 'rack', rack: 4 });
        expect(readInventoryRouteState('?view=rack&rack=99')).toEqual({ view: 'rack', rack: 1 });
        expect(readInventoryRouteState('?view=unknown&rack=3')).toEqual({ view: 'map', rack: 1 });
    });
});
