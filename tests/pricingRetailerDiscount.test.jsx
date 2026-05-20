import { describe, expect, it } from 'vitest';
import { clampRetailerDiscount, getNextGlobalDiscount } from '../src/views/Pricing';

describe('Retailer global discount logic', () => {
    it('allows retailer global discounts within the configured retailer range', () => {
        expect(getNextGlobalDiscount('18', true, 30)).toBe(18);
        expect(getNextGlobalDiscount('0', true, 30)).toBe(0);
        expect(getNextGlobalDiscount('30', true, 30)).toBe(30);
    });

    it('clamps retailer global discounts to the configured retailer maximum', () => {
        expect(getNextGlobalDiscount('35', true, 30)).toBe(30);
        expect(getNextGlobalDiscount('100', true, 30)).toBe(30);
    });

    it('normalizes retailer discounts to a non-negative range', () => {
        expect(clampRetailerDiscount(-5, 30)).toBe(0);
        expect(getNextGlobalDiscount('-5', true, 30)).toBe(0);
    });

    it('keeps non-retailer discount parsing on the normal 0-100 scale', () => {
        expect(getNextGlobalDiscount('35', false, 30)).toBe(35);
        expect(getNextGlobalDiscount('140', false, 30)).toBe(100);
    });
});
