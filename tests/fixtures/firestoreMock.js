function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function split(path) {
    return String(path || '').split('/').filter(Boolean);
}

function isDirectChild(collectionPath, docPath) {
    const a = split(collectionPath);
    const b = split(docPath);
    if (b.length !== a.length + 1) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function createDocSnap(path, data) {
    const parts = split(path);
    const id = parts[parts.length - 1] || '';
    return {
        id,
        ref: { path },
        data: () => clone(data)
    };
}

export function createFirestoreMock(initialDocs = {}) {
    const docs = new Map();
    const listeners = new Set();
    Object.entries(initialDocs).forEach(([path, data]) => {
        docs.set(path, clone(data));
    });

    const db = { __mock: true };

    async function resolveSnapshot(refOrQuery) {
        if (refOrQuery?.kind === 'query' || refOrQuery?.kind === 'collection' || refOrQuery?.kind === 'collectionGroup') {
            return api.getDocs(refOrQuery);
        }

        return api.getDoc(refOrQuery);
    }

    async function notifyListeners() {
        for (const listener of listeners) {
            const snapshot = await resolveSnapshot(listener.refOrQuery);
            listener.onNext(snapshot);
        }
    }

    const api = {
        db,
        doc: (_db, ...segments) => ({ path: segments.join('/') }),
        collection: (_db, ...segments) => ({ path: segments.join('/'), kind: 'collection' }),
        collectionGroup: (_db, collectionId) => ({ path: collectionId, kind: 'collectionGroup', collectionId }),
        orderBy: (field, direction = 'asc') => ({ kind: 'orderBy', field, direction }),
        where: (field, op, value) => ({ kind: 'where', field, op, value }),
        limit: (size) => ({ kind: 'limit', size }),
        startAfter: (...values) => ({ kind: 'startAfter', values }),
        query: (collectionRef, ...constraints) => ({
            path: collectionRef.path,
            kind: 'query',
            constraints,
            isGroup: collectionRef.kind === 'collectionGroup',
            collectionId: collectionRef.collectionId
        }),
        async getDoc(ref) {
            const value = docs.get(ref.path);
            return {
                exists: () => value !== undefined,
                data: () => clone(value)
            };
        },
        async setDoc(ref, payload, options = {}) {
            const prev = docs.get(ref.path);
            if (options.merge && prev && typeof prev === 'object' && typeof payload === 'object') {
                docs.set(ref.path, { ...clone(prev), ...clone(payload) });
                await notifyListeners();
                return;
            }
            docs.set(ref.path, clone(payload));
            await notifyListeners();
        },
        async updateDoc(ref, payload) {
            const prev = docs.get(ref.path) || {};
            docs.set(ref.path, { ...clone(prev), ...clone(payload) });
            await notifyListeners();
        },
        async deleteDoc(ref) {
            docs.delete(ref.path);
            await notifyListeners();
        },
        writeBatch: () => {
            const ops = [];
            return {
                set(ref, payload, options = {}) {
                    ops.push({ type: 'set', ref, payload, options });
                },
                delete(ref) {
                    ops.push({ type: 'delete', ref });
                },
                async commit() {
                    for (const op of ops) {
                        if (op.type === 'set') await api.setDoc(op.ref, op.payload, op.options);
                        if (op.type === 'delete') await api.deleteDoc(op.ref);
                    }
                }
            };
        },
        async runTransaction(_dbRef, callback) {
            const ops = [];
            const transaction = {
                async get(ref) {
                    return api.getDoc(ref);
                },
                set(ref, payload, options = {}) {
                    ops.push({ ref, payload, options });
                }
            };
            const result = await callback(transaction);
            for (const op of ops) {
                await api.setDoc(op.ref, op.payload, op.options);
            }
            return result;
        },
        async getDocs(refOrQuery) {
            const path = refOrQuery.path;
            const constraints = refOrQuery.constraints || [];
            const isGroup = refOrQuery.kind === 'collectionGroup' || refOrQuery.isGroup;
            const collectionId = refOrQuery.collectionId;
            const rows = [];

            for (const [docPath, data] of docs.entries()) {
                if (isGroup && collectionId) {
                    // collectionGroup: match any doc whose parent collection name matches
                    const parts = split(docPath);
                    if (parts.length >= 2 && parts[parts.length - 2] === collectionId) {
                        const snap = createDocSnap(docPath, data);
                        const grandParentId = parts.length >= 3 ? parts[parts.length - 3] : 'unknown';
                        snap.ref = {
                            path: docPath,
                            parent: {
                                path: parts.slice(0, -1).join('/'),
                                parent: { id: grandParentId }
                            }
                        };
                        rows.push(snap);
                    }
                } else {
                    if (!isDirectChild(path, docPath)) continue;
                    rows.push(createDocSnap(docPath, data));
                }
            }

            for (const constraint of constraints) {
                if (constraint.kind === 'orderBy') {
                    const dir = constraint.direction === 'desc' ? -1 : 1;
                    rows.sort((a, b) => {
                        const av = Number(a.data()?.[constraint.field]) || 0;
                        const bv = Number(b.data()?.[constraint.field]) || 0;
                        if (av === bv) return 0;
                        return av > bv ? dir : -dir;
                    });
                }
                if (constraint.kind === 'where') {
                    const { field, op, value } = constraint;
                    if (op === '==') {
                        for (let index = rows.length - 1; index >= 0; index -= 1) {
                            if (rows[index].data()?.[field] !== value) {
                                rows.splice(index, 1);
                            }
                        }
                    }
                }
                if (constraint.kind === 'limit') {
                    rows.splice(constraint.size);
                }
            }

            return {
                docs: rows,
                empty: rows.length === 0,
                forEach: (fn) => rows.forEach(fn)
            };
        },
        onSnapshot(refOrQuery, onNext, onError) {
            const listener = { refOrQuery, onNext, onError };
            listeners.add(listener);
            resolveSnapshot(refOrQuery).then(onNext).catch((error) => {
                if (typeof onError === 'function') {
                    onError(error);
                }
            });

            return () => {
                listeners.delete(listener);
            };
        }
    };

    return {
        ...api,
        __docs: docs
    };
}
