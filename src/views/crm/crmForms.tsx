import React, { useEffect, useState, type FormEvent } from 'react';
import type {
    CrmActivity,
    CrmActivityType,
    CrmCompany,
    CrmContact,
    CrmCreateActivityInput,
    CrmCreateCompanyInput,
    CrmCreateContactInput,
    CrmCreateDealInput,
    CrmDeal,
    CrmDealStage,
    CrmMember
} from '../../types/crm';
import {
    CRM_DEAL_STAGES,
    CRM_STAGE_LABELS,
    CrmModal,
    FormField,
    inputClass,
    primaryButtonClass,
    secondaryButtonClass
} from './crmShared';

export type CompanyFormValues = Omit<CrmCreateCompanyInput, 'actor' | 'id'>;
export type ContactFormValues = Omit<CrmCreateContactInput, 'actor' | 'id'>;
export type DealFormValues = Omit<CrmCreateDealInput, 'actor' | 'id'>;
export type ActivityFormValues = Omit<CrmCreateActivityInput, 'actor' | 'id'>;

function parseTags(value: string): string[] {
    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

interface FormModalProps<T, TInput> {
    open: boolean;
    initial?: T | null;
    saving: boolean;
    error?: string;
    onClose: () => void;
    onSubmit: (input: TInput) => Promise<void>;
}

function ModalActions({ saving, onClose, submitLabel }: { saving: boolean; onClose: () => void; submitLabel: string }) {
    return (
        <div className="flex flex-col-reverse gap-3 border-t border-panel-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={saving}>
                Avbryt
            </button>
            <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? 'Sparar...' : submitLabel}
            </button>
        </div>
    );
}

function FormError({ message }: { message?: string }) {
    return message ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-text-primary">
            {message}
        </div>
    ) : null;
}

export function CompanyFormModal({
    open,
    initial,
    saving,
    error,
    onClose,
    onSubmit
}: FormModalProps<CrmCompany, CompanyFormValues>) {
    const [name, setName] = useState('');
    const [orgNumber, setOrgNumber] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [street, setStreet] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [tags, setTags] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(initial?.name || '');
        setOrgNumber(initial?.orgNumber || '');
        setEmail(initial?.email || '');
        setPhone(initial?.phone || '');
        setWebsite(initial?.website || '');
        setStreet(initial?.address?.street || '');
        setPostalCode(initial?.address?.postalCode || '');
        setCity(initial?.address?.city || '');
        setCountry(initial?.address?.country || 'Sverige');
        setTags((initial?.tags || []).join(', '));
        setNotes(initial?.notes || '');
    }, [initial, open]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const input: CompanyFormValues = {
            name: name.trim(),
            orgNumber: orgNumber.trim(),
            email: email.trim(),
            phone: phone.trim(),
            website: website.trim(),
            address: {
                street: street.trim(),
                postalCode: postalCode.trim(),
                city: city.trim(),
                country: country.trim()
            },
            tags: parseTags(tags),
            notes: notes.trim()
        };
        await onSubmit(input);
    };

    return (
        <CrmModal
            open={open}
            title={initial ? 'Redigera kund' : 'Lägg till kund'}
            description="Företagets gemensamma kontakt- och säljinformation."
            onClose={onClose}
        >
            <form onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                    <div className="sm:col-span-2"><FormError message={error} /></div>
                    <FormField label="Företagsnamn *" htmlFor="crm-company-name">
                        <input id="crm-company-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
                    </FormField>
                    <FormField label="Organisationsnummer" htmlFor="crm-company-org">
                        <input id="crm-company-org" className={inputClass} value={orgNumber} onChange={(event) => setOrgNumber(event.target.value)} />
                    </FormField>
                    <FormField label="E-post" htmlFor="crm-company-email">
                        <input id="crm-company-email" type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
                    </FormField>
                    <FormField label="Telefon" htmlFor="crm-company-phone">
                        <input id="crm-company-phone" className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
                    </FormField>
                    <FormField label="Webbplats" htmlFor="crm-company-website">
                        <input id="crm-company-website" type="url" className={inputClass} value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" />
                    </FormField>
                    <FormField label="Gatuadress" htmlFor="crm-company-street">
                        <input id="crm-company-street" className={inputClass} value={street} onChange={(event) => setStreet(event.target.value)} />
                    </FormField>
                    <FormField label="Postnummer" htmlFor="crm-company-postal-code">
                        <input id="crm-company-postal-code" className={inputClass} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
                    </FormField>
                    <FormField label="Ort" htmlFor="crm-company-city">
                        <input id="crm-company-city" className={inputClass} value={city} onChange={(event) => setCity(event.target.value)} />
                    </FormField>
                    <FormField label="Land" htmlFor="crm-company-country">
                        <input id="crm-company-country" className={inputClass} value={country} onChange={(event) => setCountry(event.target.value)} />
                    </FormField>
                    <div className="sm:col-span-2">
                        <FormField label="Taggar" htmlFor="crm-company-tags" hint="Separera flera taggar med kommatecken.">
                            <input id="crm-company-tags" className={inputClass} value={tags} onChange={(event) => setTags(event.target.value)} />
                        </FormField>
                    </div>
                    <div className="sm:col-span-2">
                        <FormField label="Anteckningar" htmlFor="crm-company-notes">
                            <textarea id="crm-company-notes" rows={4} className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
                        </FormField>
                    </div>
                </div>
                <ModalActions saving={saving} onClose={onClose} submitLabel={initial ? 'Spara ändringar' : 'Skapa kund'} />
            </form>
        </CrmModal>
    );
}

interface ContactFormModalProps extends FormModalProps<CrmContact, ContactFormValues> {
    companies: CrmCompany[];
    defaultCompanyId?: string;
}

export function ContactFormModal({
    open,
    initial,
    companies,
    defaultCompanyId = '',
    saving,
    error,
    onClose,
    onSubmit
}: ContactFormModalProps) {
    const [name, setName] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [title, setTitle] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [tags, setTags] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(initial?.name || '');
        setCompanyId(initial?.companyId || defaultCompanyId);
        setTitle(initial?.role || '');
        setEmail(initial?.email || '');
        setPhone(initial?.phone || '');
        setTags((initial?.tags || []).join(', '));
        setNotes(initial?.notes || '');
    }, [defaultCompanyId, initial, open]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const input: ContactFormValues = {
            name: name.trim(),
            companyId: companyId || null,
            role: title.trim(),
            email: email.trim(),
            phone: phone.trim(),
            tags: parseTags(tags),
            notes: notes.trim()
        };
        await onSubmit(input);
    };

    return (
        <CrmModal open={open} title={initial ? 'Redigera kontakt' : 'Lägg till kontakt'} onClose={onClose}>
            <form onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                    <div className="sm:col-span-2"><FormError message={error} /></div>
                    <FormField label="Namn *" htmlFor="crm-contact-name">
                        <input id="crm-contact-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
                    </FormField>
                    <FormField label="Företag" htmlFor="crm-contact-company">
                        <select id="crm-contact-company" className={inputClass} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                            <option value="">Privatkund / inget företag</option>
                            {companies.filter((company) => !company.archived).map((company) => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Roll eller titel" htmlFor="crm-contact-title">
                        <input id="crm-contact-title" className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
                    </FormField>
                    <FormField label="E-post" htmlFor="crm-contact-email">
                        <input id="crm-contact-email" type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
                    </FormField>
                    <FormField label="Telefon" htmlFor="crm-contact-phone">
                        <input id="crm-contact-phone" className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
                    </FormField>
                    <div className="sm:col-span-2">
                        <FormField label="Taggar" htmlFor="crm-contact-tags" hint="Separera flera taggar med kommatecken.">
                            <input id="crm-contact-tags" className={inputClass} value={tags} onChange={(event) => setTags(event.target.value)} />
                        </FormField>
                    </div>
                    <div className="sm:col-span-2">
                        <FormField label="Anteckningar" htmlFor="crm-contact-notes">
                            <textarea id="crm-contact-notes" rows={4} className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
                        </FormField>
                    </div>
                </div>
                <ModalActions saving={saving} onClose={onClose} submitLabel={initial ? 'Spara ändringar' : 'Skapa kontakt'} />
            </form>
        </CrmModal>
    );
}

interface DealFormModalProps extends FormModalProps<CrmDeal, DealFormValues> {
    companies: CrmCompany[];
    contacts: CrmContact[];
    members: CrmMember[];
    defaultCompanyId?: string;
    defaultContactId?: string;
}

export function DealFormModal({
    open,
    initial,
    companies,
    contacts,
    members,
    defaultCompanyId = '',
    defaultContactId = '',
    saving,
    error,
    onClose,
    onSubmit
}: DealFormModalProps) {
    const [title, setTitle] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [contactId, setContactId] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [stage, setStage] = useState<CrmDealStage>('lead');
    const [valueSek, setValueSek] = useState('');
    const [expectedCloseDate, setExpectedCloseDate] = useState('');
    const [lostReason, setLostReason] = useState('');
    const [tags, setTags] = useState('');

    useEffect(() => {
        if (!open) return;
        setTitle(initial?.title || '');
        setCompanyId(initial?.companyId || defaultCompanyId);
        setContactId(initial?.primaryContactId || defaultContactId);
        setOwnerId(initial?.ownerId || '');
        setStage(initial?.stage === 'quote' && !initial.quoteId ? 'lead' : initial?.stage || 'lead');
        setValueSek(initial?.valueSek ? String(initial.valueSek) : '');
        setExpectedCloseDate(initial?.expectedCloseAtMs
            ? new Date(initial.expectedCloseAtMs).toISOString().slice(0, 10)
            : '');
        setLostReason(initial?.lostReason || '');
        setTags((initial?.tags || []).join(', '));
    }, [defaultCompanyId, defaultContactId, initial, open]);

    const filteredContacts = contacts.filter((contact) => !contact.archived && (!companyId || contact.companyId === companyId));
    const availableStages = CRM_DEAL_STAGES.filter((stageOption) => (
        stageOption !== 'quote' || Boolean(initial?.quoteId)
    ));

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const owner = members.find((member) => member.id === ownerId);
        const input: DealFormValues = {
            title: title.trim(),
            companyId: companyId || null,
            primaryContactId: contactId || null,
            ownerId: ownerId || null,
            ownerName: owner?.name || owner?.email || '',
            stage,
            valueSek: Math.max(0, Number(valueSek) || 0),
            expectedCloseAtMs: expectedCloseDate ? new Date(`${expectedCloseDate}T12:00:00`).getTime() : null,
            lostReason: stage === 'lost' ? lostReason.trim() : '',
            tags: parseTags(tags)
        };
        await onSubmit(input);
    };

    return (
        <CrmModal
            open={open}
            title={initial ? 'Redigera affär' : 'Skapa affär'}
            description="Affären placeras direkt i vald pipelinefas."
            onClose={onClose}
        >
            <form onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                    <div className="sm:col-span-2"><FormError message={error} /></div>
                    <div className="sm:col-span-2">
                        <FormField label="Affärsnamn *" htmlFor="crm-deal-title">
                            <input id="crm-deal-title" className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus />
                        </FormField>
                    </div>
                    <FormField label="Kund" htmlFor="crm-deal-company">
                        <select
                            id="crm-deal-company"
                            className={inputClass}
                            value={companyId}
                            onChange={(event) => {
                                setCompanyId(event.target.value);
                                setContactId('');
                            }}
                        >
                            <option value="">Ingen vald kund</option>
                            {companies.filter((company) => !company.archived).map((company) => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Primär kontakt" htmlFor="crm-deal-contact">
                        <select id="crm-deal-contact" className={inputClass} value={contactId} onChange={(event) => setContactId(event.target.value)}>
                            <option value="">Ingen vald kontakt</option>
                            {filteredContacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>{contact.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Ansvarig" htmlFor="crm-deal-owner">
                        <select id="crm-deal-owner" className={inputClass} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                            <option value="">Ej tilldelad</option>
                            {members.filter((member) => !member.archived).map((member) => (
                                <option key={member.id} value={member.id}>{member.name || member.email}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Pipelinefas" htmlFor="crm-deal-stage">
                        <select id="crm-deal-stage" className={inputClass} value={stage} onChange={(event) => setStage(event.target.value as CrmDealStage)}>
                            {availableStages.map((stageOption) => (
                                <option key={stageOption} value={stageOption}>{CRM_STAGE_LABELS[stageOption]}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Affärsvärde (SEK)" htmlFor="crm-deal-value">
                        <input id="crm-deal-value" type="number" min="0" step="1" className={inputClass} value={valueSek} onChange={(event) => setValueSek(event.target.value)} />
                    </FormField>
                    <FormField label="Förväntat avslut" htmlFor="crm-deal-close">
                        <input id="crm-deal-close" type="date" className={inputClass} value={expectedCloseDate} onChange={(event) => setExpectedCloseDate(event.target.value)} />
                    </FormField>
                    <div className="sm:col-span-2">
                        <FormField label="Taggar" htmlFor="crm-deal-tags" hint="Separera flera taggar med kommatecken.">
                            <input id="crm-deal-tags" className={inputClass} value={tags} onChange={(event) => setTags(event.target.value)} />
                        </FormField>
                    </div>
                    {stage === 'lost' ? (
                        <div className="sm:col-span-2">
                            <FormField label="Förlustorsak *" htmlFor="crm-deal-lost-reason">
                                <textarea id="crm-deal-lost-reason" rows={3} className={inputClass} value={lostReason} onChange={(event) => setLostReason(event.target.value)} required />
                            </FormField>
                        </div>
                    ) : null}
                </div>
                <ModalActions saving={saving} onClose={onClose} submitLabel={initial ? 'Spara ändringar' : 'Skapa affär'} />
            </form>
        </CrmModal>
    );
}

interface ActivityFormModalProps extends FormModalProps<CrmActivity, ActivityFormValues> {
    companies: CrmCompany[];
    contacts: CrmContact[];
    deals: CrmDeal[];
    defaultCompanyId?: string;
    defaultContactId?: string;
    defaultDealId?: string;
}

const ACTIVITY_TYPES: Array<{ value: CrmActivityType; label: string }> = [
    { value: 'note', label: 'Anteckning' },
    { value: 'call', label: 'Samtal' },
    { value: 'email', label: 'Mejl' },
    { value: 'meeting', label: 'Möte' },
    { value: 'task', label: 'Uppgift' }
];

export function ActivityFormModal({
    open,
    companies,
    contacts,
    deals,
    defaultCompanyId = '',
    defaultContactId = '',
    defaultDealId = '',
    saving,
    error,
    onClose,
    onSubmit
}: ActivityFormModalProps) {
    const [type, setType] = useState<CrmActivityType>('note');
    const [subject, setSubject] = useState('');
    const [notes, setNotes] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [contactId, setContactId] = useState('');
    const [dealId, setDealId] = useState('');
    const [dateTime, setDateTime] = useState('');

    useEffect(() => {
        if (!open) return;
        setType('note');
        setSubject('');
        setNotes('');
        setCompanyId(defaultCompanyId);
        setContactId(defaultContactId);
        setDealId(defaultDealId);
        setDateTime('');
    }, [defaultCompanyId, defaultContactId, defaultDealId, open]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const timestamp = dateTime ? new Date(dateTime).getTime() : Date.now();
        const input: ActivityFormValues = {
            type,
            status: type === 'task' ? 'open' : 'completed',
            subject: subject.trim(),
            notes: notes.trim(),
            companyId: companyId || null,
            contactId: contactId || null,
            dealId: dealId || null,
            dueAtMs: type === 'task' ? timestamp : null,
            occurredAtMs: type === 'task' ? Date.now() : timestamp,
            completedAtMs: type === 'task' ? null : timestamp
        };
        await onSubmit(input);
    };

    return (
        <CrmModal
            open={open}
            title="Registrera aktivitet"
            description="Aktiviteten visas i kundens och affärens gemensamma tidslinje."
            onClose={onClose}
        >
            <form onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                    <div className="sm:col-span-2"><FormError message={error} /></div>
                    <FormField label="Typ" htmlFor="crm-activity-type">
                        <select id="crm-activity-type" className={inputClass} value={type} onChange={(event) => setType(event.target.value as CrmActivityType)}>
                            {ACTIVITY_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label={type === 'task' ? 'Förfallotid *' : 'Tidpunkt'} htmlFor="crm-activity-time">
                        <input
                            id="crm-activity-time"
                            type="datetime-local"
                            className={inputClass}
                            value={dateTime}
                            onChange={(event) => setDateTime(event.target.value)}
                            required={type === 'task'}
                        />
                    </FormField>
                    <div className="sm:col-span-2">
                        <FormField label="Rubrik *" htmlFor="crm-activity-subject">
                            <input id="crm-activity-subject" className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} required autoFocus />
                        </FormField>
                    </div>
                    <FormField label="Kund" htmlFor="crm-activity-company">
                        <select id="crm-activity-company" className={inputClass} value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                            <option value="">Ingen vald kund</option>
                            {companies.filter((company) => !company.archived).map((company) => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <FormField label="Kontakt" htmlFor="crm-activity-contact">
                        <select id="crm-activity-contact" className={inputClass} value={contactId} onChange={(event) => setContactId(event.target.value)}>
                            <option value="">Ingen vald kontakt</option>
                            {contacts.filter((contact) => !contact.archived).map((contact) => (
                                <option key={contact.id} value={contact.id}>{contact.name}</option>
                            ))}
                        </select>
                    </FormField>
                    <div className="sm:col-span-2">
                        <FormField label="Affär" htmlFor="crm-activity-deal">
                            <select id="crm-activity-deal" className={inputClass} value={dealId} onChange={(event) => setDealId(event.target.value)}>
                                <option value="">Ingen vald affär</option>
                                {deals.filter((deal) => !deal.archived).map((deal) => (
                                    <option key={deal.id} value={deal.id}>{deal.title}</option>
                                ))}
                            </select>
                        </FormField>
                    </div>
                    <div className="sm:col-span-2">
                        <FormField label="Anteckning" htmlFor="crm-activity-notes">
                            <textarea id="crm-activity-notes" rows={4} className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
                        </FormField>
                    </div>
                </div>
                <ModalActions saving={saving} onClose={onClose} submitLabel="Spara aktivitet" />
            </form>
        </CrmModal>
    );
}
