        // =============== ADMIN: USUARIOS ==================
        // Carga la tabla de usuarios en el panel de administración
        async function loadAdminUsers() {
            // Si no hay token de autenticación, no permite continuar
            if (!authToken) return alert('No autenticado');

            // Llama al endpoint de backend que lista todos los usuarios (solo admin)
            const res = await fetch('/api/admin/users', {
                headers: { 'Authorization': 'Bearer ' + authToken } // Envía el token en el header
            });

            // Parsea la respuesta como JSON
            const data = await res.json();
            // Si la respuesta no fue OK (status >= 400), muestra error
            if (!res.ok) {
                return alert('Error: ' + data.message);
            }

            // Obtiene la tabla del DOM donde se mostrarán los usuarios
            const table = document.getElementById('admin-users-table');
            // Rellena la tabla con cabecera y filas dinámicas generadas desde data.users
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

        // Cambia el rol de un usuario a "vendedor"
        async function promoteToSeller(userId) {
            // Pide confirmación antes de realizar el cambio
            if (!confirm('¿Convertir a vendedor?')) return;

            // Llama al endpoint de actualización de usuario (PATCH /api/admin/users/:id)
            const res = await fetch('/api/admin/users/' + userId, {
                method: 'PATCH', // Método HTTP PATCH para actualización parcial
                headers: {
                    'Content-Type': 'application/json',      // Indica que se envía JSON en el body
                    'Authorization': 'Bearer ' + authToken   // Envía el token JWT
                },
                // En el body se envía solo el cambio de rol
                body: JSON.stringify({ role: 'vendedor' })
            });

            // Parsea la respuesta como JSON
            const data = await res.json();
            // Si hubo error, muestra un alert con el mensaje del backend
            if (!res.ok) return alert('Error: ' + data.message);
            // Si todo salió bien, recarga la tabla de usuarios para reflejar el cambio
            loadAdminUsers();
        }

        // Elimina un usuario desde el panel admin
        async function deleteUser(userId) {
            // Pide confirmación antes de eliminar
            if (!confirm('¿Eliminar usuario?')) return;

            // Llama al endpoint DELETE /api/admin/users/:id
            const res = await fetch('/api/admin/users/' + userId, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + authToken } // Envía el token del admin
            });

            // Parsea la respuesta
            const data = await res.json();
            // Si falló, muestra error
            if (!res.ok) return alert('Error: ' + data.message);
            // Si tuvo éxito, recarga la lista de usuarios
            loadAdminUsers();
        }

        // =============== ADMIN: PUBLICACIONES =============
        // Carga las publicaciones pendientes de aprobación en el panel admin
        async function loadPendingPublications() {
            // Verifica que el admin esté autenticado
            if (!authToken) return alert('No autenticado');

            // Llama al endpoint que lista publicaciones con status=pendiente
            // Aquí usas apiFetch (seguramente un wrapper de fetch que agrega el token)
            const res = await apiFetch('/api/admin/publications?status=pendiente');

            // Parsea la respuesta como JSON
            const data = await res.json();
            // Si hubo error, lo muestra
            if (!res.ok) {
                return alert('Error: ' + data.message);
            }

            // Obtiene la tabla donde se mostrarán las publicaciones
            const table = document.getElementById('admin-publications-table');
            // Rellena la tabla con cabecera y filas según data.listings
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

        // Aprueba una publicación (cambia su estado a 'aprobada')
        async function approvePublication(id) {
            // Llama al endpoint de cambio de estado de publicación
            const res = await apiFetch('/api/admin/publications/' + id + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }, // Se envía JSON
                body: JSON.stringify({ status: 'aprobada' })    // Nuevo estado
            });

            // Parsea la respuesta
            const data = await res.json();
            // Si la respuesta no fue exitosa, muestra error
            if (!res.ok) return alert('Error: ' + data.message);
            // Recarga la lista de publicaciones pendientes
            loadPendingPublications();
        }

        // Rechaza una publicación, solicitando un motivo
        async function rejectPublication(id) {
            // Pide al admin que ingrese el motivo de rechazo
            const rejectionReason = prompt('Motivo de rechazo:');
            // Si el admin cancela el prompt, no hace nada
            if (rejectionReason === null) return;
            // Si el motivo está vacío o solo espacios, muestra advertencia
            if (!rejectionReason.trim()) return alert('Debes indicar un motivo.');

            // Llama al endpoint PATCH con status 'rechazada' y el motivo
            const res = await apiFetch('/api/admin/publications/' + id + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'rechazada', rejectionReason })
            });

            // Parsea la respuesta
            const data = await res.json();
            // Si falla, muestra mensaje de error
            if (!res.ok) return alert('Error: ' + data.message);
            // Si todo OK, recarga la lista de publicaciones pendientes
            loadPendingPublications();
        }

        // Elimina completamente una publicación desde el panel admin
        async function deletePublication(id) {
            // Pide confirmación al admin antes de eliminar
            if (!confirm('¿Eliminar publicación?')) return;

            // Llama al endpoint DELETE /api/admin/publications/:id
            const res = await apiFetch('/api/admin/publications/' + id, { method: 'DELETE' });

            // Parsea la respuesta
            const data = await res.json();
            // Si hubo error, muestra mensaje
            if (!res.ok) return alert('Error: ' + data.message);
            // Si todo salió bien, recarga la lista de publicaciones pendientes
            loadPendingPublications();
        }
