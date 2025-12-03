# REQUERIMIENTOS DEL PROYECTO DE INTERCAMBIO Y VENTA DE CARTAS COLECCIONABLES

Versión: 1.2  
Autores: Carlos Sepúlveda, Bryam Beltrán

---

## 1. Descripción del Cliente y Problema Principal

El cliente corresponde a un grupo de emprendedores dedicados al coleccionismo e intercambio de cartas de distintos juegos reconocidos a nivel mundial, tales como Pokémon, Mitos y Leyendas y Yu-Gi-Oh!. Actualmente, este grupo administra diversas comunidades en redes sociales y foros, donde los usuarios publican sus cartas para vender, intercambiar o subastar.

Durante las reuniones iniciales, el cliente manifestó que el principal problema radica en la falta de una plataforma unificada y segura que centralice todas las actividades relacionadas con la compra, venta, intercambio y registro de transacciones de cartas. En los espacios actuales, las transacciones suelen realizarse de manera informal, lo que genera múltiples dificultades, entre ellas:

- Riesgo de fraudes o falsificaciones de cartas.
- Dificultad para verificar la autenticidad y el estado de los artículos.
- Falta de un historial o trazabilidad de los intercambios.
- Desconfianza entre compradores y vendedores.

Ante esta situación, el cliente solicitó el desarrollo de un sistema web especializado que permita a los coleccionistas:

- Crear un perfil personal con información básica y su inventario de cartas.
- Publicar cartas disponibles para la venta o intercambio.
- Acceder a un sistema de validación y reputación que garantice la seguridad de las operaciones.
- Registrar las órdenes de compra/venta e intercambios, así como el estado de pago de cada transacción, aun cuando el pago se realice por medios externos (transferencia, efectivo, etc.).

El objetivo principal del cliente es consolidar una comunidad digital confiable donde los usuarios puedan realizar transacciones de manera transparente, eficiente y segura, fortaleciendo el mercado del coleccionismo y mejorando la experiencia general de los participantes, sin que la plataforma actúe como pasarela de pago, sino como gestor de órdenes, estados y reputación.

---

## 2. Lista de Usuarios del Sistema

- Administrador  
  - Supervisa la plataforma y valida autenticidad de cartas.  
  - Permisos: Crear, editar y eliminar usuarios y publicaciones; aprobar ventas o marcar operaciones como revisadas a nivel de auditoría.

- Vendedor  
  - Publica cartas y gestiona sus ventas o intercambios.  
  - Permisos: Registrar productos, modificar precios, consultar ventas, actualizar el estado de las órdenes (por ejemplo, marcar pago recibido o cancelar la operación si no se concreta el pago externo).

- Cliente  
  - Navega, compra e intercambia cartas.  
  - Permisos: Buscar cartas, realizar compras o intercambios, dejar reseñas.  
  - Rol genérico que permite el acceso inicial al sistema y funcionalidades básicas.  
  - Permisos: Registrarse, completar perfil y consultar catálogo de cartas.

---

## 3. Funciones necesarias

Incluye:

- Registro y autenticación de usuarios.
- Publicación y gestión de cartas.
- Gestión de compras, ventas, reservas e intercambios de cartas, registrando órdenes y estados de pago, pero sin procesar pagos en línea.
- Validación de autenticidad por el administrador.
- Notificaciones de estado de publicación y transacción.
- Gestión de reputación mediante reseñas y calificaciones posteriores a la compra.

---

## 4. Requerimientos Funcionales (RF)

| Código | Requerimiento                                                                                                                                                     | Prioridad |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RF-01  | El sistema debe permitir el registro de nuevos usuarios con validación de rol (cliente, vendedor o administrador).                                               | Alta      |
| RF-02  | El vendedor podrá publicar cartas con nombre, tipo de juego, condición, imagen y precio.                                                                         | Alta      |
| RF-03  | El administrador debe revisar y aprobar las publicaciones antes de que sean visibles.                                                                            | Alta      |
| RF-04  | Los clientes podrán realizar compras y reservas de cartas disponibles, registrando la orden en el sistema, mientras que el pago se coordina externamente entre cliente y vendedor. | Alta      |
| RF-05  | El sistema debe registrar un historial de transacciones por usuario, incluyendo estado de la orden (pendiente, pagada, cancelada, reservada, etc.).             | Alta      |
| RF-06  | El administrador podrá suspender cuentas o publicaciones que incumplan normas.                                                                                   | Alta      |
| RF-07  | El vendedor podrá actualizar o eliminar sus publicaciones.                                                                                                       | Media     |
| RF-08  | El cliente podrá dejar reseñas y calificaciones después de una compra.                                                                                           | Baja      |
| RF-09  | El vendedor podrá marcar una orden como “pagada” o “cancelada” según el resultado del acuerdo externo con el cliente.                                           | Alta      |
| RF-10  | El sistema debe notificar al cliente cuando una orden sea marcada como pagada o cancelada por el vendedor.                                                       | Media     |

---

## 5. Requerimientos No Funcionales (RNF)

| Código | Categoría      | Requerimiento                                                                   | Prioridad |
| ------ | -------------- | ------------------------------------------------------------------------------- | --------- |
| RNF-01 | Seguridad      | Las contraseñas deben almacenarse cifradas y la comunicación usar HTTPS.       | Alta      |
| RNF-02 | Rendimiento    | El tiempo de respuesta máximo debe ser inferior a 2 segundos por solicitud.    | Media     |
| RNF-03 | Disponibilidad | El sistema debe mantener un 99 % de disponibilidad mensual.                    | Alta      |
| RNF-04 | Escalabilidad  | La aplicación debe permitir la incorporación futura de más juegos y categorías.| Media     |
| RNF-05 | Mantenibilidad | El código debe estar documentado y seguir buenas prácticas de desarrollo.      | Media     |

---

## 6. Datos a Guardar

### Clientes

- ID
- Nombre
- RUT/Identificación
- Contacto
- Historial de compras
- Preferencia de método de pago (por ejemplo, transferencia, efectivo, otros), solo a modo informativo.

### Vendedores

- ID
- Nombre
- RUT/Identificación
- Contacto
- Historial de ventas
- Estado de suscripción

### Tipo de Carta

- Juego (e.g., Pokémon, Yu-Gi-Oh)
- Valor estimado
- Calidad (grading)
- Autentificación / Estado de verificación

---

## 7. Reglas de Negocio

- El vendedor sólo podrá estar visible al público si paga una suscripción semanal.
- Los clientes solo pueden publicar y comprar 2 cartas a la semana.
- Las cartas deben ser verificadas por un administrador antes de publicarse.
- Si un cliente reserva y el vendedor no confirma el pago en 1 día, se anulará la reserva.
- Los trueques deben ser aceptados por ambas partes.
- Las subastas serán hechas por cualquier cliente, siempre y cuando sea aceptada por un administrador.
- Toda publicación rechazada debe indicar el motivo.
- El sistema registrará cada cambio de estado (auditoría básica).
- Los pagos monetarios se realizan fuera de la plataforma (por ejemplo, vía transferencia, efectivo o acuerdo directo entre cliente y vendedor); el sistema solo registra el estado de la transacción.

---

## 8. Prioridades

- Alta: Gestión de usuarios, validación de cartas, gestión de órdenes y estados de pago (sin pasarela de pago en línea).  
- Media: Reservas.  
- Baja: Trueques, subastas.

---

## 9. Flujos Principales

### 9.1 Flujo de Publicación de Carta

1. El vendedor inicia sesión.
2. Publica una carta con sus detalles.
3. El administrador revisa la publicación.
4. Si la aprueba, la carta se muestra en el catálogo.
5. Si la rechaza, se notifica al vendedor con el motivo.

### 9.2 Flujo de Compra

1. El cliente selecciona una carta disponible.
2. Realiza la compra o reserva, generando una orden en el sistema con estado inicial “pendiente de pago”.
3. Se notifica al vendedor y, opcionalmente, al administrador para fines de control.
4. El cliente y el vendedor coordinan el pago y la entrega por canales externos (WhatsApp, redes sociales, transferencia bancaria, efectivo, etc.).
5. El vendedor actualiza el estado de la orden en el sistema a “pagada” o “cancelada”.
6. Se actualiza el historial del usuario (cliente y vendedor).
7. El cliente puede dejar una reseña sobre la transacción.

---

## 10. Requerimientos Técnicos

- Lenguaje backend: Node.js (para MongoDB + Redis + JWT)
- Base de datos: MongoDB
- Cache: Redis para mejorar rendimiento
- Frontend: React.js o Vue.js (interfaz responsiva)
- Servidor: Localhost en desarrollo; Azure/AWS en producción
- Control de versiones: Git y GitHub
- Arquitectura: Cliente–Servidor con API REST  
- Alcance de pagos: No se implementará pasarela de pago integrada. El sistema solo gestionará órdenes y estados de pago, dejando el pago monetario a canales externos entre cliente y vendedor.

---

## 12. Presupuesto Estimado

### 1. Desarrollo del MVP (4–6 semanas)

| Concepto              | Detalle                                  | Costo aproximado                |
| --------------------- | ---------------------------------------- | --------------------------------|
| Backend + API         | Node.js + MongoDB + Redis + JWT         | $1.500.000 CLP (~US$1.650)      |
| Frontend              | React.js/Vue.js responsivo              | $1.200.000 CLP (~US$1.320)      |
| Integración y pruebas | Testing, correcciones y validaciones    | $500.000 CLP (~US$550)          |
| Documentación y GitHub| README, requisitos, diseño y flujo      | $200.000 CLP (~US$220)          |

Subtotal Desarrollo MVP: $3.400.000 CLP (~US$3.740)

### 2. Infraestructura (mensual)

| Concepto                  | Detalle                                | Costo mensual aproximado        |
| ------------------------- | -------------------------------------- | --------------------------------|
| Hosting / Servidor Cloud  | Azure/AWS (1 instancia para API + DB) | $100.000 CLP (~US$110)          |
| Base de datos (MongoDB)   | Servicio gestionado o VPS             | $50.000 CLP (~US$55)            |
| Redis (cache)             | Servicio gestionado o VPS             | $20.000 CLP (~US$22)            |
| Dominio y certificados SSL| Dominio .cl y certificado SSL         | $15.000 CLP (~US$16.5)          |

Subtotal Infraestructura mensual: $185.000 CLP (~US$203.5)

### 3. Suscripción y monetización

- Cliente/usuario: gratis  
- Vendedor: $3.000 CLP / semana (~US$3.3 / semana, ~$12.000 CLP / mes ~US$13.2 / mes)  

### 4. Mantenimiento y Soporte (mensual)

| Concepto                  | Detalle                                | Costo mensual aproximado        |
| ------------------------- | -------------------------------------- | --------------------------------|
| Monitoreo y soporte       | Resolución de bugs, uptime y seguridad| $150.000 CLP (~US$165)          |
| Actualizaciones y mejoras | Funcionalidades y optimización        | $100.000 CLP (~US$110)          |

Subtotal Mantenimiento: $250.000 CLP (~US$275)

### 5. Total estimado primer mes

Desarrollo MVP + infraestructura + mantenimiento inicial:  
~$3.400.000 + $185.000 + $250.000 ≈ $3.835.000 CLP (~US$4.218.5)

Este presupuesto incluye desarrollo, infraestructura y mantenimiento básico, considerando la monetización vía suscripción semanal para los vendedores y la gestión de órdenes y estados de pago sin pasarela de pago integrada.

---

## 13. Propuesta Formal y Cronograma de Trabajo

Proponemos el desarrollo de una plataforma web (con potencial para futura aplicación móvil) para la comunidad de coleccionistas. La clave de esta propuesta radica en la seguridad transaccional y la validación de la autenticidad de las cartas, diferenciándonos de plataformas de venta general. El enfoque es crear un mercado vertical y especializado, donde la plataforma gestiona la trazabilidad y la reputación, mientras que el pago monetario se realiza externamente entre las partes.

### Cronograma de Alto Nivel

- Fase I: MVP Hasta 6 de Noviembre – Módulos de Prioridad Alta y Media: Base de datos, seguridad (Login/Registro), Gestión de Usuarios, Publicación y Validación de Cartas, Gestión de Órdenes y Estados de Pago (sin pasarela).
- Fase II: Expansión Post 6 de Noviembre – Módulos de Prioridad Baja: Implementación y optimización de Trueques y Subastas.
- Fase III: Estabilización Continua – Pruebas de carga, mejoras de experiencia de usuario y optimización de rendimiento.

---

## 14. Criterios de Aceptación y Ganancia

- El flujo completo de registro de usuario y validación de rol debe ejecutarse correctamente en el 100 % de las pruebas.
- La interfaz debe ser completamente responsiva y funcional en Chrome, Firefox y Safari.
- El sistema debe soportar un mínimo de 100 usuarios concurrentes sin degradación de rendimiento.

Valor para la Comunidad: Establecer la plataforma como el mercado digital de confianza para coleccionistas, eliminando el riesgo de fraude mediante validación, reputación y trazabilidad, incluso cuando el pago se realiza por canales externos.  

Ganancia Financiera: Generación de un ingreso predecible y recurrente a través del modelo de suscripción semanal para los vendedores.

---

## 15. Soporte y Mantenimiento

- Monitoreo: Implementación de administradores para asegurar la disponibilidad y detectar errores de rendimiento o problemas de seguridad de forma proactiva.
- Mantenimiento correctivo: Equipo dedicado a la resolución de bugs y problemas reportados.
- Mantenimiento evolutivo: La plataforma se mantendrá en constante evolución, incorporando nuevas funcionalidades y adaptándose a las necesidades cambiantes del mercado coleccionista.
- Actualizaciones de Seguridad: Aplicación periódica de parches y auditorías de seguridad para proteger la integridad de los datos de los usuarios y las operaciones registradas en la plataforma.

---

## 16. Próximos Pasos

- Estabilización y Mantenimiento Correctivo: resolver bugs y problemas de rendimiento detectados en las primeras semanas de uso real.
- Mejoras visuales y experiencia de usuario: optimización de UI/UX basada en retroalimentación de usuarios.
- Evaluación de futuras funcionalidades:
  - Aplicación móvil nativa para gestión y compra/venta en movimiento.
  - Integración de motor de búsqueda avanzado con filtros por edición, rareza y valoración profesional de cartas.
