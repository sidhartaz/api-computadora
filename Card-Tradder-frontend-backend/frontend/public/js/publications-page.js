const grid = document.getElementById('all-publications-grid');
const counterEl = document.getElementById('all-publications-count');
const pagesLabel = document.getElementById('all-publications-pages');
const prevBtn = document.getElementById('all-publications-prev');
const nextBtn = document.getElementById('all-publications-next');

const urlParams = new URLSearchParams(window.location.search);
let currentPage = Math.max(parseInt(urlParams.get('page'), 10) || 1, 1);
const pageSize = 24;

function updateUrlPage(page) {
    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
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

function isListingReserved(listing) {
    if (!listing) return false;
    const hasOwner = !!listing.reservedBy;
    const expiresAt = listing.reservedUntil ? new Date(listing.reservedUntil).getTime() : null;

    if (expiresAt && !Number.isNaN(expiresAt)) {
        return expiresAt > Date.now();
    }

    return hasOwner;
}

function renderListingCard(listing) {
    const card = listing.card || {};
    const seller = listing.sellerId || listing.seller || {};
    const cardName = listing.name || card.name || listing.cardId || 'Publicación';
    const image = listing.imageData || card.images?.small || 'black.jpg';
    const isReserved = isListingReserved(listing);
    const available = listing.status === 'aprobada' && listing.isActive !== false && !isReserved;
    const availabilityLabel = isReserved ? 'Reservada' : available ? 'Disponible' : 'No disponible';

    return `
        <article class="publication-card">
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
                        <span class="seller-chip"><i class="fa-solid fa-tag"></i> ${listing.condition || 'Condición no informada'}</span>
                    </div>
                </div>
                <div class="publication-price">
                    <span>Precio</span>
                    <strong>$${listing.price}</strong>
                    <small>${card.set?.name || 'Set no disponible'}</small>
                </div>
            </div>
            <div class="publication-actions public-view">
                <span class="availability-note">Inicia sesión como cliente para reservar o contactar al vendedor.</span>
            </div>
        </article>
    `;
}

function renderPublications(items) {
    if (!grid) return;

    if (!items.length) {
        grid.innerHTML = '<p>No hay publicaciones activas.</p>';
        return;
    }

    grid.innerHTML = items.map(renderListingCard).join('');
}

function updatePagination(pagination) {
    const totalPages = Math.max(pagination.totalPages || 1, 1);
    currentPage = Math.min(Math.max(pagination.page || 1, 1), totalPages);

    if (pagesLabel) {
        pagesLabel.textContent = `Página ${currentPage} de ${totalPages}`;
    }

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }

    updateUrlPage(currentPage);
}

async function loadPublications(page = 1) {
    if (!grid) return;

    grid.innerHTML = '<p class="subtext">Cargando publicaciones...</p>';

    try {
        const res = await fetch(`/api/listings?page=${page}&limit=${pageSize}`);
        const payload = await res.json();
        const { items, pagination } = normalizeListingsPayload(payload);

        if (counterEl) {
            counterEl.textContent = pagination.total || items.length || 0;
        }

        renderPublications(items);
        updatePagination(pagination);
    } catch (error) {
        console.error('Error cargando publicaciones', error);
        grid.innerHTML = '<p>Error al cargar las publicaciones. Intenta nuevamente.</p>';
    }
}

prevBtn?.addEventListener('click', () => {
    if (currentPage > 1) {
        loadPublications(currentPage - 1);
    }
});

nextBtn?.addEventListener('click', () => {
    loadPublications(currentPage + 1);
});

document.addEventListener('DOMContentLoaded', () => {
    loadPublications(currentPage);
});
