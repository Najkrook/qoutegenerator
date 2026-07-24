import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    FULL_ADMIN_UIDS,
    CRM_SCHEMA_VERSION,
    applyPlan,
    buildCrmMigrationPlan,
    buildSearchIndex,
    createDeterministicId,
    evaluateQuoteLink,
    mapQuoteStatusToDealStage,
    normalizeCompanyName,
    normalizeEmail,
    parseCliArgs
} from '../scripts/backfill-crm-from-quotes.mjs';

function quote({
    ownerUid = FULL_ADMIN_UIDS[0],
    quoteId,
    status = 'draft',
    company = 'BRIXX AB',
    name = 'Ada Lovelace',
    email = 'ADA@EXAMPLE.COM',
    totalSek = 12500,
    crmDealId = '',
    savedBy = 'seller@brixx.se',
    savedByUid = ownerUid,
    savedByEmail = '',
    extraNotes = ''
}) {
    return {
        ownerUid,
        quoteId,
        quotePath: `users/${ownerUid}/quotes/${quoteId}`,
        metadata: {
            quoteNumber: `20260723-${quoteId}`,
            customerName: company || name,
            company,
            status,
            crmDealId,
            createdAtMs: 1000,
            updatedAtMs: 2000,
            savedBy,
            savedByUid,
            savedByEmail,
            latestVersion: 2,
            latestRevisionId: `revision-${quoteId}`,
            totalSek: 100
        },
        latestRevision: {
            id: `revision-${quoteId}`,
            version: 2,
            savedAtMs: 2000,
            state: {
                customerInfo: {
                    company,
                    name,
                    email,
                    reference: 'Intern ref',
                    customerReference: 'Kund ref',
                    extraNotes
                }
            },
            summary: {
                finalTotalSek: totalSek
            }
        }
    };
}

function migrationPlan(overrides = {}) {
    return {
        membersToCreate: [],
        companiesToCreate: [],
        contactsToCreate: [],
        dealsToCreate: [],
        companyNoteAppends: [],
        contactNoteAppends: [],
        dealQuoteLinks: [],
        existingRecordUpgrades: [],
        quoteLinks: [],
        ...overrides
    };
}

function fakeFirestore(initialDocuments = {}) {
    const documents = new Map(
        Object.entries(initialDocuments).map(([documentPath, data]) => [
            documentPath,
            { ...data }
        ])
    );
    let transactionCount = 0;

    const reference = (documentPath) => ({ path: documentPath });
    const db = {
        documents,
        get transactionCount() {
            return transactionCount;
        },
        doc: (documentPath) => reference(documentPath),
        collection: (collectionName) => ({
            doc: (id) => reference(`${collectionName}/${id}`)
        }),
        batch: () => ({
            create: () => {},
            commit: async () => {}
        }),
        runTransaction: async (callback) => {
            transactionCount += 1;
            return callback({
                get: async (documentReference) => ({
                    exists: documents.has(documentReference.path),
                    data: () => documents.get(documentReference.path)
                }),
                update: (documentReference, patch) => {
                    documents.set(documentReference.path, {
                        ...documents.get(documentReference.path),
                        ...patch
                    });
                },
                create: (documentReference, data) => {
                    if (documents.has(documentReference.path)) {
                        throw new Error(`Document already exists: ${documentReference.path}`);
                    }
                    documents.set(documentReference.path, { ...data });
                }
            });
        }
    };

    return db;
}

describe('CRM quote backfill helpers', () => {
    it('normalizes company names and email addresses consistently', () => {
        expect(normalizeCompanyName('  BRIXX\u00a0AB  ')).toBe('brixx ab');
        expect(normalizeCompanyName('ÅKES  UTERUM')).toBe('åkes uterum');
        expect(normalizeEmail('  Sales@Example.COM ')).toBe('sales@example.com');
    });

    it('maps quote states to the compact CRM pipeline', () => {
        expect(mapQuoteStatusToDealStage('draft')).toBe('quote');
        expect(mapQuoteStatusToDealStage('SENT')).toBe('quote');
        expect(mapQuoteStatusToDealStage('won')).toBe('won');
        expect(mapQuoteStatusToDealStage('lost')).toBe('lost');
        expect(mapQuoteStatusToDealStage('archived')).toBeNull();
        expect(mapQuoteStatusToDealStage('legacy-value')).toBe('quote');
    });

    it('builds stable Firestore-safe IDs and normalized search prefixes', () => {
        const first = createDeterministicId('company', normalizeCompanyName('BRIXX AB'));
        const second = createDeterministicId('company', normalizeCompanyName(' brixx  ab '));
        const other = createDeterministicId('company', normalizeCompanyName('Annan AB'));

        expect(first).toBe(second);
        expect(first).not.toBe(other);
        expect(first).toMatch(/^company_[a-f0-9]{24}$/);

        const search = buildSearchIndex(['BRIXX AB', 'Ada Lovelace']);
        expect(search.searchText).toBe('ada lovelace brixx ab');
        expect(search.searchPrefixes).toEqual(expect.arrayContaining(['a', 'ada', 'b', 'brixx']));
    });

    it('is a dry run unless --apply is explicitly present', () => {
        expect(parseCliArgs([])).toEqual({ apply: false, help: false });
        expect(parseCliArgs(['--apply'])).toEqual({ apply: true, help: false });
        expect(() => parseCliArgs(['--force'])).toThrow('Unknown argument');
    });

    it('only permits an empty or already-identical quote CRM link', () => {
        expect(evaluateQuoteLink('', 'deal-1')).toBe('write');
        expect(evaluateQuoteLink('deal-1', 'deal-1')).toBe('noop');
        expect(evaluateQuoteLink('deal-other', 'deal-1')).toBe('conflict');
    });
});

describe('CRM Firebase configuration', () => {
    it('keeps validated CRM writes admin-only and protects quote CRM links from owner writes', () => {
        const rules = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

        for (const [collection, validator] of [
            ['crm_companies', 'isValidCrmCompany'],
            ['crm_contacts', 'isValidCrmContact'],
            ['crm_deals', 'isValidCrmDeal'],
            ['crm_activities', 'isValidCrmActivity'],
            ['crm_members', 'isValidCrmMember']
        ]) {
            const matchStart = rules.indexOf(`match /${collection}/`);
            const nextMatch = rules.indexOf('\n    match /', matchStart + 1);
            const block = rules.slice(matchStart, nextMatch);

            expect(matchStart).toBeGreaterThan(-1);
            expect(block).toContain('allow read: if isAdmin();');
            expect(block).toContain('allow create: if isAdmin()');
            expect(block).toContain('allow update: if isAdmin()');
            expect(block).toContain(`${validator}(request.resource.data`);
            expect(block).toContain('hasValidCrmCreateAudit(request.resource.data)');
            expect(block).toContain('hasValidCrmUpdateAudit(request.resource.data, resource.data)');
            expect(block).toContain('allow delete: if false;');
        }
        expect(rules).toContain('data.schemaVersion == 1');
        expect(rules).toContain('data.updatedByUid == request.auth.uid');
        expect(rules).toContain('data.createdAtMs == previous.createdAtMs');
        expect(rules).toContain('data.createdByUid == previous.createdByUid');
        expect(rules).toContain('data.createdByName == previous.createdByName');
        expect(rules).toContain('data.tags.size() <= 20');
        expect(rules).toContain('tags[index] is string');
        expect(rules).toContain('tags[index].size() <= 40');
        expect(rules).toContain('isValidCrmTagAt(data.tags, 19)');
        expect(rules).toContain("data.stage in ['lead', 'quote', 'won', 'lost']");
        expect(rules).toContain('data.valueSek >= 0');
        expect(rules).toContain("data.stage != 'quote' || data.quoteId is string");
        expect(rules).toContain("data.type == 'task'");
        expect(rules).toContain("data.type in ['note', 'call', 'email', 'meeting']");
        expect(rules).toContain("data.status == 'completed'");
        expect(rules).toContain('data.dueAtMs is int');
        expect(rules).toContain('isNullableCrmInt(data.dueAtMs)');
        expect(rules).toContain("request.resource.data.get('crmDealId', null) == null");
        expect(rules).toContain(
            "request.resource.data.get('crmDealId', null) == resource.data.get('crmDealId', null)"
        );
        expect(rules).toContain('function hasRecognizedRole()');
        expect(rules).toContain('!hasRecognizedRole()');
        expect(rules).toContain('existsAfter(/databases/$(database)/documents/users/$(userId)/quotes/$(quoteId))');
        expect(rules).toContain("request.resource.data.get('state', {}).get('crmDealId', null) == null");
        expect(rules).toContain('match /{document=**}');
        expect(rules).toContain('allow read, write: if false;');
    });

    it('uses only automatic single-field indexes until server-side CRM queries are introduced', () => {
        const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve('firebase.json'), 'utf8'));
        const indexConfig = JSON.parse(fs.readFileSync(path.resolve('firestore.indexes.json'), 'utf8'));

        expect(firebaseConfig.firestore.indexes).toBe('firestore.indexes.json');
        expect(indexConfig).toEqual({
            indexes: [],
            fieldOverrides: []
        });
    });
});

describe('buildCrmMigrationPlan', () => {
    it('deduplicates companies, creates contacts and deals, and excludes archived quotes', () => {
        const plan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'quote-1',
                    status: 'sent',
                    company: ' BRIXX  AB ',
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    totalSek: 45000
                }),
                quote({
                    quoteId: 'quote-2',
                    status: 'won',
                    company: 'brixx ab',
                    name: 'Grace Hopper',
                    email: 'grace@example.com',
                    totalSek: 80000
                }),
                quote({
                    quoteId: 'quote-archived',
                    status: 'archived',
                    company: 'Historik AB',
                    name: 'Arkiverad Kund',
                    email: 'archive@example.com'
                })
            ]
        });

        expect(plan.stats).toEqual({
            scannedQuotes: 3,
            archivedQuotesSkipped: 1,
            activeQuotes: 2,
            nonAdminQuotesSkipped: 0,
            eligibleAdminQuotes: 2,
            fullAdminUsersResolved: 3
        });
        expect(plan.membersToCreate).toHaveLength(1);
        expect(plan.membersToCreate[0]).toMatchObject({
            id: FULL_ADMIN_UIDS[0],
            email: 'seller@brixx.se',
            normalizedEmail: 'seller@brixx.se'
        });
        expect(plan.companiesToCreate).toHaveLength(1);
        expect(plan.companiesToCreate[0]).toMatchObject({
            normalizedName: 'brixx ab',
            archived: false,
            archivedAtMs: null
        });
        expect(plan.contactsToCreate).toHaveLength(2);
        expect(plan.dealsToCreate).toHaveLength(2);
        expect(plan.quoteLinks).toHaveLength(2);
        expect(plan.dealsToCreate.map((deal) => deal.stage).sort()).toEqual(['quote', 'won']);
        expect(plan.dealsToCreate.every((deal) => deal.ownerId === FULL_ADMIN_UIDS[0])).toBe(true);
        expect(plan.dealsToCreate.map((deal) => deal.valueSek).sort((a, b) => a - b)).toEqual([45000, 80000]);
        expect(plan.dealsToCreate.every((deal) => deal.quoteRevisionId?.startsWith('revision-'))).toBe(true);
        expect([
            ...plan.membersToCreate,
            ...plan.companiesToCreate,
            ...plan.contactsToCreate,
            ...plan.dealsToCreate
        ].every((record) => record.schemaVersion === CRM_SCHEMA_VERSION)).toBe(true);
        expect(plan.dealsToCreate.every((deal) => (
            Array.isArray(deal.tags) && deal.tags.length === 0
        ))).toBe(true);
        expect(plan.ambiguities).toEqual([]);
    });

    it('clamps negative deal values and writes integer millisecond fields', () => {
        const source = quote({
            quoteId: 'normalized-numbers',
            totalSek: -125.5
        });
        source.metadata.createdAtMs = 1000.75;
        source.metadata.updatedAtMs = 2000.99;
        source.latestRevision.savedAtMs = 2000.99;

        const plan = buildCrmMigrationPlan({ quotes: [source] });
        const records = [
            ...plan.membersToCreate,
            ...plan.companiesToCreate,
            ...plan.contactsToCreate,
            ...plan.dealsToCreate
        ];

        expect(plan.dealsToCreate[0].valueSek).toBe(0);
        for (const record of records) {
            expect(record.updatedAtMs).toBeGreaterThanOrEqual(record.createdAtMs);
            for (const [field, value] of Object.entries(record)) {
                if (field.endsWith('AtMs') && value != null) {
                    expect(Number.isInteger(value), `${record.id}.${field}`).toBe(true);
                }
            }
        }
    });

    it('produces no new writes when the same deterministic migration is planned again', () => {
        const sourceQuotes = [
            quote({
                quoteId: 'quote-1',
                company: 'BRIXX AB',
                name: 'Ada Lovelace',
                email: 'ada@example.com'
            }),
            quote({
                quoteId: 'quote-2',
                company: '',
                name: 'Privat Kund',
                email: 'private@example.com'
            })
        ];
        const first = buildCrmMigrationPlan({ quotes: sourceQuotes });
        const dealIdByPath = new Map(first.quoteLinks.map((link) => [link.quotePath, link.dealId]));
        const linkedQuotes = sourceQuotes.map((source) => ({
            ...source,
            metadata: {
                ...source.metadata,
                crmDealId: dealIdByPath.get(source.quotePath)
            }
        }));
        const second = buildCrmMigrationPlan({
            quotes: linkedQuotes,
            existingCompanies: first.companiesToCreate,
            existingContacts: first.contactsToCreate,
            existingDeals: first.dealsToCreate,
            existingMembers: first.membersToCreate
        });

        expect(second.membersToCreate).toEqual([]);
        expect(first.dealsToCreate).toHaveLength(2);
        expect(second.companiesToCreate).toEqual([]);
        expect(second.contactsToCreate).toEqual([]);
        expect(second.dealsToCreate).toEqual([]);
        expect(second.quoteLinks).toEqual([]);
        expect(second.ambiguities).toEqual([]);
    });

    it('upgrades all reused CRM records once and preserves existing deal tag arrays', async () => {
        const company = {
            id: 'company-existing',
            name: 'BRIXX AB',
            normalizedName: 'brixx ab',
            archived: false
        };
        const contact = {
            id: 'contact-existing',
            companyId: company.id,
            name: 'Ada Lovelace',
            normalizedEmail: 'ada@example.com',
            archived: false
        };
        const member = {
            id: FULL_ADMIN_UIDS[0],
            name: 'Säljare',
            email: 'seller@brixx.se',
            normalizedEmail: 'seller@brixx.se',
            archived: false
        };
        const deals = [
            {
                id: 'deal-needs-empty-tags',
                companyId: company.id,
                primaryContactId: contact.id,
                archived: false,
                quoteOwnerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'upgrade-empty-tags',
                tags: 'legacy-value'
            },
            {
                id: 'deal-keeps-tags',
                companyId: company.id,
                primaryContactId: contact.id,
                archived: false,
                quoteOwnerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'upgrade-existing-tags',
                tags: ['VIP']
            }
        ];
        const sources = [
            quote({
                quoteId: 'upgrade-empty-tags',
                crmDealId: deals[0].id
            }),
            quote({
                quoteId: 'upgrade-existing-tags',
                crmDealId: deals[1].id
            })
        ];
        const first = buildCrmMigrationPlan({
            quotes: sources,
            existingCompanies: [company],
            existingContacts: [contact],
            existingDeals: deals,
            existingMembers: [member]
        });
        const emptyTagUpgrade = first.existingRecordUpgrades.find((upgrade) =>
            upgrade.id === deals[0].id
        );
        const preservedTagUpgrade = first.existingRecordUpgrades.find((upgrade) =>
            upgrade.id === deals[1].id
        );

        expect(first.existingRecordUpgrades).toHaveLength(5);
        expect(emptyTagUpgrade.patch).toEqual({
            schemaVersion: CRM_SCHEMA_VERSION,
            tags: []
        });
        expect(preservedTagUpgrade.patch).toEqual({
            schemaVersion: CRM_SCHEMA_VERSION
        });

        const initialDocuments = {
            [`crm_companies/${company.id}`]: company,
            [`crm_contacts/${contact.id}`]: contact,
            [`crm_members/${member.id}`]: member,
            [`crm_deals/${deals[0].id}`]: deals[0],
            [`crm_deals/${deals[1].id}`]: deals[1],
            [sources[0].quotePath]: sources[0].metadata,
            [sources[1].quotePath]: sources[1].metadata
        };
        const db = fakeFirestore(initialDocuments);
        const result = await applyPlan(db, first);

        expect(result).toEqual({ writes: 5, conflicts: [] });
        expect(db.documents.get(`crm_deals/${deals[0].id}`).tags).toEqual([]);
        expect(db.documents.get(`crm_deals/${deals[1].id}`).tags).toEqual(['VIP']);

        const second = buildCrmMigrationPlan({
            quotes: sources,
            existingCompanies: [db.documents.get(`crm_companies/${company.id}`)],
            existingContacts: [db.documents.get(`crm_contacts/${contact.id}`)],
            existingDeals: [
                db.documents.get(`crm_deals/${deals[0].id}`),
                db.documents.get(`crm_deals/${deals[1].id}`)
            ],
            existingMembers: [db.documents.get(`crm_members/${member.id}`)]
        });

        expect(second.existingRecordUpgrades).toEqual([]);
    });

    it('reports duplicate company matches and does not link or merge the quote', () => {
        const plan = buildCrmMigrationPlan({
            quotes: [quote({ quoteId: 'quote-ambiguous' })],
            existingCompanies: [
                {
                    id: 'company-one',
                    name: 'BRIXX AB',
                    normalizedName: 'brixx ab',
                    archived: false
                },
                {
                    id: 'company-two',
                    name: ' Brixx  AB ',
                    normalizedName: 'brixx ab',
                    archived: false
                }
            ]
        });

        expect(plan.companiesToCreate).toEqual([]);
        expect(plan.contactsToCreate).toEqual([]);
        expect(plan.dealsToCreate).toEqual([]);
        expect(plan.quoteLinks).toEqual([]);
        expect(plan.skippedQuotePaths).toEqual([
            `users/${FULL_ADMIN_UIDS[0]}/quotes/quote-ambiguous`
        ]);
        expect(plan.ambiguities[0]).toMatchObject({
            type: 'ambiguous_company',
            candidateIds: ['company-one', 'company-two']
        });
    });

    it('reports a shared email used by different companies instead of merging contacts', () => {
        const plan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'quote-a',
                    company: 'Alpha AB',
                    email: 'shared@example.com'
                }),
                quote({
                    quoteId: 'quote-b',
                    company: 'Beta AB',
                    email: 'shared@example.com'
                })
            ]
        });

        expect(plan.contactsToCreate).toEqual([]);
        expect(plan.dealsToCreate).toEqual([]);
        expect(plan.quoteLinks).toEqual([]);
        expect(plan.ambiguities).toHaveLength(2);
        expect(plan.ambiguities.every((ambiguity) => ambiguity.type === 'email_used_across_companies')).toBe(true);
    });

    it('only migrates quotes owned by a full admin and reports the skipped scope', () => {
        const roleAdminUid = 'role-admin-user';
        const nonAdminUid = 'quote-only-user';
        const plan = buildCrmMigrationPlan({
            quotes: [
                quote({ quoteId: 'hardcoded-admin' }),
                quote({
                    ownerUid: roleAdminUid,
                    savedByUid: roleAdminUid,
                    savedBy: 'role-admin@example.com',
                    quoteId: 'role-admin',
                    email: 'role-admin@example.com'
                }),
                quote({
                    ownerUid: nonAdminUid,
                    savedByUid: nonAdminUid,
                    quoteId: 'not-admin',
                    email: 'not-admin@example.com'
                })
            ],
            userRoles: [
                { id: roleAdminUid, role: 'admin' },
                { id: nonAdminUid, role: 'quote_only' }
            ]
        });

        expect(plan.dealsToCreate).toHaveLength(2);
        expect(plan.quoteLinks).toHaveLength(2);
        expect(plan.stats).toMatchObject({
            activeQuotes: 3,
            eligibleAdminQuotes: 2,
            nonAdminQuotesSkipped: 1,
            fullAdminUsersResolved: 4
        });
        expect(plan.nonAdminQuotePaths).toEqual([
            `users/${nonAdminUid}/quotes/not-admin`
        ]);
    });

    it('lets an explicit non-admin role override the hardcoded admin fallback', () => {
        const downgradedUid = FULL_ADMIN_UIDS[0];
        const plan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    ownerUid: downgradedUid,
                    savedByUid: downgradedUid,
                    quoteId: 'downgraded-admin'
                })
            ],
            userRoles: [
                { id: downgradedUid, role: 'quote_only' }
            ]
        });

        expect(plan.dealsToCreate).toEqual([]);
        expect(plan.quoteLinks).toEqual([]);
        expect(plan.nonAdminQuotePaths).toEqual([
            `users/${downgradedUid}/quotes/downgraded-admin`
        ]);
        expect(plan.stats.fullAdminUsersResolved).toBe(FULL_ADMIN_UIDS.length - 1);
    });

    it('creates deduplicated CRM members and points deal owners at the reused member', () => {
        const plan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'member-reuse',
                    savedBy: 'Ada Lovelace',
                    savedByUid: 'new-uid',
                    savedByEmail: 'ADA@BRIXX.SE'
                })
            ],
            existingMembers: [
                {
                    id: 'existing-member',
                    name: 'Ada',
                    email: 'ada@brixx.se',
                    normalizedEmail: 'ada@brixx.se',
                    archived: false
                }
            ]
        });

        expect(plan.membersToCreate).toEqual([]);
        expect(plan.dealsToCreate[0].ownerId).toBe('existing-member');
    });

    it('maps and deduplicates extra notes on companies and standalone contacts', () => {
        const companyPlan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'company-note-1',
                    email: 'first@example.com',
                    extraNotes: 'Ring före leverans'
                }),
                quote({
                    quoteId: 'company-note-2',
                    email: 'second@example.com',
                    extraNotes: 'Ring före leverans'
                }),
                quote({
                    quoteId: 'company-note-3',
                    email: 'third@example.com',
                    extraNotes: 'Kräver lyftkran'
                })
            ]
        });
        const contactPlan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'private-note',
                    company: '',
                    name: 'Privat Kund',
                    email: 'private@example.com',
                    extraNotes: 'Endast kvällstid'
                })
            ]
        });

        expect(companyPlan.companiesToCreate[0].notes).toBe(
            'Ring före leverans\n\nKräver lyftkran'
        );
        expect(companyPlan.contactsToCreate.every((contact) => contact.notes === '')).toBe(true);
        expect(contactPlan.contactsToCreate[0].notes).toBe('Endast kvällstid');
    });

    it('plans append-only missing notes for an existing company without duplicates', () => {
        const existingCompany = {
            id: 'company-existing',
            name: 'BRIXX AB',
            normalizedName: 'brixx ab',
            notes: 'Befintlig notering',
            archived: false
        };
        const first = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'append-note',
                    extraNotes: 'Ny notering'
                })
            ],
            existingCompanies: [existingCompany]
        });
        const second = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'append-note',
                    extraNotes: 'Ny notering'
                })
            ],
            existingCompanies: [{
                ...existingCompany,
                notes: 'Befintlig notering\n\nNy notering'
            }]
        });

        expect(first.companyNoteAppends).toEqual([
            { id: 'company-existing', notes: ['Ny notering'] }
        ]);
        expect(second.companyNoteAppends).toEqual([]);
    });

    it('plans a guarded relink when a referenced deal has empty quote fields', () => {
        const source = quote({
            quoteId: 'relink-me',
            crmDealId: 'deal-existing',
            totalSek: -125.5
        });
        const plan = buildCrmMigrationPlan({
            quotes: [source],
            existingDeals: [{
                id: 'deal-existing',
                archived: false,
                quoteOwnerUid: null,
                quoteId: null
            }]
        });

        expect(plan.dealsToCreate).toEqual([]);
        expect(plan.dealQuoteLinks).toEqual([
            expect.objectContaining({
                dealId: 'deal-existing',
                quoteOwnerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'relink-me',
                valueSek: 0
            })
        ]);
        expect(plan.quoteLinks).toEqual([]);
    });

    it('guardedly relinks a deterministic existing deal even before metadata is linked', () => {
        const source = quote({ quoteId: 'deterministic-relink' });
        const dealId = createDeterministicId(
            'deal',
            FULL_ADMIN_UIDS[0],
            'deterministic-relink'
        );
        const plan = buildCrmMigrationPlan({
            quotes: [source],
            existingDeals: [{
                id: dealId,
                archived: false,
                quoteOwnerUid: null,
                quoteId: null
            }]
        });

        expect(plan.dealQuoteLinks).toEqual([
            expect.objectContaining({ dealId, quoteId: 'deterministic-relink' })
        ]);
        expect(plan.quoteLinks).toEqual([]);
    });

    it('reports an archived deal as a manual conflict and never relinks it', () => {
        const plan = buildCrmMigrationPlan({
            quotes: [
                quote({
                    quoteId: 'archived-deal',
                    crmDealId: 'deal-archived'
                })
            ],
            existingDeals: [{
                id: 'deal-archived',
                archived: true,
                quoteOwnerUid: null,
                quoteId: null
            }]
        });

        expect(plan.dealQuoteLinks).toEqual([]);
        expect(plan.quoteLinks).toEqual([]);
        expect(plan.ambiguities[0]).toMatchObject({
            type: 'archived_deal_match',
            candidateIds: ['deal-archived']
        });
    });

    it('uses a transaction and skips a quote link changed after dry-run', async () => {
        const quotePath = `users/${FULL_ADMIN_UIDS[0]}/quotes/concurrent`;
        const db = fakeFirestore({
            [quotePath]: { crmDealId: 'deal-other' }
        });
        const result = await applyPlan(db, migrationPlan({
            quoteLinks: [{
                quotePath,
                ownerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'concurrent',
                dealId: 'deal-planned'
            }]
        }));

        expect(db.transactionCount).toBe(1);
        expect(result.writes).toBe(0);
        expect(result.conflicts).toEqual([
            expect.objectContaining({
                type: 'quote_link_changed',
                currentDealId: 'deal-other',
                plannedDealId: 'deal-planned'
            })
        ]);
        expect(db.documents.get(quotePath).crmDealId).toBe('deal-other');
    });

    it('does not relink a deal when the quote link changed after dry-run', async () => {
        const quotePath = `users/${FULL_ADMIN_UIDS[0]}/quotes/relink-conflict`;
        const db = fakeFirestore({
            [quotePath]: { crmDealId: 'deal-other' },
            'crm_deals/deal-planned': {
                archived: false,
                quoteOwnerUid: null,
                quoteId: null
            }
        });
        const result = await applyPlan(db, migrationPlan({
            dealQuoteLinks: [{
                dealId: 'deal-planned',
                quotePath,
                quoteOwnerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'relink-conflict',
                quoteNumber: null,
                quoteRevisionId: null,
                quoteVersion: 1,
                valueSek: 100
            }]
        }));

        expect(result.writes).toBe(0);
        expect(result.conflicts[0]).toMatchObject({
            type: 'quote_link_changed_during_deal_relink',
            currentQuoteDealId: 'deal-other'
        });
        expect(db.documents.get('crm_deals/deal-planned').quoteId).toBeNull();
    });

    it('clamps a negative value while transactionally relinking an existing deal', async () => {
        const quotePath = `users/${FULL_ADMIN_UIDS[0]}/quotes/relink-negative`;
        const db = fakeFirestore({
            [quotePath]: { crmDealId: null },
            'crm_deals/deal-planned': {
                archived: false,
                quoteOwnerUid: null,
                quoteId: null,
                valueSek: 500
            }
        });

        const result = await applyPlan(db, migrationPlan({
            dealQuoteLinks: [{
                dealId: 'deal-planned',
                quotePath,
                quoteOwnerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'relink-negative',
                quoteNumber: null,
                quoteRevisionId: null,
                quoteVersion: 1,
                valueSek: -100
            }]
        }));

        expect(result).toEqual({ writes: 2, conflicts: [] });
        expect(db.documents.get('crm_deals/deal-planned').valueSek).toBe(0);
        expect(db.documents.get(quotePath).crmDealId).toBe('deal-planned');
    });

    it('transactionally writes a quote link only when it is still empty', async () => {
        const quotePath = `users/${FULL_ADMIN_UIDS[0]}/quotes/unlinked`;
        const db = fakeFirestore({
            [quotePath]: { crmDealId: null }
        });
        const result = await applyPlan(db, migrationPlan({
            quoteLinks: [{
                quotePath,
                ownerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'unlinked',
                dealId: 'deal-planned'
            }]
        }));

        expect(result).toEqual({ writes: 1, conflicts: [] });
        expect(db.documents.get(quotePath).crmDealId).toBe('deal-planned');
    });

    it('creates a new deal and its quote link in one guarded transaction', async () => {
        const quotePath = `users/${FULL_ADMIN_UIDS[0]}/quotes/atomic-create`;
        const deal = {
            id: 'deal-atomic',
            title: 'Atomic deal',
            quoteOwnerUid: FULL_ADMIN_UIDS[0],
            quoteId: 'atomic-create'
        };
        const link = {
            quotePath,
            ownerUid: FULL_ADMIN_UIDS[0],
            quoteId: 'atomic-create',
            dealId: deal.id
        };
        const db = fakeFirestore({
            [quotePath]: { crmDealId: null }
        });

        const result = await applyPlan(db, migrationPlan({
            dealsToCreate: [deal],
            quoteLinks: [link]
        }));

        expect(result).toEqual({ writes: 2, conflicts: [] });
        expect(db.transactionCount).toBe(1);
        expect(db.documents.get(`crm_deals/${deal.id}`)).toEqual(deal);
        expect(db.documents.get(quotePath).crmDealId).toBe(deal.id);
    });

    it('does not create a deal when its quote gained another CRM link after dry-run', async () => {
        const quotePath = `users/${FULL_ADMIN_UIDS[0]}/quotes/atomic-conflict`;
        const deal = {
            id: 'deal-not-created',
            title: 'Conflicting deal',
            quoteOwnerUid: FULL_ADMIN_UIDS[0],
            quoteId: 'atomic-conflict'
        };
        const db = fakeFirestore({
            [quotePath]: { crmDealId: 'deal-other' }
        });

        const result = await applyPlan(db, migrationPlan({
            dealsToCreate: [deal],
            quoteLinks: [{
                quotePath,
                ownerUid: FULL_ADMIN_UIDS[0],
                quoteId: 'atomic-conflict',
                dealId: deal.id
            }]
        }));

        expect(result.writes).toBe(0);
        expect(result.conflicts[0]).toMatchObject({
            type: 'quote_link_changed_during_deal_create',
            currentDealId: 'deal-other'
        });
        expect(db.documents.has(`crm_deals/${deal.id}`)).toBe(false);
    });
});
