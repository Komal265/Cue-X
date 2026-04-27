const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export function getToken(): string | null {
    return localStorage.getItem('auth_token');
}

export function setToken(token: string) {
    localStorage.setItem('auth_token', token);
}

export function removeToken() {
    localStorage.removeItem('auth_token');
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Default to JSON if not explicitly sending FormData
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Token expired or invalid
        removeToken();
        // Redirect to login if we are not already there
        if (window.location.pathname !== '/auth') {
            window.location.href = '/auth';
        }
    }

    return response;
}

export function getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
