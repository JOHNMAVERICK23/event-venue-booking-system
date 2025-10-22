document.addEventListener('DOMContentLoaded', function() {
    
    if (document.getElementById('logoutBtn')) {
        
        checkAuth();
        
        initUserDisplay();
        
        initLogout();
        
        initAuthFetch();
    }
});

function checkAuth() {
    const token = localStorage.getItem('adminToken');
    const user = localStorage.getItem('adminUser');
    
    console.log('Token:', token);
    console.log('User:', user);
    
    // Only redirect if BOTH token and user are missing
    if (!token || !user) {
        console.log('No auth found, redirecting to login');
        window.location.href = '/Public/admin/admin-login.html';
        return;
    }
    
    try {
        const parsedUser = JSON.parse(user);
        if (!parsedUser.username) {
            console.log('Invalid user data, redirecting to login');
            window.location.href = '/Public/admin/admin-login.html';
            return;
        }
    } catch (e) {
        console.log('Error parsing user, redirecting to login');
        window.location.href = '/Public/admin/admin-login.html';
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
            
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            
            window.location.href = '/Public/admin/admin-login.html';
        });
    }
}

function initAuthFetch() {
    
    window.authFetch = async (url, options = {}) => {
        const token = localStorage.getItem('adminToken');
        
        if (!options.headers) {
            options.headers = {};
        }
        
        options.headers['Authorization'] = `Bearer ${token}`;
        
        try {
            const response = await fetch(url, options);
           
            if (response.status === 401) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                window.location.href = '/Public/admin/admin-login.html';
                return;
            }
            
            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    };
}

function isTokenValid() {
    const token = localStorage.getItem('adminToken');
    if (!token) return false;
   
    return true;
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('adminUser') || '{}');
}

function hasRole(requiredRole) {
    const user = getCurrentUser();
    return user.role === requiredRole || user.role === 'Administrator';
}

async function refreshToken() {
    try {
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

function startTokenRefresh() {
   
    setInterval(async () => {
        const refreshed = await refreshToken();
        if (!refreshed) {
        
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = '/Public/admin/admin-login.html';
        }
    }, 45 * 60 * 1000);
}

// Initialize token refresh for authenticated sessions
if (localStorage.getItem('adminToken')) {
    startTokenRefresh();
}