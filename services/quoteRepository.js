export const QUOTE_STATUS_VALUES = ['draft', 'sent', 'won', 'lost', 'archived'];

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeQuoteStatus(status) {
    const normalized = String(status || '').toLowerCase();
    return QUOTE_STATUS_VALUES.includes(normalized) ? normalized : 'draft';
}

export function buildQuoteSearchText({
    customerName = '',
    company = '',
    reference = '',
    status = 'draft'
} = {}) {
    return [customerName, company, reference, normalizeQuoteStatus(status)]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}

export function normalizeQuoteMetadata(quoteId, raw = {}) {
    const fallbackCustomer = raw?.state?.customerInfo || {};
    const customerName = String(raw.customerName || fallbackCustomer.name || 'Okand kund');
    const company = String(raw.company || fallbackCustomer.company || '');
    const reference = String(raw.reference || fallbackCustomer.reference || '-');
    const totalSek = toNumber(raw.totalSek, toNumber(raw?.summary?.finalTotalSek, 0));
    const timestampMs = toNumber(Date.parse(raw.timestamp || ''), 0);
    const createdAtMs = toNumber(raw.createdAtMs, timestampMs || Date.now());
    const updatedAtMs = toNumber(raw.updatedAtMs, timestampMs || createdAtMs);
    const latestVersion = Math.max(1, toNumber(raw.latestVersion, raw.state ? 1 : 0));
    const status = normalizeQuoteStatus(raw.status);
    const latestRevisionId = String(raw.latestRevisionId || '');

    return {
        quoteId,
        customerName,
        company,
        reference,
        status,
        createdAtMs,
        updatedAtMs,
        savedBy: String(raw.savedBy || ''),
        savedByUid: String(raw.savedByUid || ''),
        latestVersion,
        latestRevisionId,
        totalSek,
        searchText: String(
            raw.searchText ||
            buildQuoteSearchText({ customerName, company, reference, status })
        ),
        // Keep legacy fields available for fallback reads.
        state: raw.state || null,
        summary: raw.summary || null
    };
}

export function buildRevisionData({
    quoteId,
    version,
    nowMs,
    user,
    state,
    summary,
    changeNote = ''
}) {
    return {
        quoteId,
        version,
        savedAtMs: nowMs,
        savedBy: String(user?.email || ''),
        savedByUid: String(user?.uid || ''),
        state: JSON.parse(JSON.stringify(state || {})),
        summary: {
            finalTotalSek: toNumber(summary?.finalTotalSek, 0),
            grossTotalSek: toNumber(summary?.grossTotalSek, 0),
            totalDiscountSek: toNumber(summary?.totalDiscountSek, 0)
        },
        changeNote: String(changeNote || '')
    };
}

export function buildQuoteMetadata({
    quoteId,
    customerInfo = {},
    summary = {},
    status = 'draft',
    nowMs,
    user,
    latestVersion,
    latestRevisionId,
    existing = {}
}) {
    const normalizedStatus = normalizeQuoteStatus(status || existing.status);
    const customerName = String(customerInfo.name || existing.customerName || 'Okand kund');
    const company = String(customerInfo.company || existing.company || '');
    const reference = String(customerInfo.reference || existing.reference || '-');

    return {
        quoteId,
        customerName,
        company,
        reference,
        status: normalizedStatus,
        createdAtMs: toNumber(existing.createdAtMs, nowMs),
        updatedAtMs: nowMs,
        savedBy: String(user?.email || existing.savedBy || ''),
        savedByUid: String(user?.uid || existing.savedByUid || ''),
        latestVersion: Math.max(1, toNumber(latestVersion, 1)),
        latestRevisionId: String(latestRevisionId || existing.latestRevisionId || ''),
        totalSek: toNumber(summary?.finalTotalSek, existing.totalSek || 0),
        searchText: buildQuoteSearchText({
            customerName,
            company,
            reference,
            status: normalizedStatus
        })
    };
}

export function applyQuoteFilters(quotes = [], { status = '', search = '' } = {}) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const normalizedSearch = String(search || '').trim().toLowerCase();

    return quotes.filter((quote) => {
        if (normalizedStatus && quote.status !== normalizedStatus) return false;
        if (!normalizedSearch) return true;
        const haystack = `${quote.searchText || ''} ${quote.customerName || ''} ${quote.reference || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
    });
}

export function createQuoteRepository(deps) {
    const {
        db,
        doc,
        getDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        collection,
        getDocs,
        query,
        orderBy,
        limit,
        writeBatch,
        runTransaction
    } = deps || {};

    if (!db || !doc || !getDoc || !setDoc || !collection || !getDocs || !query || !orderBy || !limit) {
        throw new Error('quoteRepository requires Firestore dependencies.');
    }

    const quoteDocRef = (userId, quoteId) => doc(db, 'users', userId, 'quotes', quoteId);
    const revisionsCollectionRef = (userId, quoteId) =>
        collection(db, 'users', userId, 'quotes', quoteId, 'revisions');

    const saveRevisionFallback = async ({
        user,
        quoteId,
        state,
        summary,
        customerInfo,
        status,
        changeNote
    }) => {
        const quoteRef = quoteDocRef(user.uid, quoteId);
        const nowMs = Date.now();
        const quoteSnap = await getDoc(quoteRef);
        const existing = quoteSnap.exists()
            ? normalizeQuoteMetadata(quoteId, quoteSnap.data())
            : {};

        const version = Math.max(1, toNumber(existing.latestVersion, 0) + 1);
        const revisionId = `v${String(version).padStart(4, '0')}_${nowMs}`;
        const revisionRef = doc(db, 'users', user.uid, 'quotes', quoteId, 'revisions', revisionId);
        const revisionData = buildRevisionData({
            quoteId,
            version,
            nowMs,
            user,
            state,
            summary,
            changeNote
        });
        const metadata = buildQuoteMetadata({
            quoteId,
            customerInfo,
            summary,
            status,
            nowMs,
            user,
            latestVersion: version,
            latestRevisionId: revisionId,
            existing
        });

        await setDoc(revisionRef, revisionData);
        await setDoc(quoteRef, metadata, { merge: true });

        return { metadata, revision: { revisionId, ...revisionData } };
    };

    async function saveQuoteRevision({
        user,
        quoteId,
        state,
        summary,
        customerInfo = {},
        status = 'draft',
        changeNote = ''
    }) {
        if (!user?.uid) throw new Error('Missing authenticated user.');
        if (!quoteId) throw new Error('quoteId is required.');

        if (typeof runTransaction !== 'function') {
            return saveRevisionFallback({
                user,
                quoteId,
                state,
                summary,
                customerInfo,
                status,
                changeNote
            });
        }

        const quoteRef = quoteDocRef(user.uid, quoteId);

        return runTransaction(db, async (transaction) => {
            const nowMs = Date.now();
            const snap = await transaction.get(quoteRef);
            const existing = snap.exists()
                ? normalizeQuoteMetadata(quoteId, snap.data())
                : {};

            const version = Math.max(1, toNumber(existing.latestVersion, 0) + 1);
            const revisionId = `v${String(version).padStart(4, '0')}_${nowMs}`;
            const revisionRef = doc(db, 'users', user.uid, 'quotes', quoteId, 'revisions', revisionId);

            const revisionData = buildRevisionData({
                quoteId,
                version,
                nowMs,
                user,
                state,
                summary,
                changeNote
            });
            const metadata = buildQuoteMetadata({
                quoteId,
                customerInfo,
                summary,
                status,
                nowMs,
                user,
                latestVersion: version,
                latestRevisionId: revisionId,
                existing
            });

            transaction.set(revisionRef, revisionData);
            transaction.set(quoteRef, metadata, { merge: true });

            return { metadata, revision: { revisionId, ...revisionData } };
        });
    }

    async function createQuote({
        user,
        state,
        summary,
        customerInfo = {},
        status = 'draft',
        changeNote = 'Initial save'
    }) {
        if (!user?.uid) throw new Error('Missing authenticated user.');
        const quoteId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const saved = await saveQuoteRevision({
            user,
            quoteId,
            state,
            summary,
            customerInfo,
            status,
            changeNote
        });
        return { quoteId, ...saved };
    }

    async function getUserQuotes({ userId, status = '', search = '' }) {
        if (!userId) return [];
        const quotesRef = collection(db, 'users', userId, 'quotes');
        let snap;
        try {
            snap = await getDocs(query(quotesRef, orderBy('updatedAtMs', 'desc')));
        } catch (err) {
            snap = await getDocs(query(quotesRef, orderBy('timestamp', 'desc')));
        }

        const mapped = snap.docs.map((docSnap) =>
            normalizeQuoteMetadata(docSnap.id, docSnap.data() || {})
        );

        const filtered = applyQuoteFilters(mapped, { status, search });
        filtered.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        return filtered;
    }

    async function getQuoteRevisions({ userId, quoteId, limit: limitRows = 5 }) {
        if (!userId || !quoteId) return [];
        const maxRows = Math.max(1, Math.min(100, toNumber(limitRows, 5)));
        const revisionsRef = revisionsCollectionRef(userId, quoteId);
        let snap;

        try {
            snap = await getDocs(query(revisionsRef, orderBy('version', 'desc'), limit(maxRows)));
        } catch (err) {
            snap = await getDocs(query(revisionsRef, orderBy('savedAtMs', 'desc'), limit(maxRows)));
        }

        const rows = snap.docs.map((docSnap) => {
            const raw = docSnap.data() || {};
            return {
                revisionId: docSnap.id,
                quoteId,
                version: Math.max(1, toNumber(raw.version, 1)),
                savedAtMs: toNumber(raw.savedAtMs, toNumber(raw.createdAt, Date.now())),
                savedBy: String(raw.savedBy || ''),
                savedByUid: String(raw.savedByUid || ''),
                state: raw.state || {},
                summary: raw.summary || {
                    finalTotalSek: 0,
                    grossTotalSek: 0,
                    totalDiscountSek: 0
                },
                changeNote: String(raw.changeNote || '')
            };
        });

        rows.sort((a, b) => b.version - a.version);
        return rows;
    }

    async function getQuoteLatestRevision({ userId, quoteId }) {
        if (!userId || !quoteId) return null;
        const quoteRef = quoteDocRef(userId, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        if (!quoteSnap.exists()) return null;

        const metadata = normalizeQuoteMetadata(quoteId, quoteSnap.data() || {});

        if (metadata.latestRevisionId) {
            const revisionRef = doc(
                db,
                'users',
                userId,
                'quotes',
                quoteId,
                'revisions',
                metadata.latestRevisionId
            );
            const revisionSnap = await getDoc(revisionRef);
            if (revisionSnap.exists()) {
                const revisionRaw = revisionSnap.data() || {};
                return {
                    metadata,
                    revision: {
                        revisionId: revisionSnap.id,
                        quoteId,
                        version: Math.max(1, toNumber(revisionRaw.version, metadata.latestVersion || 1)),
                        savedAtMs: toNumber(revisionRaw.savedAtMs, metadata.updatedAtMs),
                        savedBy: String(revisionRaw.savedBy || metadata.savedBy || ''),
                        savedByUid: String(revisionRaw.savedByUid || metadata.savedByUid || ''),
                        state: revisionRaw.state || {},
                        summary: revisionRaw.summary || metadata.summary || {
                            finalTotalSek: metadata.totalSek || 0,
                            grossTotalSek: 0,
                            totalDiscountSek: 0
                        },
                        changeNote: String(revisionRaw.changeNote || '')
                    }
                };
            }
        }

        const rows = await getQuoteRevisions({ userId, quoteId, limit: 1 });
        if (rows.length > 0) return { metadata, revision: rows[0] };

        if (metadata.state) {
            return {
                metadata,
                revision: {
                    revisionId: 'legacy',
                    quoteId,
                    version: metadata.latestVersion || 1,
                    savedAtMs: metadata.updatedAtMs || metadata.createdAtMs || Date.now(),
                    savedBy: metadata.savedBy || '',
                    savedByUid: metadata.savedByUid || '',
                    state: metadata.state || {},
                    summary: metadata.summary || {
                        finalTotalSek: metadata.totalSek || 0,
                        grossTotalSek: 0,
                        totalDiscountSek: 0
                    },
                    changeNote: 'Legacy snapshot'
                }
            };
        }

        return { metadata, revision: null };
    }

    async function updateQuoteStatus({ userId, quoteId, status }) {
        if (!userId || !quoteId) throw new Error('userId and quoteId are required.');
        const quoteRef = quoteDocRef(userId, quoteId);
        const snap = await getDoc(quoteRef);
        if (!snap.exists()) throw new Error('Quote not found.');

        const existing = normalizeQuoteMetadata(quoteId, snap.data() || {});
        const normalizedStatus = normalizeQuoteStatus(status);
        const updatedAtMs = Date.now();
        const searchText = buildQuoteSearchText({
            customerName: existing.customerName,
            company: existing.company,
            reference: existing.reference,
            status: normalizedStatus
        });

        if (typeof updateDoc === 'function') {
            await updateDoc(quoteRef, {
                status: normalizedStatus,
                updatedAtMs,
                searchText
            });
        } else {
            await setDoc(
                quoteRef,
                {
                    status: normalizedStatus,
                    updatedAtMs,
                    searchText
                },
                { merge: true }
            );
        }

        return {
            ...existing,
            status: normalizedStatus,
            updatedAtMs,
            searchText
        };
    }

    async function deleteQuote({ userId, quoteId }) {
        if (!userId || !quoteId) throw new Error('userId and quoteId are required.');
        const quoteRef = quoteDocRef(userId, quoteId);
        const revisionsRef = revisionsCollectionRef(userId, quoteId);
        const revisionsSnap = await getDocs(revisionsRef);

        if (typeof writeBatch === 'function') {
            const batch = writeBatch(db);
            revisionsSnap.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });
            batch.delete(quoteRef);
            await batch.commit();
            return;
        }

        for (const docSnap of revisionsSnap.docs) {
            await deleteDoc(docSnap.ref);
        }
        if (typeof deleteDoc === 'function') {
            await deleteDoc(quoteRef);
            return;
        }
        await setDoc(quoteRef, { deletedAtMs: Date.now() }, { merge: true });
    }

    return {
        createQuote,
        saveQuoteRevision,
        getUserQuotes,
        getQuoteLatestRevision,
        getQuoteRevisions,
        deleteQuote,
        updateQuoteStatus
    };
}
