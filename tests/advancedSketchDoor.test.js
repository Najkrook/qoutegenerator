import { describe, expect, it } from 'vitest';
import { calculateSectionsForEdge, parseSection } from '../src/utils/sectionCalculator';

describe('Advanced Sketch Door & Custom Properties logic', () => {
    it('correctly parses sections and doors using parseSection', () => {
        const standardResult = parseSection(1500);
        expect(standardResult.kind).toBe('section');
        expect(standardResult.length).toBe(1500);

        const stringResult = parseSection('1600');
        expect(stringResult.kind).toBe('section');
        expect(stringResult.length).toBe(1600);

        const doorResult = parseSection('Dörr 1000');
        expect(doorResult.kind).toBe('door');
        expect(doorResult.length).toBe(1000);

        const customDoorResult = parseSection('Dörr 700');
        expect(customDoorResult.kind).toBe('door');
        expect(customDoorResult.length).toBe(700);
    });

    it('correctly computes sections with doors and varying sizes/priorities', () => {
        // Test a 4000 mm wall with a 1000 mm door under convenient prio
        const sectionsConvenient = calculateSectionsForEdge(4000, true, {
            prioMode: 'convenient',
            doorSize: 1000,
            targetLength: 1500
        });

        // The solver should produce a total length summing up to 4000
        const parsedConvenient = sectionsConvenient.map(s => parseSection(s));
        const totalSumConvenient = parsedConvenient.reduce((sum, p) => sum + p.length, 0);
        expect(totalSumConvenient).toBe(4000);
        
        // Ensure there is exactly one door in the resolved sections
        const doorSections = parsedConvenient.filter(p => p.kind === 'door');
        expect(doorSections).toHaveLength(1);
        expect(doorSections[0].length).toBe(1000);

        // Test a 3000 mm wall with a 700 mm door under target prio mode and 1100 target glass length
        const sectionsTarget = calculateSectionsForEdge(3000, true, {
            prioMode: 'target',
            doorSize: 700,
            targetLength: 1100
        });

        const parsedTarget = sectionsTarget.map(s => parseSection(s));
        const totalSumTarget = parsedTarget.reduce((sum, p) => sum + p.length, 0);
        expect(totalSumTarget).toBe(3000);
        
        const targetDoors = parsedTarget.filter(p => p.kind === 'door');
        expect(targetDoors).toHaveLength(1);
        expect(targetDoors[0].length).toBe(700);
    });
});
