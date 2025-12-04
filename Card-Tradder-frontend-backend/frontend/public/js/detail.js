                data.results.forEach(item => {
                    const card = item.card || {};
                    const listing = item.listings[0] || null;

                    const listingId = listing?.id || '';
                    const targetCardId = listing?.cardId || card.id || '';
                    const displayName = listing?.name || card.name || listing?.cardId || 'Publicación';
                    const coverImage = listing?.imageData || card.images?.large || 'black.jpg';
                    const priceLabel = listing ? "$" + listing.price : "Sin vendedores";

                    container.innerHTML += `
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
                });
            } catch (err) {
                console.error(err);
                container.innerHTML = "<p>Error buscando cartas.</p>";
            }
        }

        // =============== DETALLE DE CARTA =================
        async function showListingDetail(listingId, cardId) {
            if (!listingId && cardId) {
                return showCardDetail(cardId);
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

                if (!listingRes.ok) {
                    container.innerHTML = `<p>${listing.message || 'No se pudo cargar la publicación.'}</p>`;
                    return;
                }

                const seller = listing.sellerId || listing.seller || {};
                const isReserved = isListingReserved(listing);
                const available = listing.status === 'aprobada' && listing.isActive !== false && !isReserved;
                const availabilityLabel = isReserved ? 'Reservada' : available ? 'Disponible' : 'No disponible';
                const coverImage = listing.imageData || card?.images?.large || 'black.jpg';
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

