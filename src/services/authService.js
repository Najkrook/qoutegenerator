import { auth, firebaseConfig } from './firebase.js';
import { initializeApp, deleteApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'firebase/auth';

export async function createRetailerAuthUser(email, password) {
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

export function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
    return signOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}
