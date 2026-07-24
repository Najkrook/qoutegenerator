import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { confirmAction } from '../../services/notificationService';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmActivity, CrmCompany, CrmContact, CrmDeal, CrmMember } from '../../types/crm';
import { ActivityFormModal, ContactFormModal, DealFormModal } from './crmForms';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_PATHS,
    ActivityTimeline,
    CrmPanel,
    CrmShell,
    EmptyState,
    ErrorState,
    LoadingState,
    StageBadge,
    TagChips,
    dangerButtonClass,
    formatCrmDate,
    formatCurrencySek,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface ContactDetailData {
    contact: CrmContact | null;
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
    activities: CrmActivity[];
    members: CrmMember[];
}

type ContactModal = 'edit' | 'deal' | 'activity' | null;

export function CrmContactDetailPage() {
    const { contactId = '' } = useParams<{ contactId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeModal, setActiveModal] = useState<ContactModal>(null);
    const [saving, setSaving] = useState(false);
    const [mutationError, setMutationError] = useState('');
    const [completingId, setCompletingId] = useState<string | null>(null);

    const load = useCallback(async (): Promise<ContactDetailData> => {
        const [contact, companiesPage, contactsPage, dealsPage, activitiesPage, membersPage] = await Promise.all([
            crmRepository.getContact(contactId),
            crmRepository.listCompanies({ pageSize: 500 }),
            crmRepository.listContacts({ includeArchived: true, pageSize: 500 }),
            crmRepository.listDeals({ pageSize: 500 }),
            crmRepository.listActivities({ contactId, pageSize: 500 }),
            crmRepository.listMembers({ pageSize: 200 })
        ]);

        return {
            contact,
            companies: companiesPage.items,
            contacts: contactsPage.items,
            deals: dealsPage.items.filter((deal) => deal.primaryContactId === contactId),
            activities: activitiesPage.items,
            members: membersPage.items
        };
    }, [contactId]);

    const { data, loading, error, reload } = useCrmLoader<ContactDetailData>(
        load,
        { contact: null, companies: [], contacts: [], deals: [], activities: [], members: [] },
        'Kunde inte ladda kontakten.'
    );

    const company = useMemo(
        () => data.companies.find((item) => item.id === data.contact?.companyId),
        [data.companies, data.contact?.companyId]
    );
    const activities = useMemo(
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
        if (!data.contact) return;
        const confirmed = await confirmAction({
            title: 'Arkivera kontakt?',
            message: `${data.contact.name} döljs från aktiva kontaktlistor. Kopplade affärer och aktiviteter finns kvar.`,
            confirmText: 'Arkivera kontakt',
            tone: 'danger'
        });
        if (!confirmed) return;

        await runMutation(
            () => crmRepository.archiveContact({
                contactId: data.contact!.id,
                actor: getCrmActor(user)
            }),
            'Kunde inte arkivera kontakten.',
            () => navigate(company ? CRM_PATHS.company(company.id) : CRM_PATHS.customers)
        );
    };

    const handleComplete = async (activity: CrmActivity): Promise<void> => {
        setCompletingId(activity.id);
        setMutationError('');
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

    const contact = data.contact;

    return (
        <CrmShell
            title={contact?.name || 'Kontakt'}
            description={contact?.role || (company ? `Kontakt hos ${company.name}` : 'Fristående kontakt')}
            actions={contact && !contact.archived ? (
                <>
                    <button type="button" className={secondaryButtonClass} onClick={() => setActiveModal('edit')}>Redigera</button>
                    <button type="button" className={dangerButtonClass} onClick={() => void handleArchive()}>Arkivera</button>
                </>
            ) : undefined}
        >
            {loading ? <LoadingState label="Laddar kontakt..." /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error && !contact ? <ErrorState message="Kontakten kunde inte hittas." /> : null}
            {!loading && !error && contact ? (
                <>
                    {mutationError ? (
                        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-text-primary">
                            {mutationError}
                        </div>
                    ) : null}
                    {contact.archived ? (
                        <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm font-semibold text-warning">
                            Den här kontakten är arkiverad.
                        </div>
                    ) : null}

                    <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
                        <CrmPanel title="Kontaktuppgifter">
                            <dl className="space-y-4 text-sm">
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Företag</dt>
                                    <dd className="mt-1">
                                        {company ? (
                                            <Link to={CRM_PATHS.company(company.id)} className="font-semibold text-primary hover:underline">
                                                {company.name}
                                            </Link>
                                        ) : <span className="text-text-primary">Privatkund / inget företag</span>}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">E-post</dt>
                                    <dd className="mt-1 break-all text-text-primary">
                                        {contact.email ? <a href={`mailto:${contact.email}`} className="hover:text-primary">{contact.email}</a> : 'Ej angivet'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Telefon</dt>
                                    <dd className="mt-1 text-text-primary">
                                        {contact.phone ? <a href={`tel:${contact.phone}`} className="hover:text-primary">{contact.phone}</a> : 'Ej angivet'}
                                    </dd>
                                </div>
                                {(contact.tags || []).length > 0 ? (
                                    <div>
                                        <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Taggar</dt>
                                        <dd><TagChips tags={contact.tags} className="mt-2" /></dd>
                                    </div>
                                ) : null}
                                {contact.notes ? (
                                    <div>
                                        <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Anteckningar</dt>
                                        <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-text-secondary">{contact.notes}</dd>
                                    </div>
                                ) : null}
                            </dl>
                        </CrmPanel>

                        <CrmPanel
                            title="Affärer"
                            description="Affärer där kontakten är primär kontakt."
                            actions={!contact.archived ? (
                                <button type="button" className={primaryButtonClass} onClick={() => setActiveModal('deal')}>
                                    Skapa affär
                                </button>
                            ) : undefined}
                        >
                            {data.deals.filter((deal) => !deal.archived).length === 0 ? (
                                <EmptyState
                                    title="Inga kopplade affärer"
                                    description="Skapa en affär och använd kontakten som primär kontakt."
                                />
                            ) : (
                                <div className="space-y-3">
                                    {data.deals.filter((deal) => !deal.archived).map((deal) => (
                                        <Link
                                            key={deal.id}
                                            to={CRM_PATHS.deal(deal.id)}
                                            className="flex flex-col gap-3 rounded-xl border border-panel-border bg-black/5 p-4 transition-colors hover:border-primary/40 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                             <div>
                                                 <p className="font-semibold text-text-primary">{deal.title}</p>
                                                 <p className="mt-1 text-xs text-text-secondary">
                                                     Förväntat avslut: {formatCrmDate(deal.expectedCloseAtMs)}
                                                 </p>
                                                 <TagChips tags={deal.tags} className="mt-2" />
                                             </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-text-primary">{formatCurrencySek(deal.valueSek)}</span>
                                                <StageBadge stage={deal.stage} />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CrmPanel>
                    </div>

                    <CrmPanel
                        title="Tidslinje"
                        description="Samtal, mejl, möten, anteckningar och uppgifter för kontakten."
                        actions={!contact.archived ? (
                            <button type="button" className={primaryButtonClass} onClick={() => setActiveModal('activity')}>
                                Registrera aktivitet
                            </button>
                        ) : undefined}
                    >
                        <ActivityTimeline
                            activities={activities}
                            onComplete={(activity) => void handleComplete(activity)}
                            completingId={completingId}
                            onRescheduled={() => reload()}
                        />
                    </CrmPanel>
                </>
            ) : null}

            <ContactFormModal
                open={activeModal === 'edit'}
                initial={contact}
                companies={data.companies}
                saving={saving}
                error={mutationError}
                onClose={() => setActiveModal(null)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.updateContact({
                        contactId,
                        actor: getCrmActor(user),
                        patch: input
                    }),
                    'Kunde inte spara kontaktuppgifterna.'
                )}
            />
            <DealFormModal
                open={activeModal === 'deal'}
                companies={data.companies}
                contacts={data.contacts}
                members={data.members}
                defaultCompanyId={contact?.companyId || ''}
                defaultContactId={contactId}
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
                defaultCompanyId={contact?.companyId || ''}
                defaultContactId={contactId}
                saving={saving}
                error={mutationError}
                onClose={() => setActiveModal(null)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.createActivity({ actor: getCrmActor(user), ...input }),
                    'Kunde inte registrera aktiviteten.'
                )}
            />
        </CrmShell>
    );
}

export const CrmContactDetail = CrmContactDetailPage;
