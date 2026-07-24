import React, { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { confirmAction } from '../../services/notificationService';
import { changeCrmDealStageWithQuote } from '../../services/crmQuoteWorkflow';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmActivity, CrmCompany, CrmContact, CrmDeal, CrmDealStage, CrmMember } from '../../types/crm';
import { ActivityFormModal, DealFormModal } from './crmForms';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_DEAL_STAGES,
    CRM_PATHS,
    CRM_STAGE_LABELS,
    ActivityTimeline,
    CrmMetric,
    CrmModal,
    CrmPanel,
    CrmShell,
    ErrorState,
    FormField,
    LoadingState,
    StageBadge,
    TagChips,
    dangerButtonClass,
    formatCrmDate,
    formatCurrencySek,
    inputClass,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface DealDetailData {
    deal: CrmDeal | null;
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
    activities: CrmActivity[];
    members: CrmMember[];
}

function buildQuoteHistoryUrl(deal: CrmDeal): string {
    const search = new URLSearchParams({ openQuote: deal.quoteId || '' });
    if (deal.quoteOwnerUid) search.set('ownerUid', deal.quoteOwnerUid);
    if (deal.quoteVersion) search.set('version', String(deal.quoteVersion));
    return `/quotes?${search.toString()}`;
}

export function CrmDealDetailPage() {
    const { dealId = '' } = useParams<{ dealId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [editOpen, setEditOpen] = useState(false);
    const [activityOpen, setActivityOpen] = useState(false);
    const [lostReasonOpen, setLostReasonOpen] = useState(false);
    const [lostReason, setLostReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [changingStage, setChangingStage] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [mutationError, setMutationError] = useState('');

    const load = useCallback(async (): Promise<DealDetailData> => {
        const [companiesPage, contactsPage, dealsPage, activitiesPage, membersPage] = await Promise.all([
            crmRepository.listCompanies({ pageSize: 500 }),
            crmRepository.listContacts({ pageSize: 500 }),
            crmRepository.listDeals({ includeArchived: true, pageSize: 500 }),
            crmRepository.listActivities({ dealId, pageSize: 500 }),
            crmRepository.listMembers({ pageSize: 200 })
        ]);

        return {
            deal: dealsPage.items.find((deal) => deal.id === dealId) || null,
            companies: companiesPage.items,
            contacts: contactsPage.items,
            deals: dealsPage.items,
            activities: activitiesPage.items,
            members: membersPage.items
        };
    }, [dealId]);

    const { data, loading, error, reload } = useCrmLoader<DealDetailData>(
        load,
        { deal: null, companies: [], contacts: [], deals: [], activities: [], members: [] },
        'Kunde inte ladda affären.'
    );

    const company = useMemo(
        () => data.companies.find((item) => item.id === data.deal?.companyId),
        [data.companies, data.deal?.companyId]
    );
    const contact = useMemo(
        () => data.contacts.find((item) => item.id === data.deal?.primaryContactId),
        [data.contacts, data.deal?.primaryContactId]
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
            reload();
        } catch (mutationFailure) {
            console.error(errorMessage, mutationFailure);
            setMutationError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleStageChange = async (stage: CrmDealStage, reason?: string): Promise<void> => {
        if (!data.deal || stage === data.deal.stage) return;
        if (stage === 'lost' && !reason) {
            setLostReason(data.deal.lostReason || '');
            setLostReasonOpen(true);
            return;
        }

        setChangingStage(true);
        setMutationError('');
        try {
            await changeCrmDealStageWithQuote({
                dealId: data.deal.id,
                stage,
                lostReason: stage === 'lost' ? reason?.trim() : undefined,
                actor: getCrmActor(user)
            });
            setLostReasonOpen(false);
            setLostReason('');
            reload();
        } catch (stageError) {
            console.error('Failed to change CRM deal stage:', stageError);
            setMutationError('Kunde inte ändra affärens fas.');
        } finally {
            setChangingStage(false);
        }
    };

    const handleLostSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!lostReason.trim()) return;
        await handleStageChange('lost', lostReason);
    };

    const handleArchive = async (): Promise<void> => {
        if (!data.deal) return;
        const confirmed = await confirmAction({
            title: 'Arkivera affär?',
            message: `"${data.deal.title}" döljs från pipelinen. Den länkade offerten påverkas inte.`,
            confirmText: 'Arkivera affär',
            tone: 'danger'
        });
        if (!confirmed) return;

        await runMutation(
            () => crmRepository.archiveDeal({
                dealId: data.deal!.id,
                actor: getCrmActor(user)
            }),
            'Kunde inte arkivera affären.',
            () => navigate(CRM_PATHS.pipeline)
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

    const deal = data.deal;

    return (
        <CrmShell
            title={deal?.title || 'Affär'}
            description={company ? `Affär för ${company.name}` : 'Affärsdetaljer och aktivitet.'}
            actions={deal && !deal.archived ? (
                <>
                    <button type="button" className={secondaryButtonClass} onClick={() => setEditOpen(true)}>Redigera</button>
                    <button type="button" className={dangerButtonClass} onClick={() => void handleArchive()}>Arkivera</button>
                </>
            ) : undefined}
        >
            {loading ? <LoadingState label="Laddar affär..." /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error && !deal ? <ErrorState message="Affären kunde inte hittas." /> : null}
            {!loading && !error && deal ? (
                <>
                    {mutationError ? (
                        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-text-primary">
                            {mutationError}
                        </div>
                    ) : null}
                    {deal.archived ? (
                        <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm font-semibold text-warning">
                            Den här affären är arkiverad.
                        </div>
                    ) : null}

                    <section className="grid gap-3 rounded-2xl border border-panel-border bg-panel-bg p-4 shadow-sm sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                        <CrmMetric label="Affärsvärde" value={formatCurrencySek(deal.valueSek)} />
                        <CrmMetric label="Ansvarig" value={deal.ownerName || 'Ej tilldelad'} />
                        <CrmMetric label="Förväntat avslut" value={formatCrmDate(deal.expectedCloseAtMs)} />
                        <CrmMetric
                            label="Nästa aktivitet"
                            value={deal.nextActivityAtMs ? formatCrmDate(deal.nextActivityAtMs) : 'Saknas'}
                            tone={!deal.nextActivityAtMs && (deal.stage === 'lead' || deal.stage === 'quote') ? 'warning' : 'default'}
                        />
                    </section>

                    <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.25fr)]">
                        <CrmPanel title="Affärsuppgifter">
                            <div className="mb-5">
                                <label htmlFor="crm-detail-stage" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">
                                    Pipelinefas
                                </label>
                                <select
                                    id="crm-detail-stage"
                                    className={inputClass}
                                    value={deal.stage}
                                    disabled={changingStage || deal.archived}
                                    onChange={(event) => void handleStageChange(event.target.value as CrmDealStage)}
                                >
                                    {CRM_DEAL_STAGES.filter((stage) => stage !== 'quote' || Boolean(deal.quoteId)).map((stage) => (
                                        <option key={stage} value={stage}>{CRM_STAGE_LABELS[stage]}</option>
                                    ))}
                                </select>
                            </div>
                            <dl className="space-y-4 text-sm">
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Kund</dt>
                                    <dd className="mt-1">
                                        {company ? (
                                            <Link to={CRM_PATHS.company(company.id)} className="font-semibold text-primary hover:underline">
                                                {company.name}
                                            </Link>
                                        ) : <span className="text-text-primary">Ingen kund vald</span>}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Primär kontakt</dt>
                                    <dd className="mt-1">
                                        {contact ? (
                                            <Link to={CRM_PATHS.contact(contact.id)} className="font-semibold text-primary hover:underline">
                                                {contact.name}
                                            </Link>
                                        ) : <span className="text-text-primary">Ingen kontakt vald</span>}
                                    </dd>
                                </div>
                                 <div>
                                     <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Senaste aktivitet</dt>
                                     <dd className="mt-1 text-text-primary">{formatCrmDate(deal.lastActivityAtMs, true)}</dd>
                                 </div>
                                 {(deal.tags || []).length > 0 ? (
                                     <div>
                                         <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Taggar</dt>
                                         <dd><TagChips tags={deal.tags} className="mt-2" /></dd>
                                     </div>
                                 ) : null}
                                {deal.stage === 'lost' ? (
                                    <div>
                                        <dt className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">Förlustorsak</dt>
                                        <dd className="mt-1 whitespace-pre-wrap text-text-secondary">{deal.lostReason || 'Ej angiven'}</dd>
                                    </div>
                                ) : null}
                            </dl>
                        </CrmPanel>

                        <CrmPanel title="Offertkoppling">
                            {deal.quoteId ? (
                                <div className="rounded-xl border border-primary/30 bg-primary/10 p-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">
                                                {deal.quoteNumber ? `Offert ${deal.quoteNumber}` : 'Länkad offert'}
                                            </p>
                                            <p className="mt-1 text-xs text-text-secondary">
                                                {deal.quoteVersion ? `Version ${deal.quoteVersion}` : 'Senaste sparade version'}
                                            </p>
                                        </div>
                                        <Link to={buildQuoteHistoryUrl(deal)} className={primaryButtonClass}>
                                            Öppna offert
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-panel-border bg-black/5 p-6">
                                    <h4 className="text-base font-semibold text-text-primary">Ingen offert är länkad</h4>
                                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                                        Starta en offert från affären. När den sparas kopplas offertlinjen tillbaka hit och affärsvärdet uppdateras.
                                    </p>
                                    {!deal.archived ? (
                                        <Link
                                            to={`/quote/new/product-lines?crmDealId=${encodeURIComponent(deal.id)}&start=1`}
                                            className={`${primaryButtonClass} mt-5`}
                                        >
                                            Skapa eller länka offert
                                        </Link>
                                    ) : null}
                                </div>
                            )}
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                                <span>CRM-status: <strong className="text-text-primary">{CRM_STAGE_LABELS[deal.stage]}</strong></span>
                                {deal.quoteId ? <span>Offert-ID: {deal.quoteId}</span> : null}
                            </div>
                        </CrmPanel>
                    </div>

                    <CrmPanel
                        title="Tidslinje"
                        description="Aktivitet och nästa steg för affären."
                        actions={!deal.archived ? (
                            <button type="button" className={primaryButtonClass} onClick={() => setActivityOpen(true)}>
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

            <DealFormModal
                open={editOpen}
                initial={deal}
                companies={data.companies}
                contacts={data.contacts}
                members={data.members}
                saving={saving}
                error={mutationError}
                onClose={() => setEditOpen(false)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.updateDeal({
                        dealId,
                        actor: getCrmActor(user),
                        patch: input
                    }),
                    'Kunde inte spara affären.',
                    () => setEditOpen(false)
                )}
            />
            <ActivityFormModal
                open={activityOpen}
                companies={data.companies}
                contacts={data.contacts}
                deals={data.deals}
                defaultCompanyId={deal?.companyId || ''}
                defaultContactId={deal?.primaryContactId || ''}
                defaultDealId={dealId}
                saving={saving}
                error={mutationError}
                onClose={() => setActivityOpen(false)}
                onSubmit={(input) => runMutation(
                    () => crmRepository.createActivity({ actor: getCrmActor(user), ...input }),
                    'Kunde inte registrera aktiviteten.',
                    () => setActivityOpen(false)
                )}
            />
            <CrmModal
                open={lostReasonOpen}
                title="Markera affären som förlorad"
                description="Ange orsaken så att utfallet kan följas upp."
                onClose={() => {
                    if (!changingStage) setLostReasonOpen(false);
                }}
            >
                <form onSubmit={(event) => void handleLostSubmit(event)}>
                    <div className="px-5 py-5 sm:px-6">
                        <FormField label="Förlustorsak *" htmlFor="crm-detail-lost-reason">
                            <textarea
                                id="crm-detail-lost-reason"
                                rows={4}
                                className={inputClass}
                                value={lostReason}
                                onChange={(event) => setLostReason(event.target.value)}
                                required
                                autoFocus
                            />
                        </FormField>
                    </div>
                    <div className="flex flex-col-reverse gap-3 border-t border-panel-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <button type="button" className={secondaryButtonClass} onClick={() => setLostReasonOpen(false)} disabled={changingStage}>
                            Avbryt
                        </button>
                        <button type="submit" className={primaryButtonClass} disabled={changingStage || !lostReason.trim()}>
                            {changingStage ? 'Sparar...' : 'Markera som förlorad'}
                        </button>
                    </div>
                </form>
            </CrmModal>
        </CrmShell>
    );
}

export const CrmDealDetail = CrmDealDetailPage;
