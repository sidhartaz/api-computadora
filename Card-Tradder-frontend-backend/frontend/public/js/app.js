async function loadPartial(targetId, partialPath) {
    const container = document.getElementById(targetId);
    if (!container) return;

    const res = await fetch(partialPath);
    if (!res.ok) {
        throw new Error(`No se pudo cargar ${partialPath}`);
    }

    container.innerHTML = await res.text();
}

async function loadLayout() {
    await loadPartial('auth-placeholder', 'partials/auth.html');
    await loadPartial('app-main-placeholder', 'partials/app-main.html');
    await loadPartial('modals-placeholder', 'partials/modals.html');
}

const AUTH_TOKEN_KEY = 'authToken';
const CURRENT_USER_KEY = 'currentUser';
let authToken = null;
let currentUser = null;
let listingImageBase64 = null;
let historyOrdersCache = [];
let historyLoadPromise = null;
let historyTypeFilter = '';
let clientReservationsCache = [];
let countdownIntervals = [];
let sellerListingsCache = [];
let sellerReservationMap = new Map();
let sellerNotifications = [];
let editingListingId = null;
let listingContactCache = new Map();
let listingPreviewCache = new Map();
let publicationsPage = 1;
let publicationsTotalPages = 1;
const PUBLICATIONS_PAGE_SIZE = 12;
let catalogPage = 1;
let catalogTotalPages = 1;
const CATALOG_PAGE_SIZE = 12;
let lastSearchQuery = '';
let catalogMode = 'listings';

function renderProfileInfo(user) {
    if (!user) return;

    document.getElementById('profile-name').innerText = user.name || '';
    document.getElementById('profile-role').innerText = (user.role || '').toUpperCase();
    document.getElementById('profile-email').innerText = user.email || '';

    const whatsappEl = document.getElementById('profile-whatsapp');
    if (whatsappEl) {
        whatsappEl.innerText = user.contactWhatsapp || 'No configurado';
        whatsappEl.classList.toggle('subtext', !user.contactWhatsapp);
    }
}

function persistSession(token, user) {
    authToken = token;
    currentUser = user;
    if (token) {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    if (user) {
        sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
}

function clearPersistedSession() {
    authToken = null;
    currentUser = null;
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    listingContactCache = new Map();
}

function cacheListingPreview(listingId, image) {
    if (!listingId || !image) return;
    const key = listingId.toString();
    listingPreviewCache.set(key, image);
}

function getStoredSession() {
    let token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    let user = null;

    const userData = sessionStorage.getItem(CURRENT_USER_KEY);
    if (userData) {
        try {
            user = JSON.parse(userData);
        } catch (err) {
            user = null;
        }
    }

    if (!token) {
        const legacyToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (legacyToken) {
            token = legacyToken;
            const legacyUser = localStorage.getItem(CURRENT_USER_KEY);
            if (legacyUser) {
                sessionStorage.setItem(CURRENT_USER_KEY, legacyUser);
                try {
                    user = JSON.parse(legacyUser);
                } catch (err) {
                    user = null;
                }
            }
            sessionStorage.setItem(AUTH_TOKEN_KEY, legacyToken);
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    }

    return { token, user };
}

function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
        headers['Authorization'] = 'Bearer ' + authToken;
    }
    return fetch(url, { ...options, headers });
}

function normalizeListingsPayload(payload) {
    const items = Array.isArray(payload) ? payload : payload.items || payload.listings || [];
    const pagination = Array.isArray(payload)
        ? { total: items.length, page: 1, pageSize: items.length, totalPages: 1 }
        : payload.pagination || {
            total: payload.total ?? items.length,
            page: 1,
            pageSize: items.length,
            totalPages: 1,
        };

    return { items, pagination };
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function formatCountdown(expiresAt) {
    const target = new Date(expiresAt).getTime();
    const diff = target - Date.now();
    if (Number.isNaN(target)) return '';
    if (diff <= 0) return 'Reserva expirada';

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

function clearCountdowns() {
    countdownIntervals.forEach(clearInterval);
    countdownIntervals = [];
}

function isListingReserved(listing) {
    if (!listing) return false;
    const hasOwner = !!listing.reservedBy;
    const expiresAt = listing.reservedUntil ? new Date(listing.reservedUntil).getTime() : null;

    if (expiresAt && !Number.isNaN(expiresAt)) {
        return expiresAt > Date.now();
    }

    return hasOwner;
}

function getIdValue(value) {
    if (!value) return null;
    if (typeof value === 'object' && value._id) return value._id.toString();
    return value.toString();
}

function getCurrentUserId() {
    return getIdValue(currentUser?._id || currentUser?.id || currentUser?._id);
}

function isReservedByCurrentUser(listing) {
    const reservedOwner = getIdValue(listing?.reservedBy);
    const userId = getCurrentUserId();
    return !!reservedOwner && !!userId && reservedOwner === userId;
}

function hasActiveReservationForCurrentUser(listing) {
    const listingId = getIdValue(listing?._id || listing?.id || listing);
    const userId = getCurrentUserId();
    if (!listingId || !userId) return false;

    const activeReservationStatuses = ['reservada', 'pagada'];

    return historyOrdersCache.some(order => {
        const orderListingId = getIdValue(order?.listingId?._id || order?.listingId);
        const buyerId = getIdValue(order?.buyerId);
        return (
            order.type === 'reserva'
            && activeReservationStatuses.includes(order.status)
            && buyerId === userId
            && orderListingId === listingId
        );
    });
}

function canCurrentUserSeeContact(listing) {
    return isReservedByCurrentUser(listing) || hasActiveReservationForCurrentUser(listing);
}

function autoRevealContactIfAllowed(listing) {
    const listingId = getIdValue(listing?._id || listing?.id);
    if (!listingId) return;

    if (canCurrentUserSeeContact(listing)) {
        setTimeout(() => revealContact(listingId), 100);
    }
}

function activateCountdowns(root = document) {
    const timers = root.querySelectorAll('[data-expires-at]');
    timers.forEach((timerEl) => {
        const label = timerEl.querySelector('.countdown-label');
        const pill = timerEl.closest('.availability-pill');
        const expiresAt = timerEl.getAttribute('data-expires-at');
        if (!expiresAt || !label) return;

        const update = () => {
            const text = formatCountdown(expiresAt);
            label.textContent = text;
            if (text === 'Reserva expirada' && pill) {
                pill.classList.remove('available', 'reserved');
                pill.classList.add('unavailable');
                pill.textContent = 'Reserva expirada';
            }
        };

        update();
        const intervalId = setInterval(update, 1000);
        countdownIntervals.push(intervalId);
    });
}

function renderListingCard(listing) {
    const card = listing.card || {};
    const image = listing.imageData || card.images?.large || 'black.jpg';
    const cardName = listing.name || card.name || listing.cardId;
    const listingId = listing.id || listing._id || '';
    const badge = listing.status && listing.status !== 'aprobada'
        ? `<span class="badge-overlay warning">${listing.status.toUpperCase()}</span>`
        : '';

    return `
        <div class="market-card" onclick="showListingDetail('${listingId}','${listing.cardId}')">
            <div class="market-img-box">
                <img src="${image}" alt="${cardName}" onerror="this.src='black.jpg'">
                ${badge}
            </div>
            <div class="market-info">
                <span class="card-game-badge">${card.set?.name || 'Carta'}</span>
                <h4 class="market-title">${cardName}</h4>
                <div class="market-meta">
                    <span class="condition-badge">${listing.condition}</span>
                    <span class="market-price">$${listing.price}</span>
                </div>
            </div>
        </div>
    `;
}

function renderContactCta(listing, itemLabel = 'esta publicación') {
    const listingId = listing._id || listing.id;
    if (!listingId) return '';

    const allowed = canCurrentUserSeeContact(listing);
    const helper = allowed
        ? 'Reserva activa detectada, cargaremos el WhatsApp automáticamente.'
        : 'Solo el comprador con reserva activa podrá ver el contacto.';

    return `
        <div class="contact-card${allowed ? '' : ' disabled'}" id="contact-box-${listingId}">
            <div class="contact-top">
                <div class="contact-heading">
                    <p class="eyebrow">Contacto del vendedor</p>
                    <h4>${itemLabel}</h4>
                    <p class="subtext">${helper}</p>
                </div>
                <div class="contact-chip ${allowed ? 'chip-success' : 'chip-muted'}">
                    <i class="fa-brands fa-whatsapp"></i>
                    <span>${allowed ? 'Reserva activa' : 'Reserva requerida'}</span>
                </div>
            </div>

            <div class="contact-body">
                <div class="contact-compact">
                    <div class="contact-compact__icon"><i class="fa-solid fa-lock"></i></div>
                    <div>
                        <p class="contact-title">WhatsApp protegido</p>
                        <p class="subtext">Mostraremos el número solo cuando el acceso esté autorizado.</p>
                    </div>
                </div>

                <div class="contact-display hidden"></div>

                <div class="contact-actions">
                    <button class="btn-contact" type="button" onclick="event.stopPropagation(); revealContact('${listingId}')">
                        <span class="btn-contact__main"><i class="fa-brands fa-whatsapp"></i> Ver contacto</span>
                        <span class="btn-sub">Se abrirá el chat directo una vez recuperemos el número.</span>
                    </button>
                    <p class="contact-error subtext"></p>
                </div>
            </div>
        </div>
    `;
}

function renderDetailContactCta(listing, itemLabel = 'esta publicación') {
    const listingId = listing._id || listing.id;
    if (!listingId) return '';

    return `
        <div class="contact-card detail-contact" id="contact-box-${listingId}">
            <div class="detail-contact__header">
                <div>
                    <p class="eyebrow">Contacto WhatsApp</p>
                    <h4>${itemLabel}</h4>
                    <p class="subtext contact-helper">Validando privilegios de reserva...</p>
                </div>
                <div class="contact-chip chip-muted">
                    <i class="fa-brands fa-whatsapp"></i><span>Reserva requerida</span>
                </div>
            </div>

            <div class="detail-contact__body">
                <div class="contact-inline">
                    <div class="contact-inline__icon"><i class="fa-brands fa-whatsapp"></i></div>
                    <div>
                        <p class="contact-title">WhatsApp del vendedor</p>
                        <p class="contact-number">Cargando contacto...</p>
                    </div>
                </div>
                <p class="contact-error subtext"></p>
            </div>
        </div>
    `;
}

async function revealContact(listingId) {
    if (!authToken) {
        alert('Debes iniciar sesión para ver el contacto del vendedor.');
        return;
    }

    const normalizedId = getIdValue(listingId);
    const box = document.getElementById(`contact-box-${normalizedId}`);
    if (!box) return;

    const errorEl = box.querySelector('.contact-error');
    const button = box.querySelector('button');
    const displayEl = box.querySelector('.contact-display');
    const actionsEl = box.querySelector('.contact-actions');

    if (errorEl) errorEl.textContent = '';
    if (button) button.disabled = true;
    if (displayEl) displayEl.classList.add('hidden');
    box.classList.remove('contact-ready');
    box.classList.add('contact-loading');

    try {
        let contact = listingContactCache.get(normalizedId);

        if (!contact) {
            const res = await apiFetch(`/api/listings/${normalizedId}/contact`);
            const data = await res.json();

            if (!res.ok) {
                if (errorEl) errorEl.textContent = data.message || 'No se pudo recuperar el contacto.';
                return;
            }

            contact = data.contactWhatsapp;
            listingContactCache.set(normalizedId, contact);
        }

        if (!contact) {
            if (errorEl) errorEl.textContent = 'No hay un número de WhatsApp configurado.';
            return;
        }

        const numeric = contact.replace(/[^0-9]/g, '');
        const whatsappTarget = numeric || contact;
        const link = `https://wa.me/${whatsappTarget.replace(/^\+/, '')}`;

        box.classList.remove('disabled', 'contact-loading');
        box.classList.add('contact-ready');
        if (actionsEl) actionsEl.classList.add('hidden');

        if (displayEl) {
            displayEl.innerHTML = `
                <div class="contact-display-row">
                    <div class="contact-number">
                        <i class="fa-brands fa-whatsapp"></i>
                        <a href="${link}" target="_blank" rel="noopener noreferrer">${contact}</a>
                    </div>
                    <span class="contact-helper">Listo para enviar mensaje por WhatsApp</span>
                </div>
            `;
            displayEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error al cargar contacto', error);
        if (errorEl) errorEl.textContent = 'No se pudo cargar el contacto. Intenta nuevamente.';
    } finally {
        if (button) button.disabled = false;
    }
}

async function hydrateDetailContact(listing) {
    const listingId = getIdValue(listing?._id || listing?.id);
    if (!listingId) return;

    const box = document.getElementById(`contact-box-${listingId}`);
    if (!box) return;

    const errorEl = box.querySelector('.contact-error');
    const numberEl = box.querySelector('.contact-number');
    const helperEl = box.querySelector('.contact-helper');
    const chipEl = box.querySelector('.contact-chip');

    const setChip = (text, variant = 'chip-muted') => {
        if (!chipEl) return;
        chipEl.classList.remove('chip-success', 'chip-muted');
        chipEl.classList.add(variant);
        chipEl.innerHTML = `<i class="fa-brands fa-whatsapp"></i><span>${text}</span>`;
    };

    const setNumber = (content) => {
        if (numberEl) numberEl.innerHTML = content;
    };

    const setHelper = (text) => {
        if (helperEl) helperEl.textContent = text;
    };

    box.classList.remove('contact-ready');
    setChip('Validando acceso');
    setHelper('Validando privilegios de reserva...');
    if (errorEl) errorEl.textContent = '';
    setNumber('Cargando contacto...');

    if (!authToken) {
        setNumber('Inicia sesión para ver el contacto');
        setHelper('Inicia sesión para recuperar el WhatsApp.');
        setChip('Inicio de sesión requerido');
        return;
    }

    try {
        let contact = listingContactCache.get(listingId);

        if (!contact) {
            const res = await apiFetch(`/api/listings/${listingId}/contact`);
            const data = await res.json();

            if (!res.ok) {
                setHelper('Necesitas una reserva activa para ver el WhatsApp.');
                setNumber('No autorizado');
                if (errorEl) errorEl.textContent = data.message || 'No se pudo recuperar el contacto.';
                return;
            }

            contact = data.contactWhatsapp;
            listingContactCache.set(listingId, contact);
        }

        if (!contact) {
            setHelper('El vendedor no ha configurado su WhatsApp.');
            setNumber('Sin número configurado');
            return;
        }

        const numeric = contact.replace(/[^0-9]/g, '');
        const whatsappTarget = numeric || contact;
        const link = `https://wa.me/${whatsappTarget.replace(/^\+/, '')}`;

        setChip('Contacto disponible', 'chip-success');
        setHelper('Listo para enviar mensaje por WhatsApp.');
        setNumber(`<a href="${link}" target="_blank" rel="noopener noreferrer">${contact}</a>`);
        box.classList.add('contact-ready');
    } catch (error) {
        console.error('Error al cargar contacto', error);
        setHelper('No se pudo cargar el contacto.');
        setNumber('No disponible');
        if (errorEl) errorEl.textContent = 'No se pudo cargar el contacto. Intenta nuevamente.';
    }
}

function renderPublicationCard(listing) {
    const card = listing.card || {};
    const seller = listing.sellerId || listing.seller || {};
    const cardName = listing.name || card.name || listing.cardId;
    const image = listing.imageData || card.images?.small || 'black.jpg';
    const isReserved = isListingReserved(listing);
    const available = listing.status === 'aprobada' && listing.isActive !== false && !isReserved;
    const availabilityLabel = isReserved ? 'Reservada' : available ? 'Disponible' : 'No disponible';
    const listingId = listing.id || listing._id;
    const isClient = currentUser && currentUser.role === 'cliente';

    return `
        <div class="publication-card" onclick="showListingDetail('${listingId}','${listing.cardId || ''}')">
            <div class="publication-main">
                <div class="publication-thumb">
                    <img src="${image}" alt="${cardName}" onerror="this.src='black.jpg'">
                </div>
                <div class="publication-info">
                    <div class="publication-title-row">
                        <h4 class="publication-title">${cardName}</h4>
                        <span class="availability-pill ${isReserved ? 'reserved' : available ? 'available' : 'unavailable'}">${availabilityLabel}</span>
                    </div>
                    <p class="publication-desc">${listing.description || 'Sin descripción'}</p>
                    <div class="publication-meta">
                        <span class="seller-chip"><i class="fa-solid fa-user"></i> ${seller.name || 'Vendedor'}</span>
                        <span class="seller-chip"><i class="fa-solid fa-envelope"></i> ${seller.email || 'Correo no disponible'}</span>
                        <span class="seller-chip"><i class="fa-solid fa-tag"></i> ${listing.condition}</span>
                    </div>
                    ${isReserved ? `<div class="reservation-timer" data-expires-at="${listing.reservedUntil}">
                        <i class="fa-regular fa-clock"></i>
                        <span class="countdown-label">Cargando contador...</span>
                    </div>` : ''}
                </div>
                <div class="publication-price">
                    <span>Precio</span>
                    <strong>$${listing.price}</strong>
                    <small>${card.set?.name || 'Set no disponible'}</small>
                </div>
            </div>
            ${available
                ? `<div class="publication-actions">
                    ${isClient
                        ? `<button class="btn-reserve" onclick="event.stopPropagation(); createOrder('${listingId}','reserva')">Reservar</button>`
                        : `<span class="availability-note">Solo los clientes pueden reservar.</span>`
                    }
                    <span class="availability-note">El WhatsApp aparecerá cuando tengas la reserva activa.</span>
                    <button class="btn-secondary ghost" onclick="event.stopPropagation(); showListingDetail('${listingId}','${listing.cardId || ''}')">Ver detalle</button>
                </div>`
                : `<div class="publication-actions disabled">
                    <span class="availability-note">No disponible para compra ni reserva.</span>
                    <button class="btn-secondary ghost" onclick="event.stopPropagation(); showListingDetail('${listingId}','${listing.cardId || ''}')">Ver detalle</button>
                </div>`
            }
            ${renderContactCta(listing, cardName)}
        </div>
    `;
}

function renderFeaturedListing(listing) {
    const card = listing.card || {};
    const seller = listing.sellerId || listing.seller || {};
    const cardName = listing.name || card.name || listing.cardId || 'Publicación';
    const image = listing.imageData || card.images?.large || 'black.jpg';
    const available = listing.status === 'aprobada' && listing.isActive !== false;
    const availabilityLabel = available ? 'Disponible' : 'No disponible';

    return `
        <div class="featured-card">
            <div class="featured-image">
                <img src="${image}" alt="${cardName}" onerror="this.src='black.jpg'">
            </div>
            <div class="featured-info">
                <div class="featured-title-row">
                    <h4>${cardName}</h4>
                    <span class="availability-pill ${available ? 'available' : 'unavailable'}">${availabilityLabel}</span>
                </div>
                <p class="subtext">Vendedor: ${seller.name || 'Vendedor'}${seller.email ? ' • ' + seller.email : ''}</p>
                <div class="tags featured-tags">
                    <span class="tag verification">Búsquedas: ${listing.searchCount || 0}</span>
                    <span class="tag">Condición: ${listing.condition}</span>
                </div>
                <div class="price-box">
                    <span class="currency">$${listing.price}</span>
                    <small>${card.set?.name || 'Set no disponible'}</small>
                </div>
                <div class="featured-actions">
                    <button class="btn-secondary" onclick="showListingDetail('${listing.id || listing._id}','${listing.cardId || ''}')">Ver publicación</button>
                </div>
            </div>
        </div>
    `;
}

async function loadFeaturedListing() {
    const container = document.getElementById('featured-listing');
    if (!container) return;

    container.innerHTML = '<p class="subtext">Buscando publicación destacada...</p>';

    try {
        const res = await fetch('/api/listings/featured');
        const data = await res.json();

        if (!data.listing) {
            container.innerHTML = '<p class="subtext">Aún no hay búsquedas registradas.</p>';
            return;
        }

        container.innerHTML = renderFeaturedListing(data.listing);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="subtext">Error cargando la publicación destacada.</p>';
    }
}

// Cambiar entre login / registro
function toggleAuth(view) {
    document.getElementById('form-login').classList.toggle('hidden');
    document.getElementById('form-register').classList.toggle('hidden');
}

function resetListingForm() {
    document.getElementById('publish-form')?.reset();
    document.getElementById('modal-title').innerText = 'Nueva Publicación';
    document.getElementById('publish-submit-label').innerText = 'Enviar a Revisión';
    listingImageBase64 = null;
    editingListingId = null;

    const whatsappInput = document.getElementById('listing-whatsapp');
    if (whatsappInput) {
        whatsappInput.value = currentUser?.contactWhatsapp || '';
    }
}

function toggleModal(forceOpen = null) {
    const modal = document.getElementById('modalPublish');
    if (!modal) return;

    const isOpen = modal.classList.contains('active');
    const targetState = forceOpen === null ? !isOpen : !!forceOpen;
    const isSeller = currentUser && currentUser.role === 'vendedor';

    if (targetState && !isSeller) {
        alert('Solo los vendedores pueden crear publicaciones.');
        return;
    }

    if (!targetState) {
        resetListingForm();
    }

    modal.classList.toggle('active', targetState);
}

function toggleProfileModal(forceOpen = null) {
    const modal = document.getElementById('modalProfile');
    if (!modal) return;

    const isOpen = modal.classList.contains('active');
    const targetState = forceOpen === null ? !isOpen : !!forceOpen;

    if (targetState && !currentUser) {
        alert('Debes iniciar sesión para editar tu perfil.');
        return;
    }

    modal.classList.toggle('active', targetState);
}

function toggleOrderDetail(forceOpen = null) {
    const modal = document.getElementById('orderDetailModal');
    if (!modal) return;

    const isOpen = modal.classList.contains('active');
    const targetState = forceOpen === null ? !isOpen : !!forceOpen;
    modal.classList.toggle('active', targetState);
}

// Mostrar vista principal (usada por el menú)
function showView(viewName, element) {
    const sections = ['view-home', 'view-dashboard', 'view-catalog', 'view-publications', 'view-admin', 'view-history', 'view-reservations', 'view-card-detail'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById('view-' + viewName);
    if (target) {
        target.classList.remove('hidden');
    } else {
        console.warn('Vista no encontrada:', 'view-' + viewName);
    }

    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    if (element) element.classList.add('active');

    const titles = {
        home: 'Bienvenido',
        dashboard: 'Mi Panel',
        catalog: 'Buscar Cartas',
        publications: 'Publicaciones',
        admin: 'Panel de Administración',
        'card-detail': 'Detalle de Carta',
        history: 'Historial',
        reservations: 'Reservas',
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'Card Trader';

    if (viewName === 'catalog') {
        const query = document.getElementById('searchInput')?.value || '';
        if (!query) loadCatalogListings(catalogPage);
    }

    if (viewName === 'history') {
        loadOrderHistory();
    }

    if (viewName === 'reservations') {
        loadClientReservations();
    }

    if (viewName === 'publications') {
        loadPublicationsBoard();
    }

    if (viewName === 'dashboard') {
        loadFeaturedListing();
        loadSellerListings();
    }
}

function openProfileModal() {
    if (!currentUser) {
        alert('Debes iniciar sesión para editar tu perfil.');
        return;
    }

    document.getElementById('profile-edit-name').value = currentUser.name || '';
    document.getElementById('profile-edit-whatsapp').value = currentUser.contactWhatsapp || '';
    toggleProfileModal(true);
}

// Helper para cambiar de vista desde otras funciones (detalle de carta)
function showSection(sectionId) {
    const sections = ['view-home', 'view-dashboard', 'view-catalog', 'view-publications', 'view-admin', 'view-history', 'view-reservations', 'view-card-detail'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
}

function getMenuItemForView(viewName) {
    return document.querySelector(`.menu-item[data-view="${viewName}"]`);
}

function setLandingViewForRole(user) {
    let landingView = 'home';

    if (user.role === 'vendedor') {
        landingView = 'dashboard';
    }

    if (user.role === 'admin') {
        landingView = 'admin';
    }

    const targetItem = getMenuItemForView(landingView);
    showView(landingView, targetItem);
}

// Al entrar después de login
function enterApp(user) {
    currentUser = user;

    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-app').classList.remove('hidden');

    document.getElementById('user-display-name').innerText = user.name;
    renderProfileInfo(user);

    // Mostrar/ocultar cosas solo admin
    const adminItems = document.querySelectorAll('.admin-only');
    adminItems.forEach(el => {
        el.style.display = (user.role === 'admin') ? 'block' : 'none';
    });

    const sellerItems = document.querySelectorAll('.seller-only');
    sellerItems.forEach(el => {
        el.style.display = (user.role === 'vendedor') ? '' : 'none';
    });

    loadHomeListings();
    loadCatalogListings();
    loadPublicationsBoard();
    loadSellerListings();
    loadOrderHistory();
    loadFeaturedListing();
    if (user.role === 'cliente') {
        loadClientReservations();
    }

    setLandingViewForRole(user);
}

async function loadHomeListings() {
    const container = document.getElementById('home-listings');
    if (!container) return;
    container.innerHTML = '<p>Cargando publicaciones...</p>';

    try {
        const res = await fetch('/api/listings');
        const payload = await res.json();
        const { items } = normalizeListingsPayload(payload);

        if (!items.length) {
            container.innerHTML = '<p>No hay publicaciones aprobadas.</p>';
            return;
        }

        const latest = items.slice(0, 4);
        container.innerHTML = latest.map(renderListingCard).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Error cargando publicaciones.</p>';
    }
}

function updateCatalogPagination(pagination = {}) {
    const pagesLabel = document.getElementById('catalog-pages');
    const prevBtn = document.getElementById('catalog-prev');
    const nextBtn = document.getElementById('catalog-next');

    catalogTotalPages = Math.max(pagination.totalPages || 1, 1);
    catalogPage = Math.min(Math.max(pagination.page || 1, 1), catalogTotalPages);

    if (pagesLabel) {
        pagesLabel.textContent = `Página ${catalogPage} de ${catalogTotalPages}`;
    }

    if (prevBtn) {
        prevBtn.disabled = catalogPage <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = catalogPage >= catalogTotalPages;
    }
}

function renderSearchResultCard(item) {
    const card = item.card || {};
    const listing = (item.listings || [])[0] || null;

    const listingId = listing?.id || '';
    const targetCardId = listing?.cardId || card.id || '';
    const displayName = listing?.name || card.name || listing?.cardId || 'Publicación';
    const coverImage = listing?.imageData || card.images?.large || 'black.jpg';
    const priceLabel = listing ? "$" + listing.price : "Sin vendedores";

    return `
        <div class="market-card" onclick="showListingDetail('${listingId}','${targetCardId}')">
            <div class="market-img-box">
                <img src="${coverImage}" alt="${displayName}" onerror="this.src='black.jpg'">
            </div>
            <div class="market-info">
                <h4>${displayName}</h4>
                <span class="market-price">
                    ${priceLabel}
                </span>
            </div>
        </div>
    `;
}

function renderSearchResults(container, results = []) {
    container.innerHTML = results.map(renderSearchResultCard).join('');
}

async function loadCatalogListings(page = 1) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    catalogMode = 'listings';
    lastSearchQuery = '';
    catalogPage = page;
    container.innerHTML = '<p>Cargando catálogo...</p>';

    try {
        const res = await fetch(`/api/listings?page=${page}&limit=${CATALOG_PAGE_SIZE}`);
        const payload = await res.json();
        const { items, pagination } = normalizeListingsPayload(payload);

        updateCatalogPagination(pagination);

        if (!items.length) {
            container.innerHTML = '<p>No hay publicaciones activas.</p>';
            return;
        }

        container.innerHTML = items.map(renderListingCard).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Error cargando catálogo.</p>';
    }
}

async function loadSearchResults(query, page = 1) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    catalogMode = 'search';
    lastSearchQuery = query;
    catalogPage = page;
    container.innerHTML = page > 1 ? '<p>Cargando resultados...</p>' : '<p>Buscando...</p>';

    try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}&page=${page}&limit=${CATALOG_PAGE_SIZE}`);
        const data = await res.json();
        const pagination = data.pagination || { page, totalPages: 1, total: data.results?.length || 0 };

        updateCatalogPagination(pagination);

        if (!data.results || data.results.length === 0) {
            container.innerHTML = '<p>No se encontraron cartas.</p>';
            return;
        }

        renderSearchResults(container, data.results);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Error buscando cartas.</p>';
    }
}

function goToCatalogPage(targetPage) {
    if (catalogMode === 'search' && lastSearchQuery) {
        loadSearchResults(lastSearchQuery, targetPage);
    } else {
        loadCatalogListings(targetPage);
    }
}

function bindCatalogPaginationControls() {
    const prevBtn = document.getElementById('catalog-prev');
    const nextBtn = document.getElementById('catalog-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (catalogPage > 1) {
                goToCatalogPage(catalogPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (catalogPage < catalogTotalPages) {
                goToCatalogPage(catalogPage + 1);
            }
        });
    }
}

function updatePublicationsPagination(pagination = {}) {
    const pagesLabel = document.getElementById('publications-pages');
    const prevBtn = document.getElementById('publications-prev');
    const nextBtn = document.getElementById('publications-next');

    publicationsTotalPages = Math.max(pagination.totalPages || 1, 1);
    publicationsPage = Math.min(Math.max(pagination.page || 1, 1), publicationsTotalPages);

    if (pagesLabel) {
        pagesLabel.textContent = `Página ${publicationsPage} de ${publicationsTotalPages}`;
    }

    if (prevBtn) {
        prevBtn.disabled = publicationsPage <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = publicationsPage >= publicationsTotalPages;
    }
}

async function loadPublicationsBoard(page = 1) {
    const container = document.getElementById('publications-list');
    if (!container) return;
    container.innerHTML = '<p class="subtext">Cargando publicaciones...</p>';

    try {
        const res = await fetch(`/api/listings?page=${page}&limit=${PUBLICATIONS_PAGE_SIZE}`);
        const payload = await res.json();
        const { items, pagination } = normalizeListingsPayload(payload);

        const counter = document.getElementById('publications-count');
        if (counter) counter.textContent = pagination.total || items.length;

        updatePublicationsPagination(pagination);

        if (!items.length) {
            container.innerHTML = '<p>No hay publicaciones activas.</p>';
            return;
        }

        container.innerHTML = items.map(renderPublicationCard).join('');
        clearCountdowns();
        activateCountdowns(container);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Error cargando publicaciones.</p>';
    }
}

function bindPublicationsPaginationControls() {
    const prevBtn = document.getElementById('publications-prev');
    const nextBtn = document.getElementById('publications-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (publicationsPage > 1) {
                loadPublicationsBoard(publicationsPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (publicationsPage < publicationsTotalPages) {
                loadPublicationsBoard(publicationsPage + 1);
            }
        });
    }
}

async function loadSellerListings() {
    const container = document.getElementById('seller-listings');
    if (!container) return;

    if (!currentUser || currentUser.role !== 'vendedor') {
        container.innerHTML = '<p class="subtext">Solo los vendedores pueden gestionar publicaciones.</p>';
        renderSellerNotifications();
        return;
    }

    container.innerHTML = '<p>Cargando tus publicaciones...</p>';
    renderSellerNotifications(true);

    try {
        const [mineRes, reservationsRes] = await Promise.all([
            apiFetch('/api/listings/mine'),
            authToken ? apiFetch('/api/orders?type=reserva') : Promise.resolve({ ok: false, json: async () => ({ orders: [] }) })
        ]);

        if (!mineRes.ok) {
            throw new Error('No se pudieron cargar tus publicaciones');
        }

        const minePayload = await mineRes.json();
        const mine = (minePayload.listings || []).filter(lst => (lst.sellerId?._id || lst.sellerId) === currentUser.id);
        const reservationsPayload = reservationsRes.ok ? await reservationsRes.json() : { orders: [] };
        const reservations = reservationsPayload.orders || [];

        sellerListingsCache = mine;
        sellerReservationMap = new Map();
        sellerNotifications = [];

        const pickPrimaryReservation = (current, incoming) => {
            if (!current) return incoming;

            const activeStatuses = ['pendiente', 'reservada'];
            const currentActive = activeStatuses.includes(current.status);
            const incomingActive = activeStatuses.includes(incoming.status);

            const currentDate = new Date(current.createdAt || current.updatedAt || 0).getTime();
            const incomingDate = new Date(incoming.createdAt || incoming.updatedAt || 0).getTime();

            if (currentActive && incomingActive) {
                return incomingDate < currentDate ? incoming : current;
            }

            if (currentActive || incomingActive) {
                return currentActive ? current : incoming;
            }

            return incomingDate < currentDate ? incoming : current;
        };

        reservations.forEach(order => {
            const listingKey = order.listingId?._id || order.listingId;
            const normalizedKey = listingKey ? String(listingKey) : null;

            if (normalizedKey) {
                const existing = sellerReservationMap.get(normalizedKey);
                const chosen = pickPrimaryReservation(existing, order);
                sellerReservationMap.set(normalizedKey, chosen);
            }
        });

        sellerReservationMap.forEach((order) => {
            (order.notifications || []).forEach(note => {
                if (note.recipient === 'seller') {
                    sellerNotifications.push({
                        ...note,
                        listingName: order.listingId?.name || order.cardId || 'Publicación',
                        listingId: order.listingId?._id,
                        orderId: order._id,
                        buyer: order.buyerId,
                        expiresAt: order.reservationExpiresAt,
                        status: order.status,
                    });
                }
            });
        });

        if (!mine.length) {
            container.innerHTML = '<p>No tienes publicaciones aún.</p>';
        } else {
            container.innerHTML = mine
                .map((lst) => {
                    const listingKey = String(lst._id || lst.id || '');
                    return renderSellerListing(lst, sellerReservationMap.get(listingKey));
                })
                .join('');
            clearCountdowns();
            activateCountdowns(container);
        }

        renderSellerNotifications();
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>Error cargando tus publicaciones.</p>';
        renderSellerNotifications();
    }
}

function renderSellerNotifications(isLoading = false) {
    const badge = document.getElementById('notification-badge');
    const counter = document.getElementById('notification-counter');
    const list = document.getElementById('notification-list');

    if (!badge || !counter || !list) return;

    if (!currentUser || currentUser.role !== 'vendedor') {
        list.innerHTML = '<p class="subtext">Inicia sesión como vendedor para ver notificaciones.</p>';
        badge.classList.add('hidden');
        counter.textContent = '0';
        return;
    }

    if (isLoading) {
        list.innerHTML = '<p class="subtext">Cargando notificaciones...</p>';
        badge.classList.add('hidden');
        counter.textContent = '0';
        return;
    }

    if (!sellerNotifications.length) {
        list.innerHTML = '<p class="subtext">No hay notificaciones de reserva.</p>';
        badge.classList.add('hidden');
        counter.textContent = '0';
        return;
    }

    badge.textContent = sellerNotifications.length;
    badge.classList.remove('hidden');
    counter.textContent = sellerNotifications.length;
    list.innerHTML = sellerNotifications.map(note => `
        <div class="notice-item">
            <div class="notice-icon"><i class="fa-regular fa-bell"></i></div>
            <div class="notice-body">
                <p class="notice-title">${note.message}</p>
                <p class="notice-meta">
                    ${note.listingName || 'Publicación'}
                    ${note.buyer?.name ? ' · ' + note.buyer.name : ''}
                    ${note.expiresAt ? ' · vence ' + formatDate(note.expiresAt) : ''}
                </p>
            </div>
            <div class="notice-actions">
                <button class="btn-secondary ghost" onclick="showListingDetail('${note.listingId || ''}','')">Ver</button>
            </div>
        </div>
    `).join('');
}

function toggleNotifications(forceClose = false) {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    const shouldOpen = forceClose ? false : dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !shouldOpen);
}

document.addEventListener('click', (event) => {
    const wrapper = document.querySelector('.notification-wrapper');
    const dropdown = document.getElementById('notification-dropdown');
    if (!wrapper || !dropdown) return;

    if (!wrapper.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

function renderSellerListing(listing, reservation) {
    const card = listing.card || {};
    const image = listing.imageData || card.images?.small || 'black.jpg';
    const cardName = listing.name || card.name || listing.cardId;
    const statusClass = listing.status === 'aprobada' ? 'delivered' : 'pending';
    const isReserved = isListingReserved(listing);
    const availability = isReserved
        ? 'Reservada'
        : listing.status === 'aprobada' && listing.isActive !== false
            ? 'Disponible'
            : 'No disponible';
    const listingId = listing.id || listing._id;
    const hasReservation = reservation && reservation.status !== 'cancelada';
    const buyer = reservation?.buyerId || {};
    const expiresAt = reservation?.reservationExpiresAt || listing.reservedUntil;

    return `
        <div class="seller-publication">
            <div class="seller-thumb">
                <img src="${image}" alt="${cardName}" onerror="this.src='black.jpg'">
            </div>
            <div class="seller-pub-info">
                <div class="seller-pub-title-row">
                    <div class="seller-pub-title">${cardName}</div>
                    <div class="seller-pub-meta">
                        <span class="condition-badge">${listing.condition}</span>
                        <span class="status-pill ${statusClass}">${listing.status}</span>
                        <span class="availability-pill ${isReserved ? 'reserved' : availability === 'Disponible' ? 'available' : 'unavailable'}">${availability}</span>
                    </div>
                </div>
                <div class="seller-pub-price">$${listing.price}</div>
                ${hasReservation ? `<div class="seller-reservation-box">
                    <div class="seller-reservation-head">
                        <div>
                            <p class="reservation-label">Reserva creada</p>
                            <p class="reservation-meta">Cliente: ${buyer.name || 'Cliente'} · ${buyer.email || 'Correo no disponible'}</p>
                        </div>
                        ${expiresAt ? `<div class="reservation-timer" data-expires-at="${expiresAt}">
                            <i class="fa-regular fa-clock"></i>
                            <span class="countdown-label">Cargando contador...</span>
                        </div>` : ''}
                    </div>
                    <div class="seller-reservation-actions">
                        <button class="btn-primary" onclick="handleReservationDecision('${reservation._id}','approve')">Aprobar</button>
                        <button class="btn-secondary danger" onclick="handleReservationDecision('${reservation._id}','reject')">Rechazar</button>
                    </div>
                </div>` : '<p class="subtext">Sin reservas activas.</p>'}
            </div>
            <div class="seller-pub-actions">
                <button class="btn-secondary ghost" onclick="showListingDetail('${listingId}','${listing.cardId || ''}')">Ver</button>
                <button class="btn-secondary" onclick="startEditListing('${listingId}')">Editar</button>
                <button class="btn-secondary danger" onclick="deleteListing('${listingId}')">Eliminar</button>
            </div>
        </div>
    `;
}

function startEditListing(listingId) {
    if (!authToken || !currentUser || currentUser.role !== 'vendedor') {
        alert('Solo los vendedores pueden editar publicaciones');
        return;
    }

    const listing = sellerListingsCache.find(lst => (lst._id || lst.id) === listingId);
    if (!listing) {
        alert('No se encontró la publicación seleccionada');
        return;
    }

    editingListingId = listingId;
    document.getElementById('modal-title').innerText = 'Editar publicación';
    document.getElementById('publish-submit-label').innerText = 'Guardar cambios';

    document.getElementById('listing-name').value = listing.name || '';
    document.getElementById('listing-card-id').value = listing.cardId || '';
    document.getElementById('listing-price').value = listing.price || '';
    document.getElementById('listing-condition').value = listing.condition || 'Mint';
    document.getElementById('listing-description').value = listing.description || '';
    document.getElementById('listing-whatsapp').value = listing.contactWhatsapp || '';
    listingImageBase64 = listing.imageData || null;

    toggleModal(true);
}

async function handleReservationDecision(orderId, action) {
    if (!authToken || !currentUser || currentUser.role !== 'vendedor') {
        alert('Solo los vendedores pueden gestionar reservas');
        return;
    }

    const status = action === 'reject' ? 'cancelada' : 'reservada';
    const note = action === 'reject'
        ? 'Reserva rechazada por el vendedor'
        : 'Reserva aprobada por el vendedor';

    try {
        const res = await apiFetch(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, note })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.message || 'No se pudo actualizar la reserva');
            return;
        }

        alert('Estado de la reserva actualizado');
        loadSellerListings();
        loadPublicationsBoard();
        loadOrderHistory();
    } catch (error) {
        console.error(error);
        alert('Error al actualizar la reserva');
    }
}

async function deleteListing(listingId) {
    if (!authToken || !currentUser || currentUser.role !== 'vendedor') {
        return alert('Solo vendedores pueden eliminar publicaciones');
    }

    const confirmDelete = confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.');
    if (!confirmDelete) return;

    try {
        const res = await apiFetch(`/api/listings/${listingId}`, { method: 'DELETE' });
        const data = await res.json();

        if (!res.ok) {
            return alert(data.message || 'No se pudo eliminar la publicación');
        }

        alert('Publicación eliminada con éxito');
        loadSellerListings();
        loadPublicationsBoard();
        loadCatalogListings();
        loadHomeListings();
        loadOrderHistory();
    } catch (error) {
        console.error(error);
        alert('Error al eliminar la publicación');
    }
}

function logout() {
    clearPersistedSession();
    location.reload();
}

// =============== ADMIN: USUARIOS ==================
async function loadAdminUsers() {
    if (!authToken) return alert('No autenticado');

    const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': 'Bearer ' + authToken }
    });

    const data = await res.json();
    if (!res.ok) {
        return alert('Error: ' + data.message);
    }

    const table = document.getElementById('admin-users-table');
    table.innerHTML = `
        <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Activo</th>
            <th>Acciones</th>
        </tr>
        ${data.users.map(u => `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.role}</td>
                <td>${u.isActive ? 'Sí' : 'No'}</td>
                <td>
                    <button onclick="promoteToSeller('${u._id}')">Hacer vendedor</button>
                    <button onclick="deleteUser('${u._id}')">Eliminar</button>
                </td>
            </tr>
        `).join('')}
    `;
}

async function promoteToSeller(userId) {
    if (!confirm('¿Convertir a vendedor?')) return;
    const res = await fetch('/api/admin/users/' + userId, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify({ role: 'vendedor' })
    });
    const data = await res.json();
    if (!res.ok) return alert('Error: ' + data.message);
    loadAdminUsers();
}

async function deleteUser(userId) {
    if (!confirm('¿Eliminar usuario?')) return;
    const res = await fetch('/api/admin/users/' + userId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + authToken }
    });
    const data = await res.json();
    if (!res.ok) return alert('Error: ' + data.message);
    loadAdminUsers();
}

// =============== ADMIN: PUBLICACIONES =============
async function loadPendingPublications() {
    if (!authToken) return alert('No autenticado');

    const res = await apiFetch('/api/admin/publications?status=pendiente');

    const data = await res.json();
    if (!res.ok) {
        return alert('Error: ' + data.message);
    }

    const table = document.getElementById('admin-publications-table');
    table.innerHTML = `
        <tr>
            <th>Carta</th>
            <th>Vendedor</th>
            <th>Precio</th>
            <th>Acciones</th>
        </tr>
        ${data.listings.map(p => `
            <tr>
                <td>${p.card?.name || p.cardId}</td>
                <td>${p.sellerId?.name || 'N/A'} (${p.sellerId?.email || ''})</td>
                <td>${p.price}</td>
                <td>
                    <button onclick="approvePublication('${p._id}')">Aprobar</button>
                    <button onclick="rejectPublication('${p._id}')">Rechazar</button>
                    <button onclick="deletePublication('${p._id}')">Eliminar</button>
                </td>
            </tr>
        `).join('')}
    `;
}

async function approvePublication(id) {
    const res = await apiFetch('/api/admin/publications/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'aprobada' })
    });
    const data = await res.json();
    if (!res.ok) return alert('Error: ' + data.message);
    loadPendingPublications();
}

async function rejectPublication(id) {
    const rejectionReason = prompt('Motivo de rechazo:');
    if (rejectionReason === null) return;
    if (!rejectionReason.trim()) return alert('Debes indicar un motivo.');

    const res = await apiFetch('/api/admin/publications/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rechazada', rejectionReason })
    });
    const data = await res.json();
    if (!res.ok) return alert('Error: ' + data.message);
    loadPendingPublications();
}

async function deletePublication(id) {
    if (!confirm('¿Eliminar publicación?')) return;
    const res = await apiFetch('/api/admin/publications/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert('Error: ' + data.message);
    loadPendingPublications();
}

// =============== REGISTRO =========================
async function handleRegister(e) {
    e.preventDefault();
    console.log("Iniciando registro...");

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const roleElement = document.querySelector('input[name="role"]:checked');
    const role = roleElement ? roleElement.value : 'cliente';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        
        const data = await res.json();
        
        if(res.ok) {
            alert('✅ Registro exitoso. Ahora inicia sesión.');
            toggleAuth('login');
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor.');
    }
}

async function handleListingImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        listingImageBase64 = null;
        return;
    }

    try {
        listingImageBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error('Error leyendo imagen', error);
        alert('No se pudo leer la imagen seleccionada.');
        listingImageBase64 = null;
    }
}

// =============== LOGIN ============================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if(res.ok) {
            persistSession(data.token, data.user);
            enterApp(data.user);
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor.');
    }
}

async function handleProfileSubmit(e) {
    e.preventDefault();

    if (!authToken || !currentUser) {
        alert('Debes iniciar sesión para actualizar tu perfil.');
        return;
    }

    const name = document.getElementById('profile-edit-name').value.trim();
    const contactWhatsapp = document.getElementById('profile-edit-whatsapp').value.trim();
    const payload = {};

    if (name && name !== currentUser.name) {
        payload.name = name;
    }

    if (contactWhatsapp !== (currentUser.contactWhatsapp || '')) {
        payload.contactWhatsapp = contactWhatsapp || null;
    }

    if (!Object.keys(payload).length) {
        alert('No realizaste cambios en tu perfil.');
        return;
    }

    try {
        const res = await apiFetch('/api/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            currentUser = { ...currentUser, ...data.user };
            persistSession(authToken, currentUser);
            renderProfileInfo(currentUser);
            document.getElementById('user-display-name').innerText = currentUser.name;

            const listingWhatsapp = document.getElementById('listing-whatsapp');
            if (listingWhatsapp && !editingListingId) {
                listingWhatsapp.value = currentUser.contactWhatsapp || '';
            }

            toggleProfileModal(false);
            alert('✅ Perfil actualizado.');
        } else {
            alert('❌ Error: ' + (data.message || 'No se pudo actualizar el perfil'));
        }
    } catch (error) {
        console.error('Error al actualizar perfil', error);
        alert('Error de conexión con el servidor.');
    }
}

async function handleCreateListing(e) {
    e.preventDefault();
    if (!authToken || !currentUser) return alert('Debes iniciar sesión como vendedor.');
    if (currentUser.role !== 'vendedor') return alert('Solo los vendedores pueden crear publicaciones.');

    const name = document.getElementById('listing-name').value.trim();
    const cardId = document.getElementById('listing-card-id').value.trim();
    const price = Number(document.getElementById('listing-price').value);
    const condition = document.getElementById('listing-condition').value;
    const description = document.getElementById('listing-description').value;
    const contactWhatsapp = document.getElementById('listing-whatsapp').value.trim();
    const isEditing = !!editingListingId;

    if (!name) {
        alert('Debes ingresar el nombre de la publicación.');
        return;
    }

    try {
        const payload = { name, price, condition, description, imageData: listingImageBase64 };
        if (cardId || isEditing) {
            payload.cardId = cardId || null;
        }

        if (contactWhatsapp || isEditing) {
            payload.contactWhatsapp = contactWhatsapp || null;
        }

        const url = isEditing ? `/api/listings/${editingListingId}` : '/api/listings';
        const method = isEditing ? 'PUT' : 'POST';

        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            alert(isEditing ? '✅ Publicación actualizada.' : '✅ Publicación enviada a revisión.');
            resetListingForm();
            toggleModal(false);
            loadSellerListings();
            loadHomeListings();
            loadCatalogListings();
            loadPublicationsBoard();
            loadOrderHistory();
        } else {
            alert('❌ Error: ' + (data.message || 'No se pudo crear la publicación'));
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor.');
    }
}

function renderStatusBadge(status) {
    const className = {
        pagada: 'success',
        cancelada: 'danger',
        reservada: 'warning',
        pendiente: 'info',
    }[status] || 'info';
    return `<span class="status-pill status-${className}">${status}</span>`;
}

function renderHistoryItem(order) {
    const cardName = order.card?.name || order.listingId?.description || order.listingId?.cardId || 'Carta';
    const listingId = order.listingId?._id || order.listingId?.id || order.listingId;
    const image = order.listingId?.imageData || order.card?.images?.small || 'black.jpg';

    cacheListingPreview(listingId, order.listingId?.imageData);
    const counterpart = currentUser && order.buyerId && order.sellerId
        ? (currentUser.id === (order.buyerId._id || order.buyerId) ? order.sellerId : order.buyerId)
        : null;
    const counterpartName = counterpart?.name || 'Otro usuario';
    const counterpartEmail = counterpart?.email || '';

    const historySteps = (order.history || []).map(step => `
        <div class="history-step">
            <div class="history-step-header">
                ${renderStatusBadge(step.status)}
                <span class="history-step-date">${formatDate(step.changedAt)}</span>
            </div>
            <div class="history-step-body">
                <p class="history-note">${step.note || ''}</p>
                <p class="history-user">${step.changedBy?.name || 'Sistema'}</p>
            </div>
        </div>
    `).join('');

    return `
        <div class="history-card">
            <div class="history-card-header">
                <div class="history-image-wrapper">
                    <img src="${image}" alt="${cardName}" onerror="this.src='black.jpg'">
                </div>
                <div class="history-card-info">
                    <div class="history-card-title">${cardName}</div>
                    <div class="history-card-meta">
                        <span>${order.type === 'reserva' ? 'Reserva' : 'Compra'}</span>
                        ${renderStatusBadge(order.status)}
                        <span class="history-total">${order.total ? '$' + order.total : ''}</span>
                    </div>
                    <p class="history-counterpart">Con: ${counterpartName}${counterpartEmail ? ' · ' + counterpartEmail : ''}</p>
                    <p class="history-dates">Creada: ${formatDate(order.createdAt)}</p>
                </div>
            </div>
            <div class="history-steps">
                ${historySteps || '<p class="subtext">Sin eventos registrados.</p>'}
            </div>
            <div class="history-actions">
                <button class="btn-secondary ghost" onclick="showOrderDetail('${order._id || order.id}')">Ver detalle</button>
            </div>
        </div>
    `;
}

function renderHistoryList(orders) {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = '<p>No hay órdenes registradas aún.</p>';
        return;
    }

    container.innerHTML = orders.map(renderHistoryItem).join('');
}

function updateHistorySummary(orders = []) {
    const summary = document.getElementById('history-summary');
    if (!summary) return;

    const totalCompras = orders.filter(o => o.type === 'compra').length;
    const totalReservas = orders.filter(o => o.type === 'reserva').length;
    const activeReservas = orders.filter(o => o.type === 'reserva' && o.status === 'reservada').length;

    summary.innerHTML = `
        <div class="history-summary-card">
            <p class="summary-label">Compras</p>
            <p class="summary-value">${totalCompras}</p>
            <p class="summary-sub">Totales</p>
        </div>
        <div class="history-summary-card">
            <p class="summary-label">Reservas</p>
            <p class="summary-value">${totalReservas}</p>
            <p class="summary-sub">Totales</p>
        </div>
        <div class="history-summary-card">
            <p class="summary-label">Reservas activas</p>
            <p class="summary-value">${activeReservas}</p>
            <p class="summary-sub">En estado reservada</p>
        </div>
    `;
}

function setHistoryTypeFilter(type) {
    historyTypeFilter = type || '';
    document.querySelectorAll('.history-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === historyTypeFilter);
    });

    const filtered = historyTypeFilter
        ? historyOrdersCache.filter(o => o.type === historyTypeFilter)
        : historyOrdersCache;

    renderHistoryList(filtered);
}

function renderClientReservationCard(order) {
    const listing = order.listingId || {};
    const listingId = listing._id || listing.id || order.listingId;
    const seller = listing.sellerId || order.sellerId || {};
    const cardName = listing.name || listing.description || listing.cardId || order.card?.name || 'Publicación reservada';
    const listingImage = listing.imageData || listing.image;
    const image = listingImage || listing.card?.images?.small || order.card?.images?.small || 'black.jpg';
    const status = order.status || 'pendiente';
    const expiresAt = order.reservationExpiresAt || listing.reservedUntil;
    const createdLabel = order.createdAt ? formatDate(order.createdAt) : '';
    const expiresLabel = expiresAt ? formatDate(expiresAt) : '';
    const total = order.total || listing.price;
    const contact = (listing.contactWhatsapp || '').trim();
    const contactLink = contact ? `https://wa.me/${contact.replace(/^\\+/, '')}` : '';
    const contactAllowed = ['reservada', 'pagada'].includes(status);
    const showContact = contactAllowed && contact;

    cacheListingPreview(listingId, listingImage);

    return `
        <div class="reservation-card">
            <div class="reservation-top">
                <div class="reservation-image">
                    <img src="${image}" alt="${cardName}" onerror="this.src='black.jpg'">
                </div>
                <div class="reservation-info">
                    <p class="eyebrow">${createdLabel ? 'Creada: ' + createdLabel : 'Reserva creada'}</p>
                    <h4 class="reservation-title">${cardName}</h4>
                    <div class="reservation-meta">
                        ${renderStatusBadge(status)}
                        ${expiresAt ? `<span class="chip chip-muted"><i class="fa-regular fa-clock"></i> Vence ${expiresLabel}</span>` : ''}
                    </div>
                    <p class="reservation-detail">Vendedor: ${seller.name || 'Sin datos'}${seller.email ? ' · ' + seller.email : ''}</p>
                    <p class="reservation-detail">Importe reservado: ${total ? '$' + total : 'Pendiente de total'}</p>
                    ${showContact
                      ? `<div class="reservation-contact">
                            <span class="chip chip-success"><i class="fa-brands fa-whatsapp"></i> WhatsApp del vendedor</span>
                            <a class="reservation-contact__number" href="${contactLink}" target="_blank" rel="noopener">${contact}</a>
                         </div>`
                      : contactAllowed
                        ? '<p class="reservation-detail subtext">El vendedor aún no ha añadido su WhatsApp.</p>'
                        : '<p class="reservation-detail subtext">La reserva debe ser aprobada para ver el WhatsApp.</p>'}
                </div>
            </div>
            <div class="reservation-actions">
                ${listingId ? `<button class="btn-secondary ghost" onclick="showListingDetail('${listingId}','', '${listingImage || ''}')">Ver publicación</button>` : ''}
            </div>
        </div>
    `;
}

async function loadClientReservations() {
    const container = document.getElementById('client-reservations-list');
    const counter = document.getElementById('reservations-count');

    if (!container) return;

    if (!authToken || !currentUser || currentUser.role !== 'cliente') {
        container.innerHTML = '<p class="subtext">Inicia sesión como cliente para ver tus reservas.</p>';
        if (counter) counter.textContent = '0';
        return;
    }

    container.innerHTML = '<p class="subtext">Cargando reservas...</p>';

    try {
        const res = await apiFetch('/api/orders?type=reserva');
        const data = await res.json();

        if (!res.ok) {
            container.innerHTML = `<p class="subtext">${data.message || 'No se pudieron cargar las reservas.'}</p>`;
            if (counter) counter.textContent = '0';
            return;
        }

        const rawOrders = data.orders || [];
        const userId = getCurrentUserId();

        clientReservationsCache = rawOrders.filter(order => {
            const buyerId = order.buyerId?._id || order.buyerId;
            return !buyerId || !userId || String(buyerId) === String(userId);
        });

        const visibleReservations = clientReservationsCache
            .filter(order => order.status !== 'cancelada')
            .sort((a, b) => {
                const weight = { reservada: 0, pendiente: 1, pagada: 2, cancelada: 3 };
                const byWeight = (weight[a.status] || 4) - (weight[b.status] || 4);
                if (byWeight !== 0) return byWeight;
                return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
            });

        if (counter) counter.textContent = visibleReservations.length.toString();

        if (!visibleReservations.length) {
            container.innerHTML = '<p class="subtext">Aún no tienes reservas activas.</p>';
            return;
        }

        container.innerHTML = visibleReservations.map(renderClientReservationCard).join('');
    } catch (error) {
        console.error('No se pudieron cargar las reservas del cliente', error);
        container.innerHTML = '<p class="subtext">Error al cargar tus reservas.</p>';
        if (counter) counter.textContent = '0';
    }
}

async function loadOrderHistory() {
    if (!authToken) return;
    const container = document.getElementById('history-list');
    if (!container) return;

    container.innerHTML = '<p>Cargando historial...</p>';
    const status = document.getElementById('history-status-filter')?.value;
    const query = status ? `?status=${status}` : '';

    historyLoadPromise = (async () => {
        try {
            const res = await apiFetch('/api/orders' + query);
            const data = await res.json();
            if (!res.ok) {
                container.innerHTML = `<p>Error: ${data.message || 'No se pudo cargar el historial'}</p>`;
                return [];
            }

            historyOrdersCache = data.orders || [];
            updateHistorySummary(historyOrdersCache);

            const filtered = historyTypeFilter
                ? historyOrdersCache.filter(order => order.type === historyTypeFilter)
                : historyOrdersCache;

            renderHistoryList(filtered);
            return historyOrdersCache;
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p>Error al cargar el historial.</p>';
            historyOrdersCache = [];
            updateHistorySummary([]);
            return [];
        }
    })();

    return historyLoadPromise;
}

async function ensureHistoryLoaded() {
    if (!authToken) return [];
    if (!historyLoadPromise) {
        historyLoadPromise = loadOrderHistory();
    }

    try {
        return await historyLoadPromise;
    } catch (error) {
        console.error('No se pudo precargar el historial', error);
        return historyOrdersCache;
    }
}

async function showOrderDetail(orderId) {
    if (!orderId) return;
    if (!authToken) {
        alert('Inicia sesión para ver el detalle de la orden.');
        return;
    }

    await ensureHistoryLoaded();

    const body = document.getElementById('order-detail-body');
    if (body) {
        body.innerHTML = '<p>Cargando detalle...</p>';
    }

    toggleOrderDetail(true);

    try {
        const res = await apiFetch(`/api/orders/${orderId}`);
        const data = await res.json();

        if (!res.ok || !data.order) {
            body.innerHTML = `<p>${data.message || 'No se pudo cargar el pedido.'}</p>`;
            return;
        }

        const order = data.order;
        const listing = order.listingId || {};
        const listingId = listing._id || listing.id || order.listingId;
        const listingImage = listing.imageData || listing.image;
        const cachedPreview = listingPreviewCache.get(listingId?.toString());
        const coverImage = listingImage || cachedPreview || order.card?.images?.large || 'black.jpg';

        cacheListingPreview(listingId, listingImage || cachedPreview);
        const steps = (order.history || []).map(step => `
            <div class="history-step">
                <div class="history-step-header">
                    ${renderStatusBadge(step.status)}
                    <span class="history-step-date">${formatDate(step.changedAt)}</span>
                </div>
                <div class="history-step-body">
                    <p class="history-note">${step.note || ''}</p>
                    <p class="history-user">${step.changedBy?.name || 'Sistema'}</p>
                </div>
            </div>
        `).join('');

        const contactCta = order.listingId ? renderContactCta(order.listingId, order.card?.name || order.listingId.cardId) : '';

        body.innerHTML = `
            <div class="order-detail">
                <div class="order-detail__image">
                    <img src="${coverImage}" alt="${order.listingId?.name || order.card?.name || 'Publicación'}" onerror="this.src='black.jpg'">
                </div>
                <p><strong>Tipo:</strong> ${order.type === 'reserva' ? 'Reserva' : 'Compra'}</p>
                <p><strong>Estado:</strong> ${order.status}</p>
                <p><strong>Precio:</strong> $${order.total || order.listingId?.price || ''}</p>
                <p><strong>Publicación:</strong> ${order.listingId?.name || order.card?.name || order.listingId?.cardId || 'Sin nombre'}</p>
                <p><strong>Vendedor:</strong> ${order.sellerId?.name || 'No disponible'} (${order.sellerId?.email || ''})</p>
                <p><strong>Comprador:</strong> ${order.buyerId?.name || 'No disponible'} (${order.buyerId?.email || ''})</p>
                <div class="history-steps">${steps || '<p class="subtext">Sin eventos registrados.</p>'}</div>
                ${contactCta}
            </div>
        `;
    } catch (error) {
        console.error(error);
        body.innerHTML = '<p>Error al cargar el detalle de la orden.</p>';
    }
}

// =============== BUSCAR CARTAS ====================
async function searchCards() {
    const query = document.getElementById("searchInput").value.trim();

    if (!query) {
        catalogPage = 1;
        loadCatalogListings();
        return;
    }

    await loadSearchResults(query, 1);
}

// =============== DETALLE DE CARTA =================
async function showListingDetail(listingId, cardId, previewImage = '') {
    if (!listingId && cardId) {
        return showCardDetail(cardId);
    }

    if (listingId && previewImage) {
        cacheListingPreview(listingId, previewImage);
    }

    showSection('view-card-detail');

    const container = document.getElementById("cardDetailContent");
    container.innerHTML = "<p>Cargando publicación...</p>";

    try {
        await ensureHistoryLoaded();

        const [listingRes, cardRes] = await Promise.all([
            fetch(`/api/listings/${listingId}`),
            cardId ? fetch(`/api/cards/${cardId}`) : Promise.resolve({ ok: false }),
        ]);

        const listing = await listingRes.json();
        const cardData = cardRes.ok ? await cardRes.json() : {};
        const card = cardData.card || null;
        const cachedPreview = listingPreviewCache.get(listingId?.toString());

        if (!listingRes.ok) {
            container.innerHTML = `<p>${listing.message || 'No se pudo cargar la publicación.'}</p>`;
            return;
        }

        const seller = listing.sellerId || listing.seller || {};
        const isReserved = isListingReserved(listing);
        const available = listing.status === 'aprobada' && listing.isActive !== false && !isReserved;
        const availabilityLabel = isReserved ? 'Reservada' : available ? 'Disponible' : 'No disponible';
        const coverImage = listing.imageData || cachedPreview || card?.images?.large || 'black.jpg';
        const displayName = listing.name || card?.name || listing.cardId;
        const isClient = currentUser && currentUser.role === 'cliente';
        const statusLabel = listing.status === 'aprobada'
            ? 'Publicación aprobada'
            : listing.status === 'rechazada'
                ? 'Rechazada'
                : 'Pendiente de revisión';
        const reservationNote = isReserved
            ? `Reservada hasta ${formatDate(listing.reservedUntil)}`
            : available
                ? 'Habilitada para reservas'
                : 'No disponible para reserva';

        container.innerHTML = `
            <div class="detail-card compact-detail">
                <div class="detail-left">
                    <div class="detail-img-frame">
                        <img src="${coverImage}" alt="${card?.name || listing.cardId}" class="detail-img" onerror="this.src='black.jpg'">
                    </div>
                    <div class="detail-tags">
                        <span class="chip chip-muted">${statusLabel}</span>
                        <span class="chip ${isReserved ? 'chip-warning' : available ? 'chip-success' : 'chip-muted'}">${availabilityLabel}</span>
                    </div>
                    <div class="detail-specs-grid">
                        <div class="spec-item">
                            <p class="spec-label">Publicado</p>
                            <p class="spec-value">${formatDate(listing.createdAt) || 'Sin fecha'}</p>
                        </div>
                        <div class="spec-item">
                            <p class="spec-label">ID publicación</p>
                            <p class="spec-value">${listing._id || listing.id || 'N/D'}</p>
                        </div>
                        <div class="spec-item">
                            <p class="spec-label">ID carta</p>
                            <p class="spec-value">${listing.cardId || card?.id || 'N/D'}</p>
                        </div>
                        ${isReserved && listing.reservedUntil ? `
                            <div class="spec-item accent">
                                <p class="spec-label">Vence</p>
                                <p class="spec-value">${formatDate(listing.reservedUntil)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="detail-right">
                    <div class="detail-header">
                        <div>
                            <p class="eyebrow">${card?.set?.series || 'Colección no disponible'}</p>
                            <h2>${displayName}</h2>
                            <p class="detail-subtitle">${card?.set?.name || 'Set desconocido'} • ${card?.rarity || 'Rareza sin definir'}</p>
                        </div>
                        <div class="price-card">
                            <span class="price-label">Precio</span>
                            <span class="price-value">$${listing.price}</span>
                            <span class="price-hint">${listing.condition}</span>
                        </div>
                    </div>

                    ${isReserved ? `<div class="reservation-timer" data-expires-at="${listing.reservedUntil}">
                        <i class="fa-regular fa-clock"></i>
                        <span class="countdown-label">Cargando contador...</span>
                    </div>` : ''}

                    <div class="detail-meta modern-grid">
                        <div>
                            <p class="meta-label">Disponibilidad</p>
                            <p class="meta-value">${reservationNote}</p>
                        </div>
                        <div>
                            <p class="meta-label">Tipo</p>
                            <p class="meta-value">${card?.supertype || 'No especificado'}</p>
                        </div>
                        <div>
                            <p class="meta-label">Colección</p>
                            <p class="meta-value">${card?.set?.name || 'Sin colección'}</p>
                        </div>
                        <div>
                            <p class="meta-label">Numero de carta</p>
                            <p class="meta-value">${card?.number || listing.cardId || 'N/D'}</p>
                        </div>
                    </div>

                    <div class="detail-description">
                        <p class="section-title">Descripción</p>
                        <p>${listing.description || 'Sin descripción proporcionada.'}</p>
                    </div>

                    <div class="seller-panel">
                        <div class="seller-main">
                            <div class="seller-avatar">${(seller.name || 'V')[0]}</div>
                            <div class="seller-data">
                                <p class="seller-name">${seller.name || 'Vendedor sin nombre'}</p>
                                <p class="seller-rating">${seller.email || 'Correo no disponible'}</p>
                                <p class="seller-rating">Rol: ${seller.role || 'vendedor'}</p>
                            </div>
                        </div>
                        <div class="seller-actions refined">
                            ${available
                                ? (isClient
                                    ? `<button class="btn-reserve" onclick="createOrder('${listing._id || listing.id}','reserva')">Reservar</button>`
                                    : `<span class="availability-note">Inicia sesión como cliente para reservar.</span>`)
                                : `<span class="availability-note">No disponible para reservar.</span>`
                            }
                            <p class="availability-note subtle">Se notificará al vendedor para aprobar la reserva.</p>
                        </div>
                    </div>

                    ${card
                        ? `<button class="btn-secondary ghost" onclick="showCardDetail('${card.id}')">Ver más vendedores</button>`
                        : ''}
                </div>
            </div>
        `;
        clearCountdowns();
        activateCountdowns(container);
    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Error cargando la publicación.</p>";
    }
}

async function showCardDetail(cardId) {
    showSection('view-card-detail');

    const container = document.getElementById("cardDetailContent");
    container.innerHTML = "<p>Cargando carta...</p>";
    const isClient = currentUser && currentUser.role === 'cliente';

    try {
        const res = await fetch(`/api/cards/${cardId}`);
        const data = await res.json();

        const card = data.card;
        const listings = data.listings;

        if (!card) {
            container.innerHTML = "<p>La carta no existe o fue removida.</p>";
            return;
        }
        const coverImage = (listings[0] && listings[0].imageData) || card.images.large || 'black.jpg';

        container.innerHTML = `
            <div class="detail-card">

                <div class="detail-left">
                    <img src="${coverImage}" alt="${card.name}" class="detail-img" onerror="this.src='black.jpg'">
                </div>

                <div class="detail-right">
                    <h2>${card.name}</h2>
                    <p><strong>Tipo:</strong> ${card.types?.join(", ") || "Desconocido"}</p>
                    <p><strong>Rareza:</strong> ${card.rarity || "Desconocida"}</p>
                    <p><strong>Set:</strong> ${card.set.name}</p>
                    <p><strong>HP:</strong> ${card.hp || "?"}</p>

                    <h3>Vendedores Disponibles</h3>
                    <div class="seller-list">
                        ${
                            listings.length
                            ? listings.map(listing => {
                                const isReserved = isListingReserved(listing);
                                const available = listing.status === 'aprobada' && listing.isActive !== false && !isReserved;
                                const availabilityLabel = isReserved ? 'Reservada' : available ? 'Disponible' : 'No disponible';
                                return `
                                <div class="seller-card">
                                    <div class="seller-avatar">${(listing.seller?.name || 'Vendedor')[0]}</div>
                                    <div>
                                        <p class="seller-name">${listing.seller?.name || 'Vendedor sin nombre'}</p>
                                        <p class="seller-rating">${listing.seller?.email || 'Correo no disponible'}</p>
                                        <p class="seller-rating">Rol: ${listing.seller?.role || 'vendedor'}</p>
                                    </div>

                                    ${listing.imageData ? `<div class="seller-thumb"><img src="${listing.imageData}" alt="Foto de la publicación" onerror="this.src='black.jpg'"></div>` : ''}

                                    <div class="seller-price">
                                        $${listing.price}
                                        <span class="seller-condition">(${listing.condition})</span>
                                        <span class="availability-pill ${isReserved ? 'reserved' : available ? 'available' : 'unavailable'}">${availabilityLabel}</span>
                                    </div>
                                    ${isReserved ? `<div class="reservation-timer" data-expires-at="${listing.reservedUntil}">
                                        <i class="fa-regular fa-clock"></i>
                                        <span class="countdown-label">Cargando contador...</span>
                                    </div>` : ''}
                                ${available
                                    ? `<div class="seller-actions">
                                            <button class="btn-primary" onclick="createOrder('${listing.id}','compra')">Comprar</button>
                                            ${isClient
                                                ? `<button class="btn-reserve" onclick="createOrder('${listing.id}','reserva')">Reservar</button>`
                                                : `<span class="availability-note">Solo los clientes pueden reservar.</span>`
                                            }
                                            <span class="availability-note">El WhatsApp se habilita solo para quien tiene una reserva activa.</span>
                                        </div>`
                                        : `<div class="seller-actions disabled">
                                            <span class="availability-note">No disponible para compra, reserva ni contacto.</span>
                                        </div>`
                                    }
                                    ${renderContactCta(listing, card.name)}
                                </div>
                              `; }).join("")
                            : "<p>No hay vendedores aún.</p>"
                        }
                    </div>
                </div>

            </div>
        `;
        clearCountdowns();
        activateCountdowns(container);
    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Error cargando la carta.</p>";
    }
}

async function createOrder(listingId, type = 'compra') {
    if (!authToken) return alert('Debes iniciar sesión para continuar.');

    if (type === 'reserva' && (!currentUser || currentUser.role !== 'cliente')) {
        alert('Solo los clientes pueden generar reservas.');
        return;
    }

    try {
        const res = await apiFetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId, type })
        });

        const data = await res.json();
        if (res.ok) {
            alert(`Orden creada con estado ${data.order.status}. Revisa tu historial.`);
            if (type === 'reserva') {
                await loadOrderHistory();
                loadPublicationsBoard();
                loadSellerListings();
                showListingDetail(listingId, '');
            }
        } else {
            alert('❌ Error: ' + (data.message || 'No se pudo crear la orden'));
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor.');
    }
}

function goBackToCatalog() {
    showSection('view-catalog');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadLayout();
    } catch (error) {
        console.error('No se pudieron cargar las secciones del frontend', error);
        alert('No se pudieron cargar los recursos del sitio. Recarga la página.');
        return;
    }

    bindPublicationsPaginationControls();
    bindCatalogPaginationControls();

    const { token: savedToken } = getStoredSession();

    if (savedToken) {
        try {
            const res = await fetch('/api/me', {
                headers: {
                    'Authorization': 'Bearer ' + savedToken,
                },
            });

            if (!res.ok) {
                throw new Error('No se pudo restaurar la sesión');
            }

            const data = await res.json();
            if (!data?.user) throw new Error('Usuario inválido en sesión');

            persistSession(savedToken, data.user);
            enterApp(data.user);
        } catch (err) {
            console.warn('No se pudo restaurar la sesión desde token', err);
            clearPersistedSession();
        }
    }
});

