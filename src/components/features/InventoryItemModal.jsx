import React, { useState } from 'react';

export function InventoryItemModal({ item, editIndex, onSave, onClose }) {
    const [formData, setFormData] = useState({
        ID: item?.ID || '',
        TYP: item?.TYP || 'JUMB',
        STORLEK: item?.STORLEK || '',
        TEXTIL: item?.TEXTIL || '',
        BESKRIVNING: item?.BESKRIVNING || '',
        Kommentar: item?.Kommentar || ''
    });

    const isEdit = editIndex >= 0;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.ID.trim() || !formData.BESKRIVNING.trim()) {
            alert('Du måste minst ange ID och beskrivning.');
            return;
        }
        onSave({
            ...formData,
            ID: formData.ID.trim(),
            TYP: formData.TYP.trim().toUpperCase(),
            STORLEK: formData.STORLEK.trim(),
            TEXTIL: formData.TEXTIL.trim(),
            BESKRIVNING: formData.BESKRIVNING.trim(),
            Kommentar: formData.Kommentar.trim()
        }, editIndex);
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={onClose}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
            <div
                className="bg-panel-bg border border-panel-border rounded-xl p-8 w-full max-w-lg animate-slide-in"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-semibold text-text-primary mb-6">
                    {isEdit ? 'Redigera Artikel' : 'Ny BaHaMa Artikel'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">ID</label>
                            <input
                                autoFocus
                                type="text"
                                value={formData.ID}
                                onChange={(e) => setFormData({ ...formData, ID: e.target.value })}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. 3.5.1"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Typ</label>
                            <input
                                type="text"
                                value={formData.TYP}
                                onChange={(e) => setFormData({ ...formData, TYP: e.target.value })}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. JB, XL, OUT"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Storlek</label>
                            <input
                                type="text"
                                value={formData.STORLEK}
                                onChange={(e) => setFormData({ ...formData, STORLEK: e.target.value })}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. 4x4"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Textil / Färg</label>
                            <input
                                type="text"
                                value={formData.TEXTIL}
                                onChange={(e) => setFormData({ ...formData, TEXTIL: e.target.value })}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. 7016, OAK"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Beskrivning</label>
                        <textarea
                            rows={3}
                            value={formData.BESKRIVNING}
                            onChange={(e) => setFormData({ ...formData, BESKRIVNING: e.target.value })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary resize-y"
                            placeholder="Full beskrivning av artikeln"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Kommentar</label>
                        <input
                            type="text"
                            value={formData.Kommentar}
                            onChange={(e) => setFormData({ ...formData, Kommentar: e.target.value })}
                            className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                            placeholder="Intern anteckning"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-panel-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 border border-panel-border bg-transparent text-text-primary rounded-lg cursor-pointer hover:bg-white/5"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold hover:brightness-110"
                        >
                            {isEdit ? 'Uppdatera' : 'Lägg till'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
