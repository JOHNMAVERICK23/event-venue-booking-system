const API_BASE = 'https://event-venue-booking-system.onrender.com/api';
let currentStep = 1;
let venues = [];

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
    }
    initEventListeners();
    loadVenuesFromAPI();
});

function initEventListeners() {
    document.getElementById('checkAvailabilityBtn').addEventListener('click', checkAvailability);
    document.getElementById('bookingForm').addEventListener('submit', submitBooking);
    document.getElementById('expectedGuests').addEventListener('input', validateGuestCapacity);
    document.getElementById('venueSelect').addEventListener('change', updateVenueSelection);
}

function loadVenuesFromAPI() {
    try {
        fetch(`${API_BASE}/venues`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }).then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to load venues');
            }
        }).then(apiVenues => {
            venues = apiVenues;
            populateVenueSelect();
        }).catch(error => {
            console.warn('Failed to load venues from API, using fallback data');
            venues = [
                { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
                { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
                { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
            ];
            populateVenueSelect();
        });
    } catch (error) {
        console.error('Error loading venues:', error);
        venues = [
            { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
            { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
            { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
        ];
        populateVenueSelect();
    }
}

function populateVenueSelect() {
    const venueSelect = document.getElementById('venueSelect');
    venueSelect.innerHTML = '<option value="">Select a venue</option>';

    venues.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.venue_id;
        option.setAttribute("data-name", venue.venue_name);
        option.textContent = `${venue.venue_name} (${venue.capacity} guests) - ₱${venue.hourly_rate.toLocaleString()}/hr`;
        venueSelect.appendChild(option);
    });

    const urlParams = new URLSearchParams(window.location.search);
    const venueId = urlParams.get("venueId");
    if (venueId) {
        venueSelect.value = venueId;
        venueSelect.disabled = true; 
    }

    updateVenueCards(venues);
}

function updateVenueCards(venuesData) {
    console.log("Venues loaded:", venuesData);
}

function nextStep(step) {
    if (validateCurrentStep()) {
        document.getElementById(`booking-step-${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}`).classList.add('completed');

        currentStep = step;
        document.getElementById(`booking-step-${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}`).classList.add('active');

        if (currentStep === 3) {
            populateBookingSummary();
        }
    }
}

function prevStep(step) {
    document.getElementById(`booking-step-${currentStep}`).classList.remove('active');
    document.getElementById(`step${currentStep}`).classList.remove('active');

    currentStep = step;
    document.getElementById(`booking-step-${currentStep}`).classList.add('active');
    document.getElementById(`step${currentStep}`).classList.add('active');
}

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

        const email = document.getElementById('contactEmail').value;
        if (!isValidEmail(email)) {
            showAlert('danger', 'Please enter a valid email address');
            return false;
        }

        const phone = document.getElementById('contactPhone').value;
        if (!isValidPhone(phone)) {
            showAlert('danger', 'Please enter a valid phone number');
            return false;
        }

        return validateGuestCapacity();
    } else if (currentStep === 2) {
        const required = ['eventDate', 'startTime', 'endTime'];
        for (let field of required) {
            if (!document.getElementById(field).value) {
                showAlert('danger', 'Please fill in all date and time fields');
                return false;
            }
        }

        const eventDate = new Date(document.getElementById('eventDate').value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (eventDate < today) {
            showAlert('danger', 'Please select a future date');
            return false;
        }

        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        if (startTime >= endTime) {
            showAlert('danger', 'End time must be after start time');
            return false;
        }

        if (!document.getElementById('venueSelect').value) {
            showAlert('danger', 'Please select a venue');
            return false;
        }

        const availabilityResult = document.getElementById('availabilityResult');
        if (!availabilityResult.classList.contains('available')) {
            showAlert('danger', 'Please check venue availability first');
            return false;
        }

        return true;
    }
    return true;
}

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

function updateVenueSelection() {
    validateGuestCapacity();
}

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

    const selectedDate = new Date(eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showAlert('danger', 'Please select a future date');
        return;
    }

    const btn = document.getElementById('checkAvailabilityBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Checking...';
    btn.disabled = true;

    try {
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

async function submitBooking(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBookingBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Submitting...';
    submitBtn.disabled = true;

    try {
        const formData = getFormData();

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
                specialRequests: formData.specialRequests
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create booking');
        }
        
        const bookingResult = await response.json();
        
        showSuccessModal(formData, bookingResult.booking_id);
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

    if (/^\d{1,2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        return `${hours.padStart(2, '0')}:${minutes}:00`;
    }

    if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        return `${hours.padStart(2, '0')}:${minutes}:00`;
    }

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
    
    document.getElementById('successModal').addEventListener('hidden.bs.modal', function () {
        resetBookingForm();
    });
}

function resetBookingForm() {
    document.getElementById('bookingForm').reset();
    currentStep = 1;
    
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.getElementById('step1').classList.add('active');
    
    document.querySelectorAll('.booking-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById('booking-step-1').classList.add('active');
    
    document.getElementById('availabilityResult').style.display = 'none';
    document.getElementById('nextToConfirm').disabled = true;
}

function showAlert(type, message) {
    const existingAlerts = document.querySelectorAll('.custom-alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `custom-alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button type="button" class="alert-close" onclick="this.parentElement.remove()">×</button>
    `;
    
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
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 2000);
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