import React, { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { changeCrmDealStageWithQuote } from '../../services/crmQuoteWorkflow';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmCompany, CrmContact, CrmDeal, CrmDealStage, CrmMember } from '../../types/crm';
import { DealFormModal, type DealFormValues } from './crmForms';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_DEAL_STAGES,
    CRM_PATHS,
    CRM_STAGE_LABELS,
    CrmModal,
    CrmPanel,
    CrmShell,
    EmptyState,
    ErrorState,
    FormField,
    LoadingState,
    StageBadge,
    TagChips,
    formatCrmDate,
    formatCurrencySek,
    inputClass,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface PipelineData {
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
    members: CrmMember[];
}

function DealCard({
    deal,
    company,
    changing,
    onChangeStage
}: {
    deal: CrmDeal;
    company?: CrmCompany;
    changing: boolean;
    onChangeStage: (deal: CrmDeal, stage: CrmDealStage) => void;
}) {
    const missingFollowUp = (deal.stage === 'lead' || deal.stage === 'quote') && !deal.nextActivityAtMs;
    const overdueFollowUp = Boolean(deal.nextActivityAtMs && deal.nextActivityAtMs < Date.now());

    return (
        <article className="rounded-xl border border-panel-border bg-panel-bg p-4 shadow-sm transition-colors hover:border-primary/40">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Link
                        to={CRM_PATHS.deal(deal.id)}
                        className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary hover:text-primary"
                    >
                        {deal.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-text-secondary">
                        {company?.name || 'Ingen kund vald'}
                    </p>
                </div>
                <StageBadge stage={deal.stage} />
            </div>

             <p className="mt-4 text-xl font-semibold tracking-tight text-text-primary">
                 {formatCurrencySek(deal.valueSek)}
             </p>
             <TagChips tags={deal.tags} className="mt-3" />

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                    <dt className="text-text-secondary">Ansvarig</dt>
                    <dd className="mt-1 truncate font-semibold text-text-primary">{deal.ownerName || 'Ej tilldelad'}</dd>
                </div>
                <div>
                    <dt className="text-text-secondary">Förväntat avslut</dt>
                    <dd className="mt-1 truncate font-semibold text-text-primary">{formatCrmDate(deal.expectedCloseAtMs)}</dd>
                </div>
            </dl>

            {missingFollowUp ? (
                <div className="mt-3 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                    Saknar nästa aktivitet
                </div>
            ) : overdueFollowUp ? (
                <div className="mt-3 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                    Uppföljningen är försenad
                </div>
            ) : (
                <div className="mt-3 rounded-md border border-panel-border bg-black/5 px-3 py-2 text-xs text-text-secondary">
                    Nästa aktivitet: {formatCrmDate(deal.nextActivityAtMs, true)}
                </div>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-panel-border pt-3">
                <label htmlFor={`deal-stage-${deal.id}`} className="sr-only">Ändra fas för {deal.title}</label>
                <select
                    id={`deal-stage-${deal.id}`}
                    aria-label={`Ändra fas för ${deal.title}`}
                    value={deal.stage}
                    disabled={changing}
                    onChange={(event) => onChangeStage(deal, event.target.value as CrmDealStage)}
                    className={`${inputClass} min-h-9 py-1.5 text-xs`}
                >
                    {CRM_DEAL_STAGES.filter((stage) => stage !== 'quote' || Boolean(deal.quoteId)).map((stage) => (
                        <option key={stage} value={stage}>{CRM_STAGE_LABELS[stage]}</option>
                    ))}
                </select>
                <Link
                    to={CRM_PATHS.deal(deal.id)}
                    className={`${secondaryButtonClass} min-h-9 shrink-0 px-3 py-1.5 text-xs`}
                >
                    Öppna
                </Link>
            </div>
        </article>
    );
}

export function CrmPipelinePage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [mutationError, setMutationError] = useState('');
    const [changingDealId, setChangingDealId] = useState<string | null>(null);
    const [lostDeal, setLostDeal] = useState<CrmDeal | null>(null);
    const [lostReason, setLostReason] = useState('');

    const load = useCallback(async (): Promise<PipelineData> => {
        const [companiesPage, contactsPage, dealsPage, membersPage] = await Promise.all([
            crmRepository.listCompanies({ pageSize: 500 }),
            crmRepository.listContacts({ pageSize: 500 }),
            crmRepository.listDeals({ pageSize: 500 }),
            crmRepository.listMembers({ pageSize: 200 })
        ]);

        return {
            companies: companiesPage.items,
            contacts: contactsPage.items,
            deals: dealsPage.items,
            members: membersPage.items
        };
    }, []);

    const { data, loading, error, reload } = useCrmLoader<PipelineData>(
        load,
        { companies: [], contacts: [], deals: [], members: [] },
        'Kunde inte ladda CRM-pipelinen.'
    );

    const companyById = useMemo(
        () => new Map(data.companies.map((company) => [company.id, company])),
        [data.companies]
    );

    const visibleDeals = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('sv-SE');
        return data.deals.filter((deal) => {
            if (deal.archived) return false;
            if (ownerId && deal.ownerId !== ownerId) return false;
            if (!normalizedSearch) return true;
            const companyName = companyById.get(deal.companyId || '')?.name || '';
            return `${deal.title} ${companyName} ${deal.ownerName || ''} ${(deal.tags || []).join(' ')}`
                .toLocaleLowerCase('sv-SE')
                .includes(normalizedSearch);
        });
    }, [companyById, data.deals, ownerId, search]);

    const dealsByStage = useMemo(
        () => new Map(CRM_DEAL_STAGES.map((stage) => [
            stage,
            visibleDeals.filter((deal) => deal.stage === stage)
        ])),
        [visibleDeals]
    );

    const handleCreate = async (input: DealFormValues): Promise<void> => {
        setSaving(true);
        setMutationError('');
        try {
            await crmRepository.createDeal({
                actor: getCrmActor(user),
                ...input
            });
            setCreateOpen(false);
            reload();
        } catch (createError) {
            console.error('Failed to create CRM deal:', createError);
            setMutationError('Kunde inte skapa affären. Kontrollera uppgifterna och försök igen.');
        } finally {
            setSaving(false);
        }
    };

    const changeStage = async (deal: CrmDeal, stage: CrmDealStage, reason?: string): Promise<void> => {
        if (stage === deal.stage) return;
        if (stage === 'lost' && !reason) {
            setLostDeal(deal);
            setLostReason(deal.lostReason || '');
            return;
        }

        setChangingDealId(deal.id);
        setMutationError('');
        try {
            await changeCrmDealStageWithQuote({
                dealId: deal.id,
                stage,
                lostReason: stage === 'lost' ? reason?.trim() : undefined,
                actor: getCrmActor(user)
            });
            setLostDeal(null);
            setLostReason('');
            reload();
        } catch (stageError) {
            console.error('Failed to change CRM deal stage:', stageError);
            setMutationError('Kunde inte ändra affärens fas.');
        } finally {
            setChangingDealId(null);
        }
    };

    const handleLostSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!lostDeal || !lostReason.trim()) return;
        await changeStage(lostDeal, 'lost', lostReason);
    };

    return (
        <CrmShell
            title="Pipeline"
            description="Följ affärerna från första lead till offert och avslut."
            actions={<button type="button" className={primaryButtonClass} onClick={() => setCreateOpen(true)}>Skapa affär</button>}
        >
            <CrmPanel>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px_auto]">
                    <div>
                        <label htmlFor="crm-pipeline-search" className="sr-only">Sök i pipeline</label>
                        <input
                            id="crm-pipeline-search"
                            type="search"
                            className={inputClass}
                            placeholder="Sök affär, kund eller ansvarig..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="crm-pipeline-owner" className="sr-only">Filtrera på ansvarig</label>
                        <select id="crm-pipeline-owner" className={inputClass} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                            <option value="">Alla ansvariga</option>
                            {data.members.filter((member) => !member.archived).map((member) => (
                                <option key={member.id} value={member.id}>{member.name || member.email}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => {
                            setSearch('');
                            setOwnerId('');
                        }}
                    >
                        Rensa filter
                    </button>
                </div>
                {mutationError ? (
                    <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-text-primary">
                        {mutationError}
                    </div>
                ) : null}
            </CrmPanel>

            {loading ? <LoadingState label="Laddar pipeline..." /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error ? (
                <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Affärspipeline">
                    {CRM_DEAL_STAGES.map((stage) => {
                        const stageDeals = dealsByStage.get(stage) || [];
                        const total = stageDeals.reduce((sum, deal) => sum + (Number(deal.valueSek) || 0), 0);
                        return (
                            <div key={stage} className="min-w-0 rounded-2xl border border-panel-border bg-black/10 p-3">
                                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                                    <div>
                                        <h3 className="text-sm font-bold text-text-primary">{CRM_STAGE_LABELS[stage]}</h3>
                                        <p className="mt-1 text-xs text-text-secondary">{stageDeals.length} affärer</p>
                                    </div>
                                    <p className="text-xs font-semibold text-text-secondary">{formatCurrencySek(total)}</p>
                                </div>
                                <div className="space-y-3">
                                    {stageDeals.length === 0 ? (
                                        <EmptyState
                                            title="Tom fas"
                                            description={`Inga affärer finns i ${CRM_STAGE_LABELS[stage].toLocaleLowerCase('sv-SE')} just nu.`}
                                        />
                                    ) : stageDeals.map((deal) => (
                                        <DealCard
                                            key={deal.id}
                                            deal={deal}
                                            company={companyById.get(deal.companyId || '')}
                                            changing={changingDealId === deal.id}
                                            onChangeStage={(selectedDeal, nextStage) => void changeStage(selectedDeal, nextStage)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </section>
            ) : null}

            <DealFormModal
                open={createOpen}
                saving={saving}
                error={mutationError}
                companies={data.companies}
                contacts={data.contacts}
                members={data.members}
                onClose={() => {
                    if (!saving) {
                        setCreateOpen(false);
                        setMutationError('');
                    }
                }}
                onSubmit={handleCreate}
            />

            <CrmModal
                open={Boolean(lostDeal)}
                title="Markera affären som förlorad"
                description={lostDeal ? `Ange varför "${lostDeal.title}" inte gick vidare.` : undefined}
                onClose={() => {
                    if (!changingDealId) {
                        setLostDeal(null);
                        setLostReason('');
                    }
                }}
            >
                <form onSubmit={(event) => void handleLostSubmit(event)}>
                    <div className="px-5 py-5 sm:px-6">
                        <FormField label="Förlustorsak *" htmlFor="crm-lost-reason">
                            <textarea
                                id="crm-lost-reason"
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
                        <button type="button" className={secondaryButtonClass} onClick={() => setLostDeal(null)} disabled={Boolean(changingDealId)}>
                            Avbryt
                        </button>
                        <button type="submit" className={primaryButtonClass} disabled={Boolean(changingDealId) || !lostReason.trim()}>
                            {changingDealId ? 'Sparar...' : 'Markera som förlorad'}
                        </button>
                    </div>
                </form>
            </CrmModal>
        </CrmShell>
    );
}

export const CrmPipeline = CrmPipelinePage;
