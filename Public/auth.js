document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the dashboard page
    if (document.getElementById('logoutBtn')) {
        // Check authentication
        checkAuth();
        
        // Initialize authenticated user display
        initUserDisplay();
        
        // Initialize logout functionality
        initLogout();
        
        // Initialize authenticated fetch wrapper
        initAuthFetch();
    }
});

function checkAuth() {
    const token = localStorage.getItem('adminToken');
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    
    if (!token || !user.username) {
        // Redirect to login page if not authenticated
        window.location.href = 'index.html';
        return;
    }
}

function initUserDisplay() {
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    const currentUserElement = document.getElementById('currentUser');
    
    if (currentUserElement && user.username) {
        currentUserElement.textContent = `Welcome, ${user.username} (${user.role || 'Administrator'})`;
    }
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Clear authentication data
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            
            // Redirect to public site
            window.location.href = 'admin/admin-login.html';
        });
    }
}

function initAuthFetch() {
    // Create authenticated fetch wrapper
    window.authFetch = async (url, options = {}) => {
        const token = localStorage.getItem('adminToken');
        
        if (!options.headers) {
            options.headers = {};
        }
        
        // Add authorization header
        options.headers['Authorization'] = `Bearer ${token}`;
        
        try {
            const response = await fetch(url, options);
            
            // Check if token is expired or invalid
            if (response.status === 401) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                window.location.href = 'index.html';
                return;
            }
            
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };
}

// Login functionality for public site
function handlePublicLogin(username, password) {
    return new Promise((resolve, reject) => {
        // Mock authentication - in real app, call your backend API
        setTimeout(() => {
            if (username === 'admin' && password === 'admin123') {
                const token = 'mock-token-' + Date.now();
                const user = {
                    username: 'admin',
                    fullName: 'Administrator',
                    role: 'Administrator',
                    email: 'admin@cityofdreams.com'
                };
                
                localStorage.setItem('adminToken', token);
                localStorage.setItem('adminUser', JSON.stringify(user));
                
                resolve({ token, user });
            } else {
                reject(new Error('Invalid credentials'));
            }
        }, 1000);
    });
}

// Token validation
function isTokenValid() {
    const token = localStorage.getItem('adminToken');
    if (!token) return false;
    
    // In a real application, you would validate the token with your backend
    // For demo purposes, we'll just check if it exists
    return true;
}

// Get current user
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('adminUser') || '{}');
}

// Check if user has specific role
function hasRole(requiredRole) {
    const user = getCurrentUser();
    return user.role === requiredRole || user.role === 'Administrator';
}

// Refresh token (for real applications)
async function refreshToken() {
    try {
        // In a real app, call your refresh token endpoint
        const response = await fetch('/api/refresh-token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('adminToken', data.token);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
    }
}

// Auto-refresh token before expiry (for real applications)
function startTokenRefresh() {
    // Refresh token every 45 minutes (assuming 1-hour expiry)
    setInterval(async () => {
        const refreshed = await refreshToken();
        if (!refreshed) {
            // Force logout if refresh fails
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'index.html';
        }
    }, 45 * 60 * 1000); // 45 minutes
}

// Initialize token refresh for authenticated sessions
if (localStorage.getItem('adminToken')) {
    // Uncomment for production with real backend
    startTokenRefresh();
}