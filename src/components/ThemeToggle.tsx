import { useEffect, useState } from 'react';

type ThemeId = 'portal-dark' | 'brixx-light';

function getStoredTheme(): ThemeId {
    try {
        const storedTheme = globalThis.localStorage?.getItem('quote-generator-theme');
        return storedTheme === 'brixx-light' ? 'brixx-light' : 'portal-dark';
    } catch {
        return 'portal-dark';
    }
}

function persistTheme(theme: ThemeId): void {
    try {
        globalThis.localStorage?.setItem('quote-generator-theme', theme);
    } catch {
        // Storage can be unavailable during server-style test renders.
    }
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<ThemeId>(getStoredTheme);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        persistTheme(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'portal-dark' ? 'brixx-light' : 'portal-dark');
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Toggle theme"
            title={theme === 'portal-dark' ? 'Switch to Brixx Light Theme' : 'Switch to Portal Dark Theme'}
        >
            {theme === 'portal-dark' ? (
                // Sun Icon
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 21v-2.25m-6.364-.386 1.591-1.591M3 12h2.25m.386-6.364 1.591 1.591M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
            ) : (
                // Moon Icon
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
            )}
        </button>
    );
}
