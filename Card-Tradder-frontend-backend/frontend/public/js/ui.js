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
                if (!query) loadCatalogListings();
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
