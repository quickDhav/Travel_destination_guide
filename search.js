/**
 * TravelGo - Dynamic Search & API Integration Script
 * Handles live weather (Open-Meteo) and destination summaries (Wikipedia)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize search form handler on the Home page
  const searchForm = document.getElementById('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearchSubmit);
  }

  // 2. Initialize booking page auto-fill handler if on plan.html
  if (window.location.pathname.includes('plan.html')) {
    autoFillBookingForm();
    
    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
      bookingForm.addEventListener('submit', handleBookingSubmit);
    }
  }

  // 3. Initialize destinations filtering logic
  initCategoryFilters();

  // 4. Initialize newsletter subscription handler
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', handleNewsletterSubmit);
  }
});

/**
 * Handles the search submission on the Home page
 */
async function handleSearchSubmit(e) {
  e.preventDefault();

  const destinationInput = document.getElementById('destination').value.trim();
  const dateInput = document.getElementById('date').value;

  if (!destinationInput) return;

  const resultsSection = document.getElementById('search-results-section');
  const resultsContainer = document.getElementById('search-results-container');

  // Show the results section and display a premium skeleton loader
  resultsSection.classList.remove('d-none');
  resultsContainer.innerHTML = getSkeletonLoaderHTML();

  // Smooth scroll to the results section
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    // Run Wikipedia and Geocoding calls in parallel
    const [wikiData, geoData] = await Promise.allSettled([
      fetchWikipediaSummary(destinationInput),
      fetchGeocodingData(destinationInput)
    ]);

    const destinationDetails = wikiData.status === 'fulfilled' ? wikiData.value : null;
    const locationCoords = geoData.status === 'fulfilled' ? geoData.value : null;

    let weatherData = null;
    if (locationCoords) {
      weatherData = await fetchWeatherData(locationCoords.latitude, locationCoords.longitude);
    }

    // Build the page content
    renderSearchResults(destinationInput, dateInput, destinationDetails, locationCoords, weatherData);
  } catch (error) {
    console.error('Error fetching travel data:', error);
    resultsContainer.innerHTML = `
      <div class="alert alert-danger rounded-4 p-4 text-center shadow-sm" role="alert">
        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
        <h4 class="fw-bold">Something went wrong</h4>
        <p class="mb-0">We couldn't retrieve the details for "${destinationInput}". Please check your internet connection and try again.</p>
      </div>
    `;
  }
}

/**
 * Fetch destination summary from Wikipedia REST API
 */
async function fetchWikipediaSummary(query) {
  // Normalize query name for Wikipedia
  const formattedQuery = query.split(',')[0].trim();
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(formattedQuery)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Wikipedia page not found');
  }
  return await response.json();
}

/**
 * Fetch latitude & longitude coordinates from Open-Meteo Geocoding API
 */
async function fetchGeocodingData(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Geocoding failed');
  }
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }
  return data.results[0]; // Return the first matching result
}

/**
 * Fetch weather forecast data from Open-Meteo Forecast API
 */
async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Weather fetching failed');
  }
  return await response.json();
}

/**
 * Maps the WMO Weather Code to Description, Icon, and Recommendation
 */
function getWeatherDetails(code) {
  const mapping = {
    0: { icon: 'fa-sun', desc: 'Clear Sunny Sky', rec: 'Ideal weather for sightseeing, walking tours, and outdoor photography.' },
    1: { icon: 'fa-cloud-sun', desc: 'Mainly Clear', rec: 'Great day for outdoor activities. Perfect for city exploring.' },
    2: { icon: 'fa-cloud-sun', desc: 'Partly Cloudy', rec: 'Pleasant weather. A light jacket might be handy for late evening.' },
    3: { icon: 'fa-cloud', desc: 'Overcast Cloudy', rec: 'Good conditions for museum visits, indoor monuments, or cafes.' },
    45: { icon: 'fa-smog', desc: 'Foggy', rec: 'Low visibility. Stay safe if driving; perfect for cozy indoor cafes.' },
    48: { icon: 'fa-smog', desc: 'Depositing Rime Fog', rec: 'Chilly fog. Wrap up warm and explore indoor museums.' },
    51: { icon: 'fa-cloud-rain', desc: 'Light Drizzle', rec: 'Slight drizzle. Carry a compact travel umbrella just in case.' },
    53: { icon: 'fa-cloud-rain', desc: 'Moderate Drizzle', rec: 'A steady drizzle. A raincoat or umbrella is highly recommended.' },
    55: { icon: 'fa-cloud-rain', desc: 'Dense Drizzle', rec: 'Heavy drizzle. Consider scheduling indoor exhibits.' },
    61: { icon: 'fa-cloud-showers-heavy', desc: 'Slight Rain', rec: 'Light rain showers. Keep an umbrella handy while exploring.' },
    63: { icon: 'fa-cloud-showers-heavy', desc: 'Moderate Rain', rec: 'Rainy day. Perfect time to visit art galleries and indoor malls.' },
    65: { icon: 'fa-cloud-showers-heavy', desc: 'Heavy Rain', rec: 'Torrential rain. Recommended to plan indoor tours or a spa day.' },
    71: { icon: 'fa-snowflake', desc: 'Slight Snowfall', rec: 'Magical light snow! Wrap up in heavy layers and enjoy the winter vibe.' },
    73: { icon: 'fa-snowflake', desc: 'Moderate Snowfall', rec: 'Steady snowfall. Ideal for winter sports or enjoying a warm beverage.' },
    75: { icon: 'fa-snowflake', desc: 'Heavy Snowfall', rec: 'Thick snow. Watch out for travel disruptions. Keep warm indoors.' },
    77: { icon: 'fa-snowflake', desc: 'Snow Grains', rec: 'Tiny ice grains. Wear protective winter gear.' },
    80: { icon: 'fa-cloud-showers-water', desc: 'Slight Rain Showers', rec: 'Passing showers. Carry an umbrella, but expect clearing skies soon.' },
    81: { icon: 'fa-cloud-showers-water', desc: 'Moderate Rain Showers', rec: 'On-and-off rain showers. Stay close to indoor spots.' },
    82: { icon: 'fa-cloud-showers-water', desc: 'Violent Rain Showers', rec: 'Sudden heavy downpour. Wait it out in a coffee shop or museum.' },
    85: { icon: 'fa-snowflake', desc: 'Slight Snow Showers', rec: 'Chilly snow showers. Dress in warm windproof gear.' },
    86: { icon: 'fa-snowflake', desc: 'Heavy Snow Showers', rec: 'Heavy snow squalls. Best to reschedule outdoor excursions.' },
    95: { icon: 'fa-bolt', desc: 'Thunderstorm', rec: 'Stormy skies. Stay safe indoors. Avoid high spots and open water.' },
    96: { icon: 'fa-bolt', desc: 'Thunderstorm with Hail', rec: 'Hail and lightning. Seek shelter immediately in a solid building.' },
    99: { icon: 'fa-bolt', desc: 'Heavy Thunderstorm with Hail', rec: 'Severe storm alert. Avoid traveling outdoors. Stay indoors.' }
  };

  return mapping[code] || { icon: 'fa-cloud-sun', desc: 'Partly Cloudy', rec: 'Dress in comfortable layers and enjoy your trip.' };
}

/**
 * Returns the HTML structure of a loading skeleton
 */
function getSkeletonLoaderHTML() {
  return `
    <div class="results-card p-4 p-md-5">
      <div class="row g-4 align-items-center">
        <div class="col-md-6">
          <div class="skeleton skeleton-image rounded-4"></div>
        </div>
        <div class="col-md-6">
          <div class="skeleton skeleton-text title"></div>
          <div class="skeleton skeleton-text w-100"></div>
          <div class="skeleton skeleton-text w-100"></div>
          <div class="skeleton skeleton-text w-75"></div>
          <div class="skeleton skeleton-text w-50 mt-4"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the fetched data into the page container
 */
function renderSearchResults(queryName, targetDate, wiki, geo, weather) {
  const resultsContainer = document.getElementById('search-results-container');
  
  // 1. Determine Title & Country
  const title = wiki && wiki.title ? wiki.title : (geo && geo.name ? geo.name : queryName);
  const country = geo && geo.country ? geo.country : (wiki && wiki.description ? wiki.description : '');
  const region = geo && geo.admin1 && geo.admin1 !== title ? `${geo.admin1}, ` : '';
  const fullLocationString = country ? `${region}${country}` : 'Global Destination';

  // 2. Extract description & image
  const extract = wiki && wiki.extract ? wiki.extract : `Welcome to ${title}! Plan your trip, find the best accommodations, and enjoy an amazing travel experience in this beautiful location.`;
  const imageUrl = wiki && wiki.originalimage && wiki.originalimage.source 
    ? wiki.originalimage.source 
    : `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80`;

  // 3. Process Weather
  let weatherHTML = '';
  let dateText = 'Current Weather';
  
  if (weather) {
    let temperature = weather.current_weather.temperature;
    let weatherCode = weather.current_weather.weathercode;
    let isForecast = false;

    // Check if targetDate is selected and is within the 7 days daily forecast range
    if (targetDate) {
      const selectedDateString = new Date(targetDate).toISOString().split('T')[0];
      const timeArray = weather.daily.time;
      const dateIndex = timeArray.indexOf(selectedDateString);

      if (dateIndex !== -1) {
        // Show max and min temp for forecast date
        const maxTemp = weather.daily.temperature_2m_max[dateIndex];
        const minTemp = weather.daily.temperature_2m_min[dateIndex];
        temperature = `${minTemp}°C to ${maxTemp}`;
        weatherCode = weather.daily.weathercode[dateIndex];
        isForecast = true;
        
        // Format date string for display
        const dateObj = new Date(targetDate);
        dateText = `Forecast for ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        // Outside 7 days
        const dateObj = new Date(targetDate);
        dateText = `Forecast for ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (Approx)`;
      }
    }

    const weatherDetails = getWeatherDetails(weatherCode);

    weatherHTML = `
      <div class="weather-widget mb-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 class="text-white-50 text-uppercase fw-bold ls-1 mb-1">${dateText}</h6>
            <div class="fw-bold fs-4">${weatherDetails.desc}</div>
          </div>
          <i class="fas ${weatherDetails.icon} weather-icon-large"></i>
        </div>
        <div class="d-flex align-items-baseline mb-3">
          <span class="weather-temp">${temperature}${typeof temperature === 'number' ? '°C' : ''}</span>
        </div>
        <div class="small opacity-75">
          <i class="fas fa-lightbulb me-2 text-warning"></i>${weatherDetails.rec}
        </div>
      </div>
    `;
  } else {
    weatherHTML = `
      <div class="weather-widget mb-4 bg-secondary">
        <div class="text-center py-3">
          <i class="fas fa-cloud-sun fa-3x mb-2 text-white-50"></i>
          <p class="mb-0 small text-white-50">Weather forecast is currently unavailable for this destination.</p>
        </div>
      </div>
    `;
  }

  // 4. Generate dynamic recommended items (Hotels & Activities)
  const hotelList = [
    { name: `Grand ${title} Palace Hotel`, rating: '4.9', price: '$180', tag: 'Luxury', icon: 'fa-hotel' },
    { name: `Riverside Resort ${title}`, rating: '4.7', price: '$120', tag: 'Premium', icon: 'fa-water' },
    { name: `${title} Boutique Suites`, rating: '4.5', price: '$85', tag: 'Cozy', icon: 'fa-bed' }
  ];

  const tourList = [
    { name: `Historical Guided Landmark Tour`, price: '$45', time: '4 hours', icon: 'fa-monument' },
    { name: `Local Culinary & Tasting Session`, price: '$60', time: '3 hours', icon: 'fa-utensils' },
    { name: `Day Tour & Scenic Photo Walk`, price: '$75', time: '6 hours', icon: 'fa-camera' }
  ];

  let hotelsHTML = hotelList.map(hotel => `
    <div class="d-flex align-items-center p-3 mb-2 rec-item border">
      <div class="bg-light p-2 rounded me-3 text-primary">
        <i class="fas ${hotel.icon} fa-fw fa-lg"></i>
      </div>
      <div class="flex-grow-1 min-w-0">
        <h6 class="mb-0 text-truncate fw-bold text-dark">${hotel.name}</h6>
        <small class="text-muted"><i class="fas fa-star text-warning me-1"></i>${hotel.rating} • ${hotel.tag}</small>
      </div>
      <div class="text-end ms-2">
        <div class="fw-bold text-primary">${hotel.price}</div>
        <small class="text-muted" style="font-size: 0.75rem;">/night</small>
      </div>
    </div>
  `).join('');

  let toursHTML = tourList.map(tour => `
    <div class="d-flex align-items-center p-3 mb-2 rec-item border">
      <div class="bg-light p-2 rounded me-3 text-success">
        <i class="fas ${tour.icon} fa-fw fa-lg"></i>
      </div>
      <div class="flex-grow-1 min-w-0">
        <h6 class="mb-0 text-truncate fw-bold text-dark">${tour.name}</h6>
        <small class="text-muted"><i class="far fa-clock me-1"></i>${tour.time}</small>
      </div>
      <div class="text-end ms-2">
        <div class="fw-bold text-success">${tour.price}</div>
        <small class="text-muted" style="font-size: 0.75rem;">/person</small>
      </div>
    </div>
  `).join('');

  // 5. Final Output Compilation
  const searchResultsHTML = `
    <div class="results-card bg-white p-4 p-md-5 rounded-4 shadow-lg border" data-aos="fade-up">
      <div class="row g-4 g-lg-5">
        <!-- Left Column: Wikipedia details -->
        <div class="col-lg-6">
          <div class="results-image-wrapper rounded-4 shadow-sm mb-4">
            <img src="${imageUrl}" alt="${title}" class="results-image">
            <span class="badge bg-primary position-absolute top-0 end-0 m-3 fs-6 px-3 py-2 shadow-sm">
              <i class="fas fa-map-marker-alt me-1"></i> ${title}
            </span>
          </div>
          <h2 class="display-6 fw-bold mb-1 text-dark">${title}</h2>
          <p class="text-primary fw-medium mb-3"><i class="fas fa-globe me-2"></i>${fullLocationString}</p>
          <p class="text-muted mb-4 lead" style="font-size: 1.05rem; line-height: 1.6;">${extract}</p>
          
          ${wiki && wiki.content_urls ? `
            <a href="${wiki.content_urls.desktop.page}" target="_blank" class="btn btn-outline-secondary rounded-pill px-4 btn-sm mb-4">
              <i class="fab fa-wikipedia-w me-2"></i>Read Full Article
            </a>
          ` : ''}
        </div>

        <!-- Right Column: Weather & Booking recommendations -->
        <div class="col-lg-6">
          ${weatherHTML}

          <ul class="nav nav-tabs border-bottom mb-3" id="recommendationsTab" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active py-2 px-3 border-0 fw-semibold text-primary" id="hotels-tab" data-bs-toggle="tab" data-bs-target="#hotels-pane" type="button" role="tab" aria-controls="hotels-pane" aria-selected="true">
                <i class="fas fa-hotel me-2"></i>Where to Stay
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link py-2 px-3 border-0 fw-semibold text-success" id="tours-tab" data-bs-toggle="tab" data-bs-target="#tours-pane" type="button" role="tab" aria-controls="tours-pane" aria-selected="false">
                <i class="fas fa-route me-2"></i>What to Do
              </button>
            </li>
          </ul>

          <div class="tab-content mb-4" id="recommendationsTabContent">
            <div class="tab-pane fade show active" id="hotels-pane" role="tabpanel" aria-labelledby="hotels-tab" tabindex="0">
              ${hotelsHTML}
            </div>
            <div class="tab-pane fade" id="tours-pane" role="tabpanel" aria-labelledby="tours-tab" tabindex="0">
              ${toursHTML}
            </div>
          </div>

          <div class="d-grid mt-4">
            <button onclick="redirectToBooking('${encodeURIComponent(title)}', '${targetDate}')" class="btn btn-primary btn-lg rounded-pill py-3 fw-bold shadow">
              <i class="fas fa-paper-plane me-2"></i>Book Trip to ${title}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  resultsContainer.innerHTML = searchResultsHTML;
  
  // Re-init Bootstrap tabs inside dynamic HTML (needed for Bootstrap 5)
  const tabElList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tab"]'));
  tabElList.map(tabEl => new bootstrap.Tab(tabEl));
}

/**
 * Handle booking button click: redirect to plan.html with destination & date params
 */
function redirectToBooking(destination, date) {
  const url = `plan.html?destination=${destination}&date=${date}`;
  window.location.href = url;
}

/**
 * Auto-populates inputs on plan.html from URL parameters
 */
function autoFillBookingForm() {
  const params = new URLSearchParams(window.location.search);
  const destinationParam = params.get('destination');
  const dateParam = params.get('date');

  if (destinationParam) {
    const destinationSelect = document.getElementById('destination');
    if (destinationSelect) {
      const decodedDest = decodeURIComponent(destinationParam);
      
      // Try to find matching option by text
      let found = false;
      for (let i = 0; i < destinationSelect.options.length; i++) {
        const option = destinationSelect.options[i];
        if (option.text.toLowerCase().includes(decodedDest.toLowerCase())) {
          destinationSelect.selectedIndex = i;
          found = true;
          break;
        }
      }

      // If not matching default option, dynamically append new option and select it
      if (!found) {
        const newOption = new Option(decodedDest, decodedDest);
        destinationSelect.add(newOption);
        destinationSelect.value = decodedDest;
      }
    }
  }

  if (dateParam) {
    const checkinInput = document.getElementById('checkin');
    if (checkinInput) {
      checkinInput.value = dateParam;
    }
  }
}

/**
 * Handles interactive filtering of destination cards
 */
function initCategoryFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const destinationItems = document.querySelectorAll('.destination-item');
  
  if (filterButtons.length === 0 || destinationItems.length === 0) return;
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active status styles
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filterValue = btn.getAttribute('data-filter');
      
      destinationItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        
        if (filterValue === 'all' || itemCategory === filterValue) {
          // Show the item
          item.classList.remove('d-none');
        } else {
          // Hide the item
          item.classList.add('d-none');
        }
      });
      
      // Refresh AOS scroll animation positioning if available
      if (typeof AOS !== 'undefined') {
        AOS.refresh();
      }
    });
  });
}

/**
 * Handle booking form submission asynchronously with premium thank-you page
 */
function handleBookingSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const destinationSelect = document.getElementById('destination');
  const destination = destinationSelect.options[destinationSelect.selectedIndex].text;

  const formContainer = document.getElementById('booking-form');
  if (formContainer) {
    formContainer.innerHTML = `
      <div class="text-center py-5" data-aos="zoom-in" data-aos-duration="500">
        <div class="text-success mb-4">
          <i class="fas fa-check-circle fa-5x"></i>
        </div>
        <h3 class="fw-bold text-dark mb-3">Booking Request Received!</h3>
        <p class="text-muted mb-4">Thank you, <strong>${name}</strong>. We have registered your inquiry for <strong>${destination}</strong>. A travel consultant will contact you at <strong>${email}</strong> within 24 hours.</p>
        <a href="index.html" class="btn btn-primary rounded-pill px-5 py-2 fw-semibold text-white text-decoration-none d-inline-block">Back to Home</a>
      </div>
    `;
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Handle newsletter form submission with beautiful checkmark indicator
 */
function handleNewsletterSubmit(e) {
  e.preventDefault();
  const emailInput = e.target.querySelector('input[type="email"]');
  const email = emailInput ? emailInput.value : '';

  const parentCol = e.target.parentElement;
  if (parentCol) {
    parentCol.innerHTML = `
      <div class="text-center py-3" data-aos="fade-up">
        <div class="text-success fs-3 mb-2"><i class="fas fa-circle-check"></i></div>
        <h5 class="fw-bold mb-1">Awesome, you're subscribed!</h5>
        <p class="small opacity-75 mb-0">We've sent a welcome newsletter to <strong>${email}</strong>.</p>
      </div>
    `;
  }
}


