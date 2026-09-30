import { writable } from 'svelte/store';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'dark';
    try {
        const saved = localStorage.getItem('ziqva-theme') as Theme | null;
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (e) {
        return 'dark';
    }
}

const initial = getInitialTheme();
export const theme = writable<Theme>(initial);

export function toggleTheme(): void {
    theme.update(current => {
        const next: Theme = current === 'dark' ? 'light' : 'dark';
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('ziqva-theme', next);
                document.documentElement.setAttribute('data-theme', next);
                if (next === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } catch (e) {}
        }
        return next;
    });
}

export function setTheme(next: Theme): void {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('ziqva-theme', next);
            document.documentElement.setAttribute('data-theme', next);
            if (next === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch (e) {}
    }
    theme.set(next);
}

// Global hook
if (typeof window !== 'undefined') {
    (window as unknown as { toggleTheme: () => void }).toggleTheme = toggleTheme;
}
