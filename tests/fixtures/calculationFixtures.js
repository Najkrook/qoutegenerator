export function createCatalogFixture() {
    return {
        BaHaMa: {
            currency: 'SEK',
            models: {
                Jumbrella: {
                    sizes: {
                        '3x3 Kvadrat': { price: 30000 },
                        '4x4 Kvadrat': { price: 45000 }
                    },
                    addonCategories: [
                        {
                            id: 'installation',
                            name: 'Installation',
                            items: [
                                { id: 'gutter-kit', name: 'Rannsystem', price: 5000 },
                                { id: 'heater', name: 'Varmare', price: 9000 }
                            ]
                        }
                    ]
                }
            }
        },
        ClickitUP: {
            currency: 'EUR',
            gridItems: [
                {
                    model: 'ClickitUP Section',
                    sizes: [
                        { size: '1000', price: 1000 },
                        { size: '1200', price: 1200 }
                    ]
                }
            ],
            addonCategories: [
                {
                    id: 'doors',
                    items: [
                        { id: 'door-right', name: 'Dorr hoger', price: 200 },
                        { id: 'door-left', name: 'Dorr vanster', price: 200 }
                    ]
                }
            ]
        }
    };
}

export function createStateFixture(overrides = {}) {
    return {
        builderItems: [
            {
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '3x3 Kvadrat',
                qty: 2,
                discountPct: 10,
                addons: [
                    { id: 'gutter-kit', qty: 1, discountPct: 20 }
                ]
            }
        ],
        gridSelections: {
            ClickitUP: {
                items: {
                    'ClickitUP Section|1000': { qty: 1, discountPct: 5 }
                },
                addons: {
                    'door-right': { qty: 1, discountPct: 0 }
                }
            }
        },
        customCosts: [
            { description: 'Montering', price: 1000, qty: 1 }
        ],
        exchangeRate: 11.5,
        globalDiscountPct: 15,
        includesVat: true,
        customerInfo: {
            name: 'Testkund',
            company: 'Testbolag AB',
            reference: 'REF-123',
            customerReference: 'CUST-456',
            date: '2026-03-02',
            validity: '30 dagar'
        },
        ...overrides
    };
}
