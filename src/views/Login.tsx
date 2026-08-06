import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../store/AuthContext';
import { getErrorCode } from '../utils/runtime';
import { Button } from '../components/ui/Button';

export function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setErrorMsg('');
        setLoading(true);

        try {
            await login(email, password);
            // Auth route handling will redirect to the requested URL or dashboard.
        } catch (error) {
            console.error('Firebase Auth Error:', error);
            const authErrorCode = getErrorCode(error);

            let message = 'Inloggningen misslyckades.';
            if (
                authErrorCode === 'auth/invalid-credential'
                || authErrorCode === 'auth/wrong-password'
                || authErrorCode === 'auth/user-not-found'
            ) {
                message = 'Fel e-post eller lösenord.';
            } else if (authErrorCode === 'auth/too-many-requests') {
                message = 'För många försök. Vänta en stund och försök igen.';
            } else {
                message = 'Ett tekniskt fel uppstod. Försök igen om en stund.';
            }

            setErrorMsg(message);
            setLoading(false);
        }
    };

    const handleEmailChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setErrorMsg('');
        setEmail(event.target.value);
    };

    const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setErrorMsg('');
        setPassword(event.target.value);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg text-text-primary p-4 font-sans antialiased">
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-8 shadow-panel sm:p-10">
                <div className="text-center mb-8">
                    <div className="text-3xl font-bold text-brand tracking-widest">BRIXX</div>
                </div>
                <h1 className="text-2xl font-semibold mb-1 text-text-primary">Offertverktyg</h1>
                <p className="text-text-secondary text-sm mb-8">Logga in för att fortsätta.</p>

                {errorMsg && (
                    <div
                        id="login-error"
                        role="alert"
                        aria-live="assertive"
                        className="mb-6 rounded-control border border-danger/35 bg-danger-bg px-4 py-3 text-sm text-danger-text"
                    >
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
                            name="email"
                            placeholder="namn@brixx.se"
                            required
                            autoComplete="email"
                            aria-describedby={errorMsg ? 'login-error' : undefined}
                            aria-invalid={Boolean(errorMsg)}
                            value={email}
                            onChange={handleEmailChange}
                            className="w-full rounded-control border border-control-border bg-input px-4 py-3 text-base text-text transition-colors placeholder:text-text-muted"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1.5" htmlFor="password">
                            Lösenord
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                placeholder="********"
                                required
                                autoComplete="current-password"
                                aria-describedby={errorMsg ? 'login-error' : undefined}
                                aria-invalid={Boolean(errorMsg)}
                                value={password}
                                onChange={handlePasswordChange}
                                className="w-full rounded-control border border-control-border bg-input px-4 py-3 pr-20 text-base text-text transition-colors placeholder:text-text-muted"
                            />
                            <Button
                                aria-controls="password"
                                aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
                                onClick={() => setShowPassword((visible) => !visible)}
                                className="absolute inset-y-1.5 right-1.5 min-h-0"
                                size="sm"
                                variant="ghost"
                            >
                                {showPassword ? 'Dölj' : 'Visa'}
                            </Button>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full"
                        size="lg"
                        variant="primary"
                    >
                        {loading ? 'Loggar in...' : 'Logga in'}
                    </Button>
                </form>

                <hr className="border-t border-panel-border my-6" />
                <p className="text-center text-xs text-text-secondary m-0">
                    BRIXX Europe AB &middot; Offertverktyg v3
                </p>
            </div>
        </div>
    );
}
