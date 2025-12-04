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

