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
