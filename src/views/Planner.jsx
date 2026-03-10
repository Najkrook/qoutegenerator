import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import {
    db,
    collection,
    query,
    orderBy,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    updateDoc
} from '../services/firebase';

// Helper: Get ISO week string (e.g., "2023-W42")
const getISOWeekString = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

// Helper: Generate array of previous, current, and next weeks
const generateWeeksList = (currentDate = new Date()) => {
    const weeks = [];
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    
    // 4 weeks ago to 2 weeks ahead
    for (let i = -4; i <= 2; i++) {
        const d = new Date(currentDate.getTime() + i * msPerWeek);
        weeks.push(getISOWeekString(d));
    }
    return weeks;
};

export function Planner({ onBack }) {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [contractor, setContractor] = useState(''); // '' (None), 'Stabil', or 'Tavi'
    const [newPriority, setNewPriority] = useState('Normal'); // 'Låg', 'Normal', 'Hög'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    
    // Week state
    const [selectedWeek, setSelectedWeek] = useState(() => getISOWeekString(new Date()));
    const [availableWeeks] = useState(() => generateWeeksList(new Date()));

    const collectionPath = 'planner_projects';

    const fetchProjects = useCallback(async () => {
        if (!collectionPath || !selectedWeek) return;
        setLoading(true);
        try {
            const ref = collection(db, collectionPath);
            // Fetch only for the selected week (avoiding composite index requirement)
            const q = query(ref, where('week', '==', selectedWeek));
            const snap = await getDocs(q);
            const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Sort by createdAt descending locally
            fetched.sort((a, b) => b.createdAt - a.createdAt);
            setProjects(fetched);
        } catch (err) {
            console.error('Failed to fetch planner projects by week:', err);
        } finally {
            setLoading(false);
        }
    }, [collectionPath, selectedWeek]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title || !collectionPath) return;
        setSaving(true);
        try {
            const ref = collection(db, collectionPath);
            const newProject = { 
                title, 
                done: false, 
                contractor, 
                priority: newPriority,
                createdAt: Date.now(), 
                createdBy: user?.email || '',
                week: selectedWeek 
            };
            const docRef = await addDoc(ref, newProject);
            setProjects((prev) => [{ id: docRef.id, ...newProject }, ...prev]);
            setNewTitle('');
            setContractor('');
            setNewPriority('Normal');
        } catch (err) {
            console.error('Failed to add project:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (project) => {
        if (!collectionPath) return;
        const newDone = !project.done;
        setProjects((prev) =>
            prev.map((p) => (p.id === project.id ? { ...p, done: newDone } : p))
        );
        try {
            await updateDoc(doc(db, collectionPath, project.id), { done: newDone });
        } catch (err) {
            console.error('Failed to toggle project:', err);
            setProjects((prev) =>
                prev.map((p) => (p.id === project.id ? { ...p, done: !newDone } : p))
            );
        }
    };

    const handleSaveDetails = async (projectId, updates) => {
        if (!collectionPath) return;
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
        try {
            await updateDoc(doc(db, collectionPath, projectId), updates);
        } catch (err) {
            console.error('Failed to update project details:', err);
        }
    };

    const handleDelete = (project) => {
        if (!collectionPath) return;
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        const timeoutId = setTimeout(async () => {
            try {
                await deleteDoc(doc(db, collectionPath, project.id));
            } catch (err) {
                console.error('Failed to delete project:', err);
                setProjects((prev) => {
                    if (prev.find(p => p.id === project.id)) return prev;
                    return [...prev, project].sort((a, b) => a.createdAt - b.createdAt);
                });
            }
            setToastMessage((current) => current?.id === project.id ? null : current);
        }, 5000);
        setToastMessage({ id: project.id, title: project.title, project, timeoutId });
    };

    const handleUndoDelete = () => {
        if (!toastMessage) return;
        clearTimeout(toastMessage.timeoutId);
        setProjects((prev) => [...prev, toastMessage.project].sort((a, b) => a.createdAt - b.createdAt));
        setToastMessage(null);
    };

    /* old delete
    const handleDeleteOld = async (project) => {
        if (!collectionPath) return;
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        try {
            await deleteDoc(doc(db, collectionPath, project.id));
        } catch (err) {
            console.error('Failed to delete project:', err);
            setProjects((prev) => [...prev, project].sort((a, b) => b.createdAt - a.createdAt));
        }
    };
    */

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !saving) handleAdd();
    };
    
    // Testing dummy: Generate tasks for 2 weeks ago
    const generateDummyData = async () => {
        setSaving(true);
        const twoWeeksAgoStr = availableWeeks[availableWeeks.length - 2 - 3]; // approx 2 weeks ago index = (7) - 2 - 3 ? Wait. generateWeeksList is -4 to +2. Current is index 4. -2 weeks is index 2.
        const twoWeeksAgoDate = new Date();
        twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
        const dummyWeek = getISOWeekString(twoWeeksAgoDate);
        
        try {
            const ref = collection(db, collectionPath);
            const dummies = [
                { title: 'Dummy Project Alpha', contractor: 'Stabil', createdAt: twoWeeksAgoDate.getTime(), week: dummyWeek },
                { title: 'Dummy Project Beta', contractor: 'Tavi', createdAt: twoWeeksAgoDate.getTime() + 1000 * 60 * 60, week: dummyWeek }
            ];
            for (const d of dummies) {
                await addDoc(ref, { ...d, done: false, createdBy: user?.email || 'admin' });
            }
            alert(`Generated 2 dummies for ${dummyWeek}`);
            if (selectedWeek === dummyWeek) fetchProjects();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const doneCount = projects.filter((p) => p.done).length;
    const totalCount = projects.length;

    return (
        <div className="flex animate-slide-in h-full w-full min-h-[800px] -m-8">
            {/* Sidebar */}
            <div className="w-64 border-r border-panel-border bg-bg p-6 flex flex-col gap-4 overflow-y-auto">
                <button
                    onClick={onBack}
                    className="w-full bg-panel-bg border border-panel-border text-text-primary text-sm font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-panel-border transition-all mb-4"
                >
                    ← Tillbaka
                </button>
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-text-primary font-semibold m-0 text-sm uppercase tracking-widest opacity-60">Veckor</h3>
                </div>
                
                <div className="flex flex-col gap-2">
                    {availableWeeks.map(week => (
                        <button
                            key={week}
                            onClick={() => setSelectedWeek(week)}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                                selectedWeek === week 
                                ? 'bg-primary/20 border-primary text-primary' 
                                : 'bg-panel-bg border-panel-border text-text-secondary hover:border-primary/50'
                            }`}
                        >
                            {week === getISOWeekString(new Date()) ? `Denna vecka (${week})` : week}
                        </button>
                    ))}
                </div>
                
                <div className="mt-8 border-t border-panel-border pt-4">
                    <button
                        onClick={generateDummyData}
                        disabled={saving}
                        className="w-full bg-danger/10 text-danger border border-danger/20 text-xs font-semibold px-4 py-2 rounded cursor-pointer hover:bg-danger/20 transition-all opacity-50"
                    >
                        Generera Test-data (-2 veckor)
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="w-full max-w-[1200px] mx-auto">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-panel-border">
                        <div>
                            <h2 className="text-3xl font-semibold text-text-primary m-0">
                                📋 Projektplanerare <span className="text-primary text-2xl">| {selectedWeek}</span>
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

                    {/* Add project input */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-8">
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nytt projekt..."
                            className="flex-1 bg-panel-bg border border-panel-border text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-text-secondary"
                        />
                        <select
                            value={contractor}
                            onChange={(e) => setContractor(e.target.value)}
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        >
                            <option value="">Ingen Etablerare</option>
                            <option value="Stabil">Stabil</option>
                            <option value="Tavi">Tavi</option>
                        </select>
                        <select
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value)}
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        >
                            <option value="Låg">Låg Prio</option>
                            <option value="Normal">Normal Prio</option>
                            <option value="Hög">Hög Prio</option>
                        </select>
                        <button
                            onClick={handleAdd}
                            disabled={!newTitle.trim() || saving}
                            className="bg-primary border border-primary text-white text-sm font-semibold px-6 py-3 rounded-lg cursor-pointer hover:bg-primary-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {saving ? '...' : '+ Lägg till'}
                        </button>
                    </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                    <div className="w-full h-2 bg-panel-bg rounded-full mb-8 overflow-hidden border border-panel-border">
                        <div
                            className="h-full bg-success rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(doneCount / totalCount) * 100}%` }}
                        />
                    </div>
                )}

                {/* Timeline */}
                {loading ? (
                    <p className="text-text-secondary text-center italic py-12">
                        Laddar projekt...
                    </p>
                ) : projects.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4 opacity-40">📋</div>
                        <p className="text-text-secondary italic m-0">
                            Inga projekt ännu. Lägg till ditt första ovan!
                        </p>
                    </div>
                ) : (() => {
                    // Show oldest first (left-to-right)
                    const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt);
                    
                    // Group by date string (e.g. '2023-10-24')
                    const grouped = sorted.reduce((acc, project) => {
                        const dateObj = new Date(project.createdAt);
                        // Using padded YYYY-MM-DD for stable alphabetical sorting
                        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                        if (!acc[dateStr]) acc[dateStr] = { displayDate: dateObj, projects: [] };
                        acc[dateStr].projects.push(project);
                        return acc;
                    }, {});
                    const groupedEntries = Object.entries(grouped);

                    return (
                        <div className="w-full overflow-x-auto pb-4">
                            <div className="relative" style={{ minWidth: `${Math.max(groupedEntries.length * 200, 400)}px` }}>
                                {/* Horizontal line */}
                                <div
                                    className="absolute left-0 right-0 h-[2px] bg-panel-border"
                                    style={{ top: '16px' }}
                                />

                                {/* Timeline nodes */}
                                <div className="flex">
                                    {groupedEntries.map(([dateKey, group], idx) => {
                                        const dayProjects = group.projects;
                                        const allDone = dayProjects.every(p => p.done);
                                        
                                        return (
                                        <div
                                            key={dateKey}
                                            className="flex-1 flex flex-col items-center"
                                            style={{ minWidth: '180px' }}
                                        >
                                            {/* Node dot (Date status) */}
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
                                                    <span className="text-xs font-bold">{idx + 1}</span>
                                                )}
                                            </div>

                                            {/* Connector stem */}
                                            <div className={`w-[2px] h-6 transition-colors ${allDone ? 'bg-success' : 'bg-panel-border'}`} />

                                            {/* Project Stack */}
                                            <div className="flex flex-col gap-3 w-full items-center">
                                                {dayProjects.map((project) => (
                                                    <div
                                                        key={project.id}
                                                        onClick={() => setSelectedProjectDetails(project)}
                                                        className={`group relative w-full max-w-[170px] flex flex-col items-center bg-panel-bg border rounded-lg px-3 pt-3 pb-6 text-center transition-all cursor-pointer hover:border-primary/60 ${
                                                            project.done
                                                                ? 'border-success/30 opacity-60'
                                                                : 'border-panel-border'
                                                        }`}
                                                    >
                                                        {/* Interactive checkbox */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggle(project); }}
                                                            className={`absolute -top-3 -right-3 w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-sm cursor-pointer transition-all z-10 ${
                                                                project.done 
                                                                    ? 'bg-success border-success text-white' 
                                                                    : 'bg-bg border-panel-border hover:border-primary text-transparent hover:text-primary/40'
                                                            }`}
                                                            title={project.done ? "Markera som ofärdig" : "Markera som klar"}
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
                                                            {project.priority === 'Hög' && !project.done && <span className="w-2 h-2 rounded-full bg-danger shadow-[0_0_4px_theme(colors.danger)]" title="Hög Prio" />}
                                                            {project.priority === 'Låg' && !project.done && <span className="w-2 h-2 rounded-full bg-success opacity-80" title="Låg Prio" />}
                                                            {project.title}
                                                        </p>
                                                        <p className="text-xs text-text-secondary m-0">
                                                            {group.displayDate.toLocaleDateString('sv-SE', {
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </p>
                                                        {project.contractor && (
                                                            <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                                project.contractor === 'Stabil' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                                            }`}>
                                                                {project.contractor}
                                                            </span>
                                                        )}

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(project); }}
                                                            className="absolute bottom-2 right-2 bg-transparent border-none text-text-secondary cursor-pointer text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger"
                                                            title="Ta bort"
                                                        >
                                                            ✕ Ta bort
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>
                    );
                })()}
                </div>
            </div>

            {/* Expanded Project Details Modal */}
            {selectedProjectDetails && (
                <ProjectDetailsModal
                    project={selectedProjectDetails}
                    onClose={() => setSelectedProjectDetails(null)}
                    onSave={(updates) => handleSaveDetails(selectedProjectDetails.id, updates)}
                />
            )}

            {/* Toast for Undo Delete */}
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
                                deleteDoc(doc(db, collectionPath, toastMessage.id));
                                setToastMessage(null);
                            }}
                            className="text-text-secondary hover:text-text-primary bg-transparent border-none cursor-pointer p-1"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProjectDetailsModal({ project, onClose, onSave }) {
    const [address, setAddress] = useState(project.address || '');
    const [phone, setPhone] = useState(project.phone || '');
    const [notes, setNotes] = useState(project.notes || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave({ address, phone, notes });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-bg border border-panel-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 flex justify-between items-center border-b border-panel-border bg-panel-bg">
                    <h3 className="text-lg font-semibold text-text-primary m-0 pr-4 truncate">{project.title}</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary bg-transparent border-none cursor-pointer text-xl leading-none">✕</button>
                </div>
                
                <div className="p-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Adress</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Gatunamn 1 123..."
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Telefon</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="070-123 45 67..."
                            className="bg-panel-bg border border-panel-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Anteckningar / Offertlänk</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
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
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-hover border-none cursor-pointer transition-colors"
                    >
                        {saving ? 'Sparar...' : 'Spara'}
                    </button>
                </div>
            </div>
        </div>
    );
}
