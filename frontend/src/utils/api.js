import axios from 'axios';

// Get API base URL from environment variable or use proxy in development
const getApiBaseUrl = () => {
    // In development, use proxy (empty string to use relative paths)
    if (import.meta.env.DEV) {
        return '';
    }

    // In production, use environment variable or fallback
    return import.meta.env.VITE_API_URL || 'https://tutor-arc.onrender.com';
};

// Create axios instance with base URL
const apiClient = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

export default apiClient;

