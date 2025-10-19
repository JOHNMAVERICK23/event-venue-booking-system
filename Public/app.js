document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('sidebar')) return;
    let venues = [];
    let bookings = [];
    let currentBookingId = null;
    let calendar;

    const API_BASE = 'http://localhost:3000/api';

    document.getElementById('sidebarCollapse').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('active');
    });
    
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.add('d-none');
            });
            document.getElementById(`${sectionId}-section`).classList.remove('d-none');
            if (sectionId === 'bookings') {
                loadBookings();
            } else if (sectionId === 'venues') {
                loadVenues();
            } else if (sectionId === 'overview') {
                loadOverview();
            } else if (sectionId === 'calendar') {
                initCalendar();
            }
        });
    });
    initDashboard();
    initBookingManagement();
    initReports();
    initSettings();
    async function initDashboard() {
        await loadVenues();
        await loadBookings();
        loadOverview();
        initCalendar();
    }
    async function loadVenues() {
        try {
            const response = await authFetch(`${API_BASE}/venues`);
            if (!response.ok) {
                throw new Error('Failed to load venues');
            }
            const apiVenues = await response.json();
            venues = apiVenues;
            const venueSelects = document.querySelectorAll('#filterVenue');
            venueSelects.forEach(select => {
                select.innerHTML = '<option value="">All Venues</option>';
                apiVenues.forEach(venue => {
                    const option = document.createElement('option');
                    option.value = venue.venue_id;
                    option.textContent = venue.venue_name;
                    select.appendChild(option);
                });
            });
            const venuesTable = document.getElementById('venuesTable');
            if (venuesTable) {
                const tbody = venuesTable.getElementsByTagName('tbody')[0];
                tbody.innerHTML = '';
                apiVenues.forEach(venue => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${venue.venue_id}</td>
                        <td>${venue.venue_name}</td>
                        <td>${venue.capacity}</td>
                        <td>₱${venue.hourly_rate.toLocaleString()}</td>
                        <td><span class="badge bg-success">${venue.status}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="editVenue(${venue.venue_id})">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                        </td>
                    `;
                });
            }
        } catch (error) {
            console.error('Error loading venues:', error);
            showAlert('danger', 'Failed to load venues');
        }
    }
    async function loadBookings() {
        try {
            const params = new URLSearchParams();
            const filterStatus = document.getElementById('filterStatus')?.value;
            const filterVenue = document.getElementById('filterVenue')?.value;
            const filterStartDate = document.getElementById('filterStartDate')?.value;
            const filterEndDate = document.getElementById('filterEndDate')?.value;
            if (filterStatus) params.append('status', filterStatus);
            if (filterVenue) params.append('venueId', filterVenue);
            if (filterStartDate) params.append('startDate', filterStartDate);
            if (filterEndDate) params.append('endDate', filterEndDate);
            const queryString = params.toString();
            const url = `${API_BASE}/bookings${queryString ? '?' + queryString : ''}`;
            const response = await authFetch(url);
            if (!response.ok) {
                throw new Error('Failed to load bookings');
            }
            const apiBookings = await response.json();
            bookings = apiBookings;
            const bookingsTable = document.getElementById('bookingsTable');
            if (bookingsTable) {
                const tbody = bookingsTable.getElementsByTagName('tbody')[0];
                tbody.innerHTML = '';         
                apiBookings.forEach(booking => {
                    const row = tbody.insertRow();                 
                    const eventDate = new Date(booking.event_date);
                    const formattedDate = eventDate.toLocaleDateString();
                    const startTime = booking.start_time ? booking.start_time.substring(0, 5) : 'N/A';
                    const endTime = booking.end_time ? booking.end_time.substring(0, 5) : 'N/A';
                    let statusBadge;
                    if (booking.status === 'Confirmed') {
                        statusBadge = '<span class="badge bg-success">Confirmed</span>';
                    } else if (booking.status === 'Pending') {
                        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
                    } else {
                        statusBadge = '<span class="badge bg-secondary">Cancelled</span>';
                    }
                    row.innerHTML = `
                        <td>${booking.booking_id}</td>
                        <td>${booking.client_name}</td>
                        <td>${booking.venue_name}</td>
                        <td>${formattedDate}</td>
                        <td>${startTime} - ${endTime}</td>
                        <td>${booking.event_type}</td>
                        <td>${booking.expected_guests}</td>
                        <td>${statusBadge}</td>
                        <td class="action-buttons">
                            <button class="btn btn-sm btn-info view-booking" data-id="${booking.booking_id}">View</button>
                            <button class="btn btn-sm btn-primary edit-booking" data-id="${booking.booking_id}">Edit</button>
                            <button class="btn btn-sm btn-danger delete-booking" data-id="${booking.booking_id}">
                                Delete
                            </button>
                        </td>
                    `;
                });
                attachBookingEventListeners();
            }
        } catch (error) {
            console.error('Error loading bookings:', error);
            showAlert('danger', 'Failed to load bookings: ' + error.message);
        }
    }
    function attachBookingEventListeners() {
        document.querySelectorAll('.view-booking').forEach(button => {
            button.addEventListener('click', function() {
                const bookingId = this.getAttribute('data-id');
                showBookingDetails(bookingId);
            });
        });
        document.querySelectorAll('.edit-booking').forEach(button => {
            button.addEventListener('click', function() {
                const bookingId = this.getAttribute('data-id');
                showEditBookingModal(bookingId);
            });
        });
        document.querySelectorAll('.delete-booking').forEach(button => {
            button.addEventListener('click', function() {
                const bookingId = this.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this booking?')) {
                    deleteBooking(bookingId);
                }
            });
        });
    }
    
    async function loadOverview() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const todayEvents = bookings.filter(b => {
                const bookingDate = new Date(b.event_date).toISOString().split('T')[0];
                return bookingDate === today && b.status === 'Confirmed';
            });
            document.getElementById('todayEvents').textContent = todayEvents.length;
            const todayDate = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const upcomingEvents = bookings.filter(b => {
                const eventDate = new Date(b.event_date);
                return eventDate >= todayDate && eventDate <= nextWeek && b.status === 'Confirmed';
            });
            document.getElementById('upcomingEvents').textContent = upcomingEvents.length;
            const pendingBookings = bookings.filter(b => b.status === 'Pending');
            document.getElementById('pendingApprovals').textContent = pendingBookings.length;
            const recentBookingsTable = document.getElementById('recentBookingsTable');
            if (recentBookingsTable) {
                const tbody = recentBookingsTable.getElementsByTagName('tbody')[0];
                tbody.innerHTML = '';
                const recentBookings = [...bookings]
                    .sort((a, b) => new Date(b.booking_date || b.event_date) - new Date(a.booking_date || a.event_date))
                    .slice(0, 5);
                recentBookings.forEach(booking => {
                    const row = tbody.insertRow();
                    const eventDate = new Date(booking.event_date);
                    const formattedDate = eventDate.toLocaleDateString();
                    const startTime = booking.start_time ? booking.start_time.substring(0, 5) : 'N/A';
                    let statusBadge;
                    if (booking.status === 'Confirmed') {
                        statusBadge = '<span class="badge bg-success">Confirmed</span>';
                    } else if (booking.status === 'Pending') {
                        statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
                    } else {
                        statusBadge = '<span class="badge bg-secondary">Cancelled</span>';
                    }
                    row.innerHTML = `
                        <td>${booking.booking_id}</td>
                        <td>${booking.client_name}</td>
                        <td>${booking.venue_name}</td>
                        <td>${formattedDate}</td>
                        <td>${startTime}</td>
                        <td>${statusBadge}</td>
                    `;
                });
            }
            
        } catch (error) {
            console.error('Error loading overview data:', error);
        }
    }
    function initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
    
        
        const section = document.getElementById('calendar-section');
        section.classList.remove('d-none');
    
        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                events: async function(fetchInfo, successCallback, failureCallback) {
                    try {
                        const response = await authFetch(`${API_BASE}/calendar?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`);
                        if (response.ok) {
                            const events = await response.json();
                            successCallback(events);
                        } else {
                        
                            const events = bookings.map(booking => ({
                                id: booking.booking_id,
                                title: `${booking.venue_name} - ${booking.client_name} (${booking.event_type})`,
                                start: `${booking.event_date}T${booking.start_time}`,
                                end: `${booking.event_date}T${booking.end_time}`,
                                backgroundColor: booking.status === 'Confirmed' ? '#27ae60' : '#f39c12',
                                borderColor: booking.status === 'Confirmed' ? '#27ae60' : '#f39c12',
                            }));
                            successCallback(events);
                        }
                    } catch (error) {
                        console.error('Error loading calendar events:', error);
                        failureCallback(error);
                    }
                },
                eventClick: function(info) {
                    showBookingDetails(info.event.id);
                },
                eventTimeFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }
            });
            calendar.render();
        } else {
            calendar.refetchEvents();
        }
    }
    
    function initBookingManagement() {
        document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
        document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    }
    function applyFilters() {
        loadBookings();
    }
    function resetFilters() {
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterVenue').value = '';
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        loadBookings();
    }
    async function showBookingDetails(bookingId) {
        try {
            const response = await authFetch(`${API_BASE}/bookings/${bookingId}`);
            if (!response.ok) {
                throw new Error('Failed to load booking details');
            }
            const booking = await response.json();
            const venue = venues.find(v => v.venue_id == booking.venue_id);
            const eventDate = new Date(booking.event_date);
            const formattedDate = eventDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const startTime = booking.start_time ? booking.start_time.substring(0, 5) : 'N/A';
            const endTime = booking.end_time ? booking.end_time.substring(0, 5) : 'N/A';
            let durationHours = 0;
            let estimatedCost = 0;
            if (booking.start_time && booking.end_time) {
                const start = new Date(`2000-01-01T${booking.start_time}`);
                const end = new Date(`2000-01-01T${booking.end_time}`);
                durationHours = (end - start) / (1000 * 60 * 60);
                estimatedCost = durationHours * (venue?.hourly_rate || 0);
            }
            let statusBadge;
            if (booking.status === 'Confirmed') {
                statusBadge = '<span class="badge bg-success">Confirmed</span>';
            } else if (booking.status === 'Pending') {
                statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
            } else {
                statusBadge = '<span class="badge bg-secondary">Cancelled</span>';
            }
            const content = document.getElementById('bookingDetailsContent');
            content.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h5><i class="bi bi-person-circle"></i> Client Information</h5>
                        <p><strong>Name:</strong> ${booking.client_name}</p>
                        <p><strong>Email:</strong> ${booking.contact_email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.contact_phone || 'N/A'}</p>
                        <p><strong>Event Type:</strong> ${booking.event_type}</p>
                        <p><strong>Expected Guests:</strong> ${booking.expected_guests}</p>
                    </div>
                    <div class="col-md-6">
                        <h5><i class="bi bi-building"></i> Venue & Schedule</h5>
                        <p><strong>Venue:</strong> ${booking.venue_name}</p>
                        <p><strong>Capacity:</strong> ${venue?.capacity || 'N/A'} guests</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
                        <p><strong>Duration:</strong> ${durationHours.toFixed(1)} hours</p>
                        <p><strong>Status:</strong> ${statusBadge}</p>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h5><i class="bi bi-chat-text"></i> Special Requests</h5>
                        <p>${booking.special_requests || 'None'}</p>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h5><i class="bi bi-currency-dollar"></i> Cost Information</h5>
                        <p><strong>Estimated Cost:</strong> ₱${estimatedCost.toLocaleString()} 
                        (${durationHours.toFixed(1)} hours × ₱${(venue?.hourly_rate || 0).toLocaleString()}/hour)</p>
                    </div>
                </div>
            `;
            const statusButtons = document.getElementById('statusButtons');
            statusButtons.innerHTML = '';
            if (booking.status === 'Pending') {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'btn btn-success me-2';
                confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> Confirm';
                confirmBtn.addEventListener('click', () => updateBookingStatus(bookingId, 'Confirmed'));
                statusButtons.appendChild(confirmBtn);
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn btn-danger';
                cancelBtn.innerHTML = '<i class="bi bi-x-circle"></i> Cancel';
                cancelBtn.addEventListener('click', () => updateBookingStatus(bookingId, 'Cancelled'));
                statusButtons.appendChild(cancelBtn);
            } else if (booking.status === 'Confirmed') {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn btn-danger';
                cancelBtn.innerHTML = '<i class="bi bi-x-circle"></i> Cancel';
                cancelBtn.addEventListener('click', () => updateBookingStatus(bookingId, 'Cancelled'));
                statusButtons.appendChild(cancelBtn);
            }
            const modal = new bootstrap.Modal(document.getElementById('bookingDetailsModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading booking details:', error);
            showAlert('danger', 'Failed to load booking details');
        }
    }
    async function updateBookingStatus(bookingId, newStatus) {
        try {
            const response = await authFetch(`${API_BASE}/bookings/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) {
                throw new Error('Failed to update booking status');
            }
            showAlert('success', `Booking status updated to ${newStatus}`);
            const modal = bootstrap.Modal.getInstance(document.getElementById('bookingDetailsModal'));
            modal.hide();
            await loadBookings();
            loadOverview();
            if (calendar) {
                calendar.refetchEvents();
            }
        } catch (error) {
            console.error('Error updating booking status:', error);
            showAlert('danger', 'Failed to update booking status');
        }
    }
    async function deleteBooking(bookingId) {
        try {
            await updateBookingStatus(bookingId, 'Cancelled');  
        } catch (error) {
            console.error('Error deleting booking:', error);
            showAlert('danger', 'Failed to delete booking');
        }
    }
    async function showEditBookingModal(bookingId) {
        try {
            const response = await authFetch(`${API_BASE}/bookings/${bookingId}`);
            if (!response.ok) {
                throw new Error('Failed to load booking for editing');
            }
            const booking = await response.json();
            const editContent = document.getElementById('editBookingContent');
            editContent.innerHTML = `
                <form id="editBookingForm">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label for="editClientName" class="form-label">Client Name *</label>
                            <input type="text" class="form-control" id="editClientName" value="${booking.client_name}" required>
                        </div>
                        <div class="col-md-6">
                            <label for="editEventType" class="form-label">Event Type *</label>
                            <select class="form-select" id="editEventType" required>
                                <option value="Wedding" ${booking.event_type === 'Wedding' ? 'selected' : ''}>Wedding</option>
                                <option value="Conference" ${booking.event_type === 'Conference' ? 'selected' : ''}>Conference</option>
                                <option value="Seminar" ${booking.event_type === 'Seminar' ? 'selected' : ''}>Seminar</option>
                                <option value="Birthday" ${booking.event_type === 'Birthday' ? 'selected' : ''}>Birthday</option>
                                <option value="Corporate" ${booking.event_type === 'Corporate' ? 'selected' : ''}>Corporate Event</option>
                                <option value="Other" ${booking.event_type === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="editContactEmail" class="form-label">Contact Email</label>
                            <input type="email" class="form-control" id="editContactEmail" value="${booking.contact_email || ''}">
                        </div>
                        <div class="col-md-6">
                            <label for="editContactPhone" class="form-label">Contact Phone</label>
                            <input type="tel" class="form-control" id="editContactPhone" value="${booking.contact_phone || ''}">
                        </div>
                        <div class="col-md-4">
                            <label for="editExpectedGuests" class="form-label">Expected Guests *</label>
                            <input type="number" class="form-control" id="editExpectedGuests" min="1" value="${booking.expected_guests}" required>
                        </div>
                        <div class="col-md-4">
                            <label for="editEventDate" class="form-label">Event Date *</label>
                            <input type="date" class="form-control" id="editEventDate" value="${booking.event_date.split('T')[0]}" required>
                        </div>
                        <div class="col-md-4">
                            <label for="editVenueSelect" class="form-label">Venue *</label>
                            <select class="form-select" id="editVenueSelect" required>
                                ${venues.map(venue => `
                                    <option value="${venue.venue_id}" ${venue.venue_id === booking.venue_id ? 'selected' : ''}>
                                        ${venue.venue_name} (${venue.capacity} pax)
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="editStartTime" class="form-label">Start Time *</label>
                            <input type="time" class="form-control" id="editStartTime" value="${booking.start_time ? booking.start_time.substring(0, 5) : ''}" required>
                        </div>
                        <div class="col-md-6">
                            <label for="editEndTime" class="form-label">End Time *</label>
                            <input type="time" class="form-control" id="editEndTime" value="${booking.end_time ? booking.end_time.substring(0, 5) : ''}" required>
                        </div>
                        <div class="col-12">
                            <label for="editSpecialRequests" class="form-label">Special Requests</label>
                            <textarea class="form-control" id="editSpecialRequests" rows="2">${booking.special_requests || ''}</textarea>
                        </div>
                    </div>
                </form>
            `;
            const saveBtn = document.getElementById('saveBookingChanges');
            saveBtn.onclick = () => saveBookingChanges(bookingId);
            const modal = new bootstrap.Modal(document.getElementById('editBookingModal'));
            modal.show();
        } catch (error) {
            console.error('Error loading booking for editing:', error);
            showAlert('danger', 'Failed to load booking for editing');
        }
    }
    async function saveBookingChanges(bookingId) {
        try {
            const updatedData = {
                clientName: document.getElementById('editClientName').value,
                eventType: document.getElementById('editEventType').value,
                contactEmail: document.getElementById('editContactEmail').value,
                contactPhone: document.getElementById('editContactPhone').value,
                expectedGuests: parseInt(document.getElementById('editExpectedGuests').value),
                eventDate: document.getElementById('editEventDate').value,
                venueId: parseInt(document.getElementById('editVenueSelect').value),
                startTime: document.getElementById('editStartTime').value,
                endTime: document.getElementById('editEndTime').value,
                specialRequests: document.getElementById('editSpecialRequests').value
            };
            const response = await authFetch(`${API_BASE}/bookings/${bookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update booking');
            }
            showAlert('success', 'Booking updated successfully');
            const modal = bootstrap.Modal.getInstance(document.getElementById('editBookingModal'));
            modal.hide();
            await loadBookings();
            loadOverview();
            if (calendar) {
                calendar.refetchEvents();
            }
        } catch (error) {
            console.error('Error updating booking:', error);
            showAlert('danger', `Failed to update booking: ${error.message}`);
        }
    }
    function initReports() {
        document.getElementById('generateVenueReport')?.addEventListener('click', generateVenueReport);
        document.getElementById('generateEventReport')?.addEventListener('click', generateEventReport);
    }
    async function generateVenueReport() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        if (!startDate || !endDate) {
            showAlert('warning', 'Please select both start and end dates');
            return;
        }
        try {
            const response = await authFetch(`${API_BASE}/reports?reportType=venue-utilization&startDate=${startDate}&endDate=${endDate}`);
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const venueStats = await response.json();
            const table = document.getElementById('venueReportTable').getElementsByTagName('tbody')[0];
            table.innerHTML = '';
            venueStats.forEach(venue => {
                const row = table.insertRow();
                row.innerHTML = `
                    <td>${venue.venue_name}</td>
                    <td>${venue.booking_count || 0}</td>
                    <td>${(venue.total_hours || 0).toFixed(1)}</td>
                    <td>₱${(venue.estimated_revenue || 0).toLocaleString()}</td>
                `;
            });
            createVenueUtilizationChart(venueStats); 
        } catch (error) {
            console.error('Error generating venue report:', error);
            showAlert('danger', 'Failed to generate report');
        }
    }
    async function generateEventReport() {
        const startDate = document.getElementById('eventReportStartDate').value;
        const endDate = document.getElementById('eventReportEndDate').value;
        if (!startDate || !endDate) {
            showAlert('warning', 'Please select both start and end dates');
            return;
        }
        try {
            const response = await authFetch(`${API_BASE}/reports?reportType=event-types&startDate=${startDate}&endDate=${endDate}`);
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }
            const eventStats = await response.json();
            const table = document.getElementById('eventReportTable').getElementsByTagName('tbody')[0];
            table.innerHTML = '';
            eventStats.forEach(event => {
                const row = table.insertRow();
                row.innerHTML = `
                    <td>${event.event_type}</td>
                    <td>${event.count}</td>
                    <td>${(event.avg_guests || 0).toFixed(1)}</td>
                `;
            });
            createEventTypesChart(eventStats);  
        } catch (error) {
            console.error('Error generating event report:', error);
            showAlert('danger', 'Failed to generate report');
        }
    }
    function createVenueUtilizationChart(data) {
        const ctx = document.getElementById('venueUtilizationChart').getContext('2d');
        if (window.venueUtilizationChart) {
            window.venueUtilizationChart.destroy();
        }  
        window.venueUtilizationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(v => v.venue_name),
                datasets: [{
                    label: 'Booking Count',
                    data: data.map(v => v.booking_count || 0),
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                }, {
                    label: 'Total Hours',
                    data: data.map(v => v.total_hours || 0),
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    type: 'line',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Booking Count'
                        }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Total Hours'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }  
    function createEventTypesChart(data) {
        const ctx = document.getElementById('eventTypesChart').getContext('2d');
        if (window.eventTypesChart) {
            window.eventTypesChart.destroy();
        }
        window.eventTypesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(e => e.event_type),
                datasets: [{
                    data: data.map(e => e.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Event Types Distribution'
                    }
                }
            }
        });
    }
    function initSettings() {
        const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
        if (user.username) {
            document.getElementById('profileFullName').value = user.fullName || user.username;
            document.getElementById('profileEmail').value = user.email || '';
            document.getElementById('profileRole').value = user.role || 'Administrator';
        }
        document.getElementById('passwordForm')?.addEventListener('submit', handlePasswordChange);
    }   
    async function handlePasswordChange(e) {
        e.preventDefault();      
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;       
        if (newPassword !== confirmPassword) {
            showAlert('danger', 'New passwords do not match');
            return;
        }       
        if (newPassword.length < 6) {
            showAlert('danger', 'Password must be at least 6 characters long');
            return;
        }       
        try {
            showAlert('success', 'Password changed successfully');
            document.getElementById('passwordForm').reset();
        } catch (error) {
            console.error('Error changing password:', error);
            showAlert('danger', 'Failed to change password');
        }
    }
    document.getElementById('printBookingBtn')?.addEventListener('click', function() {
        const content = document.getElementById('bookingDetailsContent').innerHTML;
        const printWindow = window.open('', '', 'width=800,height=700');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Booking Confirmation</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h2 { color: #2c3e50; }
                    .header { text-align: center; margin-bottom: 20px; }
                    h5 { color: #34495e; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    p { margin: 5px 0; }
                    .footer { margin-top: 30px; font-size: 0.9em; text-align: center; color: #666; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>City of Dreams Manila</h2>
                    <h3>Event Booking Confirmation</h3>
                </div>
                ${content}
                <div class="footer">
                    <p>Thank you for choosing City of Dreams Manila</p>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    });
    function showAlert(type, message) {
        const alertContainer = document.querySelector('#main-content');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i>
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
    window.editVenue = function(venueId) {
        showAlert('info', 'Venue editing functionality would be implemented here');
    };
});