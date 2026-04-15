import React, { useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { BahamaInventoryItem, InventoryItemModalProps } from '../../types/contracts';

function buildInitialFormData(item: BahamaInventoryItem | null): BahamaInventoryItem {
    return {
        ID: item?.ID || '',
        TYP: item?.TYP || 'JUMB',
        STORLEK: item?.STORLEK || '',
        TEXTIL: item?.TEXTIL || '',
        BESKRIVNING: item?.BESKRIVNING || '',
        Kommentar: item?.Kommentar || ''
    };
}

export function InventoryItemModal({ item, editIndex, onSave, onClose }: InventoryItemModalProps) {
    const [formData, setFormData] = useState<BahamaInventoryItem>(() => buildInitialFormData(item));

    const isEdit = editIndex >= 0;

    const updateField = (field: keyof BahamaInventoryItem) => (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const nextValue = event.target.value;
        setFormData((prev) => ({ ...prev, [field]: nextValue }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!String(formData.ID || '').trim() || !String(formData.BESKRIVNING || '').trim()) {
            alert('Du måste minst ange ID och beskrivning.');
            return;
        }

        onSave({
            ...formData,
            ID: String(formData.ID || '').trim(),
            TYP: String(formData.TYP || '').trim().toUpperCase(),
            STORLEK: String(formData.STORLEK || '').trim(),
            TEXTIL: String(formData.TEXTIL || '').trim(),
            BESKRIVNING: String(formData.BESKRIVNING || '').trim(),
            Kommentar: String(formData.Kommentar || '').trim()
        }, editIndex);
    };

    const handleOverlayClick = () => {
        onClose();
    };

    const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
        >
            <div
                className="bg-panel-bg border border-panel-border rounded-xl p-8 w-full max-w-lg animate-slide-in"
                onClick={stopPropagation}
            >
                <h3 className="text-xl font-semibold text-text-primary mb-6">
                    {isEdit ? 'Redigera artikel' : 'Ny BaHaMa-artikel'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">ID</label>
                            <input
                                autoFocus
                                type="text"
                                value={String(formData.ID || '')}
                                onChange={updateField('ID')}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. 3.5.1"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Typ</label>
                            <input
                                type="text"
                                value={String(formData.TYP || '')}
                                onChange={updateField('TYP')}
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
                                value={String(formData.STORLEK || '')}
                                onChange={updateField('STORLEK')}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. 4x4"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary uppercase">Textil / Färg</label>
                            <input
                                type="text"
                                value={String(formData.TEXTIL || '')}
                                onChange={updateField('TEXTIL')}
                                className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                                placeholder="t.ex. 7016, OAK"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Beskrivning</label>
                        <textarea
                            rows={3}
                            value={String(formData.BESKRIVNING || '')}
                            onChange={updateField('BESKRIVNING')}
                            className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary resize-y"
                            placeholder="Full beskrivning av artikeln"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Kommentar</label>
                        <input
                            type="text"
                            value={String(formData.Kommentar || '')}
                            onChange={updateField('Kommentar')}
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
