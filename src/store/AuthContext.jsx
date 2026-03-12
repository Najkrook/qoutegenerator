import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, login as firebaseLogin, logout as firebaseLogout } from '../services/authService';
import { canAccessQuoteHistoryLevel, resolveAccessLevelFromUser } from '../config/accessControl.shared.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [accessLevel, setAccessLevel] = useState('guest');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange((u) => {
            setLoading(true);
            setUser(u);
            const resolvedLevel = resolveAccessLevelFromUser(u);
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

    const canViewEverything = accessLevel === 'full';
    const canStartQuote = accessLevel === 'full' || accessLevel === 'quote-only';
    const canAccessSketch = accessLevel === 'full' || accessLevel === 'sketch-only';
    const canAccessQuoteHistory = canAccessQuoteHistoryLevel(accessLevel);
    const canExportSketchToQuote = accessLevel === 'full';

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
            logout
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
