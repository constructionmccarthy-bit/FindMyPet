// ============================================
// LOST PETS VB - Main App Logic
// ============================================

// State
let map = null;
let markers = [];
let currentUserLocation = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initForm();
  initFeedFilters();
  initMap();
  initPWAInstall();
  loadPets();
});

// ============================================
// TAB NAVIGATION
// ============================================

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + 'Tab') {
          content.classList.add('active');
        }
      });
      
      // Refresh map when map tab is opened
      if (tabId === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
      }
    });
  });
}

// ============================================
// FORM HANDLING
// ============================================

function initForm() {
  const form = document.getElementById('petForm');
  const photoInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photoPreview');
  const locationBtn = document.getElementById('getLocationBtn');
  
  // Photo preview
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        photoPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        photoPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });
  
  // Get current location
  locationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      locationBtn.textContent = '📍 Getting location...';
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentUserLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          locationBtn.textContent = '✅ Location captured!';
          locationBtn.style.background = '#e8f5e9';
        },
        (error) => {
          locationBtn.textContent = '❌ Location failed';
          alert('Could not get your location. Please enter address manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      type: document.querySelector('input[name="type"]:checked').value,
      species: document.getElementById('species').value,
      breed: document.getElementById('breed').value || 'Unknown',
      color: document.getElementById('color').value,
      description: document.getElementById('description').value,
      location: document.getElementById('location').value,
      lat: currentUserLocation ? currentUserLocation.lat : 36.8529,
      lng: currentUserLocation ? currentUserLocation.lng : -75.9780,
      contactEmail: document.getElementById('contact').value,
      photoUrl: '',
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Upload photo if selected
    const photoFile = document.getElementById('photo').files[0];
    if (photoFile) {
      try {
        const photoRef = storage.ref('photos/' + Date.now() + '_' + photoFile.name);
        await photoRef.put(photoFile);
        formData.photoUrl = await photoRef.getDownloadURL();
      } catch (error) {
        console.error('Photo upload failed:', error);
        showMessage('Photo upload failed, but report was submitted', 'error');
      }
    }
    
    // Save to Firestore
    try {
      await db.collection('pets').add(formData);
      showMessage('🐾 Report submitted successfully!', 'success');
      form.reset();
      photoPreview.classList.add('hidden');
      document.getElementById('getLocationBtn').textContent = '📍 Use Current Location';
      document.getElementById('getLocationBtn').style.background = '';
      currentUserLocation = null;
      
      // Refresh feed
      loadPets();
    } catch (error) {
      console.error('Submit failed:', error);
      showMessage('Failed to submit report. Please try again.', 'error');
    }
  });
}

function showMessage(text, type) {
  const messageEl = document.getElementById('formMessage');
  messageEl.textContent = text;
  messageEl.className = 'message ' + type;
  messageEl.classList.remove('hidden');
  setTimeout(() => messageEl.classList.add('hidden'), 5000);
}

// ============================================
// FEED & FILTERING
// ============================================

function initFeedFilters() {
  document.getElementById('refreshFeed').addEventListener('click', loadPets);
  document.getElementById('filterSpecies').addEventListener('change', loadPets);
  document.getElementById('filterType').addEventListener('change', loadPets);
}

async function loadPets() {
  const feedEl = document.getElementById('petsFeed');
  feedEl.innerHTML = '<div class="loading">Loading reports...</div>';
  
  try {
    // Don't use orderBy first - just get recent pets
    let query = db.collection('pets').where('status', '==', 'active').limit(50);
    
    const speciesFilter = document.getElementById('filterSpecies').value;
    const typeFilter = document.getElementById('filterType').value;
    
    let pets = [];
    const snapshot = await query.get();
    
    snapshot.forEach(doc => {
      pets.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by createdAt client-side, handle nulls
    pets.sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.toDate().getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.toDate().getTime() : 0;
      return bTime - aTime;
    });
    
    // Apply filters
    if (speciesFilter) {
      pets = pets.filter(p => p.species === speciesFilter);
    }
    if (typeFilter) {
      pets = pets.filter(p => p.type === typeFilter);
    }
    
    renderPets(pets);
  } catch (error) {
    console.error('Load failed:', error);
    feedEl.innerHTML = '<div class="loading">Failed to load reports. Check Firebase config.</div>';
  }
}

function renderPets(pets) {
  const feedEl = document.getElementById('petsFeed');
  
  if (pets.length === 0) {
    feedEl.innerHTML = '<div class="loading">No reports yet. Be the first to post!</div>';
    return;
  }
  
  feedEl.innerHTML = pets.map(pet => `
    <div class="pet-card" onclick="showPetModal('${pet.id}')">
      <div class="pet-card-header ${pet.type}">
        <span class="badge ${pet.type}">${pet.type === 'lost' ? '🔴 LOST' : '🟢 FOUND'}</span>
        <span>${pet.species.charAt(0).toUpperCase() + pet.species.slice(1)}</span>
      </div>
      <div class="pet-card-body">
        ${pet.photoUrl ? `<img src="${pet.photoUrl}" alt="${pet.species}" class="pet-card-photo">` : '<div class="pet-card-photo" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">🐾</div>'}
        <div class="pet-card-info">
          <h3>${pet.breed || pet.species}</h3>
          <p>${pet.color}</p>
          <p class="location">📍 ${pet.location}</p>
          <p class="date">${formatDate(pet.createdAt)}</p>
        </div>
      </div>
    </div>
  `).join('');
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' days ago';
  return date.toLocaleDateString();
}

// ============================================
// PET DETAILS MODAL
// ============================================

async function showPetModal(petId) {
  try {
    const doc = await db.collection('pets').doc(petId).get();
    if (!doc.exists) return;
    
    const pet = doc.data();
    const modal = document.getElementById('petModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
      ${pet.photoUrl ? `<img src="${pet.photoUrl}" alt="${pet.species}" class="modal-pet-photo">` : '<div class="modal-pet-photo" style="display:flex;align-items:center;justify-content:center;font-size:5rem;background:#f5f5f5;">🐾</div>'}
      <div class="modal-body">
        <span class="modal-type ${pet.type}">${pet.type === 'lost' ? '🔴 LOST' : '🟢 FOUND'}</span>
        <h2>${pet.breed || pet.species}</h2>
        <p class="species">${pet.species.charAt(0).toUpperCase() + pet.species.slice(1)} • ${pet.color}</p>
        
        <div class="description">
          <strong>Description:</strong><br>
          ${pet.description}
        </div>
        
        <div class="info-row">📍 <strong>Last seen:</strong> ${pet.location}</div>
        <div class="info-row">📅 <strong>Posted:</strong> ${formatDate(pet.createdAt)}</div>
        
        <button class="modal-contact-btn" onclick="window.location.href='mailto:${pet.contactEmail}?subject=${pet.type === 'lost' ? 'Found' : 'Re:'} ${pet.breed || pet.species} - Lost Pets VB'">
          ✉️ Contact Owner
        </button>
      </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Close modal handlers
    modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
  } catch (error) {
    console.error('Modal error:', error);
  }
}

// ============================================
// MAP
// ============================================

function initMap() {
  // Wait for map tab to be shown
  const mapTab = document.getElementById('mapTab');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        if (!mapTab.classList.contains('active')) return;
        if (map) return;
        
        // Initialize map
        map = L.map('map').setView([36.8529, -75.9780], 11);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Map filters
        document.getElementById('showLost').addEventListener('change', updateMapMarkers);
        document.getElementById('showFound').addEventListener('change', updateMapMarkers);
        
        loadPetsForMap();
      }
    });
  });
  
  observer.observe(mapTab, { attributes: true });
}

async function loadPetsForMap() {
  try {
    const snapshot = await db.collection('pets')
      .where('status', '==', 'active')
      .get();
    
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    snapshot.forEach(doc => {
      const pet = doc.data();
      
      const lostIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#D32F2F;color:white;padding:8px 12px;border-radius:50%;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);">🔴</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      const foundIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#388E3C;color:white;padding:8px 12px;border-radius:50%;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);">🟢</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      const marker = L.marker([pet.lat, pet.lng], {
        icon: pet.type === 'lost' ? lostIcon : foundIcon
      }).addTo(map);
      
      const popupContent = `
        <strong>${pet.type === 'lost' ? '🔴 LOST' : '🟢 FOUND'}</strong><br>
        <strong>${pet.breed || pet.species}</strong><br>
        ${pet.color}<br>
        <small>${pet.location}</small><br>
        <button onclick="showPetModal('${doc.id}')" style="margin-top:5px;padding:5px 10px;cursor:pointer;">View Details</button>
      `;
      
      marker.bindPopup(popupContent);
      markers.push(marker);
    });
  } catch (error) {
    console.error('Map load error:', error);
  }
}

function updateMapMarkers() {
  const showLost = document.getElementById('showLost').checked;
  const showFound = document.getElementById('showFound').checked;
  
  markers.forEach(marker => {
    const isLost = marker.getPopup().getContent().includes('🔴 LOST');
    if (isLost && !showLost) marker.setOpacity(0);
    else if (!isLost && !showFound) marker.setOpacity(0);
    else marker.setOpacity(1);
  });
}

// ============================================
// PWA INSTALL
// ============================================

function initPWAInstall() {
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('addToHomeBtn').classList.remove('hidden');
  });
  
  document.getElementById('addToHomeBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('addToHomeBtn').classList.add('hidden');
    }
    deferredPrompt = null;
  });
}
