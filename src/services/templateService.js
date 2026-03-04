import {
    db,
    collection,
    collectionGroup,
    doc,
    getDocs,
    addDoc,
    deleteDoc
} from './firebase.js';

function sortByCreatedAtDesc(templates) {
    return templates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Fetch templates for a specific user.
 */
export async function fetchUserTemplates(uid) {
    if (!uid) return [];
    try {
        const colRef = collection(db, 'users', uid, 'templates');
        const snapshot = await getDocs(colRef);
        const templates = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
        }));
        return sortByCreatedAtDesc(templates);
    } catch (err) {
        console.error('[templateService] fetchUserTemplates failed:', err);
        return [];
    }
}

/**
 * Fetch ALL users' templates (admin only).
 * Uses collectionGroup to query across all user template subcollections.
 */
export async function fetchAllTemplates() {
    try {
        const snapshot = await getDocs(collectionGroup(db, 'templates'));
        const templates = snapshot.docs.map((d) => ({
            id: d.id,
            ownerUid: d.ref.parent.parent?.id || 'unknown',
            ...d.data()
        }));
        return sortByCreatedAtDesc(templates);
    } catch (err) {
        console.error('[templateService] fetchAllTemplates failed:', err);
        return [];
    }
}

/**
 * Save a new template for the given user.
 */
export async function saveTemplate(uid, label, body, email) {
    const colRef = collection(db, 'users', uid, 'templates');
    const docRef = await addDoc(colRef, {
        label,
        body,
        ownerUid: uid,
        ownerEmail: email || '',
        createdAt: new Date().toISOString()
    });
    return docRef.id;
}

/**
 * Delete a template for the given user.
 */
export async function deleteTemplate(uid, templateId) {
    const docRef = doc(db, 'users', uid, 'templates', templateId);
    await deleteDoc(docRef);
}
