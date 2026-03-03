import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, login as firebaseLogin, logout as firebaseLogout } from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange((u) => {
            setUser(u);
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

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
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
