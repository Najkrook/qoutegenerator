import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    collectionGroup,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    runTransaction
} from './firebase';
import { createQuoteRepository } from '../services/quoteRepository';

export const quoteRepository = createQuoteRepository({
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    collectionGroup,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    runTransaction
});
