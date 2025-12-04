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

            const activeReservationStatuses = ['pendiente', 'reservada', 'pagada'];

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

