#!/usr/bin/env node

/**
 * Backfills quote metadata fields for legacy quote documents.
 *
 * Usage:
 *   node scripts/backfill-quote-metadata.mjs
 *
 * Auth:
 *   - Preferred: GOOGLE_APPLICATION_CREDENTIALS
 *   - Optional: FIREBASE_SERVICE_ACCOUNT_JSON=<path-to-service-account.json>
 */

import fs from 'node:fs';
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const STATUS_VALUES = new Set(['draft', 'sent', 'won', 'lost', 'archived']);

function normalizeStatus(value) {
    const normalized = String(value || '').toLowerCase();
    return STATUS_VALUES.has(normalized) ? normalized : 'draft';
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSearchText({ customerName = '', company = '', reference = '', status = 'draft' } = {}) {
    return [customerName, company, reference, normalizeStatus(status)]
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}

function resolveAdminCredentials() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        return cert(serviceAccount);
    }
    return applicationDefault();
}

function normalizeMetadata(quoteId, raw = {}) {
    const customerInfo = raw.state?.customerInfo || {};
    const customerName = String(raw.customerName || customerInfo.name || 'Okand kund');
    const company = String(raw.company || customerInfo.company || '');
    const reference = String(raw.reference || customerInfo.reference || '-');
    const status = normalizeStatus(raw.status);
    const timestampMs = toNumber(Date.parse(raw.timestamp || ''), Date.now());
    const createdAtMs = toNumber(raw.createdAtMs, timestampMs);
    const updatedAtMs = toNumber(raw.updatedAtMs, timestampMs);
    const latestVersion = Math.max(1, toNumber(raw.latestVersion, raw.state ? 1 : 0));
    const totalSek = toNumber(raw.totalSek, toNumber(raw.summary?.finalTotalSek, 0));
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
        searchText: buildSearchText({ customerName, company, reference, status })
    };
}

async function run() {
    initializeApp({ credential: resolveAdminCredentials() });
    const db = getFirestore();

    const usersSnap = await db.collection('users').get();
    let updatedDocs = 0;
    let scannedDocs = 0;

    for (const userDoc of usersSnap.docs) {
        const quotesSnap = await userDoc.ref.collection('quotes').get();
        if (quotesSnap.empty) continue;

        for (const quoteDoc of quotesSnap.docs) {
            scannedDocs += 1;
            const normalized = normalizeMetadata(quoteDoc.id, quoteDoc.data() || {});
            const current = quoteDoc.data() || {};

            const patch = {};
            for (const [key, value] of Object.entries(normalized)) {
                const hasKey = Object.prototype.hasOwnProperty.call(current, key);
                if (!hasKey || current[key] === null || current[key] === undefined || current[key] === '') {
                    patch[key] = value;
                }
            }

            if (Object.keys(patch).length === 0) continue;
            await quoteDoc.ref.set(patch, { merge: true });
            updatedDocs += 1;
        }
    }

    console.log(`Scan complete. Scanned: ${scannedDocs}, updated: ${updatedDocs}`);
}

run().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
