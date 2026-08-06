import { useEffect, useState } from 'react';
import { Button } from './ui/Button';

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
        <Button
            onClick={toggleTheme}
            aria-label={theme === 'portal-dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
            size="sm"
            variant="ghost"
        >
            {theme === 'portal-dark' ? 'Ljust läge' : 'Mörkt läge'}
        </Button>
    );
}
