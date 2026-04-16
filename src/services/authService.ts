import type { AccessUser, AuthChangeUser } from '../types/contracts';
import { auth, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'firebase/auth';

export async function createRetailerAuthUser(email: string, password: string) {
    const secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuthApp_' + Date.now());
    try {
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await signOut(secondaryAuth);
        return userCredential.user.uid;
    } finally {
        await deleteApp(secondaryApp);
    }
}

export function currentUser() {
    return auth.currentUser;
}

export function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
    return signOut(auth);
}

function toAccessUser(user: AuthChangeUser | null): AccessUser | null {
    if (!user) {
        return null;
    }

    return {
        uid: user.uid,
        email: user.email
    };
}

export function onAuthChange(callback: (user: AccessUser | null) => void) {
    return onAuthStateChanged(auth, (user) => {
        callback(toAccessUser(user));
    });
}
