import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { confirmAction } from '../../services/notificationService';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmActivity, CrmCompany, CrmContact, CrmDeal, CrmMember } from '../../types/crm';
import {
    ActivityFormModal,
    CompanyFormModal,
    ContactFormModal,
    DealFormModal,
    type ContactFormValues
} from './crmForms';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_PATHS,
    ActivityTimeline,
    CrmMetric,
    CrmPanel,
    CrmShell,
    DuplicateReviewDialog,
    type DuplicateReviewMatch,
    EmptyState,
    ErrorState,
    LoadingState,
    StageBadge,
    TagChips,
    dangerButtonClass,
    formatCrmDate,
    formatCurrencySek,
    getSafeExternalUrl,
    isOpenDeal,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface CompanyDetailData {
    company: CrmCompany | null;
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
    activities: CrmActivity[];
    members: CrmMember[];
}

type CompanyModal = 'edit' | 'contact' | 'deal' | 'activity' | null;

export function CrmCompanyDetailPage() {
    const { companyId = '' } = useParams<{ companyId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeModal, setActiveModal] = useState<CompanyModal>(null);
    const [saving, setSaving] = useState(false);
    const [mutationError, setMutationError] = useState('');
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [duplicateContact, setDuplicateContact] = useState<{
        input: ContactFormValues;
        matches: DuplicateReviewMatch[];
    } | null>(null);

    const load = useCallback(async (): Promise<CompanyDetailData> => {
        const [company, companiesPage, contactsPage, dealsPage, activitiesPage, membersPage] = await Promise.all([
            crmRepository.getCompany(companyId),
            crmRepository.listCompanies({ includeArchived: true, pageSize: 500 }),
            crmRepository.listContacts({ companyId, pageSize: 500 }),
            crmRepository.listDeals({ companyId, pageSize: 500 }),
            crmRepository.listActivities({ companyId, pageSize: 500 }),
            crmRepository.listMembers({ pageSize: 200 })
        ]);

        return {
            company,
            companies: companiesPage.items,
            contacts: contactsPage.items,
            deals: dealsPage.items,
            activities: activitiesPage.items,
            members: membersPage.items
        };
    }, [companyId]);

    const { data, loading, error, reload } = useCrmLoader<CompanyDetailData>(
        load,
        { company: null, companies: [], contacts: [], deals: [], activities: [], members: [] },
        'Kunde inte ladda kundkortet.'
    );

    const visibleContacts = useMemo(
        () => data.contacts.filter((contact) => !contact.archived),
        [data.contacts]
    );
    const visibleDeals = useMemo(
        () => data.deals.filter((deal) => !deal.archived),
        [data.deals]
    );
    const orderedActivities = useMemo(
        () => [...data.activities]
            .filter((activity) => !activity.archived)
            .sort((left, right) => (
                (right.occurredAtMs || right.dueAtMs || right.createdAtMs)
                - (left.occurredAtMs || left.dueAtMs || left.createdAtMs)
            )),
        [data.activities]
    );

    const runMutation = async (
        action: () => Promise<unknown>,
        errorMessage: string,
        onSuccess?: () => void
    ): Promise<void> => {
        setSaving(true);
        setMutationError('');
        try {
            await action();
            onSuccess?.();
            setActiveModal(null);
            reload();
        } catch (mutationFailure) {
            console.error(errorMessage, mutationFailure);
            setMutationError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async (): Promise<void> => {
        if (!data.company) return;
        const confirmed = await confirmAction({
            title: 'Arkivera kund?',
            message: `Kundkortet för ${data.company.name} döljs från aktiva listor. Kontakter och affärer raderas inte.`,
            confirmText: 'Arkivera kund',
            tone: 'danger'
        });
        if (!confirmed) return;

        await runMutation(
            () => crmRepository.archiveCompany({
                companyId: data.company!.id,
                actor: getCrmActor(user)
            }),
            'Kunde inte arkivera kunden.',
            () => navigate(CRM_PATHS.customers)
        );
    };

    const handleComplete = async (activity: CrmActivity): Promise<void> => {
        setCompletingId(activity.id);
        try {
            await crmRepository.completeActivity({
                activityId: activity.id,
                actor: getCrmActor(user)
            });
            reload();
        } catch (completeError) {
            console.error('Failed to complete CRM activity:', completeError);
            setMutationError('Kunde inte markera uppgiften som klar.');
        } finally {
            setCompletingId(null);
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
                    setDuplicateContact({
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
            setDuplicateContact(null);
            setActiveModal(null);
            reload();
        } catch (createError) {
            console.error('Failed to create CRM contact:', createError);
            setMutationError('Kunde inte skapa kontakten.');
        } finally {
            setSaving(false);
        }
    };

    const company = data.company;
    const openDeals = visibleDeals.filter(isOpenDeal);
    const openValue = openDeals.reduce((sum, deal) => sum + deal.valueSek, 0);

    return (
        <CrmShell
            title={company?.name || 'Kundkort'}
            description={company ? 'Kontakter, affärer och aktivitet för kunden.' : 'Laddar kunduppgifter.'}
            actions={company && !company.archived ? (
                <>
                    <button type="button" className={secondaryButtonClass} onClick={() => setActiveModal('edit')}>Redigera</button>
                    <button type="button" className={dangerButtonClass} onClick={() => void handleArchive()}>Arkivera</button>
                </>
            ) : undefined}
        >
            {loading ? <LoadingState label="Laddar kundkort..." /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error && !company ? (
                <ErrorState message="Kunden kunde inte hittas. Den kan ha arkiverats eller tagits bort." />
            ) : null}
            {!loading && !error && company ? (
                <>
                    {company.archived ? (
                        <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm font-semibold text-warning">
                            Det här kundkortet är arkiverat och visas endast för historik.
                        </div>
                    ) : null}

                    <section className="grid gap-3 rounded-2xl border border-panel-border bg-panel-bg p-4 shadow-sm sm:grid-cols-3 sm:p-6">
                        <CrmMetric label="Kontakter" value={visibleContacts.length} />
                        <CrmMetric label="Öppna affärer" value={openDeals.length} supportingText={formatCurrencySek(openValue)} />
                        <CrmMetric
                            label="Nästa aktivitet"
                            value={openDeals.some((deal) => deal.nextActivityAtMs)
                                ? formatCrmDate(Math.min(...openDeals.filter((deal) => deal.nextActivityAtMs).map((deal) => deal.nextActivityAtMs)))
                                : 'Saknas'}
                            tone={openDeals.length > 0 && !openDeals.some((deal) => deal.nextActivityAtMs) ? 'warning' : 'default'}
                        />
                    </section>

                    <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
                        <CrmPanel title="Kunduppgifter">
                            <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Organisationsnummer</dt>
                                    <dd className="mt-1 text-text-primary">{company.orgNumber || 'Ej angivet'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">E-post</dt>
                                    <dd className="mt-1 break-all text-text-primary">{company.email || 'Ej angivet'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Telefon</dt>
                                    <dd className="mt-1 text-text-primary">{company.phone || 'Ej angivet'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Adress</dt>
                                    <dd className="mt-1 whitespace-pre-wrap text-text-primary">
                                        {[
                                            company.address.street,
                                            [company.address.postalCode, company.address.city].filter(Boolean).join(' '),
                                            company.address.country
                                        ].filter(Boolean).join('\n') || 'Ej angivet'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Webbplats</dt>
                                    <dd className="mt-1 break-all text-text-primary">
                                        {getSafeExternalUrl(company.website) ? (
                                            <a href={getSafeExternalUrl(company.website) || undefined} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                                {company.website}
                                            </a>
                                        ) : 'Ej angivet'}
                                    </dd>
                                </div>
                                {(company.tags || []).length > 0 ? (
                                    <div>
                                        <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Taggar</dt>
                                        <dd><TagChips tags={company.tags} className="mt-2" /></dd>
                                    </div>
                                ) : null}
                                {company.notes ? (
                                    <div>
                                        <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Anteckningar</dt>
                                        <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-text-secondary">{company.notes}</dd>
                                    </div>
                                ) : null}
                            </dl>
                        </CrmPanel>

                        <CrmPanel
                            title="Kontakter"
                            actions={!company.archived ? (
                                <button type="button" className={secondaryButtonClass} onClick={() => setActiveModal('contact')}>
                                    Lägg till kontakt
                                </button>
                            ) : undefined}
                        >
                            {visibleContacts.length === 0 ? (
                                <EmptyState
                                    title="Inga kontakter registrerade"
                                    description="Lägg till en kontaktperson för att samla mejl, telefon och aktivitet."
                                />
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {visibleContacts.map((contact) => (
                                        <Link
                                            key={contact.id}
                                            to={CRM_PATHS.contact(contact.id)}
                                            className="rounded-xl border border-panel-border bg-black/5 p-4 transition-colors hover:border-primary/40 hover:bg-white/5"
                                        >
                                            <p className="font-semibold text-text-primary">{contact.name}</p>
                                            <p className="mt-1 text-xs text-text-secondary">{contact.role || 'Ingen titel angiven'}</p>
                                            <p className="mt-3 truncate text-sm text-text-secondary">{contact.email || contact.phone || 'Kontaktuppgifter saknas'}</p>
                                            <TagChips tags={contact.tags} className="mt-3" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CrmPanel>
                    </div>

                    <CrmPanel
                        title="Affärer"
                        description={`${openDeals.length} öppna affärer, totalt ${formatCurrencySek(openValue)}`}
                        actions={!company.archived ? (
                            <button type="button" className={primaryButtonClass} onClick={() => setActiveModal('deal')}>
                                Skapa affär
                            </button>
                        ) : undefined}
                    >
                        {visibleDeals.length === 0 ? (
                            <EmptyState
                                title="Inga affärer registrerade"
                                description="Skapa en affär för att följa kunden genom säljpipelinen."
                            />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {visibleDeals.map((deal) => (
                                    <Link
                                        key={deal.id}
                                        to={CRM_PATHS.deal(deal.id)}
                                        className="rounded-xl border border-panel-border bg-black/5 p-4 transition-colors hover:border-primary/40 hover:bg-white/5"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="font-semibold text-text-primary">{deal.title}</p>
                                            <StageBadge stage={deal.stage} />
                                        </div>
                                        <p className="mt-3 text-lg font-semibold text-text-primary">{formatCurrencySek(deal.valueSek)}</p>
                                        <TagChips tags={deal.tags} className="mt-3" />
                                        <p className={`mt-2 text-xs ${deal.nextActivityAtMs ? 'text-text-secondary' : 'font-semibold text-warning'}`}>
                                            {deal.nextActivityAtMs
                                                ? `Nästa: ${formatCrmDate(deal.nextActivityAtMs, true)}`
                                                : 'Saknar nästa aktivitet'}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CrmPanel>

                    <CrmPanel
                        title="Tidslinje"
                        description="All aktivitet för kundens kontakter och affärer."
                        actions={!company.archived ? (
                            <button type="button" className={primaryButtonClass} onClick={() => setActiveModal('activity')}>
                                Registrera aktivitet
                            </button>
                        ) : undefined}
                    >
                        <ActivityTimeline
                            activities={orderedActivities}
                            onComplete={(activity) => void handleComplete(activity)}
                            completingId={completingId}
                            onRescheduled={() => reload()}
                        />
                    </CrmPanel>
                </>
            ) : null}

            <CompanyFormModal
                open={activeModal === 'edit'}
                initial={company}
                saving={saving}
                error={mutationError}
                onClose={() => setActiveModal(null)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.updateCompany({
                        companyId,
                        actor: getCrmActor(user),
                        patch: input
                    }),
                    'Kunde inte spara kunduppgifterna.'
                )}
            />
            <ContactFormModal
                open={activeModal === 'contact'}
                companies={data.companies}
                defaultCompanyId={companyId}
                saving={saving}
                error={mutationError}
                onClose={() => {
                    setDuplicateContact(null);
                    setActiveModal(null);
                }}
                onSubmit={handleCreateContact}
            />
            <DealFormModal
                open={activeModal === 'deal'}
                companies={data.companies}
                contacts={data.contacts}
                members={data.members}
                defaultCompanyId={companyId}
                saving={saving}
                error={mutationError}
                onClose={() => setActiveModal(null)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.createDeal({ actor: getCrmActor(user), ...input }),
                    'Kunde inte skapa affären.'
                )}
            />
            <ActivityFormModal
                open={activeModal === 'activity'}
                companies={data.companies}
                contacts={data.contacts}
                deals={data.deals}
                defaultCompanyId={companyId}
                saving={saving}
                error={mutationError}
                onClose={() => setActiveModal(null)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.createActivity({ actor: getCrmActor(user), ...input }),
                    'Kunde inte registrera aktiviteten.'
                )}
            />
            <DuplicateReviewDialog
                open={Boolean(duplicateContact)}
                entityLabel="kontakt"
                matches={duplicateContact?.matches || []}
                saving={saving}
                onCancel={() => setDuplicateContact(null)}
                onOpenExisting={(match) => {
                    setDuplicateContact(null);
                    setActiveModal(null);
                    navigate(CRM_PATHS.contact(match.id));
                }}
                onCreateAnyway={() => {
                    if (duplicateContact) void handleCreateContact(duplicateContact.input, true);
                }}
            />
        </CrmShell>
    );
}

export const CrmCompanyDetail = CrmCompanyDetailPage;
