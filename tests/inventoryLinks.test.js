import { describe, expect, it } from 'vitest';
import {
    getInventoryRouteSearch,
    readInventoryRouteState
} from '../src/navigation/inventoryLinks';

describe('inventory URL state', () => {
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
