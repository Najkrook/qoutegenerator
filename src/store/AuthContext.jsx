import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, login as firebaseLogin, logout as firebaseLogout } from '../services/authService';
import { ACCESS_LEVELS, getAccessCapabilities, resolveAccessLevelFromUser } from '../config/accessControl.shared.js';
import { db, collection, query, where, limit, getDocs } from '../services/firebase';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessLevel, setAccessLevel] = useState(ACCESS_LEVELS.GUEST);
    const [retailer, setRetailer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange(async (u) => {
            setLoading(true);
            setUser(u);
            setRetailer(null);

            let resolvedLevel = resolveAccessLevelFromUser(u);

            if (u && resolvedLevel !== ACCESS_LEVELS.FULL && u.email) {
                try {
                    const emailLower = u.email.toLowerCase();
                    const retailersRef = collection(db, 'retailers');
                    const q = query(retailersRef, where('email', '==', emailLower), limit(1));
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const docSnap = snap.docs[0];
                        setRetailer({ id: docSnap.id, ...docSnap.data() });
                        resolvedLevel = ACCESS_LEVELS.RETAILER;
                    }
                } catch (err) {
                    console.error('Failed to load retailer profile:', err);
                }
            }

            setAccessLevel(resolvedLevel);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        return firebaseLogin(email, password);
    };

    const logout = async () => {
        return firebaseLogout();
    };

    const {
        canViewEverything,
        canStartQuote,
        canAccessSketch,
        canAccessQuoteHistory,
        canExportSketchToQuote
    } = getAccessCapabilities(accessLevel);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            accessLevel,
            canViewEverything,
            canStartQuote,
            canAccessSketch,
            canAccessQuoteHistory,
            canExportSketchToQuote,
            login,
            logout,
            retailer,
            isRetailer: accessLevel === ACCESS_LEVELS.RETAILER
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
