import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmActivity, CrmCompany, CrmDeal } from '../../types/crm';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_PATHS,
    ActivityTimeline,
    CrmMetric,
    CrmPanel,
    CrmShell,
    EmptyState,
    ErrorState,
    LoadingState,
    StageBadge,
    formatCrmDate,
    formatCurrencySek,
    isOpenDeal,
    isOpenTask,
    isOverdueTask,
    isSameLocalDay,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface DashboardData {
    companies: CrmCompany[];
    deals: CrmDeal[];
    activities: CrmActivity[];
}

export interface CrmDashboardSummary {
    openPipelineValue: number;
    wonCount: number;
    lostCount: number;
    overdueTasks: CrmActivity[];
    todayTasks: CrmActivity[];
    dealsWithoutFollowUp: CrmDeal[];
}

export function buildCrmDashboardSummary(
    deals: CrmDeal[],
    activities: CrmActivity[],
    now = Date.now()
): CrmDashboardSummary {
    const openDeals = deals.filter(isOpenDeal);
    const openTasks = activities.filter(isOpenTask);

    return {
        openPipelineValue: openDeals.reduce((sum, deal) => sum + (Number(deal.valueSek) || 0), 0),
        wonCount: deals.filter((deal) => !deal.archived && deal.stage === 'won').length,
        lostCount: deals.filter((deal) => !deal.archived && deal.stage === 'lost').length,
        overdueTasks: openTasks
            .filter((activity) => isOverdueTask(activity, now))
            .sort((left, right) => left.dueAtMs - right.dueAtMs),
        todayTasks: openTasks
            .filter((activity) => isSameLocalDay(activity.dueAtMs, now))
            .sort((left, right) => left.dueAtMs - right.dueAtMs),
        dealsWithoutFollowUp: openDeals
            .filter((deal) => !deal.nextActivityAtMs)
            .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
    };
}

export function CrmDashboardPage() {
    const { user } = useAuth();
    const [completingId, setCompletingId] = useState<string | null>(null);

    const load = useCallback(async (): Promise<DashboardData> => {
        const [companiesPage, dealsPage, activitiesPage] = await Promise.all([
            crmRepository.listCompanies({ pageSize: 250 }),
            crmRepository.listDeals({ pageSize: 250 }),
            crmRepository.listActivities({ pageSize: 250 })
        ]);

        return {
            companies: companiesPage.items,
            deals: dealsPage.items,
            activities: activitiesPage.items
        };
    }, []);

    const { data, loading, error, reload } = useCrmLoader<DashboardData>(
        load,
        { companies: [], deals: [], activities: [] },
        'Kunde inte ladda CRM-översikten.'
    );

    const summary = useMemo(
        () => buildCrmDashboardSummary(data.deals, data.activities),
        [data.activities, data.deals]
    );
    const companyById = useMemo(
        () => new Map(data.companies.map((company) => [company.id, company])),
        [data.companies]
    );
    const recentOutcomes = useMemo(
        () => data.deals
            .filter((deal) => !deal.archived && (deal.stage === 'won' || deal.stage === 'lost'))
            .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
            .slice(0, 6),
        [data.deals]
    );

    const handleComplete = async (activity: CrmActivity): Promise<void> => {
        if (completingId) return;
        setCompletingId(activity.id);
        try {
            await crmRepository.completeActivity({
                activityId: activity.id,
                actor: getCrmActor(user)
            });
            reload();
        } catch (completeError) {
            console.error('Failed to complete CRM activity:', completeError);
        } finally {
            setCompletingId(null);
        }
    };

    return (
        <CrmShell
            title="Sälj-CRM"
            description="Pipeline, kunder och nästa uppföljningar samlade på en plats."
            actions={(
                <>
                    <Link to={CRM_PATHS.activities} className={secondaryButtonClass}>Ny aktivitet</Link>
                    <Link to={CRM_PATHS.pipeline} className={primaryButtonClass}>Öppna pipeline</Link>
                </>
            )}
        >
            {loading ? <LoadingState /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error ? (
                <>
                    <section className="grid gap-3 rounded-2xl border border-panel-border bg-panel-bg p-4 shadow-sm sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                        <CrmMetric
                            label="Öppen pipeline"
                            value={formatCurrencySek(summary.openPipelineValue)}
                            supportingText={`${data.deals.filter(isOpenDeal).length} aktiva affärer`}
                        />
                        <CrmMetric
                            label="Försenade uppgifter"
                            value={summary.overdueTasks.length}
                            supportingText="Behöver hanteras nu"
                            tone={summary.overdueTasks.length > 0 ? 'danger' : 'success'}
                        />
                        <CrmMetric
                            label="Saknar nästa steg"
                            value={summary.dealsWithoutFollowUp.length}
                            supportingText="Öppna affärer utan uppgift"
                            tone={summary.dealsWithoutFollowUp.length > 0 ? 'warning' : 'success'}
                        />
                        <CrmMetric
                            label="Utfall"
                            value={`${summary.wonCount} / ${summary.lostCount}`}
                            supportingText="Vunna / förlorade affärer"
                        />
                    </section>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                        <CrmPanel
                            title="Prioriterade uppföljningar"
                            description="Försenade uppgifter visas först, följt av dagens aktiviteter."
                            actions={<Link to={CRM_PATHS.activities} className={secondaryButtonClass}>Visa alla</Link>}
                        >
                            {summary.overdueTasks.length === 0 && summary.todayTasks.length === 0 ? (
                                <EmptyState
                                    title="Inga uppföljningar kräver åtgärd"
                                    description="Det finns inga försenade uppgifter eller uppgifter för idag."
                                />
                            ) : (
                                <ActivityTimeline
                                    activities={[...summary.overdueTasks, ...summary.todayTasks]
                                        .filter((activity, index, all) => all.findIndex((item) => item.id === activity.id) === index)
                                        .slice(0, 8)}
                                     onComplete={(activity) => void handleComplete(activity)}
                                     completingId={completingId}
                                     onRescheduled={() => reload()}
                                 />
                            )}
                        </CrmPanel>

                        <CrmPanel
                            title="Affärer utan nästa aktivitet"
                            description="Öppna affärer som saknar planerad uppföljning."
                        >
                            {summary.dealsWithoutFollowUp.length === 0 ? (
                                <EmptyState
                                    title="Alla affärer har ett nästa steg"
                                    description="Bra jobbat – varje öppen affär har en planerad uppföljning."
                                />
                            ) : (
                                <ul className="divide-y divide-panel-border">
                                    {summary.dealsWithoutFollowUp.slice(0, 8).map((deal) => (
                                        <li key={deal.id} className="py-3 first:pt-0 last:pb-0">
                                            <Link
                                                to={CRM_PATHS.deal(deal.id)}
                                                className="group flex items-start justify-between gap-3 rounded-md py-1"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-text-primary group-hover:text-primary">
                                                        {deal.title}
                                                    </p>
                                                    <p className="mt-1 truncate text-xs text-text-secondary">
                                                        {companyById.get(deal.companyId || '')?.name || 'Ingen kund vald'}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <StageBadge stage={deal.stage} />
                                                    <p className="mt-1 text-xs font-semibold text-text-secondary">
                                                        {formatCurrencySek(deal.valueSek)}
                                                    </p>
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CrmPanel>
                    </div>

                    <CrmPanel title="Senaste vunna och förlorade affärer">
                        {recentOutcomes.length === 0 ? (
                            <EmptyState
                                title="Inga avslut registrerade"
                                description="Vunna och förlorade affärer visas här när pipelinen börjar användas."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-panel-border text-xs uppercase tracking-[0.06em] text-text-secondary">
                                            <th className="px-3 py-3 font-bold">Affär</th>
                                            <th className="px-3 py-3 font-bold">Kund</th>
                                            <th className="px-3 py-3 font-bold">Utfall</th>
                                            <th className="px-3 py-3 text-right font-bold">Värde</th>
                                            <th className="px-3 py-3 text-right font-bold">Uppdaterad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentOutcomes.map((deal) => (
                                            <tr key={deal.id} className="border-b border-panel-border/70 last:border-b-0 hover:bg-white/5">
                                                <td className="px-3 py-3">
                                                    <Link to={CRM_PATHS.deal(deal.id)} className="font-semibold text-text-primary hover:text-primary">
                                                        {deal.title}
                                                    </Link>
                                                </td>
                                                <td className="px-3 py-3 text-text-secondary">
                                                    {companyById.get(deal.companyId || '')?.name || '–'}
                                                </td>
                                                <td className="px-3 py-3"><StageBadge stage={deal.stage} /></td>
                                                <td className="px-3 py-3 text-right font-semibold text-text-primary">
                                                    {formatCurrencySek(deal.valueSek)}
                                                </td>
                                                <td className="px-3 py-3 text-right text-text-secondary">
                                                    {formatCrmDate(deal.updatedAtMs)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CrmPanel>
                </>
            ) : null}
        </CrmShell>
    );
}

export const CrmDashboard = CrmDashboardPage;
