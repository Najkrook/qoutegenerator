import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
    type KeyboardEvent
} from 'react';
import { notifyError } from '../../services/notificationService';
import type { BahamaInventoryStatus, BahamaInventoryV2Item, InventoryItemModalProps } from '../../types/contracts';
import {
    BAHAMA_FOOT_OPTIONS,
    BAHAMA_FRAME_OPTIONS,
    BAHAMA_HEAT_OPTIONS,
    BAHAMA_LIGHTING_OPTIONS,
    BAHAMA_LOCATION_OPTION_GROUPS,
    BAHAMA_TEXTILE_OPTION_GROUPS,
    BAHAMA_TYPE_OPTIONS,
    formatBahamaLocationOptionLabel,
    getBahamaGroupedSizeOptions,
    type InventoryOptionGroup
} from './inventoryOptions';

const STATUS_OPTIONS: Array<{ value: BahamaInventoryStatus; label: string }> = [
    { value: 'available', label: 'Tillgänglig' },
    { value: 'reserved', label: 'Reserverad' },
    { value: 'needs-review', label: 'Behöver kontroll' },
    { value: 'used', label: 'Begagnad' },
    { value: 'sold', label: 'Såld' }
];

const FIELD_CLASS = 'w-full rounded-md border border-white/10 bg-[#12191f] px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#e8e1d4]';
const LABEL_CLASS = 'text-[11px] font-semibold uppercase text-slate-500';

function nowIso(): string {
    return new Date().toISOString();
}

function createBlankItem(): BahamaInventoryV2Item {
    const timestamp = nowIso();
    return {
        id: '',
        type: '',
        size: '',
        status: 'available',
        location: '',
        properties: {
            stativ: '',
            textil: '',
            fot: '',
            belysning: '',
            varme: ''
        },
        comment: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedByUid: '',
        updatedByEmail: ''
    };
}

function trimItem(item: BahamaInventoryV2Item): BahamaInventoryV2Item {
    return {
        ...item,
        id: item.id.trim(),
        type: item.type.trim(),
        size: item.size.trim(),
        location: item.location.trim(),
        properties: {
            stativ: item.properties.stativ.trim(),
            textil: item.properties.textil.trim(),
            fot: item.properties.fot.trim(),
            belysning: item.properties.belysning.trim(),
            varme: item.properties.varme.trim()
        },
        comment: item.comment.trim()
    };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>{label}</span>
            {children}
        </div>
    );
}

interface PresetTextInputProps {
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
    placeholder: string;
    options: string[];
    optionGroups?: InventoryOptionGroup[];
    formatOptionLabel?: (value: string) => string;
    autoFocus?: boolean;
}

interface RenderedPresetOption {
    type: 'option';
    value: string;
    optionIndex: number;
}

interface RenderedPresetGroup {
    type: 'group';
    label: string;
}

type RenderedPresetRow = RenderedPresetOption | RenderedPresetGroup;

function PresetTextInput({
    value,
    onValueChange,
    disabled,
    placeholder,
    options,
    optionGroups,
    formatOptionLabel = (option) => option,
    autoFocus = false
}: PresetTextInputProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [dropdownMaxHeight, setDropdownMaxHeight] = useState(224);
    const sourceGroups = useMemo<InventoryOptionGroup[]>(() => (
        optionGroups && optionGroups.length > 0 ? optionGroups : [{ label: '', options }]
    ), [optionGroups, options]);
    const filteredGroups = useMemo(() => {
        const normalizedValue = value.trim().toLowerCase();
        if (!normalizedValue) {
            return sourceGroups;
        }
        const matches = sourceGroups
            .map((group) => ({
                ...group,
                options: group.options.filter((option) => option.toLowerCase().includes(normalizedValue))
            }))
            .filter((group) => group.options.length > 0);
        return matches.length > 0 ? matches : sourceGroups;
    }, [sourceGroups, value]);
    const renderedRows = useMemo<RenderedPresetRow[]>(() => {
        let optionIndex = 0;
        return filteredGroups.flatMap((group) => {
            const rows: RenderedPresetRow[] = [];
            if (group.label) {
                rows.push({ type: 'group', label: group.label });
            }
            group.options.forEach((option) => {
                rows.push({ type: 'option', value: option, optionIndex });
                optionIndex += 1;
            });
            return rows;
        });
    }, [filteredGroups]);
    const filteredOptions = useMemo(() => (
        filteredGroups.flatMap((group) => group.options)
    ), [filteredGroups]);

    useEffect(() => {
        setActiveIndex(0);
    }, [sourceGroups, value]);

    const canShowOptions = !disabled && filteredOptions.length > 0;
    const hasDropdownOptions = sourceGroups.some((group) => group.options.length > 0);

    const updateDropdownHeight = useCallback(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const availableBelow = window.innerHeight - rect.bottom - 16;
        setDropdownMaxHeight(Math.max(160, Math.min(420, availableBelow)));
    }, []);

    useEffect(() => {
        if (!isOpen || !canShowOptions) return undefined;

        updateDropdownHeight();
        window.addEventListener('resize', updateDropdownHeight);
        return () => window.removeEventListener('resize', updateDropdownHeight);
    }, [canShowOptions, isOpen, updateDropdownHeight]);

    const selectOption = (option: string) => {
        onValueChange(option);
        setIsOpen(false);
        setActiveIndex(0);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!canShowOptions) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
            return;
        }

        if (event.key === 'Enter' && isOpen) {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex] || filteredOptions[0]);
            return;
        }

        if (event.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                autoFocus={autoFocus}
                type="text"
                value={value}
                onChange={(event) => {
                    onValueChange(event.target.value);
                    setIsOpen(true);
                    window.requestAnimationFrame(updateDropdownHeight);
                }}
                onFocus={() => {
                    setIsOpen(true);
                    window.requestAnimationFrame(updateDropdownHeight);
                }}
                onBlur={() => {
                    window.setTimeout(() => setIsOpen(false), 120);
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={`${FIELD_CLASS} pr-9`}
                placeholder={placeholder}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isOpen && canShowOptions}
            />
            {hasDropdownOptions && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-300">
                    ▾
                </span>
            )}
            {isOpen && canShowOptions && (
                <div
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-y-auto rounded-lg border border-white/10 bg-[#151b20] py-1 shadow-2xl shadow-black/45"
                    role="listbox"
                    style={{ maxHeight: dropdownMaxHeight }}
                >
                    {renderedRows.map((row) => (
                        row.type === 'group' ? (
                            <div
                                key={`group-${row.label}`}
                                className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase text-amber-300"
                                role="presentation"
                            >
                                --- {row.label.toUpperCase()} ---
                            </div>
                        ) : (
                            <button
                                key={row.value}
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectOption(row.value);
                                }}
                                onMouseEnter={() => setActiveIndex(row.optionIndex)}
                                className={`block w-full px-5 py-2.5 text-left text-sm font-semibold uppercase transition-colors ${
                                    row.optionIndex === activeIndex
                                        ? 'bg-white/35 text-white'
                                        : 'text-slate-100 hover:bg-white/[0.08]'
                                }`}
                                role="option"
                                aria-selected={row.optionIndex === activeIndex}
                            >
                                {formatOptionLabel(row.value)}
                            </button>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}

export function InventoryItemModal({
    item,
    mode,
    existingIds,
    onSave,
    onDelete,
    onCancel
}: InventoryItemModalProps) {
    const [formData, setFormData] = useState<BahamaInventoryV2Item>(() => item || createBlankItem());
    const isCreate = mode === 'create';
    const canEdit = mode === 'create' || mode === 'edit';
    const sizeOptionGroups = getBahamaGroupedSizeOptions(formData.type);

    useEffect(() => {
        setFormData(item || createBlankItem());
    }, [item, mode]);

    const updateField = (field: keyof Pick<BahamaInventoryV2Item, 'id' | 'type' | 'size' | 'location' | 'comment'>) => (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const value = event.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const updateStatus = (event: ChangeEvent<HTMLSelectElement>) => {
        setFormData((prev) => ({ ...prev, status: event.target.value as BahamaInventoryStatus }));
    };

    const updateFieldValue = (field: keyof Pick<BahamaInventoryV2Item, 'type' | 'size' | 'location'>) => (value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const updatePropertyValue = (field: keyof BahamaInventoryV2Item['properties']) => (value: string) => {
        setFormData((prev) => ({
            ...prev,
            properties: {
                ...prev.properties,
                [field]: value
            }
        }));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = trimItem(formData);
        if (!trimmed.id) {
            notifyError('Du måste ange ett lager-ID.');
            return;
        }

        const previousId = item?.id || null;
        const isDuplicate = existingIds.some((id) => id === trimmed.id && id !== previousId);
        if (isDuplicate) {
            notifyError('Lager-ID måste vara unikt.');
            return;
        }

        onSave(trimmed, previousId);
    };

    if (!item && mode === 'view') {
        return (
            <aside className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[#10161b] p-5">
                <div className="mb-5">
                    <h3 className="m-0 text-lg font-semibold text-slate-100">Inspektör</h3>
                    <p className="m-0 mt-1 text-sm text-slate-500">Välj en rad eller skapa en ny artikel.</p>
                </div>
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 text-center text-sm text-slate-500">
                    Ingen artikel vald
                </div>
            </aside>
        );
    }

    return (
        <aside className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[#10161b]">
            <div className="border-b border-white/10 px-5 py-4">
                <p className="m-0 text-[11px] font-semibold uppercase text-slate-500">Inspektör</p>
                <h3 className="m-0 mt-1 text-lg font-semibold text-slate-100">
                    {isCreate ? 'Ny BaHaMa-artikel' : formData.id || 'BaHaMa-artikel'}
                </h3>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                    <section className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Lager-ID">
                                <input
                                    autoFocus={isCreate}
                                    type="text"
                                    value={formData.id}
                                    onChange={updateField('id')}
                                    disabled={!canEdit}
                                    className={FIELD_CLASS}
                                    placeholder="BA-001"
                                />
                            </Field>
                            <Field label="Status">
                                <select
                                    value={formData.status}
                                    onChange={updateStatus}
                                    disabled={!canEdit}
                                    className={FIELD_CLASS}
                                >
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status.value} value={status.value}>{status.label}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <Field label="Typ">
                            <PresetTextInput
                                value={formData.type}
                                onValueChange={updateFieldValue('type')}
                                disabled={!canEdit}
                                placeholder="Pure"
                                options={BAHAMA_TYPE_OPTIONS}
                            />
                        </Field>
                        <Field label="Storlek">
                            <PresetTextInput
                                value={formData.size}
                                onValueChange={updateFieldValue('size')}
                                disabled={!canEdit}
                                placeholder="4x4"
                                options={[]}
                                optionGroups={sizeOptionGroups}
                            />
                        </Field>
                        <Field label="Lagerplats">
                            <PresetTextInput
                                value={formData.location}
                                onValueChange={updateFieldValue('location')}
                                disabled={!canEdit}
                                placeholder="Grenställ 3 våning 5"
                                options={[]}
                                optionGroups={BAHAMA_LOCATION_OPTION_GROUPS}
                                formatOptionLabel={formatBahamaLocationOptionLabel}
                            />
                        </Field>
                    </section>

                    <section className="space-y-3">
                        <h4 className="m-0 text-[11px] font-semibold uppercase text-slate-500">Egenskaper</h4>
                        <Field label="Stativ">
                            <PresetTextInput
                                value={formData.properties.stativ}
                                onValueChange={updatePropertyValue('stativ')}
                                disabled={!canEdit}
                                placeholder="7016"
                                options={BAHAMA_FRAME_OPTIONS}
                            />
                        </Field>
                        <Field label="Textil">
                            <PresetTextInput
                                value={formData.properties.textil}
                                onValueChange={updatePropertyValue('textil')}
                                disabled={!canEdit}
                                placeholder="9947 - mushroom"
                                options={[]}
                                optionGroups={BAHAMA_TEXTILE_OPTION_GROUPS}
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Fot">
                                <PresetTextInput
                                    value={formData.properties.fot}
                                    onValueChange={updatePropertyValue('fot')}
                                    disabled={!canEdit}
                                    placeholder="Tipping"
                                    options={BAHAMA_FOOT_OPTIONS}
                                />
                            </Field>
                            <Field label="Belysning">
                                <PresetTextInput
                                    value={formData.properties.belysning}
                                    onValueChange={updatePropertyValue('belysning')}
                                    disabled={!canEdit}
                                    placeholder="Classic"
                                    options={BAHAMA_LIGHTING_OPTIONS}
                                />
                            </Field>
                        </div>
                        <Field label="Värme">
                            <PresetTextInput
                                value={formData.properties.varme}
                                onValueChange={updatePropertyValue('varme')}
                                disabled={!canEdit}
                                placeholder="Heaters"
                                options={BAHAMA_HEAT_OPTIONS}
                            />
                        </Field>
                    </section>

                    <Field label="Kommentar">
                        <textarea
                            rows={4}
                            value={formData.comment}
                            onChange={updateField('comment')}
                            disabled={!canEdit}
                            className={`${FIELD_CLASS} resize-none`}
                            placeholder="Intern kommentar"
                        />
                    </Field>
                </div>

                <div className="border-t border-white/10 p-5">
                    <div className="flex gap-2">
                        {!isCreate && item && (
                            <button
                                type="button"
                                onClick={() => onDelete(item)}
                                className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-400/20"
                            >
                                Ta bort
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onCancel}
                            className="ml-auto rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/5"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            className="rounded-md border border-[#e8e1d4] bg-[#e8e1d4] px-4 py-2 text-sm font-semibold text-[#11171c] transition-colors hover:bg-white"
                        >
                            Spara
                        </button>
                    </div>
                </div>
            </form>
        </aside>
    );
}
