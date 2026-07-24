import { describe, expect, it, vi } from 'vitest';
import {
    buildCrmSearchFields,
    createCrmRepository,
    deriveDealActivityDates,
    getCrmStageForQuoteStatus,
    normalizeCrmActivity,
    normalizeCrmCompany,
    normalizeCrmContact,
    normalizeCrmDeal,
    normalizeCrmMember,
    normalizeCrmSearchText,
    normalizeCrmTags,
    normalizeCrmWebsite
} from '../src/services/crmRepository';
import { createFirestoreMock } from './fixtures/firestoreMock';

const actor = {
    uid: 'admin-1',
    name: 'Ada Admin',
    email: 'ada@brixx.se'
};

function buildRepo(initialDocs = {}, dependencyOverrides = {}) {
    const mock = createFirestoreMock(initialDocs);
    let nowMs = Date.parse('2026-07-23T08:00:00.000Z');
    let sequence = 0;
    const strictRunTransaction = (db, callback) => mock.runTransaction(db, async (transaction) => {
        let hasWritten = false;
        return callback({
            get(ref) {
                if (hasWritten) {
                    throw new Error('Firestore transaction attempted a read after a write.');
                }
                return transaction.get(ref);
            },
            set(ref, payload, options) {
                hasWritten = true;
                transaction.set(ref, payload, options);
            }
        });
    });
    const repo = createCrmRepository({
        ...mock,
        runTransaction: strictRunTransaction,
        now: () => nowMs,
        createId: (prefix) => `${prefix}-${++sequence}`,
        ...dependencyOverrides
    });
    return {
        mock,
        repo,
        setNow: (value) => {
            nowMs = value;
        }
    };
}

describe('crmRepository pure helpers', () => {
    it('normalizes Swedish search text and builds token prefixes', () => {
        const fields = buildCrmSearchFields(['Örebro Företag AB', 'info@example.se']);

        expect(normalizeCrmSearchText('  Örebro & Företag  ')).toBe('orebro foretag');
        expect(fields.searchText).toContain('orebro foretag ab');
        expect(fields.searchPrefixes).toContain('ore');
        expect(fields.searchPrefixes).toContain('fore');
        expect(fields.searchPrefixes).toContain('info');
    });

    it('normalizes safe websites and removes script/data URLs', () => {
        expect(normalizeCrmWebsite('brixx.se')).toBe('https://brixx.se/');
        expect(normalizeCrmWebsite('http://example.com/path')).toBe('http://example.com/path');
        expect(normalizeCrmWebsite('javascript:alert(1)')).toBe('');
        expect(normalizeCrmWebsite('data:text/html,test')).toBe('');
    });

    it('maps quote statuses without allowing archived quotes to change a stage', () => {
        expect(getCrmStageForQuoteStatus('draft')).toBe('quote');
        expect(getCrmStageForQuoteStatus('sent')).toBe('quote');
        expect(getCrmStageForQuoteStatus('won')).toBe('won');
        expect(getCrmStageForQuoteStatus('lost')).toBe('lost');
        expect(getCrmStageForQuoteStatus('archived')).toBeNull();
    });

    it('derives latest activity and earliest due open task', () => {
        expect(deriveDealActivityDates([
            {
                archived: false,
                type: 'note',
                status: 'completed',
                occurredAtMs: 100,
                createdAtMs: 100,
                dueAtMs: null
            },
            {
                archived: false,
                type: 'task',
                status: 'open',
                occurredAtMs: 200,
                createdAtMs: 200,
                dueAtMs: 500
            },
            {
                archived: false,
                type: 'task',
                status: 'open',
                occurredAtMs: 300,
                createdAtMs: 300,
                dueAtMs: 400
            },
            {
                archived: true,
                type: 'task',
                status: 'open',
                occurredAtMs: 900,
                createdAtMs: 900,
                dueAtMs: 50
            }
        ])).toEqual({
            lastActivityAtMs: 300,
            nextActivityAtMs: 400
        });
    });

    it('normalizes tags with stable casing, limits, and case-insensitive deduplication', () => {
        const tags = normalizeCrmTags([
            '  Viktig  ',
            'viktig',
            'Å'.repeat(45),
            ...Array.from({ length: 25 }, (_, index) => `Tagg ${index}`)
        ]);

        expect(tags[0]).toBe('Viktig');
        expect(Array.from(tags[1])).toHaveLength(40);
        expect(tags).toHaveLength(20);
        expect(tags.filter((tag) => tag.toLocaleLowerCase('sv-SE') === 'viktig')).toHaveLength(1);
    });

    it('normalizes legacy CRM records to schema version 1 and safe defaults', () => {
        const records = [
            normalizeCrmCompany('company-1', { name: 'Kund AB' }),
            normalizeCrmContact('contact-1', { name: 'Anna Andersson' }),
            normalizeCrmDeal('deal-1', { title: 'Ny affär', expectedCloseAtMs: 100.9 }),
            normalizeCrmActivity('activity-1', { type: 'note', subject: 'Notering' }),
            normalizeCrmMember('member-1', { name: 'Ada Admin' })
        ];

        expect(records.every((record) => record.schemaVersion === 1)).toBe(true);
        expect(records[2].tags).toEqual([]);
        expect(records[2].expectedCloseAtMs).toBe(100);
        expect(records[3]).toMatchObject({ type: 'note', status: 'completed' });
    });
});

describe('crmRepository CRUD, search, and paging', () => {
    it('emits best-effort CRM audit events for important changes', async () => {
        const logAudit = vi.fn();
        const { repo } = buildRepo({}, { logAudit });
        const company = await repo.createCompany({ actor, name: 'Auditkund AB' });
        const deal = await repo.createDeal({ actor, title: 'Audit-affär' });
        const activity = await repo.createActivity({
            actor,
            dealId: deal.id,
            type: 'task',
            subject: 'Audit-uppgift',
            dueAtMs: Date.parse('2026-07-24T08:00:00.000Z')
        });
        await repo.completeActivity({ activityId: activity.id, actor });

        expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
            actor,
            eventType: 'crm_company_created',
            targetId: company.id
        }));
        expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'crm_deal_created',
            targetId: deal.id
        }));
        expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'crm_activity_completed',
            targetId: activity.id
        }));
    });

    it('creates, updates, searches, pages, archives, and restores companies', async () => {
        const { repo, mock, setNow } = buildRepo();
        const first = await repo.createCompany({
            actor,
            name: 'Örebro Solskydd',
            website: 'orebrosol.se',
            address: { city: 'Örebro' },
            tags: ['Prospekt']
        });
        setNow(Date.parse('2026-07-23T09:00:00.000Z'));
        const second = await repo.createCompany({
            actor,
            name: 'Malmö Utemiljö'
        });

        expect(first.normalizedName).toBe('orebro solskydd');
        expect(first.website).toBe('https://orebrosol.se/');
        expect(mock.__docs.get(`crm_companies/${first.id}`)).toMatchObject({
            name: 'Örebro Solskydd',
            archived: false,
            createdByUid: 'admin-1'
        });

        const search = await repo.listCompanies({ search: 'ore', pageSize: 10 });
        expect(search.items.map((company) => company.id)).toEqual([first.id]);

        const pageOne = await repo.listCompanies({ pageSize: 1 });
        expect(pageOne.items[0].id).toBe(second.id);
        expect(pageOne.nextCursor).not.toBeNull();
        const pageTwo = await repo.listCompanies({ pageSize: 1, cursor: pageOne.nextCursor });
        expect(pageTwo.items[0].id).toBe(first.id);

        const updated = await repo.updateCompany({
            companyId: first.id,
            actor,
            patch: {
                phone: '019-123 45',
                address: { street: 'Storgatan 1' },
                website: 'javascript:alert(1)'
            }
        });
        expect(updated.phone).toBe('019-123 45');
        expect(updated.address).toMatchObject({ street: 'Storgatan 1', city: 'Örebro' });
        expect(updated.website).toBe('');

        await repo.archiveCompany({ companyId: first.id, actor });
        expect((await repo.listCompanies()).items.map((company) => company.id)).toEqual([second.id]);
        expect((await repo.listCompanies({ includeArchived: true })).items).toHaveLength(2);

        const restored = await repo.restoreCompany({ companyId: first.id, actor });
        expect(restored.archived).toBe(false);
        expect(restored.archivedAtMs).toBeNull();
    });

    it('supports contacts, deals, members, and parallel global search', async () => {
        const { repo } = buildRepo();
        const company = await repo.createCompany({ actor, name: 'Brixx Partner AB' });
        const contact = await repo.createContact({
            actor,
            companyId: company.id,
            firstName: 'Anna',
            lastName: 'Andersson',
            email: 'anna@partner.se'
        });
        const member = await repo.createMember({
            id: 'seller-1',
            actor,
            name: 'Säljare Ett',
            email: 'seller@brixx.se'
        });
        const deal = await repo.createDeal({
            actor,
            title: 'Ny uteservering Partner',
            companyId: company.id,
            primaryContactId: contact.id,
            ownerId: member.id,
            ownerName: member.name,
            valueSek: 125000
        });

        expect((await repo.listContacts({ companyId: company.id })).items).toEqual([contact]);
        expect((await repo.listDeals({ companyId: company.id, ownerId: member.id })).items).toEqual([deal]);
        expect((await repo.listMembers()).items).toEqual([member]);

        const result = await repo.searchAll({ query: 'partner', pageSize: 20 });
        expect(result.companies.items.map((row) => row.id)).toContain(company.id);
        expect(result.contacts.items.map((row) => row.id)).toContain(contact.id);
        expect(result.deals.items.map((row) => row.id)).toContain(deal.id);
    });

    it('stores deal tags and includes them in deal search', async () => {
        const { repo } = buildRepo();
        const deal = await repo.createDeal({
            actor,
            title: 'Terrassprojekt',
            tags: ['  Prioriterad ', 'prioriterad', 'Uteservering']
        });

        expect(deal.tags).toEqual(['Prioriterad', 'Uteservering']);
        expect((await repo.listDeals({ search: 'uteserver' })).items.map((row) => row.id)).toEqual([deal.id]);

        const updated = await repo.updateDeal({
            dealId: deal.id,
            actor,
            patch: { tags: ['Återkommande'] }
        });
        expect(updated.tags).toEqual(['Återkommande']);
        expect((await repo.listDeals({ search: 'ater' })).items.map((row) => row.id)).toEqual([deal.id]);
    });

    it('finds company duplicates by exact normalized name or organization number', async () => {
        const { repo } = buildRepo();
        const byName = await repo.createCompany({ actor, name: 'Örebro Solskydd AB' });
        const byOrgNumber = await repo.createCompany({
            actor,
            name: 'Annan kund',
            orgNumber: '556123-4567'
        });
        const archived = await repo.createCompany({ actor, name: 'Örebro Solskydd AB' });
        await repo.archiveCompany({ companyId: archived.id, actor });

        expect(await repo.findCompanyDuplicates({ name: ' orebro SOLSKYDD ab ' }))
            .toEqual([byName]);
        expect(await repo.findCompanyDuplicates({ orgNumber: ' 556123-4567 ' }))
            .toEqual([byOrgNumber]);
        expect(await repo.findCompanyDuplicates({
            name: 'Örebro Solskydd AB',
            excludeCompanyId: byName.id
        })).toEqual([]);
        expect((await repo.findCompanyDuplicates({
            name: 'Örebro Solskydd AB',
            includeArchived: true
        })).map((company) => company.id)).toEqual(expect.arrayContaining([byName.id, archived.id]));
        expect(await repo.findCompanyDuplicates({})).toEqual([]);
    });

    it('finds contacts by exact email globally or exact normalized name within one company', async () => {
        const { repo } = buildRepo();
        const firstCompany = await repo.createCompany({ actor, name: 'Första AB' });
        const secondCompany = await repo.createCompany({ actor, name: 'Andra AB' });
        const first = await repo.createContact({
            actor,
            companyId: firstCompany.id,
            firstName: 'Anna',
            lastName: 'Åberg',
            email: 'anna@example.se'
        });
        const sameNameElsewhere = await repo.createContact({
            actor,
            companyId: secondCompany.id,
            firstName: 'Anna',
            lastName: 'Åberg'
        });

        expect(await repo.findContactDuplicates({
            companyId: secondCompany.id,
            email: ' ANNA@EXAMPLE.SE '
        })).toEqual([first]);
        expect(await repo.findContactDuplicates({
            companyId: firstCompany.id,
            name: 'anna aberg'
        })).toEqual([first]);
        expect(await repo.findContactDuplicates({
            companyId: firstCompany.id,
            name: 'Anna Åberg',
            excludeContactId: first.id
        })).toEqual([]);
        expect(await repo.findContactDuplicates({
            companyId: secondCompany.id,
            name: 'Anna Åberg'
        })).toEqual([sameNameElsewhere]);
        expect(await repo.findContactDuplicates({ companyId: firstCompany.id })).toEqual([]);
    });
});

describe('crmRepository activity derivation', () => {
    it('recomputes deal activity dates after create, complete, and archive', async () => {
        const { repo, setNow } = buildRepo();
        const deal = await repo.createDeal({ actor, title: 'Aktivitetsaffär' });
        const firstDue = Date.parse('2026-07-24T08:00:00.000Z');
        const secondDue = Date.parse('2026-07-25T08:00:00.000Z');

        const firstTask = await repo.createActivity({
            actor,
            dealId: deal.id,
            type: 'task',
            subject: 'Ring kunden',
            dueAtMs: firstDue
        });
        setNow(Date.parse('2026-07-23T09:00:00.000Z'));
        const secondTask = await repo.createActivity({
            actor,
            dealId: deal.id,
            type: 'task',
            subject: 'Skicka underlag',
            dueAtMs: secondDue
        });

        let updatedDeal = await repo.getDeal(deal.id);
        expect(updatedDeal.nextActivityAtMs).toBe(firstDue);
        expect(updatedDeal.lastActivityAtMs).toBe(secondTask.occurredAtMs);

        await repo.completeActivity({ activityId: firstTask.id, actor });
        updatedDeal = await repo.getDeal(deal.id);
        expect(updatedDeal.nextActivityAtMs).toBe(secondDue);

        await repo.archiveActivity({ activityId: secondTask.id, actor });
        updatedDeal = await repo.getDeal(deal.id);
        expect(updatedDeal.nextActivityAtMs).toBeNull();
        expect(updatedDeal.lastActivityAtMs).toBe(firstTask.occurredAtMs);
    });

    it('creates only tasks as open activities', async () => {
        const { repo } = buildRepo();
        const openTask = await repo.createActivity({
            actor,
            type: 'task',
            subject: 'Följ upp',
            dueAtMs: Date.parse('2026-07-24T08:00:00.000Z')
        });
        const completedNote = await repo.createActivity({
            actor,
            type: 'note',
            status: 'open',
            subject: 'Anteckning',
            dueAtMs: Date.parse('2026-07-24T08:00:00.000Z')
        });
        const completedCall = await repo.createActivity({
            actor,
            type: 'call',
            status: 'open',
            subject: 'Samtal'
        });

        expect(openTask).toMatchObject({ type: 'task', status: 'open', completedAtMs: null });
        expect(completedNote.status).toBe('completed');
        expect(completedNote.completedAtMs).not.toBeNull();
        expect(completedNote.dueAtMs).toBeNull();
        expect(completedCall.status).toBe('completed');

        await expect(repo.createActivity({
            actor,
            type: 'task',
            subject: 'Saknar förfallodatum'
        })).rejects.toThrow('require a due date');
        await expect(repo.updateActivity({
            activityId: openTask.id,
            actor,
            patch: { dueAtMs: null }
        })).rejects.toThrow('require a due date');
    });

    it('reschedules only an open task to a future time and refreshes the deal', async () => {
        const logAudit = vi.fn();
        const { repo, setNow } = buildRepo({}, { logAudit });
        const deal = await repo.createDeal({ actor, title: 'Ombokningsaffär' });
        const firstTask = await repo.createActivity({
            actor,
            dealId: deal.id,
            type: 'task',
            subject: 'Första uppgiften',
            dueAtMs: Date.parse('2026-07-24T08:00:00.000Z')
        });
        await repo.createActivity({
            actor,
            dealId: deal.id,
            type: 'task',
            subject: 'Andra uppgiften',
            dueAtMs: Date.parse('2026-07-25T08:00:00.000Z')
        });
        setNow(Date.parse('2026-07-23T10:00:00.000Z'));

        const moved = await repo.rescheduleActivity({
            activityId: firstTask.id,
            actor,
            dueAtMs: Date.parse('2026-07-26T08:00:00.000Z')
        });

        expect(moved).toMatchObject({
            status: 'open',
            dueAtMs: Date.parse('2026-07-26T08:00:00.000Z')
        });
        expect((await repo.getDeal(deal.id)).nextActivityAtMs)
            .toBe(Date.parse('2026-07-25T08:00:00.000Z'));
        expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'crm_activity_rescheduled',
            targetId: firstTask.id,
            metadata: expect.objectContaining({
                previousDueAtMs: Date.parse('2026-07-24T08:00:00.000Z'),
                dueAtMs: Date.parse('2026-07-26T08:00:00.000Z')
            })
        }));

        await expect(repo.rescheduleActivity({
            activityId: firstTask.id,
            actor,
            dueAtMs: Date.parse('2026-07-23T09:59:59.999Z')
        })).rejects.toThrow('future');
    });

    it('keeps a successful reschedule when derived-date refresh temporarily fails', async () => {
        vi.useFakeTimers();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const { repo, mock } = buildRepo({
                'crm_deals/deal-1': {
                    id: 'deal-1',
                    title: 'Affär',
                    archived: false
                },
                'crm_activities/task-1': {
                    id: 'task-1',
                    dealId: 'deal-1',
                    type: 'task',
                    status: 'open',
                    subject: 'Följ upp',
                    dueAtMs: Date.parse('2026-07-24T08:00:00.000Z'),
                    archived: false
                }
            }, {
                getDocs: vi.fn().mockRejectedValue(new Error('temporary read failure'))
            });

            const moved = await repo.rescheduleActivity({
                activityId: 'task-1',
                actor,
                dueAtMs: Date.parse('2026-07-25T08:00:00.000Z')
            });

            expect(moved.dueAtMs).toBe(Date.parse('2026-07-25T08:00:00.000Z'));
            expect(mock.__docs.get('crm_activities/task-1').dueAtMs)
                .toBe(Date.parse('2026-07-25T08:00:00.000Z'));
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to refresh CRM deal activity dates'),
                expect.any(Error)
            );
            vi.clearAllTimers();
        } finally {
            errorSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it('rejects rescheduling completed tasks and non-task activities', async () => {
        const { repo } = buildRepo();
        const completedTask = await repo.createActivity({
            actor,
            type: 'task',
            status: 'completed',
            subject: 'Klar uppgift'
        });
        const note = await repo.createActivity({
            actor,
            type: 'note',
            subject: 'Anteckning'
        });

        await expect(repo.rescheduleActivity({
            activityId: completedTask.id,
            actor,
            dueAtMs: Date.parse('2026-07-24T08:00:00.000Z')
        })).rejects.toThrow('Only open CRM tasks');
        await expect(repo.rescheduleActivity({
            activityId: note.id,
            actor,
            dueAtMs: Date.parse('2026-07-24T08:00:00.000Z')
        })).rejects.toThrow('Only open CRM tasks');
    });
});

describe('crmRepository quote linking', () => {
    it('requires the dedicated quote-link transaction before entering the quote stage', async () => {
        const { repo } = buildRepo();

        await expect(repo.createDeal({
            actor,
            title: 'Ogiltig offertaffär',
            stage: 'quote'
        })).rejects.toThrow('linkDealToQuote');

        const deal = await repo.createDeal({ actor, title: 'Lead utan offert' });
        await expect(repo.changeDealStage({
            dealId: deal.id,
            stage: 'quote',
            actor
        })).rejects.toThrow('Link a quote');
    });

    it('links one quote transactionally and syncs quote/deal statuses in both directions', async () => {
        const { repo, mock } = buildRepo({
            'users/quote-owner/quotes/quote-1': {
                quoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260723-101',
                status: 'draft',
                totalSek: 45000
            }
        });
        const deal = await repo.createDeal({ actor, title: 'Offertaffär', valueSek: 1000 });

        const linked = await repo.linkDealToQuote({
            dealId: deal.id,
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-1',
            quoteNumber: 'BRIXX - 260723-101',
            valueSek: 45000,
            user: actor
        });
        expect(linked).toMatchObject({
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-1',
            quoteNumber: 'BRIXX - 260723-101',
            valueSek: 45000,
            stage: 'quote'
        });
        expect(mock.__docs.get('users/quote-owner/quotes/quote-1').crmDealId).toBe(deal.id);

        const won = await repo.syncDealFromQuote({
            dealId: deal.id,
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-1',
            quoteNumber: 'BRIXX - 260723-101',
            valueSek: 47500,
            quoteStatus: 'won',
            user: actor
        });
        expect(won.stage).toBe('won');
        expect(won.valueSek).toBe(47500);
        expect(mock.__docs.get('users/quote-owner/quotes/quote-1')).toMatchObject({
            crmDealId: deal.id,
            status: 'won',
            updatedAtMs: won.updatedAtMs
        });
        expect(mock.__docs.get('users/quote-owner/quotes/quote-1').searchText).toContain('won');

        const lost = await repo.changeDealStage({
            dealId: deal.id,
            stage: 'lost',
            lostReason: 'Budget',
            actor
        });
        expect(lost).toMatchObject({ stage: 'lost', lostReason: 'Budget' });
        expect(mock.__docs.get('users/quote-owner/quotes/quote-1')).toMatchObject({
            crmDealId: deal.id,
            status: 'lost'
        });

        const unchangedStage = await repo.syncDealFromQuote({
            dealId: deal.id,
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-1',
            quoteNumber: 'BRIXX - 260723-101',
            valueSek: 48000,
            quoteStatus: 'archived',
            user: actor
        });
        expect(unchangedStage.stage).toBe('lost');
        expect(unchangedStage.valueSek).toBe(48000);
    });

    it('rejects a quote linked to another deal and clears both sides on unlink', async () => {
        const { repo, mock } = buildRepo({
            'users/quote-owner/quotes/quote-1': {
                crmDealId: 'some-other-deal',
                status: 'draft'
            },
            'users/quote-owner/quotes/quote-2': {
                status: 'draft'
            }
        });
        const deal = await repo.createDeal({ actor, title: 'Unik offertaffär' });

        await expect(repo.linkDealToQuote({
            dealId: deal.id,
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-1',
            valueSek: 100,
            user: actor
        })).rejects.toThrow('already linked');

        await repo.linkDealToQuote({
            dealId: deal.id,
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-2',
            valueSek: 200,
            user: actor
        });
        const unlinked = await repo.unlinkDealFromQuote({ dealId: deal.id, user: actor });

        expect(unlinked.stage).toBe('lead');
        expect(unlinked.quoteId).toBeNull();
        expect(mock.__docs.get('users/quote-owner/quotes/quote-2').crmDealId).toBeNull();
    });

    it('keeps a finished deal and its newly linked quote on the same status', async () => {
        const { repo, mock } = buildRepo({
            'users/quote-owner/quotes/quote-won': {
                quoteId: 'quote-won',
                status: 'draft',
                crmDealId: null
            }
        });
        const deal = await repo.createDeal({ actor, title: 'Redan vunnen affär' });
        await repo.changeDealStage({
            dealId: deal.id,
            stage: 'won',
            actor
        });

        const linked = await repo.linkDealToQuote({
            dealId: deal.id,
            quoteOwnerUid: 'quote-owner',
            quoteId: 'quote-won',
            user: actor
        });

        expect(linked.stage).toBe('won');
        expect(mock.__docs.get('users/quote-owner/quotes/quote-won')).toMatchObject({
            crmDealId: deal.id,
            status: 'won'
        });
    });
});
