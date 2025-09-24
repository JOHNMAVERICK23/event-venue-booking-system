const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
});

function showAdminLogin() {
    const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
    modal.show();
}
function checkAdminAccess() {
    const token = localStorage.getItem('adminToken');
    if (token) {
        window.location.href = '/dashboard.html';
    } else {
        showAdminLogin();
    }
}
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    
    const loginBtn = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');
    
    loginBtn.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        const response = await fetch(`${API_BASE}/login`, {

            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            
            window.location.href = '/dashboard.html';
        } else {
            const errorData = await response.json();
            showAlert('danger', errorData.error || 'Invalid username or password');
        }
    } catch (error) {
        showAlert('danger', 'Login error. Please try again.');
        console.error('Login error:', error);
    } finally {
        loginBtn.style.display = 'inline';
        spinner.style.display = 'none';
    }
}
function initEventListeners() {
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
}

function showAlert(type, message) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.custom-alert');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create new alert
    const alert = document.createElement('div');
    alert.className = `custom-alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button type="button" class="alert-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add styles if not exists
    if (!document.querySelector('#alert-styles')) {
        const styles = document.createElement('style');
        styles.id = 'alert-styles';
        styles.textContent = `
            .custom-alert {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-width: 300px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .alert-danger { background-color: #dc3545; }
            .alert-success { background-color: #28a745; }
            .alert-warning { background-color: #ffc107; color: #000; }
            .alert-close {
                background: none;
                border: none;
                color: inherit;
                font-size: 20px;
                cursor: pointer;
                margin-left: 15px;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(alert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

document.addEventListener("DOMContentLoaded", () => {
    const passwordInput = document.getElementById("adminPassword");
    const togglePassword = document.getElementById("togglePassword");
  
    togglePassword.addEventListener("change", () => {
      passwordInput.type = togglePassword.checked ? "text" : "password";
    });
  });
  
  