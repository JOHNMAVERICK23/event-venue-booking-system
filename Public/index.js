let currentStep = 1;
let selectedVenue = null;
let venues = [];

const API_BASE = 'https://event-venue-booking-system.onrender.com/api';


function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const termsModal = document.getElementById('termsModal');
    if (!termsModal) return; 

    const closeTerms = document.getElementById('closeTerms');
    const agreeCheckbox = document.getElementById('agreeTerms');
    const acceptButton = document.getElementById('acceptTerms');

    const hasAccepted = sessionStorage.getItem('termsAccepted');

    if (!hasAccepted) {
        termsModal.style.display = 'flex';
    } else {
        termsModal.style.display = 'none'; 
    }

    
    closeTerms.addEventListener('click', function() {
        termsModal.style.display = 'none';
    });

    
    agreeCheckbox.addEventListener('change', function() {
        acceptButton.disabled = !this.checked;
    });

    
    acceptButton.addEventListener('click', function() {
        sessionStorage.setItem('termsAccepted', 'true'); 
        termsModal.style.display = 'none';
    });

   
    termsModal.addEventListener('click', function(e) {
        if (e.target === termsModal) {
            termsModal.style.display = 'none';
        }
    });
});


