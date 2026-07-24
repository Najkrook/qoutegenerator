import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmActivity, CrmActivityType, CrmCompany, CrmContact, CrmDeal } from '../../types/crm';
import { ActivityFormModal, type ActivityFormValues } from './crmForms';
import { getCrmActor, useCrmLoader } from './crmHooks';
import {
    CRM_PATHS,
    CrmMetric,
    CrmPanel,
    CrmShell,
    EmptyState,
    ErrorState,
    LoadingState,
    TaskRescheduleControl,
    formatCrmDate,
    getActivityTypeLabel,
    inputClass,
    isOpenTask,
    isOverdueTask,
    isSameLocalDay,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

interface ActivitiesData {
    activities: CrmActivity[];
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
}

const TYPE_OPTIONS: Array<{ value: '' | CrmActivityType; label: string }> = [
    { value: '', label: 'Alla aktivitetstyper' },
    { value: 'task', label: 'Uppgifter' },
    { value: 'call', label: 'Samtal' },
    { value: 'meeting', label: 'Möten' },
    { value: 'email', label: 'Mejl' },
    { value: 'note', label: 'Anteckningar' }
];

export function CrmActivitiesPage() {
    const { user } = useAuth();
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [mutationError, setMutationError] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'' | CrmActivityType>('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('open');

    const load = useCallback(async (): Promise<ActivitiesData> => {
        const [activitiesPage, companiesPage, contactsPage, dealsPage] = await Promise.all([
            crmRepository.listActivities({ pageSize: 500 }),
            crmRepository.listCompanies({ pageSize: 500 }),
            crmRepository.listContacts({ pageSize: 500 }),
            crmRepository.listDeals({ pageSize: 500 })
        ]);
        return {
            activities: activitiesPage.items,
            companies: companiesPage.items,
            contacts: contactsPage.items,
            deals: dealsPage.items
        };
    }, []);

    const { data, loading, error, reload } = useCrmLoader<ActivitiesData>(
        load,
        { activities: [], companies: [], contacts: [], deals: [] },
        'Kunde inte ladda CRM-aktiviteterna.'
    );

    const companyById = useMemo(
        () => new Map(data.companies.map((company) => [company.id, company])),
        [data.companies]
    );
    const contactById = useMemo(
        () => new Map(data.contacts.map((contact) => [contact.id, contact])),
        [data.contacts]
    );
    const dealById = useMemo(
        () => new Map(data.deals.map((deal) => [deal.id, deal])),
        [data.deals]
    );

    const visibleActivities = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('sv-SE');
        return data.activities
            .filter((activity) => {
                if (activity.archived) return false;
                if (typeFilter && activity.type !== typeFilter) return false;
                if (statusFilter === 'open' && activity.status === 'completed') return false;
                if (statusFilter === 'completed' && activity.status !== 'completed') return false;
                if (!normalizedSearch) return true;

                const companyName = companyById.get(activity.companyId || '')?.name || '';
                const companyTags = companyById.get(activity.companyId || '')?.tags || [];
                const contact = contactById.get(activity.contactId || '');
                const deal = dealById.get(activity.dealId || '');
                return `${activity.subject} ${activity.notes} ${companyName} ${companyTags.join(' ')} ${contact?.name || ''} ${(contact?.tags || []).join(' ')} ${deal?.title || ''} ${(deal?.tags || []).join(' ')}`
                    .toLocaleLowerCase('sv-SE')
                    .includes(normalizedSearch);
            })
            .sort((left, right) => {
                const leftOverdue = isOverdueTask(left) ? 1 : 0;
                const rightOverdue = isOverdueTask(right) ? 1 : 0;
                if (leftOverdue !== rightOverdue) return rightOverdue - leftOverdue;
                const leftTime = left.dueAtMs || left.occurredAtMs || left.createdAtMs;
                const rightTime = right.dueAtMs || right.occurredAtMs || right.createdAtMs;
                return statusFilter === 'completed' ? rightTime - leftTime : leftTime - rightTime;
            });
    }, [companyById, contactById, data.activities, dealById, search, statusFilter, typeFilter]);

    const overdueCount = data.activities.filter((activity) => isOverdueTask(activity)).length;
    const todayCount = data.activities.filter((activity) => isOpenTask(activity) && isSameLocalDay(activity.dueAtMs, Date.now())).length;
    const openTaskCount = data.activities.filter(isOpenTask).length;

    const handleCreate = async (input: ActivityFormValues): Promise<void> => {
        setSaving(true);
        setMutationError('');
        try {
            await crmRepository.createActivity({ actor: getCrmActor(user), ...input });
            setCreateOpen(false);
            reload();
        } catch (createError) {
            console.error('Failed to create CRM activity:', createError);
            setMutationError('Kunde inte registrera aktiviteten.');
        } finally {
            setSaving(false);
        }
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

    return (
        <CrmShell
            title="Aktiviteter"
            description="Planera nästa uppföljning och dokumentera kunddialogen."
            actions={<button type="button" className={primaryButtonClass} onClick={() => setCreateOpen(true)}>Registrera aktivitet</button>}
        >
            <section className="grid gap-3 rounded-2xl border border-panel-border bg-panel-bg p-4 shadow-sm sm:grid-cols-3 sm:p-6">
                <CrmMetric label="Försenade" value={overdueCount} tone={overdueCount > 0 ? 'danger' : 'success'} />
                <CrmMetric label="Idag" value={todayCount} tone={todayCount > 0 ? 'warning' : 'default'} />
                <CrmMetric label="Öppna uppgifter" value={openTaskCount} />
            </section>

            <CrmPanel>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_190px_auto]">
                    <div>
                        <label htmlFor="crm-activity-search" className="sr-only">Sök aktiviteter</label>
                        <input
                            id="crm-activity-search"
                            type="search"
                            className={inputClass}
                            placeholder="Sök aktivitet, kund eller affär..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="crm-activity-type-filter" className="sr-only">Aktivitetstyp</label>
                        <select
                            id="crm-activity-type-filter"
                            className={inputClass}
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value as '' | CrmActivityType)}
                        >
                            {TYPE_OPTIONS.map((option) => (
                                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="crm-activity-status-filter" className="sr-only">Aktivitetsstatus</label>
                        <select
                            id="crm-activity-status-filter"
                            className={inputClass}
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'open' | 'completed')}
                        >
                            <option value="open">Öppna</option>
                            <option value="completed">Klara</option>
                            <option value="all">Alla statusar</option>
                        </select>
                    </div>
                    <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => {
                            setSearch('');
                            setTypeFilter('');
                            setStatusFilter('open');
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

            {loading ? <LoadingState label="Laddar aktiviteter..." /> : null}
            {!loading && error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error ? (
                <CrmPanel title="Aktivitetslista" description={`${visibleActivities.length} aktiviteter visas`}>
                    {visibleActivities.length === 0 ? (
                        <EmptyState
                            title="Inga aktiviteter matchar filtret"
                            description="Justera filtren eller registrera en ny aktivitet."
                            action={(
                                <button type="button" className={primaryButtonClass} onClick={() => setCreateOpen(true)}>
                                    Registrera aktivitet
                                </button>
                            )}
                        />
                    ) : (
                        <ul className="divide-y divide-panel-border">
                            {visibleActivities.map((activity) => {
                                const company = companyById.get(activity.companyId || '');
                                const contact = contactById.get(activity.contactId || '');
                                const deal = dealById.get(activity.dealId || '');
                                const overdue = isOverdueTask(activity);
                                const openTask = isOpenTask(activity);
                                return (
                                    <li key={activity.id} className="py-4 first:pt-0 last:pb-0">
                                        <article className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
                                                        {getActivityTypeLabel(activity.type)}
                                                    </span>
                                                    {overdue ? (
                                                        <span className="rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                                                            Försenad
                                                        </span>
                                                    ) : null}
                                                    {activity.status === 'completed' ? (
                                                        <span className="rounded-full border border-success/35 bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                                                            Klar
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <h4 className="mt-1 text-sm font-semibold text-text-primary">
                                                    {activity.subject || getActivityTypeLabel(activity.type)}
                                                </h4>
                                                {activity.notes ? (
                                                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                                                        {activity.notes}
                                                    </p>
                                                ) : null}
                                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                                                    {company ? <Link to={CRM_PATHS.company(company.id)} className="hover:text-primary">{company.name}</Link> : null}
                                                    {contact ? <Link to={CRM_PATHS.contact(contact.id)} className="hover:text-primary">{contact.name}</Link> : null}
                                                    {deal ? <Link to={CRM_PATHS.deal(deal.id)} className="hover:text-primary">{deal.title}</Link> : null}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                                                <time className={`text-xs ${overdue ? 'font-semibold text-danger' : 'text-text-secondary'}`}>
                                                    {formatCrmDate(activity.dueAtMs || activity.occurredAtMs || activity.createdAtMs, true)}
                                                </time>
                                                 {openTask ? (
                                                     <div className="flex flex-wrap justify-end gap-2">
                                                         <button
                                                             type="button"
                                                             className={`${secondaryButtonClass} min-h-9 px-3 py-1.5 text-xs`}
                                                             disabled={completingId === activity.id}
                                                             onClick={() => void handleComplete(activity)}
                                                         >
                                                             {completingId === activity.id ? 'Markerar...' : 'Markera som klar'}
                                                         </button>
                                                         <TaskRescheduleControl activity={activity} onRescheduled={() => reload()} />
                                                     </div>
                                                 ) : null}
                                            </div>
                                        </article>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CrmPanel>
            ) : null}

            <ActivityFormModal
                open={createOpen}
                companies={data.companies}
                contacts={data.contacts}
                deals={data.deals}
                saving={saving}
                error={mutationError}
                onClose={() => {
                    if (!saving) {
                        setCreateOpen(false);
                        setMutationError('');
                    }
                }}
                onSubmit={handleCreate}
            />
        </CrmShell>
    );
}

export const CrmActivities = CrmActivitiesPage;
