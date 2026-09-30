import { writable } from 'svelte/store';

export interface UserProfile {
    name: string;
    email: string;
    avatar?: string;
}

export interface AdminProfile {
    id: number;
    username: string;
}

export interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    loading: boolean;
}

export interface AdminAuthState {
    admin: AdminProfile | null;
    isAuthenticated: boolean;
    loading: boolean;
}

export const auth = writable<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true
});

export const adminAuth = writable<AdminAuthState>({
    admin: null,
    isAuthenticated: false,
    loading: true
});

export async function checkSession(): Promise<boolean> {
    try {
        const res = await fetch('/member/api/session', {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
                auth.set({
                    user: data.user,
                    isAuthenticated: true,
                    loading: false
                });
                return true;
            }
        }
    } catch (e) {
        console.error('Member session check failed:', e);
    }

    auth.set({
        user: null,
        isAuthenticated: false,
        loading: false
    });
    return false;
}

export async function checkAdminSession(): Promise<boolean> {
    try {
        const res = await fetch('/admin/api/session', {
            headers: { 'Accept': 'application/json' },
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.admin) {
                adminAuth.set({
                    admin: data.admin,
                    isAuthenticated: true,
                    loading: false
                });
                return true;
            }
        }
    } catch (e) {
        console.error('Admin session check failed:', e);
    }

    adminAuth.set({
        admin: null,
        isAuthenticated: false,
        loading: false
    });
    return false;
}

export async function logout(): Promise<void> {
    try {
        await fetch('/member/logout', { credentials: 'include' });
    } catch (e) {}
    auth.set({
        user: null,
        isAuthenticated: false,
        loading: false
    });
    window.location.hash = '/member/login';
}

export async function adminLogout(): Promise<void> {
    try {
        await fetch('/admin/logout', { credentials: 'include' });
    } catch (e) {}
    adminAuth.set({
        admin: null,
        isAuthenticated: false,
        loading: false
    });
    window.location.hash = '/admin/login';
}
