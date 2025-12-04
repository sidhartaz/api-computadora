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

                let data = null;

                try {
                    data = await res.json();
                } catch (parseError) {
                    console.warn('No se pudo interpretar la respuesta de /api/login', parseError);
                }

                if (res.ok) {
                    if (data?.token && data?.user) {
                        persistSession(data.token, data.user);
                        enterApp(data.user);
                    } else {
                        alert('❌ Error: Respuesta inválida del servidor. Intenta nuevamente.');
                    }
                } else {
                    const message = data?.message || data?.error || res.statusText || 'Error del servidor';
                    alert('❌ Error: ' + message);
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
