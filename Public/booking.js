const API_BASE = 'http://localhost:3000/api';
let currentStep = 1;
let venues = [];
let googleUser = null;
let googleToken = null;

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get("venueId");
    const venueName = urlParams.get("venueName");

    if (venueId && venueName) {
        const venueSelect = document.getElementById("venueSelect");
        if (venueSelect) {
            venueSelect.innerHTML = `<option value="${venueId}" selected>${venueName}</option>`;
            venueSelect.disabled = true; 
        }
        const venueInput = document.getElementById("selectedVenue");
        if (venueInput) {
            venueInput.value = venueName;
        }
    }
    initEventListeners();
    loadVenuesFromAPI();
});

function initEventListeners() {
    // Check availability button
    document.getElementById('checkAvailabilityBtn').addEventListener('click', checkAvailability);

    // Form submission
    document.getElementById('bookingForm').addEventListener('submit', submitBooking);

    // Real-time validation
    document.getElementById('expectedGuests').addEventListener('input', validateGuestCapacity);
    document.getElementById('venueSelect').addEventListener('change', updateVenueSelection);
}

async function loadVenuesFromAPI() {
    try {
        const response = await fetch(`${API_BASE}/venues`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const apiVenues = await response.json();
            venues = apiVenues;
        } else {
            console.warn('Failed to load venues from API, using fallback data');
            venues = [
                { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
                { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
                { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
            ];
        }
    } catch (error) {
        console.error('Error loading venues:', error);
        venues = [
            { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
            { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
            { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
        ];
    }

    // Update venue select dropdown
    const venueSelect = document.getElementById('venueSelect');
    venueSelect.innerHTML = '<option value="">Select a venue</option>';

    venues.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.venue_id;
        option.setAttribute("data-name", venue.venue_name);
        option.textContent = `${venue.venue_name} (${venue.capacity} guests) - ₱${venue.hourly_rate.toLocaleString()}/hr`;
        venueSelect.appendChild(option);
    });

    // Auto-select galing sa URL params
    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get("venueId");
    if (venueId) {
        venueSelect.value = venueId;
        venueSelect.disabled = true; // lock
    }

    updateVenueCards(venues);
}


function updateVenueCards(venuesData) {
    console.log("Venues loaded:", venuesData);
}

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

function loadGoogleSignIn() {
    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: 'YOUR_GOOGLE_CLIENT_ID', 
            cookiepolicy: 'single_host_origin',
        }).then(function(auth2) {
            // Attach click handler
            const signInButton = document.getElementById('google-signin-button');
            auth2.attachClickHandler(signInButton, {},
                function(user) {
                    // Successful sign-in
                    googleUser = user;
                    googleToken = user.getAuthResponse().id_token;
                    document.getElementById('googleToken').value = googleToken;
                    
                    // Auto-fill ang email field kung blanko
                    const emailField = document.getElementById('contactEmail');
                    if (!emailField.value) {
                        emailField.value = user.getBasicProfile().getEmail();
                    }
                    
                    // I-update ang status
                    document.getElementById('google-auth-status').textContent = 
                        `Authenticated as: ${user.getBasicProfile().getEmail()}`;
                    document.getElementById('google-auth-status').className = 
                        'mt-2 small text-success';
                },
                function(error) {
                    console.error('Google Sign-In error:', error);
                    document.getElementById('google-auth-status').textContent = 
                        'Error during authentication. Please try again.';
                    document.getElementById('google-auth-status').className = 
                        'mt-2 small text-danger';
                }
            );
        });
    });
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

        // Validate phone number
        const phone = document.getElementById('contactPhone').value;
        if (!isValidPhone(phone)) {
            showAlert('danger', 'Please enter a valid phone number');
            return false;
        }

        // Validate Google authentication
        const googleToken = document.getElementById('googleToken');
        if (!googleToken || !googleToken.value.trim()) {
            showAlert('danger', 'Please authenticate with Google to continue');
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

        // Validate date is not in the past
        const eventDate = new Date(document.getElementById('eventDate').value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventDate < today) {
            showAlert('danger', 'Please select a future date');
            return false;
        }

        // Validate time order
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        if (startTime >= endTime) {
            showAlert('danger', 'End time must be after start time');
            return false;
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

// Add phone validation function
function isValidPhone(phone) {
    return /^[+]?[\d\s\-()]{10,}$/.test(phone);
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

    // Validate date is not in the past
    const selectedDate = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showAlert('danger', 'Please select a future date');
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
            sessionStorage.setItem('venueAvailable', 'true');
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
            sessionStorage.setItem('venueAvailable', 'false');
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
                venueName: formData.venueName,
                eventDate: formData.eventDate,
                startTime: formData.startTime,
                endTime: formData.endTime,
                expectedGuests: parseInt(formData.expectedGuests),
                specialRequests: formData.specialRequests,
                googleToken: formData.googleToken
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

    // Handle HH:mm format
    if (/^\d{1,2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        return `${hours.padStart(2, '0')}:${minutes}:00`;
    }

    // Handle HH:mm:ss format
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        return `${hours.padStart(2, '0')}:${minutes}:00`;
    }

    // Kapag may AM/PM format (e.g. 4:58 AM)
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const meridian = match[3].toUpperCase();
        
        if (meridian === "PM" && hours < 12) hours += 12;
        if (meridian === "AM" && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, "0")}:${minutes}:00`;
    }

    return null;
}

function getFormData() {
    const venueSelect = document.getElementById('venueSelect');
    const selectedOption = venueSelect.options[venueSelect.selectedIndex];
    
    return {
        clientName: document.getElementById('clientName').value,
        eventType: document.getElementById('eventType').value,
        contactEmail: document.getElementById('contactEmail').value,
        contactPhone: document.getElementById('contactPhone').value,
        expectedGuests: document.getElementById('expectedGuests').value,
        venueId: venueSelect.value,
        venueName: selectedOption ? selectedOption.text : "",
        eventDate: document.getElementById('eventDate').value,      
        startTime: normalizeTime(document.getElementById('startTime').value),
        endTime: normalizeTime(document.getElementById('endTime').value),       
        specialRequests: document.getElementById('specialRequests').value,
        googleToken: document.getElementById('googleToken').value
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
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
    
    // Reset form after modal is hidden
    document.getElementById('successModal').addEventListener('hidden.bs.modal', function () {
        resetBookingForm();
    });
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

function handleGoogleSignIn(response) {
    googleToken = response.credential;
    googleUser = parseJwt(googleToken);
    
    // Auto-fill the email field if empty
    if (googleUser && googleUser.email && !document.getElementById('contactEmail').value) {
        document.getElementById('contactEmail').value = googleUser.email;
    }
    
    // Update authentication status
    const authStatus = document.getElementById('google-auth-status');
    if (googleUser) {
        authStatus.textContent = `Authenticated as: ${googleUser.email}`;
        authStatus.className = 'auth-status authenticated';
        document.getElementById('googleToken').value = googleToken;
    } else {
        authStatus.textContent = 'Authentication failed. Please try again.';
        authStatus.className = 'auth-status error';
    }
}

function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}
