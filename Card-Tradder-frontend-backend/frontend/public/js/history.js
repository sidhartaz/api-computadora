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
            const image = order.listingId?.imageData || order.card?.images?.small || 'black.jpg';
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

            if (typeof cacheListingPreview === 'function') {
                cacheListingPreview(listingId, listingImage);
            }

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
                            ${contact
                              ? `<div class="reservation-contact">
                                    <span class="chip chip-success"><i class="fa-brands fa-whatsapp"></i> WhatsApp del vendedor</span>
                                    <a class="reservation-contact__number" href="${contactLink}" target="_blank" rel="noopener">${contact}</a>
                                 </div>`
                              : '<p class="reservation-detail subtext">El vendedor aún no ha añadido su WhatsApp.</p>'}
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
            const container = document.getElementById("resultsContainer");

            if (!query) {
                loadCatalogListings();
                return;
            }

            container.innerHTML = "<p>Buscando...</p>";

            try {
                const res = await fetch(`/api/cards/search?q=${query}`);
                const data = await res.json();

                if (!data.results || data.results.length === 0) {
                    container.innerHTML = "<p>No se encontraron cartas.</p>";
                    return;
                }

                container.innerHTML = "";
