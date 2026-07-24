// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const repositoryMocks = vi.hoisted(() => ({
    getCompany: vi.fn(),
    getContact: vi.fn(),
    getMember: vi.fn(),
    listCompanies: vi.fn(),
    listContacts: vi.fn(),
    listDeals: vi.fn(),
    listActivities: vi.fn(),
    listMembers: vi.fn(),
    createMember: vi.fn(),
    findCompanyDuplicates: vi.fn(),
    findContactDuplicates: vi.fn(),
    createCompany: vi.fn(),
    updateCompany: vi.fn(),
    archiveCompany: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    archiveContact: vi.fn(),
    createDeal: vi.fn(),
    updateDeal: vi.fn(),
    archiveDeal: vi.fn(),
    createActivity: vi.fn(),
    completeActivity: vi.fn(),
    rescheduleActivity: vi.fn(),
    changeDealStage: vi.fn()
}));

vi.mock('../src/services/crmRepository', () => ({
    crmRepository: repositoryMocks
}));

const workflowMocks = vi.hoisted(() => ({
    changeCrmDealStageWithQuote: vi.fn()
}));

vi.mock('../src/services/crmQuoteWorkflow', () => workflowMocks);

const notificationMocks = vi.hoisted(() => ({
    confirmAction: vi.fn(async () => true),
    notifySuccess: vi.fn(),
    notifyError: vi.fn()
}));

vi.mock('../src/services/notificationService', () => notificationMocks);

import { AuthContext } from '../src/store/AuthContext';
import {
    CrmCompanyDetailPage,
    CrmActivitiesPage,
    CrmCustomersPage,
    CrmDashboardPage,
    CrmPipelinePage,
    buildCrmDashboardSummary,
    getQuickRescheduleAt
} from '../src/views/crm';

const NOW = new Date('2026-07-23T10:00:00+02:00').getTime();

const companies = [{
    id: 'company-1',
    name: 'Acme Utemiljö',
    normalizedName: 'acme utemiljö',
    orgNumber: '556000-0000',
    email: 'info@acme.se',
    phone: '070-123 45 67',
    website: 'https://acme.se',
    address: { street: 'Storgatan 1', postalCode: '111 11', city: 'Stockholm', country: 'Sverige' },
    tags: ['Prioriterad'],
    notes: '',
    searchText: 'acme utemiljö',
    searchPrefixes: [],
    archived: false,
    archivedAtMs: null,
    archivedByUid: '',
    createdAtMs: NOW - 100000,
    updatedAtMs: NOW - 1000,
    createdByUid: 'admin-1',
    createdByName: 'Anna Admin',
    updatedByUid: 'admin-1',
    updatedByName: 'Anna Admin'
}];

const contacts = [{
    id: 'contact-1',
    name: 'Ada Andersson',
    normalizedName: 'ada andersson',
    firstName: 'Ada',
    lastName: 'Andersson',
    companyId: 'company-1',
    role: 'Inköpschef',
    email: 'ada@acme.se',
    normalizedEmail: 'ada@acme.se',
    phone: '070-987 65 43',
    tags: [],
    notes: '',
    searchText: 'ada andersson ada@acme.se',
    searchPrefixes: [],
    archived: false,
    archivedAtMs: null,
    archivedByUid: '',
    createdAtMs: NOW - 90000,
    updatedAtMs: NOW - 900,
    createdByUid: 'admin-1',
    createdByName: 'Anna Admin',
    updatedByUid: 'admin-1',
    updatedByName: 'Anna Admin'
}];

const deals = [
    {
        id: 'deal-1',
        title: 'Acme terrass',
        companyId: 'company-1',
        primaryContactId: 'contact-1',
        ownerId: 'admin-1',
        ownerName: 'Anna Admin',
        stage: 'lead',
        valueSek: 500000,
        expectedCloseAtMs: NOW + 86400000,
        lostReason: '',
        quoteOwnerUid: '',
        quoteId: '',
        quoteNumber: '',
        quoteRevisionId: '',
        quoteVersion: 0,
        lastActivityAtMs: NOW - 86400000,
        nextActivityAtMs: 0,
        tags: ['Uteservering'],
        searchText: 'acme terrass',
        searchPrefixes: [],
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: NOW - 80000,
        updatedAtMs: NOW - 800,
        createdByUid: 'admin-1',
        createdByName: 'Anna Admin',
        updatedByUid: 'admin-1',
        updatedByName: 'Anna Admin'
    },
    {
        id: 'deal-2',
        title: 'Acme parasoller',
        companyId: 'company-1',
        primaryContactId: 'contact-1',
        ownerId: 'admin-1',
        ownerName: 'Anna Admin',
        stage: 'quote',
        valueSek: 250000,
        expectedCloseAtMs: NOW + 172800000,
        lostReason: '',
        quoteOwnerUid: '',
        quoteId: 'quote-1',
        quoteNumber: '2026-100',
        quoteRevisionId: 'revision-1',
        quoteVersion: 1,
        lastActivityAtMs: NOW - 1000,
        nextActivityAtMs: NOW + 86400000,
        tags: ['Parasoll'],
        searchText: 'acme parasoller',
        searchPrefixes: [],
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: NOW - 70000,
        updatedAtMs: NOW - 700,
        createdByUid: 'admin-1',
        createdByName: 'Anna Admin',
        updatedByUid: 'admin-1',
        updatedByName: 'Anna Admin'
    },
    {
        id: 'deal-3',
        title: 'Acme entré',
        companyId: 'company-1',
        primaryContactId: 'contact-1',
        ownerId: 'admin-1',
        ownerName: 'Anna Admin',
        stage: 'won',
        valueSek: 100000,
        expectedCloseAtMs: NOW,
        lostReason: '',
        quoteOwnerUid: '',
        quoteId: '',
        quoteNumber: '',
        quoteRevisionId: '',
        quoteVersion: 0,
        lastActivityAtMs: NOW,
        nextActivityAtMs: 0,
        tags: [],
        searchText: 'acme entré',
        searchPrefixes: [],
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: NOW - 60000,
        updatedAtMs: NOW - 600,
        createdByUid: 'admin-1',
        createdByName: 'Anna Admin',
        updatedByUid: 'admin-1',
        updatedByName: 'Anna Admin'
    }
];

const activities = [
    {
        id: 'activity-overdue',
        type: 'task',
        status: 'open',
        subject: 'Ring om slutligt besked',
        notes: 'Stäm av leveransvecka.',
        companyId: 'company-1',
        contactId: 'contact-1',
        dealId: 'deal-1',
        dueAtMs: NOW - 86400000,
        occurredAtMs: NOW - 172800000,
        completedAtMs: 0,
        assignedToId: 'admin-1',
        assignedToName: 'Anna Admin',
        searchText: 'ring om slutligt besked',
        searchPrefixes: [],
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: NOW - 172800000,
        updatedAtMs: NOW - 172800000,
        createdByUid: 'admin-1',
        createdByName: 'Anna Admin',
        updatedByUid: 'admin-1',
        updatedByName: 'Anna Admin'
    },
    {
        id: 'activity-today',
        type: 'task',
        status: 'open',
        subject: 'Skicka färgprover',
        notes: '',
        companyId: 'company-1',
        contactId: 'contact-1',
        dealId: 'deal-2',
        dueAtMs: NOW + 3600000,
        occurredAtMs: NOW,
        completedAtMs: 0,
        assignedToId: 'admin-1',
        assignedToName: 'Anna Admin',
        searchText: 'skicka färgprover',
        searchPrefixes: [],
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: NOW,
        updatedAtMs: NOW,
        createdByUid: 'admin-1',
        createdByName: 'Anna Admin',
        updatedByUid: 'admin-1',
        updatedByName: 'Anna Admin'
    }
];

const members = [{
    id: 'admin-1',
    name: 'Anna Admin',
    email: 'admin@example.com',
    normalizedEmail: 'admin@example.com',
    phone: '',
    title: '',
    searchText: 'anna admin',
    searchPrefixes: [],
    archived: false,
    archivedAtMs: null,
    archivedByUid: '',
    createdAtMs: NOW,
    updatedAtMs: NOW,
    createdByUid: 'admin-1',
    createdByName: 'Anna Admin',
    updatedByUid: 'admin-1',
    updatedByName: 'Anna Admin'
}];

function page(items) {
    return { items, nextCursor: null };
}

function createAuthValue() {
    return {
        user: { uid: 'admin-1', email: 'admin@example.com' },
        loading: false,
        accessLevel: 'full',
        canViewEverything: true,
        canStartQuote: true,
        canAccessSketch: true,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: true,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: null,
        isRetailer: false
    };
}

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function renderCrm(node, route = '/crm') {
    return render(
        <AuthContext.Provider value={createAuthValue()}>
            <MemoryRouter initialEntries={[route]}>
                {node}
                <LocationProbe />
            </MemoryRouter>
        </AuthContext.Provider>
    );
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);

    repositoryMocks.getCompany.mockReset().mockResolvedValue(companies[0]);
    repositoryMocks.getContact.mockReset().mockResolvedValue(contacts[0]);
    repositoryMocks.getMember.mockReset().mockResolvedValue(members[0]);
    repositoryMocks.listCompanies.mockReset().mockResolvedValue(page(companies));
    repositoryMocks.listContacts.mockReset().mockResolvedValue(page(contacts));
    repositoryMocks.listDeals.mockReset().mockResolvedValue(page(deals));
    repositoryMocks.listActivities.mockReset().mockResolvedValue(page(activities));
    repositoryMocks.listMembers.mockReset().mockResolvedValue(page(members));
    repositoryMocks.createMember.mockReset().mockResolvedValue(members[0]);
    repositoryMocks.findCompanyDuplicates.mockReset().mockResolvedValue([]);
    repositoryMocks.findContactDuplicates.mockReset().mockResolvedValue([]);
    repositoryMocks.createCompany.mockReset().mockResolvedValue(companies[0]);
    repositoryMocks.updateCompany.mockReset().mockResolvedValue(companies[0]);
    repositoryMocks.archiveCompany.mockReset().mockResolvedValue(undefined);
    repositoryMocks.createContact.mockReset().mockResolvedValue(contacts[0]);
    repositoryMocks.updateContact.mockReset().mockResolvedValue(contacts[0]);
    repositoryMocks.archiveContact.mockReset().mockResolvedValue(undefined);
    repositoryMocks.createDeal.mockReset().mockResolvedValue(deals[0]);
    repositoryMocks.updateDeal.mockReset().mockResolvedValue(deals[0]);
    repositoryMocks.archiveDeal.mockReset().mockResolvedValue(undefined);
    repositoryMocks.createActivity.mockReset().mockResolvedValue(activities[0]);
    repositoryMocks.completeActivity.mockReset().mockResolvedValue(activities[0]);
    repositoryMocks.rescheduleActivity.mockReset().mockResolvedValue(activities[0]);
    repositoryMocks.changeDealStage.mockReset().mockResolvedValue(deals[0]);
    workflowMocks.changeCrmDealStageWithQuote.mockReset().mockResolvedValue(deals[0]);
    notificationMocks.confirmAction.mockClear();
    notificationMocks.notifySuccess.mockClear();
    notificationMocks.notifyError.mockClear();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('CRM views', () => {
    it('derives dashboard priorities and renders overdue and missing-follow-up work', async () => {
        const summary = buildCrmDashboardSummary(deals, activities, NOW);

        expect(summary.openPipelineValue).toBe(750000);
        expect(summary.overdueTasks.map((activity) => activity.id)).toEqual(['activity-overdue']);
        expect(summary.todayTasks.map((activity) => activity.id)).toEqual(['activity-today']);
        expect(summary.dealsWithoutFollowUp.map((deal) => deal.id)).toEqual(['deal-1']);

        renderCrm(<CrmDashboardPage />);

        await waitFor(() => expect(screen.getByText('Ring om slutligt besked')).toBeTruthy());
        expect(screen.getByText('Prioriterade uppföljningar')).toBeTruthy();
        expect(screen.getByText('Affärer utan nästa aktivitet')).toBeTruthy();
        expect(screen.getAllByText('Acme terrass').length).toBeGreaterThan(0);
    });

    it('renders the responsive pipeline and sends a stage change through the repository', async () => {
        renderCrm(<CrmPipelinePage />, '/crm/pipeline');

        await waitFor(() => expect(screen.getByText('Acme terrass')).toBeTruthy());
        expect(screen.getByText('Uteservering')).toBeTruthy();
        expect(screen.getByText('Saknar nästa aktivitet')).toBeTruthy();
        expect(screen.getByRole('region', { name: 'Affärspipeline' })).toBeTruthy();

        fireEvent.change(screen.getByLabelText('Ändra fas för Acme terrass'), {
            target: { value: 'won' }
        });

        await waitFor(() => expect(workflowMocks.changeCrmDealStageWithQuote).toHaveBeenCalledWith({
            dealId: 'deal-1',
            stage: 'won',
            lostReason: undefined,
            actor: { uid: 'admin-1', email: 'admin@example.com' }
        }));
    });

    it('searches deal tags locally and submits comma-separated deal tags', async () => {
        renderCrm(<CrmPipelinePage />, '/crm/pipeline');

        await waitFor(() => expect(screen.getByText('Acme terrass')).toBeTruthy());
        fireEvent.change(screen.getByLabelText('Sök i pipeline'), { target: { value: 'Uteservering' } });
        expect(screen.getByText('Acme terrass')).toBeTruthy();
        expect(screen.queryByText('Acme parasoller')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Skapa affär' }));
        const dialog = screen.getByRole('dialog', { name: 'Skapa affär' });
        fireEvent.change(within(dialog).getByLabelText('Affärsnamn *'), { target: { value: 'Ny uteservering' } });
        fireEvent.change(within(dialog).getByLabelText('Taggar'), { target: { value: 'Uteservering, Viktig' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Skapa affär' }));

        await waitFor(() => expect(repositoryMocks.createDeal).toHaveBeenCalledWith(expect.objectContaining({
            actor: { uid: 'admin-1', email: 'admin@example.com' },
            title: 'Ny uteservering',
            tags: ['Uteservering', 'Viktig']
        })));
    });

    it('summarizes customer contacts, open deals and follow-up state', async () => {
        renderCrm(<CrmCustomersPage />, '/crm/customers');

        await waitFor(() => expect(screen.getByText('Acme Utemiljö')).toBeTruthy());
        expect(screen.getByText('Ada Andersson')).toBeTruthy();
        expect(screen.queryByText('+0 ytterligare')).toBeNull();
        expect(screen.getByText('Pipelinevärde')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Acme Utemiljö' }).getAttribute('href')).toBe('/crm/customers/company-1');
    });

    it('warns about a duplicate company and supports cancel plus create anyway', async () => {
        repositoryMocks.findCompanyDuplicates.mockResolvedValue(companies);
        renderCrm(<CrmCustomersPage />, '/crm/customers');

        await waitFor(() => expect(screen.getByText('Acme Utemiljö')).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till kund' }));
        const companyDialog = screen.getByRole('dialog', { name: 'Lägg till kund' });
        fireEvent.change(within(companyDialog).getByLabelText('Företagsnamn *'), { target: { value: 'Acme Utemiljö' } });
        fireEvent.change(within(companyDialog).getByLabelText('Organisationsnummer'), { target: { value: '556000-0000' } });
        fireEvent.click(within(companyDialog).getByRole('button', { name: 'Skapa kund' }));

        const duplicateDialog = await screen.findByRole('dialog', { name: 'Möjlig dubblett' });
        expect(within(duplicateDialog).getByText('Acme Utemiljö')).toBeTruthy();
        fireEvent.click(within(duplicateDialog).getByRole('button', { name: 'Avbryt' }));
        expect(screen.queryByRole('dialog', { name: 'Möjlig dubblett' })).toBeNull();
        expect(repositoryMocks.createCompany).not.toHaveBeenCalled();

        fireEvent.click(within(companyDialog).getByRole('button', { name: 'Skapa kund' }));
        const secondReview = await screen.findByRole('dialog', { name: 'Möjlig dubblett' });
        fireEvent.click(within(secondReview).getByRole('button', { name: 'Skapa ändå' }));

        await waitFor(() => expect(repositoryMocks.createCompany).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Acme Utemiljö',
            orgNumber: '556000-0000'
        })));
    });

    it('opens an existing company from the duplicate warning', async () => {
        repositoryMocks.findCompanyDuplicates.mockResolvedValue(companies);
        renderCrm(<CrmCustomersPage />, '/crm/customers');

        await waitFor(() => expect(screen.getByText('Acme Utemiljö')).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till kund' }));
        const companyDialog = screen.getByRole('dialog', { name: 'Lägg till kund' });
        fireEvent.change(within(companyDialog).getByLabelText('Företagsnamn *'), { target: { value: 'Acme Utemiljö' } });
        fireEvent.click(within(companyDialog).getByRole('button', { name: 'Skapa kund' }));

        const duplicateDialog = await screen.findByRole('dialog', { name: 'Möjlig dubblett' });
        fireEvent.click(within(duplicateDialog).getByRole('button', { name: 'Öppna befintlig' }));

        expect(screen.getByTestId('location').textContent).toBe('/crm/customers/company-1');
        expect(repositoryMocks.createCompany).not.toHaveBeenCalled();
    });

    it('checks contact duplicates and preserves contact tags when creating anyway', async () => {
        repositoryMocks.findContactDuplicates.mockResolvedValue(contacts);
        renderCrm(<CrmCustomersPage />, '/crm/customers');

        await waitFor(() => expect(screen.getByText('Acme Utemiljö')).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'Lägg till kontakt' }));
        const contactDialog = screen.getByRole('dialog', { name: 'Lägg till kontakt' });
        fireEvent.change(within(contactDialog).getByLabelText('Namn *'), { target: { value: 'Ada Andersson' } });
        fireEvent.change(within(contactDialog).getByLabelText('Företag'), { target: { value: 'company-1' } });
        fireEvent.change(within(contactDialog).getByLabelText('E-post'), { target: { value: 'ada@acme.se' } });
        fireEvent.change(within(contactDialog).getByLabelText('Taggar'), { target: { value: 'Inköp, Prioriterad' } });
        fireEvent.click(within(contactDialog).getByRole('button', { name: 'Skapa kontakt' }));

        await waitFor(() => expect(repositoryMocks.findContactDuplicates).toHaveBeenCalledWith({
            companyId: 'company-1',
            name: 'Ada Andersson',
            email: 'ada@acme.se'
        }));
        const duplicateDialog = screen.getByRole('dialog', { name: 'Möjlig dubblett' });
        fireEvent.click(within(duplicateDialog).getByRole('button', { name: 'Skapa ändå' }));

        await waitFor(() => expect(repositoryMocks.createContact).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Ada Andersson',
            companyId: 'company-1',
            tags: ['Inköp', 'Prioriterad']
        })));
    });

    it('renders a customer timeline and completes an open task', async () => {
        renderCrm(
            <Routes>
                <Route path="/crm/customers/:companyId" element={<CrmCompanyDetailPage />} />
            </Routes>,
            '/crm/customers/company-1'
        );

        await waitFor(() => expect(screen.getByText('Ring om slutligt besked')).toBeTruthy());
        expect(screen.getByText('Skicka färgprover')).toBeTruthy();

        const overdueArticle = screen.getByText('Ring om slutligt besked').closest('article');
        const completeButton = overdueArticle.querySelector('button');
        expect(completeButton).toBeTruthy();
        fireEvent.click(completeButton);

        await waitFor(() => expect(repositoryMocks.completeActivity).toHaveBeenCalledWith({
            activityId: 'activity-overdue',
            actor: { uid: 'admin-1', email: 'admin@example.com' }
        }));
    });

    it('moves an open task to tomorrow while preserving its local clock', async () => {
        const expectedDueAtMs = getQuickRescheduleAt(activities[0], 1, NOW);
        repositoryMocks.rescheduleActivity.mockResolvedValue({
            ...activities[0],
            dueAtMs: expectedDueAtMs
        });
        renderCrm(
            <Routes>
                <Route path="/crm/customers/:companyId" element={<CrmCompanyDetailPage />} />
            </Routes>,
            '/crm/customers/company-1'
        );

        await waitFor(() => expect(screen.getByText('Ring om slutligt besked')).toBeTruthy());
        const task = screen.getByText('Ring om slutligt besked').closest('article');
        fireEvent.click(within(task).getByLabelText('Flytta Ring om slutligt besked'));
        fireEvent.click(within(task).getByRole('button', { name: 'Imorgon' }));

        await waitFor(() => expect(repositoryMocks.rescheduleActivity).toHaveBeenCalledWith({
            activityId: 'activity-overdue',
            actor: { uid: 'admin-1', email: 'admin@example.com' },
            dueAtMs: expectedDueAtMs
        }));
        expect(notificationMocks.notifySuccess).toHaveBeenCalled();
    });

    it('moves seven calendar days and rejects a custom time in the past', async () => {
        const dueDate = new Date(activities[0].dueAtMs);
        const nextWeek = new Date(getQuickRescheduleAt(activities[0], 7, NOW));
        const expectedDate = new Date(NOW);
        expectedDate.setDate(expectedDate.getDate() + 7);
        expect(nextWeek.getFullYear()).toBe(expectedDate.getFullYear());
        expect(nextWeek.getMonth()).toBe(expectedDate.getMonth());
        expect(nextWeek.getDate()).toBe(expectedDate.getDate());
        expect(nextWeek.getHours()).toBe(dueDate.getHours());
        expect(nextWeek.getMinutes()).toBe(dueDate.getMinutes());

        renderCrm(
            <Routes>
                <Route path="/crm/customers/:companyId" element={<CrmCompanyDetailPage />} />
            </Routes>,
            '/crm/customers/company-1'
        );
        await waitFor(() => expect(screen.getByText('Ring om slutligt besked')).toBeTruthy());
        let task = screen.getByText('Ring om slutligt besked').closest('article');
        fireEvent.click(within(task).getByLabelText('Flytta Ring om slutligt besked'));
        fireEvent.click(within(task).getByRole('button', { name: 'Nästa vecka' }));
        await waitFor(() => expect(repositoryMocks.rescheduleActivity).toHaveBeenCalledWith({
            activityId: 'activity-overdue',
            actor: { uid: 'admin-1', email: 'admin@example.com' },
            dueAtMs: nextWeek.getTime()
        }));

        repositoryMocks.rescheduleActivity.mockClear();
        task = screen.getByText('Ring om slutligt besked').closest('article');
        fireEvent.click(within(task).getByLabelText('Flytta Ring om slutligt besked'));
        fireEvent.click(within(task).getByRole('button', { name: 'Välj datum' }));
        const customDialog = screen.getByRole('dialog', { name: 'Flytta uppgift' });
        fireEvent.change(within(customDialog).getByLabelText('Nytt datum och tid *'), {
            target: { value: '2026-07-23T09:00' }
        });
        fireEvent.submit(customDialog.querySelector('form'));

        await waitFor(() => expect(notificationMocks.notifyError).toHaveBeenCalledWith('Välj en giltig tidpunkt i framtiden.'));
        expect(repositoryMocks.rescheduleActivity).not.toHaveBeenCalled();
        expect(within(customDialog).getByRole('alert').textContent).toBe('Välj en giltig tidpunkt i framtiden.');
    });

    it('moves an open task to a valid custom date and time', async () => {
        const customValue = '2026-07-30T15:45';
        const dueAtMs = new Date(customValue).getTime();
        repositoryMocks.rescheduleActivity.mockResolvedValue({
            ...activities[0],
            dueAtMs
        });
        renderCrm(
            <Routes>
                <Route path="/crm/customers/:companyId" element={<CrmCompanyDetailPage />} />
            </Routes>,
            '/crm/customers/company-1'
        );

        await waitFor(() => expect(screen.getByText('Ring om slutligt besked')).toBeTruthy());
        const task = screen.getByText('Ring om slutligt besked').closest('article');
        fireEvent.click(within(task).getByLabelText('Flytta Ring om slutligt besked'));
        fireEvent.click(within(task).getByRole('button', { name: 'Välj datum' }));
        const customDialog = screen.getByRole('dialog', { name: 'Flytta uppgift' });
        fireEvent.change(within(customDialog).getByLabelText('Nytt datum och tid *'), {
            target: { value: customValue }
        });
        fireEvent.submit(customDialog.querySelector('form'));

        await waitFor(() => expect(repositoryMocks.rescheduleActivity).toHaveBeenCalledWith({
            activityId: 'activity-overdue',
            actor: { uid: 'admin-1', email: 'admin@example.com' },
            dueAtMs
        }));
        expect(notificationMocks.notifySuccess).toHaveBeenCalled();
    });

    it('creates logged activities as completed and tasks as open', async () => {
        renderCrm(<CrmActivitiesPage />, '/crm/activities');
        await waitFor(() => expect(screen.getByText('Aktivitetslista')).toBeTruthy());

        fireEvent.click(screen.getByRole('button', { name: 'Registrera aktivitet' }));
        let dialog = screen.getByRole('dialog', { name: 'Registrera aktivitet' });
        fireEvent.change(within(dialog).getByLabelText('Rubrik *'), { target: { value: 'Kund ringde' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Spara aktivitet' }));

        await waitFor(() => expect(repositoryMocks.createActivity).toHaveBeenCalledWith(expect.objectContaining({
            type: 'note',
            status: 'completed',
            subject: 'Kund ringde',
            dueAtMs: null,
            occurredAtMs: expect.any(Number),
            completedAtMs: expect.any(Number)
        })));
        const loggedActivity = repositoryMocks.createActivity.mock.calls[0][0];
        expect(loggedActivity.completedAtMs).toBe(loggedActivity.occurredAtMs);
        expect(loggedActivity.occurredAtMs).toBeGreaterThanOrEqual(NOW);
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrera aktivitet' })).toBeNull());

        repositoryMocks.createActivity.mockClear();
        fireEvent.click(screen.getByRole('button', { name: 'Registrera aktivitet' }));
        dialog = screen.getByRole('dialog', { name: 'Registrera aktivitet' });
        fireEvent.change(within(dialog).getByLabelText('Typ'), { target: { value: 'task' } });
        fireEvent.change(within(dialog).getByLabelText('Förfallotid *'), { target: { value: '2026-07-24T14:30' } });
        fireEvent.change(within(dialog).getByLabelText('Rubrik *'), { target: { value: 'Följ upp offert' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Spara aktivitet' }));

        await waitFor(() => expect(repositoryMocks.createActivity).toHaveBeenCalledWith(expect.objectContaining({
            type: 'task',
            status: 'open',
            subject: 'Följ upp offert',
            dueAtMs: new Date('2026-07-24T14:30').getTime(),
            occurredAtMs: expect.any(Number),
            completedAtMs: null
        })));
    });
});
