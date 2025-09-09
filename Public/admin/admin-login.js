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
    const alertContainer = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `; 
    alertContainer.insertAdjacentElement('afterbegin', alert);
    setTimeout(() => {
        if (alert.parentNode) {
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
  
  