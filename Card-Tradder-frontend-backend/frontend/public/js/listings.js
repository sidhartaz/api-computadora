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

        async function loadCatalogListings() {
            const container = document.getElementById('resultsContainer');
            if (!container) return;
            container.innerHTML = '<p>Cargando catálogo...</p>';

            try {
                const res = await fetch('/api/listings');
                const payload = await res.json();
                const { items } = normalizeListingsPayload(payload);

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

        async function loadPublicationsBoard() {
            const container = document.getElementById('publications-list');
            if (!container) return;
            container.innerHTML = '<p class="subtext">Cargando publicaciones...</p>';

            try {
                const res = await fetch('/api/listings');
                const payload = await res.json();
                const { items, pagination } = normalizeListingsPayload(payload);

                const counter = document.getElementById('publications-count');
                if (counter) counter.textContent = pagination.total || items.length;

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

