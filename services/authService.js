// services/authService.js
import { auth } from './firebase.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import { isFullAccessUser } from '../config/accessControl.shared.js';

/**
 * Get the currently signed-in user (or null).
 */
export function currentUser() {
    return auth.currentUser;
}

/**
 * Sign in with email and password.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out.
 */
export function logout() {
    return signOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Callback receives user (or null if signed out).
 * @returns {Function} unsubscribe function
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Auth gate: redirects to login.html if no user is signed in.
 * Returns a Promise that resolves with the user if authenticated.
 */
export function requireAuth() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                window.location.href = 'login.html';
            }
        });
    });
}

/**
 * True when user has full/admin access.
 */
export function hasFullAccess(user) {
    return isFullAccessUser(user);
}

/**
 * Full-access gate: redirects to login.html if signed out,
 * and to redirectTo if signed in without full access.
 */
export function requireFullAccess({ redirectTo = 'index.html' } = {}) {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            if (!hasFullAccess(user)) {
                window.location.href = redirectTo;
                return;
            }

            resolve(user);
        });
    });
}
