import { describe, expect, it } from 'vitest';
import { normalizeInventoryText, normalizeInventoryItem, normalizeInventoryList } from '../src/utils/csvNormalizer';

describe('CSV Normalizer', () => {
    it('normalizes common double-encoded UTF-8 strings (mojibake)', () => {
        // "ã¤" often results from UTF-8 "ä" being read as Windows-1252
        expect(normalizeInventoryText('\u00e3\u00a4')).toBe('ä');
        expect(normalizeInventoryText('P\u00e3\u00a5g\u00e3\u00a5ende')).toBe('Pågående');
        expect(normalizeInventoryText('Tillbeh\u00c3\u00b6r')).toBe('Tillbehör');
        expect(normalizeInventoryText('Gallerigr\u00c3\u00a4nd')).toBe('Gallerigränd');
    });

    it('handles clean UTF-8 safely without mangling', () => {
        expect(normalizeInventoryText('Pågående')).toBe('Pågående');
        expect(normalizeInventoryText('Övrigt')).toBe('Övrigt');
        expect(normalizeInventoryText('Äpple')).toBe('Äpple');
    });

    it('normalizes an entire inventory item object', () => {
        const rawItem = {
            'STORLEK': 'Ok\u00e3\u00a4nd',
            'BESKRIVNING': 'Ett tillbeh\u00c3\u00b6r',
            'Antal': 5,
        };

        const cleaned = normalizeInventoryItem(rawItem);
        expect(cleaned['STORLEK']).toBe('Okänd');
        expect(cleaned['BESKRIVNING']).toBe('Ett tillbehör');
        expect(cleaned['Antal']).toBe(5); // Maintains numbers
    });

    it('normalizes an entire inventory list', () => {
        const rawList = [
            { 'BESKRIVNING': 'Test 1 \u00e3\u00a4' },
            { 'BESKRIVNING': 'Test 2' }
        ];

        const cleaned = normalizeInventoryList(rawList);
        expect(cleaned).toHaveLength(2);
        expect(cleaned[0]['BESKRIVNING']).toBe('Test 1 ä');
        expect(cleaned[1]['BESKRIVNING']).toBe('Test 2');
    });
});
