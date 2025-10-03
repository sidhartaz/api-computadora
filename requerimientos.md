# Requerimientos del Sistema EmployeeDB

## 1. Descripción del Cliente y Problema Principal
La empresa ficticia **Technoblade** enfrenta deficiencias en la gestión de personal, debido a la ausencia de un sistema centralizado que controle empleados, recursos y horarios.  
Actualmente no se puede garantizar que solo empleados autorizados accedan a áreas sensibles ni verificar quién modifica o elimina información.  
Tampoco existe un registro confiable de horas trabajadas, lo que dificulta la elaboración de nóminas y la eficiencia administrativa.  

Se propone un sistema basado en **MongoDB** que permita:  
- Almacenar y organizar información de empleados.  
- Controlar accesos según rol.  
- Registrar jornadas laborales.  
- Optimizar la administración del capital humano, seguridad e integridad de datos.

---

## 2. Lista de Usuarios del Sistema
- Jefe de empresa  
- Jefe de programadores  
- Programadores  
- Jefe de diseñadores  
- Diseñadores  
- Guardias  
- Gerencia  
- Desarrolladores  
- Juniors  
- Conserjes

---

## 3. Tipos de Usuarios y Perfiles (Roles) con Permisos

| Rol                        | Tipo de usuario       | Permisos principales |
|-----------------------------|--------------------|-------------------|
| Jefe de empresa             | Administrador general | Crear/editar/eliminar usuarios, asignar roles, aprobar salarios, ver reportes |
| Jefe de programadores       | Admin técnico        | Gestionar programadores/desarrolladores, asignar tareas, ver progreso |
| Desarrolladores             | Admin técnico        | Gestionar tareas asignadas, actualizar proyectos |
| Programadores / Diseñadores | Empleado estándar    | Registrar tareas, actualizar estado de proyectos |
| Guardias / Conserjes        | Empleado estándar    | Registrar entrada/salida, validar accesos |
| Gerencia                    | Empleado estándar    | Ver reportes de asistencia y productividad |
| Juniors                     | Soporte básico       | Apoyar registro de datos, actualizar información bajo supervisión |

---

## 4. Funciones Indispensables por Perfil (Lista Priorizada)

**1. Jefe de empresa (Administrador general)**  
- Alta prioridad: Crear, editar y eliminar usuarios; asignar roles y permisos; aprobar salarios; ver reportes de asistencia y productividad.  
- Media prioridad: Generar reportes avanzados; supervisar auditorías de cambios.

**2. Jefe de programadores / Desarrolladores (Admin técnico)**  
- Alta prioridad: Gestionar programadores/desarrolladores; asignar tareas; ver progreso de proyectos.  
- Media prioridad: Generar reportes técnicos y métricas de productividad.

**3. Programadores / Diseñadores (Empleado estándar / Usuario técnico)**  
- Alta prioridad: Registrar tareas completadas; actualizar estado de proyectos.  
- Media prioridad: Consultar reportes básicos; recibir notificaciones (futuro).

**4. Guardias / Conserjes (Empleado estándar)**  
- Alta prioridad: Registrar entrada/salida; validar accesos a instalaciones.  
- Media prioridad: Generar alertas de accesos no autorizados (futuro).

**5. Gerencia (Empleado estándar)**  
- Alta prioridad: Ver reportes de asistencia y horas trabajadas; supervisar horarios y productividad.  
- Media prioridad: Generar reportes estadísticos avanzados (futuro).

**6. Juniors (Soporte básico)**  
- Alta prioridad: Apoyar en registro de datos; actualizar información bajo supervisión.  
- Media prioridad: Consultar tareas asignadas y estado de proyectos.

---

## 5. Datos Básicos a Almacenar (Entidades y Atributos)

- **Empleado (todos los roles):**  
  `ID, Nombre, RUT, Cargo, Área, Fecha_ingreso, Dirección, Sueldo, Teléfono, Correo, Estado`

- **Usuarios:**  
  `ID, Nombre, Rol, Correo, Contraseña, Estado`

- **Asistencia:**  
  `ID, EmpleadoID, Fecha, HoraEntrada, HoraSalida`

- **Accesos:**  
  `ID, EmpleadoID, Área, IntentosFallidos, FechaHora`

- **Salarios:**  
  `ID, EmpleadoID, HorasTrabajadas, SueldoBase, Aprobación`

---

## 6. Requisitos Funcionales (RF)

- **RF1:** Registrar empleados con validación de campos obligatorios → *Issue #2*  
- **RF2:** Gestionar usuarios y asignar roles → *Issue #1*  
- **RF3:** Registrar control de entrada y salida → *Issue #3*  
- **RF4:** Controlar accesos a áreas restringidas → *Issue #4*  
- **RF5:** Calcular y aprobar salarios → *Issue #5*  
- **RF6:** Registrar modificaciones y mantener historial (auditoría) → *Issue #6*  

---

## 7. Requisitos No Funcionales (RNF)

- **RNF1:** Seguridad de la información → *Issue #7*  
- **RNF2:** Rendimiento rápido y eficiente → *Issue #7*  
- **RNF3:** Actualización automática de datos → *Issue #7*  
- **RNF4:** Escalabilidad para futuras funcionalidades → *Issue #7*  

---

## 8. Definición del MVP

**Incluye:**  
- Gestión básica de empleados  
- Roles y permisos iniciales  
- Registro de asistencia  
- Seguridad mínima en accesos  

**Excluye (para futuras versiones):**  
- Reportes avanzados  
- Nómina automática  
- Auditoría completa  
- Notificaciones  
- Estadísticas de productividad  

---

## 9. Correspondencia con Issues

| Issue | Requisito asociado |
|-------|------------------|
| 1 | Gestión de usuarios y roles (RF2) |
| 2 | Registro de empleados (RF1) |
| 3 | Control de asistencia (RF3) |
| 4 | Seguridad de accesos (RF4) |
| 5 | Gestión de salarios (RF5) |
| 6 | Auditoría de cambios (RF6) |
| 7 | Requisitos no funcionales (RNF1-RNF4) |
| 8 | Definición del MVP |
