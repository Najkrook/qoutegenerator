import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useAuth } from '../store/AuthContext';
import {
    db,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc
} from '../services/firebase';
import { normalizeAllowedValue, readSnapshotData } from '../utils/runtime';
import type {
    PlannerContractor,
    PlannerPriority,
    PlannerProject,
    PlannerProjectDetailsPatch,
    PlannerProps,
    SnapshotSource
} from '../types/contracts';

interface PlannerProjectDocument extends Omit<PlannerProject, 'id'> {}

interface PlannerToastMessage {
    id: string;
    title: string;
    project: PlannerProject;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface GroupedPlannerDay {
    displayDate: Date;
    projects: PlannerProject[];
}

interface PlannerWeekSummary {
    week: string;
    totalCount: number;
    doneCount: number;
    completionRatio: number;
}

interface PlannerAssigneeOption {
    email: string;
    label: string;
}

interface ProjectDetailsModalProps {
    project: PlannerProject;
    onClose: () => void;
    onSave: (updates: PlannerProjectDetailsPatch) => Promise<void>;
}

const PLANNER_COLLECTION_PATH = 'planner_projects';
const PRIORITY_OPTIONS: PlannerPriority[] = ['Låg', 'Normal', 'Hög'];
const CONTRACTOR_OPTIONS: PlannerContractor[] = ['', 'Stabil', 'Tavi'];
export const PLANNER_ASSIGNEE_OPTIONS: PlannerAssigneeOption[] = [
    { email: 'johan@brixx.se', label: 'Johan' },
    { email: 'info@brixx.se', label: 'Info' },
    { email: 'erik@brixx.se', label: 'Erik' }
];
const WEEK_LIST_SCROLLBAR_STYLE: CSSProperties = {
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(59, 130, 246, 0.45) transparent'
};

function getPlannerAssigneeOption(email: string): PlannerAssigneeOption | undefined {
    return PLANNER_ASSIGNEE_OPTIONS.find((option) => option.email === email);
}

export function normalizePlannerAssignees(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    const normalized = value
        .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
        .filter((entry) => Boolean(getPlannerAssigneeOption(entry)));

    return Array.from(new Set(normalized));
}

export function addPlannerAssignee(currentAssignees: string[] = [], email: string): string[] {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!getPlannerAssigneeOption(normalizedEmail)) return [...currentAssignees];
    if (currentAssignees.includes(normalizedEmail)) return [...currentAssignees];
    return [...currentAssignees, normalizedEmail];
}

export function removePlannerAssignee(currentAssignees: string[] = [], email: string): string[] {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    return currentAssignees.filter((entry) => entry !== normalizedEmail);
}

function getPlannerAssigneeLabel(email: string): string {
    return getPlannerAssigneeOption(email)?.label || email;
}

function getISOWeekString(date = new Date()): string {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${utcDate.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

function compareISOWeekStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

function generateCurrentAndFutureWeeks(currentDate = new Date(), weeksAhead = 8): string[] {
    const weeks: string[] = [];
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    for (let i = 0; i <= weeksAhead; i += 1) {
        const date = new Date(currentDate.getTime() + i * msPerWeek);
        weeks.push(getISOWeekString(date));
    }

    return weeks;
}

export function getWeekCompletionTone(
    summary: Pick<PlannerWeekSummary, 'totalCount' | 'completionRatio'>
): 'success' | 'warning' | 'danger' | null {
    if ((summary.totalCount || 0) <= 0) return null;
    if (summary.completionRatio >= 1) return 'success';
    if (summary.completionRatio > 0.3) return 'warning';
    return 'danger';
}

export function buildPlannerWeekSummaries(
    projects: PlannerProject[] = [],
    currentDate = new Date(),
    futureWeeksAhead = 8
): PlannerWeekSummary[] {
    const currentWeek = getISOWeekString(currentDate);
    const futureWeeks = generateCurrentAndFutureWeeks(currentDate, futureWeeksAhead);
    const weekStats = projects.reduce<Record<string, { totalCount: number; doneCount: number }>>((acc, project) => {
        const week = String(project.week || '').trim();
        if (!week) return acc;

        if (!acc[week]) {
            acc[week] = { totalCount: 0, doneCount: 0 };
        }

        acc[week].totalCount += 1;
        if (project.done) {
            acc[week].doneCount += 1;
        }

        return acc;
    }, {});

    const visibleWeeks = new Set<string>(futureWeeks);
    Object.keys(weekStats).forEach((week) => {
        visibleWeeks.add(week);
    });

    return Array.from(visibleWeeks)
        .map((week) => {
            const stats = weekStats[week] || { totalCount: 0, doneCount: 0 };
            const completionRatio = stats.totalCount > 0 ? stats.doneCount / stats.totalCount : 0;

            return {
                week,
                totalCount: stats.totalCount,
                doneCount: stats.doneCount,
                completionRatio
            };
        })
        .filter((summary) => (
            summary.totalCount > 0 || compareISOWeekStrings(summary.week, currentWeek) >= 0
        ))
        .sort((left, right) => compareISOWeekStrings(left.week, right.week));
}

function getWeekBadgeClassName(summary: PlannerWeekSummary): string {
    const tone = getWeekCompletionTone(summary);

    if (tone === 'success') {
        return 'border-success/40 bg-success/10 text-success';
    }

    if (tone === 'warning') {
        return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
    }

    return 'border-danger/40 bg-danger/10 text-danger';
}

function createEmptyPlannerProjectDocument(
    title: string,
    contractor: PlannerContractor,
    priority: PlannerPriority,
    createdBy: string,
    week: string
): PlannerProjectDocument {
    return {
        title,
        done: false,
        contractor,
        priority,
        createdAt: Date.now(),
        createdBy,
        week,
        address: '',
        phone: '',
        notes: '',
        assignees: []
    };
}

function priorityDot(project: PlannerProject): string | null {
    if (project.done) return null;
    if (project.priority === 'Hög') return 'bg-danger shadow-[0_0_4px_theme(colors.danger)]';
    if (project.priority === 'Låg') return 'bg-success opacity-80';
    return null;
}

function normalizePlannerContractor(value: string): PlannerContractor {
    return normalizeAllowedValue(value, CONTRACTOR_OPTIONS, '');
}

function normalizePlannerPriority(value: string): PlannerPriority {
    return normalizeAllowedValue(value, PRIORITY_OPTIONS, 'Normal');
}

export function normalizePlannerProject(snapshot: SnapshotSource & { id?: unknown }): PlannerProject {
    const raw = readSnapshotData<PlannerProjectDocument>(snapshot);

    return {
        id: String(snapshot.id || ''),
        title: typeof raw.title === 'string' ? raw.title : '',
        done: raw.done === true,
        contractor: normalizePlannerContractor(String(raw.contractor || '')),
        priority: normalizePlannerPriority(String(raw.priority || 'Normal')),
        createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
        createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
        week: typeof raw.week === 'string' ? raw.week : '',
        address: typeof raw.address === 'string' ? raw.address : '',
        phone: typeof raw.phone === 'string' ? raw.phone : '',
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        assignees: normalizePlannerAssignees(raw.assignees)
    };
}

export function Planner({ onBack }: PlannerProps) {
    const { user } = useAuth();
    const [allProjects, setAllProjects] = useState<PlannerProject[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [contractor, setContractor] = useState<PlannerContractor>('');
    const [newPriority, setNewPriority] = useState<PlannerPriority>('Normal');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedProjectDetails, setSelectedProjectDetails] = useState<PlannerProject | null>(null);
    const [toastMessage, setToastMessage] = useState<PlannerToastMessage | null>(null);
    const currentWeek = getISOWeekString(new Date());
    const [selectedWeek, setSelectedWeek] = useState(() => currentWeek);
    const selectedWeekButtonRef = useRef<HTMLButtonElement | null>(null);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            const ref = collection(db, PLANNER_COLLECTION_PATH);
            const snap = await getDocs(ref);
            const fetched = snap.docs
                .map((snapshot) => normalizePlannerProject(snapshot))
                .sort((a, b) => b.createdAt - a.createdAt);
            setAllProjects(fetched);
        } catch (error) {
            console.error('Failed to fetch planner projects:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchProjects();
    }, [fetchProjects]);

    const weekSummaries = useMemo(
        () => buildPlannerWeekSummaries(allProjects, new Date()),
        [allProjects]
    );

    const projects = useMemo(
        () => allProjects
            .filter((project) => project.week === selectedWeek)
            .sort((a, b) => b.createdAt - a.createdAt),
        [allProjects, selectedWeek]
    );

    useEffect(() => {
        if (weekSummaries.some((summary) => summary.week === selectedWeek)) {
            return;
        }

        setSelectedWeek(currentWeek);
    }, [currentWeek, selectedWeek, weekSummaries]);

    useEffect(() => {
        selectedWeekButtonRef.current?.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
        });
    }, [selectedWeek]);

    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title) return;

        setSaving(true);
        try {
            const ref = collection(db, PLANNER_COLLECTION_PATH);
            const newProject = createEmptyPlannerProjectDocument(
                title,
                contractor,
                newPriority,
                user?.email || '',
                selectedWeek
            );
            const docRef = await addDoc(ref, newProject);
            setAllProjects((prev) => [{ id: docRef.id, ...newProject }, ...prev]);
            setNewTitle('');
            setContractor('');
            setNewPriority('Normal');
        } catch (error) {
            console.error('Failed to add project:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (project: PlannerProject) => {
        const newDone = !project.done;
        setAllProjects((prev) =>
            prev.map((entry) => (entry.id === project.id ? { ...entry, done: newDone } : entry))
        );

        try {
            await updateDoc(doc(db, PLANNER_COLLECTION_PATH, project.id), { done: newDone });
        } catch (error) {
            console.error('Failed to toggle project:', error);
            setAllProjects((prev) =>
                prev.map((entry) => (entry.id === project.id ? { ...entry, done: !newDone } : entry))
            );
        }
    };

    const handleSaveDetails = async (projectId: string, updates: PlannerProjectDetailsPatch) => {
        setAllProjects((prev) => prev.map((entry) => (entry.id === projectId ? { ...entry, ...updates } : entry)));
        try {
            await updateDoc(doc(db, PLANNER_COLLECTION_PATH, projectId), updates);
        } catch (error) {
            console.error('Failed to update project details:', error);
        }
    };

    const handleDelete = (project: PlannerProject) => {
        setAllProjects((prev) => prev.filter((entry) => entry.id !== project.id));
        const timeoutId = setTimeout(async () => {
            try {
                await deleteDoc(doc(db, PLANNER_COLLECTION_PATH, project.id));
            } catch (error) {
                console.error('Failed to delete project:', error);
                setAllProjects((prev) => {
                    if (prev.some((entry) => entry.id === project.id)) return prev;
                    return [...prev, project].sort((a, b) => a.createdAt - b.createdAt);
                });
            }
            setToastMessage((current) => (current?.id === project.id ? null : current));
        }, 5000);

        setToastMessage({ id: project.id, title: project.title, project, timeoutId });
    };

    const handleUndoDelete = () => {
        if (!toastMessage) return;
        clearTimeout(toastMessage.timeoutId);
        setAllProjects((prev) => [...prev, toastMessage.project].sort((a, b) => a.createdAt - b.createdAt));
        setToastMessage(null);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !saving) {
            void handleAdd();
        }
    };

    const doneCount = projects.filter((project) => project.done).length;
    const totalCount = projects.length;

    const groupedEntries = (() => {
        const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt);
        const grouped = sorted.reduce<Record<string, GroupedPlannerDay>>((acc, project) => {
            const dateObj = new Date(project.createdAt);
            const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            if (!acc[dateStr]) {
                acc[dateStr] = { displayDate: dateObj, projects: [] };
            }
            acc[dateStr].projects.push(project);
            return acc;
        }, {});
        return Object.entries(grouped);
    })();

    return (
        <div className="flex flex-col md:flex-row animate-slide-in h-full w-full min-h-[800px] -m-8">
            <div className="w-full md:w-64 border-b md:border-r md:border-b-0 border-panel-border bg-bg p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
                <button
                    onClick={onBack}
                    className="w-full bg-panel-bg border border-panel-border text-text-primary text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-panel-border transition-all mb-4"
                >
                    Tillbaka
                </button>
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-text-primary font-semibold m-0 text-sm uppercase tracking-widest opacity-60">Veckor</h3>
                </div>

                <div className="relative rounded-2xl border border-panel-border bg-panel-bg/30 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="pointer-events-none absolute inset-x-2 top-2 h-6 rounded-t-xl bg-gradient-to-b from-bg via-bg/80 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-2 bottom-2 h-8 rounded-b-xl bg-gradient-to-t from-bg via-bg/80 to-transparent" />

                    <div
                        className="flex flex-col gap-2 overflow-y-auto pr-1 md:max-h-[calc(100vh-236px)]"
                        style={WEEK_LIST_SCROLLBAR_STYLE}
                    >
                        {weekSummaries.map((summary) => (
                            <button
                                key={summary.week}
                                ref={selectedWeek === summary.week ? selectedWeekButtonRef : null}
                                onClick={() => setSelectedWeek(summary.week)}
                                className={`w-full flex items-center justify-between gap-3 text-left px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer border backdrop-blur-sm ${
                                    selectedWeek === summary.week
                                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_10px_24px_rgba(37,99,235,0.12)]'
                                        : 'bg-panel-bg/80 border-panel-border text-text-secondary hover:border-primary/50 hover:bg-panel-bg'
                                }`}
                            >
                                <span className="min-w-0 flex-1 leading-snug">
                                    {summary.week === currentWeek ? `Denna vecka (${summary.week})` : summary.week}
                                </span>
                                {summary.totalCount > 0 && (
                                    <span className={`shrink-0 min-w-7 h-7 px-2 rounded-full border inline-flex items-center justify-center text-[11px] font-bold ${getWeekBadgeClassName(summary)}`}>
                                        {summary.totalCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 p-8 overflow-y-auto">
                <div className="w-full max-w-[1200px] mx-auto">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-panel-border">
                        <div>
                            <h2 className="text-3xl font-semibold text-text-primary m-0">
                                Projektplanerare <span className="text-primary text-2xl">| {selectedWeek}</span>
                            </h2>
                            {totalCount > 0 ? (
                                <p className="text-text-secondary text-sm mt-1 m-0">
                                    {doneCount} av {totalCount} klara denna vecka
                                </p>
                            ) : (
                                <p className="text-text-secondary text-sm mt-1 m-0">
                                    Inget inplanerat denna vecka
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mb-8">
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(event) => setNewTitle(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nytt projekt..."
                            className="flex-1 bg-panel-bg border border-panel-border text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-text-secondary"
                        />
                        <select
                            value={contractor}
                            onChange={(event) => setContractor(normalizePlannerContractor(event.target.value))}
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        >
                            {CONTRACTOR_OPTIONS.map((option) => (
                                <option key={option || 'none'} value={option}>
                                    {option || 'Ingen etablerare'}
                                </option>
                            ))}
                        </select>
                        <select
                            value={newPriority}
                            onChange={(event) => setNewPriority(normalizePlannerPriority(event.target.value))}
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        >
                            {PRIORITY_OPTIONS.map((priority) => (
                                <option key={priority} value={priority}>
                                    {priority} Prio
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => void handleAdd()}
                            disabled={!newTitle.trim() || saving}
                            className="bg-primary border border-primary text-white text-sm font-semibold px-6 py-3 rounded-lg cursor-pointer hover:bg-primary-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {saving ? '...' : '+ Lägg till'}
                        </button>
                    </div>

                    {totalCount > 0 && (
                        <div className="w-full h-2 bg-panel-bg rounded-full mb-8 overflow-hidden border border-panel-border">
                            <div
                                className="h-full bg-success rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${(doneCount / totalCount) * 100}%` }}
                            />
                        </div>
                    )}

                    {loading ? (
                        <p className="text-text-secondary text-center italic py-12">
                            Laddar projekt...
                        </p>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-text-secondary italic m-0">
                                Inga projekt ännu. Lägg till ditt första ovan!
                            </p>
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto pb-4">
                            <div className="relative" style={{ minWidth: `${Math.max(groupedEntries.length * 200, 400)}px` }}>
                                <div
                                    className="absolute left-0 right-0 h-[2px] bg-panel-border"
                                    style={{ top: '16px' }}
                                />

                                <div className="flex">
                                    {groupedEntries.map(([dateKey, group], index) => {
                                        const allDone = group.projects.every((project) => project.done);

                                        return (
                                            <div
                                                key={dateKey}
                                                className="flex-1 flex flex-col items-center"
                                                style={{ minWidth: '180px' }}
                                            >
                                                <div
                                                    className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                                        allDone
                                                            ? 'bg-success border-success text-white scale-100'
                                                            : 'bg-bg border-primary text-primary'
                                                    }`}
                                                >
                                                    {allDone ? (
                                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                            <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    ) : (
                                                        <span className="text-xs font-bold">{index + 1}</span>
                                                    )}
                                                </div>

                                                <div className={`w-[2px] h-6 transition-colors ${allDone ? 'bg-success' : 'bg-panel-border'}`} />

                                                <div className="flex flex-col gap-3 w-full items-center">
                                                    {group.projects.map((project) => {
                                                        const priorityClass = priorityDot(project);
                                                        return (
                                                            <div
                                                                key={project.id}
                                                                onClick={() => setSelectedProjectDetails(project)}
                                                                className={`group relative w-full max-w-[170px] flex flex-col items-center bg-panel-bg border rounded-lg px-3 pt-3 pb-8 text-center transition-all cursor-pointer hover:border-primary/60 ${
                                                                    project.done
                                                                        ? 'border-success/30 opacity-60'
                                                                        : 'border-panel-border'
                                                                }`}
                                                            >
                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        void handleToggle(project);
                                                                    }}
                                                                    className={`absolute -top-3 -right-3 w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-sm cursor-pointer transition-all z-10 ${
                                                                        project.done
                                                                            ? 'bg-success border-success text-white'
                                                                            : 'bg-bg border-panel-border hover:border-primary text-transparent hover:text-primary/40'
                                                                    }`}
                                                                    title={project.done ? 'Markera som ofärdig' : 'Markera som klar'}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="ml-0.5 mt-0.5">
                                                                        <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                </button>

                                                                <p
                                                                    className={`text-sm font-medium m-0 mb-1 mt-1 transition-all flex items-center justify-center gap-1.5 ${
                                                                        project.done
                                                                            ? 'line-through text-text-secondary'
                                                                            : 'text-text-primary'
                                                                    }`}
                                                                >
                                                                    {priorityClass && <span className={`w-2 h-2 rounded-full ${priorityClass}`} title={`${project.priority} Prio`} />}
                                                                    {project.title}
                                                                </p>
                                                                <p className="text-xs text-text-secondary m-0">
                                                                    {group.displayDate.toLocaleDateString('sv-SE', {
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    })}
                                                                </p>
                                                                {project.assignees && project.assignees.length > 0 && (
                                                                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                                                                        {project.assignees.map((assignee) => (
                                                                            <span
                                                                                key={assignee}
                                                                                className="max-w-full truncate rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary"
                                                                                title={assignee}
                                                                            >
                                                                                {getPlannerAssigneeLabel(assignee)}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {project.contractor && (
                                                                    <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                                        project.contractor === 'Stabil' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                                                    }`}>
                                                                        {project.contractor}
                                                                    </span>
                                                                )}

                                                                <button
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        handleDelete(project);
                                                                    }}
                                                                    className="absolute bottom-2 right-2 bg-transparent border-none text-text-secondary cursor-pointer text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger"
                                                                    title="Ta bort"
                                                                >
                                                                    X Ta bort
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedProjectDetails && (
                <ProjectDetailsModal
                    project={selectedProjectDetails}
                    onClose={() => setSelectedProjectDetails(null)}
                    onSave={(updates) => handleSaveDetails(selectedProjectDetails.id, updates)}
                />
            )}

            {toastMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-bg border border-panel-border shadow-2xl px-5 py-3 rounded-xl flex items-center gap-4">
                    <p className="text-sm font-medium text-text-primary m-0 truncate max-w-[200px]">
                        "{toastMessage.title}" raderades
                    </p>
                    <div className="flex items-center gap-2 border-l border-panel-border pl-4">
                        <button
                            onClick={handleUndoDelete}
                            className="text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded transition-colors cursor-pointer border-none"
                        >
                            Ångra
                        </button>
                        <button
                            onClick={() => {
                                clearTimeout(toastMessage.timeoutId);
                                void deleteDoc(doc(db, PLANNER_COLLECTION_PATH, toastMessage.id));
                                setToastMessage(null);
                            }}
                            className="text-text-secondary hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ProjectDetailsModal({ project, onClose, onSave }: ProjectDetailsModalProps) {
    const [address, setAddress] = useState(project.address || '');
    const [phone, setPhone] = useState(project.phone || '');
    const [notes, setNotes] = useState(project.notes || '');
    const [assignees, setAssignees] = useState<string[]>(() => normalizePlannerAssignees(project.assignees));
    const [saving, setSaving] = useState(false);
    const [isAssigneeDragOver, setIsAssigneeDragOver] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave({ address, phone, notes, assignees });
        setSaving(false);
        onClose();
    };

    const handleModalClick = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const handleAssigneeDragStart = (event: DragEvent<HTMLButtonElement>, email: string) => {
        event.dataTransfer.setData('text/plain', email);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleAssigneeDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (!isAssigneeDragOver) {
            setIsAssigneeDragOver(true);
        }
    };

    const handleAssigneeDragLeave = (event: DragEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsAssigneeDragOver(false);
        }
    };

    const handleAssigneeDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsAssigneeDragOver(false);
        const droppedEmail = event.dataTransfer.getData('text/plain');
        setAssignees((current) => addPlannerAssignee(current, droppedEmail));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-bg border border-panel-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" onClick={handleModalClick}>
                <div className="px-6 py-4 flex justify-between items-center border-b border-panel-border bg-panel-bg">
                    <h3 className="text-lg font-semibold text-text-primary m-0 pr-4 truncate">{project.title}</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary bg-transparent border-none cursor-pointer text-xl leading-none">X</button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{'Tillg\u00E4ngliga anv\u00E4ndare'}</label>
                        <div className="flex flex-wrap gap-2" data-testid="planner-assignee-pool">
                            {PLANNER_ASSIGNEE_OPTIONS.map((option) => {
                                const isAssigned = assignees.includes(option.email);

                                return (
                                    <button
                                        key={option.email}
                                        type="button"
                                        draggable
                                        onDragStart={(event) => handleAssigneeDragStart(event, option.email)}
                                        className={`rounded-full border px-3 py-2 text-left transition-colors ${isAssigned ? 'border-primary/40 bg-primary/10 text-primary' : 'border-panel-border bg-panel-bg text-text-primary hover:border-primary/50'}`}
                                        title={option.email}
                                        data-testid={`planner-assignee-option-${option.email}`}
                                    >
                                        <span className="block text-xs font-semibold">{option.label}</span>
                                        <span className="block text-[11px] text-text-secondary">{option.email}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{'Tilldelade anv\u00E4ndare'}</label>
                        <div
                            onDragOver={handleAssigneeDragOver}
                            onDragLeave={handleAssigneeDragLeave}
                            onDrop={handleAssigneeDrop}
                            className={`min-h-24 rounded-xl border border-dashed p-3 transition-all ${isAssigneeDragOver ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]' : 'border-panel-border bg-panel-bg/60'}`}
                            data-testid="planner-assignee-dropzone"
                        >
                            {assignees.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {assignees.map((assignee) => (
                                        <span
                                            key={assignee}
                                            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                                            title={assignee}
                                        >
                                            <span>{getPlannerAssigneeLabel(assignee)}</span>
                                            <button
                                                type="button"
                                                onClick={() => setAssignees((current) => removePlannerAssignee(current, assignee))}
                                                className="bg-transparent border-none p-0 text-primary/70 hover:text-primary cursor-pointer"
                                                aria-label={`Ta bort ${assignee}`}
                                                data-testid={`planner-assignee-remove-${assignee}`}
                                            >
                                                X
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="m-0 text-sm text-text-secondary italic">
                                    {'Dra en anv\u00E4ndare hit f\u00F6r att tilldela tasket.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Adress</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder="Gatunamn 1 123..."
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Telefon</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            placeholder="070-123 45 67..."
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Anteckningar / Offertlänk</label>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Mer information..."
                            rows={4}
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                        />
                        {project.createdBy && (
                            <p className="text-[10px] text-text-secondary m-0 mt-2 italic">
                                Skapad av: {project.createdBy}
                            </p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-panel-border bg-panel-bg/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-panel-border transition-colors border-none bg-transparent cursor-pointer"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-hover border-none cursor-pointer transition-colors"
                        data-testid="planner-assignee-save"
                    >
                        {saving ? 'Sparar...' : 'Spara'}
                    </button>
                </div>
            </div>
        </div>
    );
}
