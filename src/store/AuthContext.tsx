import React, { createContext, useContext, useState, useEffect, type PropsWithChildren } from 'react';
import type { AccessLevel, AccessUser, AuthContextValue, RetailerRecord } from '../types/contracts';
import { onAuthChange, login as firebaseLogin, logout as firebaseLogout } from '../services/authService';
import { ACCESS_LEVELS, getAccessCapabilities, resolveAccessLevelFromUser } from '../config/accessControl.shared';
import { db, doc, getDoc, collection, query, where, limit, getDocs } from '../services/firebase';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
    const [user, setUser] = useState<AccessUser | null>(null);
    const [accessLevel, setAccessLevel] = useState<AccessLevel>(ACCESS_LEVELS.GUEST);
    const [retailer, setRetailer] = useState<RetailerRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange(async (u: AccessUser | null) => {
            setLoading(true);
            setUser(u);
            setRetailer(null);

            let resolvedLevel: AccessLevel = ACCESS_LEVELS.GUEST;

            if (u) {
                let roleDocFetched = false;

                try {
                    const roleRef = doc(db, 'user_roles', u.uid);
                    const roleSnap = await getDoc(roleRef);
                    
                    if (roleSnap.exists()) {
                        roleDocFetched = true;
                        const data = roleSnap.data();
                        
                        if (data.role === 'admin') {
                            resolvedLevel = ACCESS_LEVELS.FULL;
                        } else if (data.role === 'sketch_only') {
                            resolvedLevel = ACCESS_LEVELS.SKETCH_ONLY;
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch user role:', err);
                }

                // Phase 1 Fallback if doc is missing, unreadable, or malformed
                if (!roleDocFetched) {
                    resolvedLevel = resolveAccessLevelFromUser(u);
                }

                // If not an admin or sketch_only, check if they are a retailer
                if (resolvedLevel !== ACCESS_LEVELS.FULL && resolvedLevel !== ACCESS_LEVELS.SKETCH_ONLY && u.email) {
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
                
                // If they are logged in but didn't match anything else, they are QUOTE_ONLY
                if (resolvedLevel === ACCESS_LEVELS.GUEST) {
                    resolvedLevel = ACCESS_LEVELS.QUOTE_ONLY;
                }
            }

            setAccessLevel(resolvedLevel);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email: string, password: string) => {
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

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
