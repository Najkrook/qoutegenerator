import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractingWorkSummaryTable } from '../src/components/features/ContractingWorkSummaryTable';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import { prepareQuote } from '../src/services/quotePreparation';

function renderContractingSummary(overrides = {}) {
    const state = {
        ...createInitialQuoteState(),
        exportLanguage: 'sv',
        contractingWork: {
            enabled: true,
            projectName: 'Designer Village, Löddeköpinge',
            rows: [
                {
                    id: 'groundworks',
                    workPackage: 'Groundworks and foundations',
                    scope: 'Excavation and casting according to the supplied documentation.',
                    unit: 'consolidated work package',
                    priceExVatSek: 101600
                },
                {
                    id: 'installation',
                    workPackage: 'Installation',
                    scope: 'Delivery and installation.',
                    unit: 'consolidated work package',
                    priceExVatSek: 469600
                }
            ],
            margin: { enabled: true, percent: 15 },
            ata: { enabled: true, percent: 15 }
        },
        ...overrides
    };

    const prepared = prepareQuote({
        state,
        totals: {
            totals: [],
            grossTotalSek: 0,
            totalDiscountSek: 0,
            finalTotalSek: 0,
            globalDiscountAmt: 0
        },
        audience: { isRetailer: false }
    });

    return prepared.commercial.contractingWork
        ? renderToStaticMarkup(
            <ContractingWorkSummaryTable
                contractingWork={prepared.commercial.contractingWork}
                exportLanguage={prepared.presentation.exportLanguage}
            />
        )
        : '';
}

describe('ContractingWorkSummaryTable', () => {
    it('renders Swedish labels, user text, ex-VAT prices, and the ÄTA range', () => {
        const html = renderContractingSummary();
        const normalizedHtml = html.replace(/\u00a0/g, ' ');

        expect(html).toContain('Entreprenadarbeten - sammanställd översikt för Designer Village, Löddeköpinge');
        expect(html).toContain('Arbetspaket');
        expect(html).toContain('Sammanställd omfattning för hela området');
        expect(html).toContain('Excavation and casting according to the supplied documentation.');
        expect(html).toContain('Ert pris');
        expect(html).toContain('exkl. moms');
        expect(normalizedHtml).toContain('116 840 SEK');
        expect(normalizedHtml).toContain('540 040 SEK');
        expect(normalizedHtml).toContain('656 880 SEK');
        expect(html).toContain('ÄTA-reserv (±15%)');
        expect(normalizedHtml).toContain('98 532 SEK');
        expect(normalizedHtml).toContain('558 348 SEK');
        expect(normalizedHtml).toContain('755 412 SEK');
        expect(normalizedHtml).not.toContain('101 600 SEK');
        expect(normalizedHtml).not.toContain('469 600 SEK');
        expect(html).not.toMatch(/marginal|margin|markup/i);
    });

    it('localizes only system labels for English output', () => {
        const html = renderContractingSummary({ exportLanguage: 'en' });

        expect(html).toContain('Contracting works - consolidated overview for Designer Village, Löddeköpinge');
        expect(html).toContain('Work package');
        expect(html).toContain('Consolidated scope for the entire area');
        expect(html).toContain('Groundworks and foundations');
        expect(html).toContain('Variation work allowance (±15%)');
        expect(html).toContain('Upper indicative amount excl. VAT (+15%)');
        expect(html.replace(/\u00a0/g, ' ')).toContain('656 880 SEK');
        expect(html).not.toMatch(/marginal|margin|markup/i);
    });

    it('rounds fractional ATA values after the margin to whole SEK', () => {
        const html = renderContractingSummary({
            contractingWork: {
                enabled: true,
                projectName: '',
                rows: [{
                    id: 'work-1',
                    workPackage: 'Markarbete',
                    scope: 'Schakt och gjutning',
                    unit: 'arbete',
                    priceExVatSek: 586180
                }],
                margin: { enabled: true, percent: 15 },
                ata: { enabled: true, percent: 15 }
            }
        }).replace(/\u00a0/g, ' ');

        expect(html).toContain('674 107 SEK');
        expect(html).toContain('101 116 SEK');
        expect(html).toContain('572 991 SEK');
        expect(html).toContain('775 223 SEK');
    });

    it('renders nothing when contracting work is inactive', () => {
        const html = renderContractingSummary({
            contractingWork: {
                enabled: false,
                projectName: 'Hidden project',
                rows: [{
                    id: 'hidden',
                    workPackage: 'Hidden work',
                    scope: 'Hidden scope',
                    unit: 'work',
                    priceExVatSek: 50000
                }],
                margin: { enabled: true, percent: 15 },
                ata: { enabled: true, percent: 15 }
            }
        });

        expect(html).toBe('');
    });
});
