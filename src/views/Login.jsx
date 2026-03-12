import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';

export function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setLoading(true);

        try {
            await login(email, password);
            // onAuthChange in App will handle redirect to step 0
        } catch (err) {
            console.error('Firebase Auth Error:', err);
            let msg = 'Inloggningen misslyckades.';
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                msg = 'Fel e-post eller lösenord.';
            } else if (err.code === 'auth/user-not-found') {
                msg = 'Ingen användare hittades med den e-posten.';
            } else if (err.code === 'auth/too-many-requests') {
                msg = 'För många försök. Vänta en stund och försök igen.';
            } else {
                msg = `Systemfel: ${err.code || err.message}`;
            }
            setErrorMsg(msg);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-text-primary p-4 font-sans antialiased">
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-10 w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    <div className="text-3xl font-bold text-primary tracking-widest">BRIXX</div>
                </div>
                <h1 className="text-2xl font-semibold mb-1 text-text-primary">Offertverktyg</h1>
                <p className="text-text-secondary text-sm mb-8">Logga in för att fortsätta.</p>

                {errorMsg && (
                    <div className="bg-red-500/15 border border-red-500/30 text-red-500 px-4 py-3 rounded-md text-sm mb-6">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5" htmlFor="email">
                            E-post
                        </label>
                        <input
                            type="email"
                            id="email"
                            placeholder="namn@brixx.se"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 text-base bg-bg border border-panel-border rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5" htmlFor="password">
                            Lösenord
                        </label>
                        <input
                            type="password"
                            id="password"
                            placeholder="********"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 text-base bg-bg border border-panel-border rounded-lg text-text-primary focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-gradient-to-br from-primary to-[#e67e22] hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all mt-2"
                    >
                        {loading ? 'Loggar in...' : 'Logga in'}
                    </button>
                </form>

                <hr className="border-t border-panel-border my-6" />
                <p className="text-center text-xs text-text-secondary m-0">
                    BRIXX Europe AB &middot; Offertverktyg v3
                </p>
            </div>
        </div>
    );
}
