/* @vitest-environment jsdom */
import React from 'react';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../src/views/Dashboard';

const dashboardMocks = vi.hoisted(() => ({
    auth: {},
    collection: vi.fn(),
    getDocs: vi.fn(),
    limit: vi.fn(),
    listRecentOrderRequests: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn()
}));

vi.mock('../src/store/AuthContext', () => ({
    useAuth: () => dashboardMocks.auth
}));

vi.mock('../src/services/firebase', () => ({
    db: {},
    collection: dashboardMocks.collection,
    getDocs: dashboardMocks.getDocs,
    limit: dashboardMocks.limit,
    orderBy: dashboardMocks.orderBy,
    query: dashboardMocks.query
}));

vi.mock('../src/services/orderRequestService', () => ({
    getOrderRequestStatusLabel: (status) => ({
        completed: 'Slutförd',
        reviewing: 'Under behandling',
        new: 'Ny'
    })[status] || 'Ny',
    orderRequestService: {
        listRecentOrderRequests: dashboardMocks.listRecentOrderRequests
    }
}));

vi.mock('../src/services/activityLogService', () => ({
    formatActivityMetadata: (metadata = {}) => String(metadata.summary || ''),
    getActivityLogVisual: (entry) => ({
        color: 'var(--color-primary)',
        label: entry.label || 'Aktivitet'
    }),
    normalizeActivityLog: (snapshot) => snapshot.data()
}));

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });

    return { promise, reject, resolve };
}

function buildOrder(index, overrides = {}) {
    return {
        id: `order-${index}`,
        quoteOwnerUid: 'quote-owner',
        quoteId: `quote-${index}`,
        quoteNumber: `BRIXX-00${index}`,
        quoteVersion: 1,
        retailerId: 'retailer-1',
        retailerName: `Återförsäljare ${index}`,
        retailerEmail: `retailer-${index}@example.com`,
        customerName: `Kund ${index}`,
        company: `Kundbolag ${index}`,
        reference: `Referens ${index}`,
        customerReference: '',
        selectedLines: ['BaHaMa'],
        totalSek: index * 1000,
        status: 'new',
        createdAtMs: Date.UTC(2026, 6, 20, 10, index),
        updatedAtMs: Date.UTC(2026, 6, 20, 10, index),
        createdByUid: 'retailer-user',
        createdByEmail: 'retailer@example.com',
        statusUpdatedByUid: '',
        statusUpdatedByEmail: '',
        ...overrides
    };
}

function buildActivity(index, overrides = {}) {
    return {
        id: `activity-${index}`,
        createdAtMs: Date.UTC(2026, 6, 20, 11, index),
        timestampMs: 0,
        resolvedMs: Date.UTC(2026, 6, 20, 11, index),
        eventType: 'quote_saved',
        label: `Aktivitet ${index}`,
        system: 'quote',
        targetType: 'quote',
        targetId: `BRIXX-00${index}`,
        user: `admin-${index}@example.com`,
        userUid: `admin-${index}`,
        details: `Aktivitetsdetalj ${index}`,
        metadata: {},
        ...overrides
    };
}

function activityDocs(entries) {
    return entries.map((entry) => ({
        id: entry.id,
        data: () => entry
    }));
}

const adminAuth = {
    canViewEverything: true,
    canStartQuote: true,
    canAccessSketch: true,
    canAccessQuoteHistory: true,
    canExportSketchToQuote: true,
    isRetailer: false,
    retailer: null,
    user: { uid: 'admin-1', email: 'admin@example.com' }
};

function createDashboardProps(overrides = {}) {
    return {
        onStartQuote: vi.fn(),
        onContinueQuote: vi.fn(),
        onOpenCrm: vi.fn(),
        onOpenInventory: vi.fn(),
        onOpenSketch: vi.fn(),
        onOpenActivity: vi.fn(),
        onOpenPlanner: vi.fn(),
        onOpenRetailerOrders: vi.fn(),
        ...overrides
    };
}

function renderDashboard({ auth = {}, props = {} } = {}) {
    dashboardMocks.auth = {
        ...adminAuth,
        ...auth
    };
    const dashboardProps = createDashboardProps(props);
    const result = render(<Dashboard {...dashboardProps} />);

    return {
        ...result,
        props: dashboardProps
    };
}

function getFeedSection(name) {
    const heading = screen.getByRole('heading', { name });
    const section = heading.closest('section');
    expect(section).toBeTruthy();
    return section;
}

async function waitForFeeds() {
    await waitFor(() => {
        expect(screen.queryByText('Laddar orderförfrågningar…')).toBeNull();
        expect(screen.queryByText('Laddar aktivitet…')).toBeNull();
    });
}

beforeEach(() => {
    dashboardMocks.collection.mockReset();
    dashboardMocks.collection.mockReturnValue({ type: 'collection' });
    dashboardMocks.query.mockReset();
    dashboardMocks.query.mockImplementation((...parts) => ({ parts }));
    dashboardMocks.orderBy.mockReset();
    dashboardMocks.orderBy.mockImplementation((field, direction) => ({ field, direction }));
    dashboardMocks.limit.mockReset();
    dashboardMocks.limit.mockImplementation((value) => ({ type: 'limit', value }));
    dashboardMocks.getDocs.mockReset();
    dashboardMocks.getDocs.mockResolvedValue({
        docs: activityDocs([
            buildActivity(1),
            buildActivity(2),
            buildActivity(3)
        ])
    });
    dashboardMocks.listRecentOrderRequests.mockReset();
    dashboardMocks.listRecentOrderRequests.mockResolvedValue([
        buildOrder(1),
        buildOrder(2),
        buildOrder(3)
    ]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('Dashboard admin workspace', () => {
    it('renders launcher tools and calls the matching actions', async () => {
        const { props } = renderDashboard();

        await waitForFeeds();

        const launchers = [
            ['Skapa ny offert', props.onStartQuote],
            ['Sälj-CRM', props.onOpenCrm],
            ['Lagersaldo', props.onOpenInventory],
            ['Rita uteservering', props.onOpenSketch],
            ['Aktivitetslogg', props.onOpenActivity],
            ['Planering', props.onOpenPlanner]
        ];

        launchers.forEach(([name, callback]) => {
            const launcher = screen.getByRole('button', { name: new RegExp(name, 'i') });
            if (callback) {
                fireEvent.click(launcher);
                expect(callback).toHaveBeenCalledTimes(1);
            }
        });

        const launcherNames = launchers.map(([name]) => name);
        const renderedLaunchers = screen.getAllByRole('button').concat(screen.queryAllByRole('link')).filter((launcher) => (
            launcherNames.some((name) => launcher.textContent.includes(name))
        ));
        expect(renderedLaunchers).toHaveLength(6);
        expect(screen.queryByRole('link', { name: /Masse Kladd/i })).toBeNull();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 }).textContent)
            .toBe('Välkommen till Brixx portal');
    });

    it('turns the quote launcher into a continue action when a draft exists', async () => {
        const { props } = renderDashboard({
            props: {
                quoteDraftSummary: {
                    customerLabel: 'Testbolaget AB',
                    reference: 'Uteservering Stortorget',
                    quoteNumber: 'BRIXX-001',
                    stepLabel: 'Steg 3 av 4 · Prissättning',
                    updatedAtMs: Date.UTC(2026, 6, 20, 9, 30)
                }
            }
        });

        await waitForFeeds();

        expect(screen.queryByRole('button', { name: /Skapa ny offert/i })).toBeNull();
        const continueButton = screen.getByRole('button', { name: /Fortsätt offert/i });
        expect(continueButton.textContent).toContain('Testbolaget AB');
        expect(continueButton.textContent).toContain('Steg 3 av 4 · Prissättning');

        fireEvent.click(continueButton);

        expect(props.onContinueQuote).toHaveBeenCalledTimes(1);
        expect(props.onStartQuote).not.toHaveBeenCalled();
    });

    it('requests and renders three static rows in each recent feed', async () => {
        renderDashboard();

        await waitForFeeds();

        expect(dashboardMocks.listRecentOrderRequests).toHaveBeenCalledWith({ limit: 3 });
        expect(dashboardMocks.limit).toHaveBeenCalledWith(3);

        const orderSection = getFeedSection('Senaste orderförfrågningar');
        const activitySection = getFeedSection('Senaste aktivitet');
        expect(within(orderSection).getAllByRole('listitem')).toHaveLength(3);
        expect(within(activitySection).getAllByRole('listitem')).toHaveLength(3);
        expect(within(orderSection).getAllByRole('button')).toHaveLength(1);
        expect(within(orderSection).getByRole('button', { name: 'Visa alla' })).toBeTruthy();
        expect(within(activitySection).getAllByRole('button')).toHaveLength(1);
        expect(within(activitySection).getByRole('button', { name: 'Visa alla' })).toBeTruthy();
    });

    it('shows loading immediately without flashing either empty state', async () => {
        const orders = deferred();
        const activities = deferred();
        dashboardMocks.listRecentOrderRequests.mockReturnValue(orders.promise);
        dashboardMocks.getDocs.mockReturnValue(activities.promise);

        renderDashboard();

        expect(screen.getByText('Laddar orderförfrågningar…')).toBeTruthy();
        expect(screen.getByText('Laddar aktivitet…')).toBeTruthy();
        expect(screen.queryByText('Inga orderförfrågningar har registrerats ännu.')).toBeNull();
        expect(screen.queryByText(/Inga loggade händelser ännu/)).toBeNull();
        expect(getFeedSection('Senaste orderförfrågningar').getAttribute('aria-busy')).toBe('true');
        expect(getFeedSection('Senaste aktivitet').getAttribute('aria-busy')).toBe('true');

        await act(async () => {
            orders.resolve([]);
            activities.resolve({ docs: [] });
            await Promise.all([orders.promise, activities.promise]);
        });

        await waitForFeeds();
    });

    it('supports retrying each failed feed and then renders its empty state', async () => {
        dashboardMocks.listRecentOrderRequests
            .mockRejectedValueOnce(new Error('orders unavailable'))
            .mockResolvedValueOnce([]);
        dashboardMocks.getDocs
            .mockRejectedValueOnce(new Error('activities unavailable'))
            .mockResolvedValueOnce({ docs: [] });

        renderDashboard();

        const orderAlert = await screen.findByText(/Kunde inte ladda orderförfrågningar/i);
        const activityAlert = await screen.findByText(/Kunde inte ladda senaste aktivitet/i);
        expect(orderAlert.closest('[role="alert"]')).toBeTruthy();
        expect(activityAlert.closest('[role="alert"]')).toBeTruthy();

        fireEvent.click(within(getFeedSection('Senaste orderförfrågningar'))
            .getByRole('button', { name: 'Försök igen' }));
        fireEvent.click(within(getFeedSection('Senaste aktivitet'))
            .getByRole('button', { name: 'Försök igen' }));

        await waitFor(() => {
            expect(screen.getByText('Inga orderförfrågningar har registrerats ännu.')).toBeTruthy();
            expect(screen.getByText(/Inga loggade händelser ännu/)).toBeTruthy();
        });
        expect(dashboardMocks.listRecentOrderRequests).toHaveBeenCalledTimes(2);
        expect(dashboardMocks.getDocs).toHaveBeenCalledTimes(2);
    });

    it('keeps long feed content, marks negative amounts, and labels unknown dates', async () => {
        const longCompany = 'Ett mycket långt kundföretagsnamn som ska finnas kvar i DOM utan att trunkeras';
        const longDetails = 'En mycket lång aktivitetsbeskrivning med filnamn-och-referens-som-måste-finnas-kvar.pdf';
        dashboardMocks.listRecentOrderRequests.mockResolvedValue([
            buildOrder(1, {
                company: longCompany,
                createdAtMs: 0,
                totalSek: -37474587
            }),
            buildOrder(2),
            buildOrder(3)
        ]);
        dashboardMocks.getDocs.mockResolvedValue({
            docs: activityDocs([
                buildActivity(1, {
                    details: longDetails,
                    resolvedMs: 0,
                    createdAtMs: 0
                }),
                buildActivity(2),
                buildActivity(3)
            ])
        });

        renderDashboard();
        await waitForFeeds();

        expect(screen.getByText(new RegExp(longCompany))).toBeTruthy();
        expect(screen.getByText(new RegExp(longDetails))).toBeTruthy();
        expect(screen.getAllByText('Okänd tid')).toHaveLength(2);

        const orderSection = getFeedSection('Senaste orderförfrågningar');
        const negativeAmount = Array.from(orderSection.querySelectorAll('*')).find((node) => (
            typeof node.className === 'string'
            && node.className.includes('text-danger')
            && node.textContent.includes('37')
            && node.textContent.includes('474')
            && node.textContent.includes('587')
        ));
        expect(negativeAmount).toBeTruthy();
        expect(negativeAmount.className).toContain('tabular-nums');

        const knownTimes = Array.from(document.querySelectorAll('time'))
            .filter((element) => element.getAttribute('dateTime'));
        expect(knownTimes.length).toBeGreaterThan(0);
    });
});

describe('Dashboard role variants', () => {
    it('keeps the retailer workspace unchanged', () => {
        renderDashboard({
            auth: {
                canViewEverything: false,
                canStartQuote: true,
                canAccessSketch: false,
                isRetailer: true,
                retailer: {
                    id: 'retailer-1',
                    name: 'Markishuset',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 12 }
                    }
                }
            }
        });

        expect(screen.getByText('Återförsäljarportal')).toBeTruthy();
        expect(screen.getByRole('heading', { level: 1, name: 'Välkommen, Markishuset' })).toBeTruthy();
        expect(screen.getByText('Aktiva produktlinjer och rabatter')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Sälj-CRM/i })).toBeNull();
    });

    it('keeps the quote-only workspace unchanged', () => {
        renderDashboard({
            auth: {
                canViewEverything: false,
                canStartQuote: true,
                canAccessSketch: false,
                isRetailer: false
            }
        });

        expect(screen.getByText('Din arbetsöversikt')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Skapa en offert' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Skapa ny offert' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Sälj-CRM/i })).toBeNull();
    });

    it('ignores an invalid persisted draft timestamp without crashing', () => {
        renderDashboard({
            auth: {
                canViewEverything: false,
                canStartQuote: true,
                canAccessSketch: false,
                isRetailer: false
            },
            props: {
                quoteDraftSummary: {
                    customerLabel: 'Testbolaget AB',
                    stepLabel: 'Steg 2 av 4 · Konfiguration',
                    updatedAtMs: Number.MAX_VALUE
                }
            }
        });

        expect(screen.getByRole('heading', { name: 'Pågående offertutkast' })).toBeTruthy();
        expect(screen.queryByText(/Senast ändrad/)).toBeNull();
    });

    it('keeps the sketch-only workspace unchanged', () => {
        renderDashboard({
            auth: {
                canViewEverything: false,
                canStartQuote: false,
                canAccessSketch: true,
                isRetailer: false
            }
        });

        expect(screen.getByRole('heading', { level: 1, name: 'Skissverktyg' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Öppna skissverktyget' })).toBeTruthy();
        expect(screen.queryByText('Senaste aktivitet')).toBeNull();
    });

    it('keeps the no-workspace fallback unchanged', () => {
        renderDashboard({
            auth: {
                canViewEverything: false,
                canStartQuote: false,
                canAccessSketch: false,
                isRetailer: false
            }
        });

        expect(screen.getByRole('heading', { name: 'Ingen arbetsyta tilldelad' })).toBeTruthy();
        expect(screen.getByText(/Kontakta administratören/)).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });
});
