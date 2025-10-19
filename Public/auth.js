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
    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    
    if (!token || !user.username) {
        
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
            
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            
            
            window.location.href = 'admin/admin-login.html';
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

function handlePublicLogin(username, password) {
    return new Promise((resolve, reject) => {
       
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
            window.location.href = 'index.html';
        }
    }, 45 * 60 * 1000); 
}

// Initialize token refresh for authenticated sessions
if (localStorage.getItem('adminToken')) {
    // Uncomment for production with real backend
    startTokenRefresh();
}