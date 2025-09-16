let currentStep = 1;
let selectedVenue = null;
let venues = [];

// API base URL - adjust this based on your server
const API_BASE = 'http://localhost:3000/api';


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
    if (!termsModal) return; // kung walang modal sa page, wag na mag run

    const closeTerms = document.getElementById('closeTerms');
    const agreeCheckbox = document.getElementById('agreeTerms');
    const acceptButton = document.getElementById('acceptTerms');

    // Check kung naka-accept na
    const hasAccepted = sessionStorage.getItem('termsAccepted');

    if (!hasAccepted) {
        // Show modal kung hindi pa naka-accept
        termsModal.style.display = 'flex';
    } else {
        termsModal.style.display = 'none'; // siguraduhin na hindi mag show
    }

    // Close modal when X is clicked
    closeTerms.addEventListener('click', function() {
        termsModal.style.display = 'none';
    });

    // Enable accept button when checkbox is checked
    agreeCheckbox.addEventListener('change', function() {
        acceptButton.disabled = !this.checked;
    });

    // Close modal when accept button is clicked
    acceptButton.addEventListener('click', function() {
        sessionStorage.setItem('termsAccepted', 'true'); // Save acceptance
        termsModal.style.display = 'none';
    });

    // Close modal if clicked outside of content
    termsModal.addEventListener('click', function(e) {
        if (e.target === termsModal) {
            termsModal.style.display = 'none';
        }
    });
});


