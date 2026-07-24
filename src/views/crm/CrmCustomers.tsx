import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmCompany, CrmContact, CrmDeal } from '../../types/crm';
import {
    CompanyFormModal,
    ContactFormModal,
    type CompanyFormValues,
    type ContactFormValues
} from './crmForms';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_PATHS,
    CrmPanel,
    CrmShell,
    DuplicateReviewDialog,
    type DuplicateReviewMatch,
    EmptyState,
    ErrorState,
    LoadingState,
    StageBadge,
    TagChips,
    formatCrmDate,
    formatCurrencySek,
    inputClass,
    isOpenDeal,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface CustomersData {
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
}

type DuplicateReview =
    | { kind: 'company'; input: CompanyFormValues; matches: DuplicateReviewMatch[] }
    | { kind: 'contact'; input: ContactFormValues; matches: DuplicateReviewMatch[] };

export function CrmCustomersPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search.trim());
    const [companyFormOpen, setCompanyFormOpen] = useState(false);
    const [contactFormOpen, setContactFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [mutationError, setMutationError] = useState('');
    const [duplicateReview, setDuplicateReview] = useState<DuplicateReview | null>(null);

    const load = useCallback(async (): Promise<CustomersData> => {
        const query = deferredSearch || undefined;
        const [companiesPage, contactsPage, dealsPage] = await Promise.all([
            crmRepository.listCompanies({ search: query, pageSize: 250 }),
            crmRepository.listContacts({ search: query, pageSize: 250 }),
            crmRepository.listDeals({ search: query, pageSize: 250 })
        ]);

        return {
            companies: companiesPage.items,
            contacts: contactsPage.items,
            deals: dealsPage.items
        };
    }, [deferredSearch]);

    const { data, loading, error, reload } = useCrmLoader<CustomersData>(
        load,
        { companies: [], contacts: [], deals: [] },
        'Kunde inte ladda kunderna.'
    );

    const contactsByCompany = useMemo(() => {
        const grouped = new Map<string, CrmContact[]>();
        for (const contact of data.contacts) {
            if (contact.archived || !contact.companyId) continue;
            const current = grouped.get(contact.companyId) || [];
            current.push(contact);
            grouped.set(contact.companyId, current);
        }
        return grouped;
    }, [data.contacts]);

    const dealsByCompany = useMemo(() => {
        const grouped = new Map<string, CrmDeal[]>();
        for (const deal of data.deals) {
            if (deal.archived || !deal.companyId) continue;
            const current = grouped.get(deal.companyId) || [];
            current.push(deal);
            grouped.set(deal.companyId, current);
        }
        return grouped;
    }, [data.deals]);

    const privateContacts = useMemo(
        () => data.contacts.filter((contact) => !contact.archived && !contact.companyId),
        [data.contacts]
    );

    const handleCreateCompany = async (input: CompanyFormValues, createAnyway = false): Promise<void> => {
        setSaving(true);
        setMutationError('');
        try {
            if (!createAnyway) {
                const matches = await crmRepository.findCompanyDuplicates({
                    name: input.name,
                    orgNumber: input.orgNumber
                });
                if (matches.length > 0) {
                    setDuplicateReview({
                        kind: 'company',
                        input,
                        matches: matches.map((company) => ({
                            id: company.id,
                            label: company.name,
                            details: [company.orgNumber, company.email].filter(Boolean).join(' · '),
                            archived: company.archived
                        }))
                    });
                    return;
                }
            }
            await crmRepository.createCompany({ actor: getCrmActor(user), ...input });
            setDuplicateReview(null);
            setCompanyFormOpen(false);
            reload();
        } catch (createError) {
            console.error('Failed to create CRM company:', createError);
            setMutationError('Kunde inte skapa kunden. Kontrollera uppgifterna och försök igen.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateContact = async (input: ContactFormValues, createAnyway = false): Promise<void> => {
        setSaving(true);
        setMutationError('');
        try {
            if (!createAnyway) {
                const matches = await crmRepository.findContactDuplicates({
                    companyId: input.companyId,
                    name: input.name,
                    email: input.email
                });
                if (matches.length > 0) {
                    setDuplicateReview({
                        kind: 'contact',
                        input,
                        matches: matches.map((contact) => ({
                            id: contact.id,
                            label: contact.name,
                            details: [contact.email, contact.phone].filter(Boolean).join(' · '),
                            archived: contact.archived
                        }))
                    });
                    return;
                }
            }
            await crmRepository.createContact({ actor: getCrmActor(user), ...input });
            setDuplicateReview(null);
            setContactFormOpen(false);
            reload();
        } catch (createError) {
            console.error('Failed to create CRM contact:', createError);
            setMutationError('Kunde inte skapa kontakten. Kontrollera uppgifterna och försök igen.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <CrmShell
            title="Kunder och kontakter"
            description="Gemensamma kundkort med kontakter, affärer och senaste uppföljning."
            actions={(
                <>
                    <button type="button" className={secondaryButtonClass} onClick={() => setContactFormOpen(true)}>
                        Lägg till kontakt
                    </button>
                    <button type="button" className={primaryButtonClass} onClick={() => setCompanyFormOpen(true)}>
                        Lägg till kund
                    </button>
                </>
            )}
        >
            <CrmPanel>
                <label htmlFor="crm-customer-search" className="sr-only">Sök kunder, kontakter eller affärer</label>
                <input
                    id="crm-customer-search"
                    type="search"
                    className={inputClass}
                    placeholder="Sök kund, kontakt, mejladress eller affär..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <p className="mt-2 text-xs text-text-secondary">
                    Sökningen matchar företag, kontakter, affärer och taggar.
                </p>
            </CrmPanel>

            {loading ? <LoadingState label="Laddar kunder..." /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error ? (
                <>
                    <CrmPanel
                        title="Företag"
                        description={`${data.companies.filter((company) => !company.archived).length} aktiva kundkort`}
                    >
                        {data.companies.filter((company) => !company.archived).length === 0 ? (
                            <EmptyState
                                title={deferredSearch ? 'Inga företag matchar sökningen' : 'Inga företag registrerade'}
                                description={deferredSearch
                                    ? 'Prova ett annat sökord eller sök efter en kontakt.'
                                    : 'Lägg till den första kunden för att börja bygga CRM-registret.'}
                                action={!deferredSearch ? (
                                    <button type="button" className={primaryButtonClass} onClick={() => setCompanyFormOpen(true)}>
                                        Lägg till första kunden
                                    </button>
                                ) : undefined}
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-panel-border text-xs uppercase tracking-[0.06em] text-text-secondary">
                                            <th className="px-3 py-3 font-bold">Kund</th>
                                            <th className="px-3 py-3 font-bold">Kontakt</th>
                                            <th className="px-3 py-3 font-bold">Öppna affärer</th>
                                            <th className="px-3 py-3 text-right font-bold">Pipelinevärde</th>
                                            <th className="px-3 py-3 font-bold">Nästa aktivitet</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.companies.filter((company) => !company.archived).map((company) => {
                                            const contacts = contactsByCompany.get(company.id) || [];
                                            const openDeals = (dealsByCompany.get(company.id) || []).filter(isOpenDeal);
                                            const nextActivityAtMs = openDeals.reduce((nearest, deal) => {
                                                if (!deal.nextActivityAtMs) return nearest;
                                                return !nearest || deal.nextActivityAtMs < nearest ? deal.nextActivityAtMs : nearest;
                                            }, 0);

                                            return (
                                                <tr key={company.id} className="border-b border-panel-border/70 last:border-b-0 hover:bg-white/5">
                                                    <td className="px-3 py-4">
                                                        <Link to={CRM_PATHS.company(company.id)} className="font-semibold text-text-primary hover:text-primary">
                                                            {company.name}
                                                        </Link>
                                                        <p className="mt-1 text-xs text-text-secondary">
                                                            {company.orgNumber || company.email || 'Inga kompletterande uppgifter'}
                                                        </p>
                                                        <TagChips tags={company.tags} className="mt-2" />
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <p className="text-text-primary">{contacts[0]?.name || 'Ingen kontakt'}</p>
                                                        <p className="mt-1 text-xs text-text-secondary">
                                                            {contacts.length > 1 ? `+${contacts.length - 1} ytterligare` : contacts[0]?.email || ''}
                                                        </p>
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {openDeals.length === 0 ? (
                                                                <span className="text-text-secondary">0</span>
                                                            ) : openDeals.slice(0, 2).map((deal) => (
                                                                <StageBadge key={deal.id} stage={deal.stage} />
                                                            ))}
                                                            {openDeals.length > 2 ? (
                                                                <span className="text-xs text-text-secondary">+{openDeals.length - 2}</span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-4 text-right font-semibold text-text-primary">
                                                        {formatCurrencySek(openDeals.reduce((sum, deal) => sum + deal.valueSek, 0))}
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <span className={nextActivityAtMs ? 'text-text-primary' : 'font-semibold text-warning'}>
                                                            {nextActivityAtMs ? formatCrmDate(nextActivityAtMs, true) : 'Saknas'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CrmPanel>

                    {privateContacts.length > 0 ? (
                        <CrmPanel title="Fristående kontakter" description="Privatkunder och kontakter utan kopplat företag.">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {privateContacts.map((contact) => (
                                    <Link
                                        key={contact.id}
                                        to={CRM_PATHS.contact(contact.id)}
                                        className="rounded-xl border border-panel-border bg-black/5 p-4 transition-colors hover:border-primary/40 hover:bg-white/5"
                                    >
                                        <p className="font-semibold text-text-primary">{contact.name}</p>
                                        <p className="mt-1 text-sm text-text-secondary">{contact.email || contact.phone || 'Kontaktuppgifter saknas'}</p>
                                        <TagChips tags={contact.tags} className="mt-3" />
                                    </Link>
                                ))}
                            </div>
                        </CrmPanel>
                    ) : null}
                </>
            ) : null}

            <CompanyFormModal
                open={companyFormOpen}
                saving={saving}
                error={mutationError}
                onClose={() => {
                    if (!saving) {
                        setCompanyFormOpen(false);
                        setDuplicateReview(null);
                        setMutationError('');
                    }
                }}
                onSubmit={handleCreateCompany}
            />
            <ContactFormModal
                open={contactFormOpen}
                saving={saving}
                error={mutationError}
                companies={data.companies}
                onClose={() => {
                    if (!saving) {
                        setContactFormOpen(false);
                        setDuplicateReview(null);
                        setMutationError('');
                    }
                }}
                onSubmit={handleCreateContact}
            />
            <DuplicateReviewDialog
                open={Boolean(duplicateReview)}
                entityLabel={duplicateReview?.kind === 'company' ? 'kund' : 'kontakt'}
                matches={duplicateReview?.matches || []}
                saving={saving}
                onCancel={() => setDuplicateReview(null)}
                onOpenExisting={(match) => {
                    const kind = duplicateReview?.kind;
                    setDuplicateReview(null);
                    setCompanyFormOpen(false);
                    setContactFormOpen(false);
                    if (kind === 'company') {
                        navigate(CRM_PATHS.company(match.id));
                    } else {
                        navigate(CRM_PATHS.contact(match.id));
                    }
                }}
                onCreateAnyway={() => {
                    if (!duplicateReview) return;
                    if (duplicateReview.kind === 'company') {
                        void handleCreateCompany(duplicateReview.input, true);
                    } else {
                        void handleCreateContact(duplicateReview.input, true);
                    }
                }}
            />
        </CrmShell>
    );
}

export const CrmCustomers = CrmCustomersPage;
