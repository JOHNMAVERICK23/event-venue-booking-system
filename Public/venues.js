const API_BASE = 'http://localhost:3000/api';
let selectedVenue = null;

document.addEventListener('DOMContentLoaded', function() {
    
});

async function loadVenuesFromAPI() {
    try {
        const response = await fetch(`${API_BASE}/venues`);
        
        if (response.ok) {
            const apiVenues = await response.json();
            updateVenueCards(apiVenues);
        } else {
            console.warn('Failed to load venues from API, using fallback data');
            updateVenueCards([
                { venue_id: 1, venue_name: 'Grand Ballroom', capacity: 500, hourly_rate: 15000 },
                { venue_id: 2, venue_name: 'Conference Hall A', capacity: 100, hourly_rate: 5000 },
                { venue_id: 3, venue_name: 'Garden Pavilion', capacity: 200, hourly_rate: 8000 }
            ]);
        }
    } catch (error) {
        console.error('Error loading venues:', error);
    }
}

function selectVenue(venueId, venueName) {
    window.location.href = `booking.html?venueId=${venueId}&venueName=${encodeURIComponent(venueName)}`;
}

function updateVenueCards(apiVenues) {
    const venueCards = document.querySelectorAll('.venue-card');
    venueCards.forEach((card, index) => {
        if (apiVenues[index]) {
            const venue = apiVenues[index];
            card.querySelector('.venue-name').textContent = venue.venue_name;
            card.querySelector('.venue-price').textContent = `₱${venue.hourly_rate.toLocaleString()}/hour`;
            card.querySelector('.venue-details').innerHTML = `
                <i class="bi bi-people"></i> Capacity: ${venue.capacity} guests<br>
                <i class="bi bi-geo-alt"></i> ${venue.location || 'Main Building'}<br>
                <i class="bi bi-check-circle"></i> ${venue.amenities || 'Full service available'}
            `;
            card.querySelector('button').onclick = () => selectVenue(venue.venue_id, venue.venue_name);
        }
    });
}
