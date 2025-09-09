let currentStep = 1;
let selectedVenue = null;
let venues = [];

// API base URL - adjust this based on your server
const API_BASE = 'http://localhost:3000/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').min = today;

    // Initialize event listeners
    initEventListeners();
    
    // Load venues from API
    loadVenuesFromAPI();
    
    // Show home section by default
    showSection('home');
});

async function loadVenuesFromAPI() {
    try {
        // For public site, we don't need authentication to view venues
        const response = await fetch(`${API_BASE}/venues`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const apiVenues = await response.json();
            venues = apiVenues;
            
            // Update venue select dropdown
            const venueSelect = document.getElementById('venueSelect');
            venueSelect.innerHTML = '<option value="">Select a venue</option>';
            
            apiVenues.forEach(venue => {
                const option = document.createElement('option');
                option.value = venue.venue_id;
                option.textContent = `${venue.venue_name} (${venue.capacity} guests) - ₱${venue.hourly_rate.toLocaleString()}/hr`;
                venueSelect.appendChild(option);
            });
            
            // Update static venue cards if they exist
            updateVenueCards(apiVenues);
        } else {
            console.warn('Failed to load venues from API, using fallback data');
            // Fallback to static venues
            venues = [
                { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
                { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
                { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
            ];
        }
    } catch (error) {
        console.error('Error loading venues:', error);
        // Use fallback venues
        venues = [
            { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
            { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
            { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
        ];
    }
}

function updateVenueCards(apiVenues) {
    // Update the venue cards in the venues section if they exist
    const venueCards = document.querySelectorAll('.venue-card');
    venueCards.forEach((card, index) => {
        if (apiVenues[index]) {
            const venue = apiVenues[index];
            const nameElement = card.querySelector('.venue-name');
            const detailsElement = card.querySelector('.venue-details');
            const priceElement = card.querySelector('.venue-price');
            const button = card.querySelector('button');
            
            if (nameElement) nameElement.textContent = venue.venue_name;
            if (priceElement) priceElement.textContent = `₱${venue.hourly_rate.toLocaleString()}/hour`;
            if (detailsElement) {
                detailsElement.innerHTML = `
                    <i class="bi bi-people"></i> Capacity: ${venue.capacity} guests<br>
                    <i class="bi bi-geo-alt"></i> ${venue.location || 'Main Building'}<br>
                    <i class="bi bi-check-circle"></i> ${venue.amenities || 'Full service available'}
                `;
            }
            if (button) {
                button.onclick = () => selectVenue(venue.venue_id, venue.venue_name);
            }
        }
    });
}

function initEventListeners() {
    // Check availability button
    document.getElementById('checkAvailabilityBtn').addEventListener('click', checkAvailability);

    // Form submission
    document.getElementById('bookingForm').addEventListener('submit', submitBooking);

    // Real-time validation
    document.getElementById('expectedGuests').addEventListener('input', validateGuestCapacity);
    document.getElementById('venueSelect').addEventListener('change', updateVenueSelection);
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.hero-section, .content-section').forEach(section => {
        if (section.id === 'home-section') {
            section.style.display = sectionName === 'home' ? 'block' : 'none';
        } else {
            section.classList.add('section-hidden');
        }
    });

    // Show selected section
    if (sectionName !== 'home') {
        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.remove('section-hidden');
        }
    }

    // Special handling for booking section
    if (sectionName === 'booking') {
        resetBookingForm();
    }
}

// Venue selection
function selectVenue(venueId, venueName) {
    selectedVenue = { id: venueId, name: venueName };
    document.getElementById('venueSelect').value = venueId;
    showSection('booking');
    
    // Show success message
    showAlert('success', `${venueName} selected! Please fill out the booking form.`);
}

// Step navigation
function nextStep(step) {
    if (validateCurrentStep()) {
        // Hide current step
        document.getElementById(`booking-step-${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}`).classList.add('completed');

        // Show next step
        currentStep = step;
        document.getElementById(`booking-step-${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}`).classList.add('active');

        // If moving to step 3, populate summary
        if (currentStep === 3) {
            populateBookingSummary();
        }
    }
}

function prevStep(step) {
    // Hide current step
    document.getElementById(`booking-step-${currentStep}`).classList.remove('active');
    document.getElementById(`step${currentStep}`).classList.remove('active');

    // Show previous step
    currentStep = step;
    document.getElementById(`booking-step-${currentStep}`).classList.add('active');
    document.getElementById(`step${currentStep}`).classList.add('active');
}

// Form validation
function validateCurrentStep() {
    if (currentStep === 1) {
        const required = ['clientName', 'eventType', 'contactEmail', 'contactPhone', 'expectedGuests'];
        for (let field of required) {
            const element = document.getElementById(field);
            if (!element.value.trim()) {
                showAlert('danger', `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
                element.focus();
                return false;
            }
        }

        // Validate email
        const email = document.getElementById('contactEmail').value;
        if (!isValidEmail(email)) {
            showAlert('danger', 'Please enter a valid email address');
            return false;
        }

        // Validate guest capacity
        return validateGuestCapacity();
    } else if (currentStep === 2) {
        const required = ['eventDate', 'startTime', 'endTime'];
        for (let field of required) {
            if (!document.getElementById(field).value) {
                showAlert('danger', 'Please fill in all date and time fields');
                return false;
            }
        }

        // Validate venue selection
        if (!document.getElementById('venueSelect').value) {
            showAlert('danger', 'Please select a venue');
            return false;
        }

        // Check if availability was confirmed
        const availabilityResult = document.getElementById('availabilityResult');
        if (!availabilityResult.classList.contains('available')) {
            showAlert('danger', 'Please check venue availability first');
            return false;
        }

        return true;
    }
    return true;
}

function validateGuestCapacity() {
    const guests = parseInt(document.getElementById('expectedGuests').value);
    const venueId = document.getElementById('venueSelect').value;
    
    if (venueId && guests) {
        const venue = venues.find(v => v.venue_id == venueId);
        if (venue && guests > venue.capacity) {
            showAlert('warning', `Selected venue capacity is ${venue.capacity} guests. Please choose a different venue or reduce guest count.`);
            return false;
        }
    }
    return true;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Venue and form updates
function updateVenueSelection() {
    validateGuestCapacity();
}

// Availability checking with actual API call
async function checkAvailability() {
    const venueId = document.getElementById('venueSelect').value;
    const eventDate = document.getElementById('eventDate').value;
    const startTime = normalizeTime(document.getElementById('startTime').value);
    const endTime = normalizeTime(document.getElementById('endTime').value);

    if (!venueId || !eventDate || !startTime || !endTime) {
        showAlert('warning', 'Please fill in all fields before checking availability');
        return;
    }

    if (startTime >= endTime) {
        showAlert('danger', 'End time must be after start time');
        return;
    }

    // Show loading state
    const btn = document.getElementById('checkAvailabilityBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Checking...';
    btn.disabled = true;

    try {
        // Call actual API for availability check
        const response = await fetch(`${API_BASE}/venues/availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                venueId: parseInt(venueId),
                date: eventDate,
                startTime: startTime,
                endTime: endTime
            })
        });

        const data = await response.json();
        const resultDiv = document.getElementById('availabilityResult');
        resultDiv.style.display = 'block';

        if (data.available) {
            const venue = venues.find(v => v.venue_id == venueId);
            const startDateTime = new Date(`${eventDate}T${startTime}`);
            const endDateTime = new Date(`${eventDate}T${endTime}`);
            const hours = (endDateTime - startDateTime) / (1000 * 60 * 60);
            const estimatedCost = hours * venue.hourly_rate;

            resultDiv.className = 'availability-result available';
            resultDiv.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    <div>
                        <strong>Great news! The venue is available!</strong><br>
                        <small>Duration: ${hours} hours | Estimated cost: ₱${estimatedCost.toLocaleString()}</small>
                    </div>
                </div>
            `;
            document.getElementById('nextToConfirm').disabled = false;
        } else {
            resultDiv.className = 'availability-result not-available';
            let conflictMessage = 'Sorry, the venue is not available for this time slot.';
            
            if (data.conflicts && data.conflicts.length > 0) {
                conflictMessage += '<br><small>Conflicting bookings:</small>';
                data.conflicts.forEach(conflict => {
                    const conflictStart = conflict.start_time ? conflict.start_time.substring(0, 5) : 'N/A';
                    const conflictEnd = conflict.end_time ? conflict.end_time.substring(0, 5) : 'N/A';
                    conflictMessage += `<br><small>• ${conflict.client_name}: ${conflictStart} - ${conflictEnd}</small>`;
                });
            }
            
            resultDiv.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>
                        <strong>${conflictMessage}</strong><br>
                        <small>Please try a different date or time, or choose another venue.</small>
                    </div>
                </div>
            `;
            document.getElementById('nextToConfirm').disabled = true;
        }

    } catch (error) {
        showAlert('danger', 'Error checking availability. Please try again.');
        console.error('Availability check error:', error);
        
        // Show error state
        const resultDiv = document.getElementById('availabilityResult');
        resultDiv.style.display = 'block';
        resultDiv.className = 'availability-result not-available';
        resultDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <div>
                    <strong>Unable to check availability</strong><br>
                    <small>Please try again or contact support.</small>
                </div>
            </div>
        `;
        document.getElementById('nextToConfirm').disabled = true;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Booking summary
function populateBookingSummary() {
    const formData = getFormData();
    const venue = venues.find(v => v.venue_id == formData.venueId);
    
    const startDateTime = new Date(`${formData.eventDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.eventDate}T${formData.endTime}`);
    const hours = (endDateTime - startDateTime) / (1000 * 60 * 60);
    const estimatedCost = hours * venue.hourly_rate;

    const summary = document.getElementById('bookingSummary');
    summary.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="bi bi-person-circle"></i> Client Information</h6>
                <p><strong>Name:</strong> ${formData.clientName}</p>
                <p><strong>Email:</strong> ${formData.contactEmail}</p>
                <p><strong>Phone:</strong> ${formData.contactPhone}</p>
                <p><strong>Event Type:</strong> ${formData.eventType}</p>
                <p><strong>Expected Guests:</strong> ${formData.expectedGuests}</p>
            </div>
            <div class="col-md-6">
                <h6><i class="bi bi-building"></i> Venue & Schedule</h6>
                <p><strong>Venue:</strong> ${venue.venue_name}</p>
                <p><strong>Date:</strong> ${new Date(formData.eventDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</p>
                <p><strong>Time:</strong> ${formatTime(formData.startTime)} - ${formatTime(formData.endTime)}</p>
                <p><strong>Duration:</strong> ${hours} hours</p>
                <p><strong>Estimated Cost:</strong> <span class="text-success fw-bold">₱${estimatedCost.toLocaleString()}</span></p>
            </div>
        </div>
        ${formData.specialRequests ? `
        <div class="row mt-3">
            <div class="col-12">
                <h6><i class="bi bi-chat-text"></i> Special Requests</h6>
                <p>${formData.specialRequests}</p>
            </div>
        </div>
        ` : ''}
        <div class="alert alert-info mt-3">
            <i class="bi bi-info-circle"></i>
            <strong>Note:</strong> This booking is subject to confirmation. You will receive a confirmation email within 24 hours.
        </div>
    `;
}

// Form submission with actual API call
async function submitBooking(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBookingBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Submitting...';
    submitBtn.disabled = true;

    try {
        const formData = getFormData();
        
        // Call the actual API
        const response = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientName: formData.clientName,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                eventType: formData.eventType,
                venueId: parseInt(formData.venueId),
                eventDate: formData.eventDate,
                startTime: formData.startTime,
                endTime: formData.endTime,
                expectedGuests: parseInt(formData.expectedGuests),
                specialRequests: formData.specialRequests
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create booking');
        }
        
        const bookingResult = await response.json();
        
        // Show success modal with real booking ID
        showSuccessModal(formData, bookingResult.booking_id);
        
        // Reset form
        resetBookingForm();
        
    } catch (error) {
        showAlert('danger', `Error submitting booking: ${error.message}`);
        console.error('Booking submission error:', error);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function normalizeTime(time) {
    if (!time) return null;

    // Kapag format ay HH:mm lang, dagdagan ng :00
    if (/^\d{1,2}:\d{2}$/.test(time)) {
        return time + ":00";
    }

    // Kapag format ay HH:mm:ss na, iwan lang
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) {
        return time;
    }

    // Kapag may AM/PM format (e.g. 4:58 AM)
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
        let hour = parseInt(match[1], 10);
        const minute = match[2];
        const meridian = match[3].toUpperCase();
        if (meridian === "PM" && hour < 12) hour += 12;
        if (meridian === "AM" && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, "0")}:${minute}:00`;
    }

    return null; // fallback kung totally invalid
}

function getFormData() {
    return {
        clientName: document.getElementById('clientName').value,
        eventType: document.getElementById('eventType').value,
        contactEmail: document.getElementById('contactEmail').value,
        contactPhone: document.getElementById('contactPhone').value,
        expectedGuests: document.getElementById('expectedGuests').value,
        venueId: document.getElementById('venueSelect').value,
        eventDate: document.getElementById('eventDate').value,      
        startTime: normalizeTime(document.getElementById('startTime').value),
        endTime: normalizeTime(document.getElementById('endTime').value),       
        specialRequests: document.getElementById('specialRequests').value
    };
}


function showSuccessModal(formData, bookingId) {
    const venue = venues.find(v => v.venue_id == formData.venueId);
    const displayBookingId = bookingId || 'BK' + Date.now();
    
    document.getElementById('bookingConfirmation').innerHTML = `
        <div class="card mt-3">
            <div class="card-body">
                <h5><i class="bi bi-receipt"></i> Booking Reference: ${displayBookingId}</h5>
                <p><strong>Venue:</strong> ${venue.venue_name}</p>
                <p><strong>Date:</strong> ${new Date(formData.eventDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${formatTime(formData.startTime)} - ${formatTime(formData.endTime)}</p>
                <p><strong>Status:</strong> <span class="badge bg-warning text-dark">Pending Confirmation</span></p>
            </div>
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
}
// Utility functions
function resetBookingForm() {
    document.getElementById('bookingForm').reset();
    currentStep = 1;
    
    // Reset step indicators
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.getElementById('step1').classList.add('active');
    
    // Show first step
    document.querySelectorAll('.booking-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById('booking-step-1').classList.add('active');
    
    // Reset availability
    document.getElementById('availabilityResult').style.display = 'none';
    document.getElementById('nextToConfirm').disabled = true;
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

function formatTime(time) {
    if (!time) return '';
    const parts = time.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

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

// Booking.js or separate JS file

document.addEventListener("DOMContentLoaded", function () {
    const signupBtn = document.querySelector(".signup");
    const signinBtn = document.querySelector(".signin");

    const signupModal = new bootstrap.Modal(document.getElementById("signupModal"));
    const signinModal = new bootstrap.Modal(document.getElementById("signinModal"));

    signupBtn.addEventListener("click", () => {
        signupModal.show();
    });

    signinBtn.addEventListener("click", () => {
        signinModal.show();
    });
});