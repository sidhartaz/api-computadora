// Importa la librería bcryptjs para hacer hashing (encriptar) contraseñas
const bcrypt = require('bcryptjs');
// Importa la librería jsonwebtoken para crear y verificar tokens JWT
const jwt = require('jsonwebtoken');
// Importa el modelo User (usuario) desde la carpeta models
const User = require('../models/User');

// Define la clave secreta que se usará para firmar los JWT
// Primero intenta leerla desde las variables de entorno (process.env.JWT_SECRET)
// Si no existe, usa el string 'camilo7532' como valor por defecto
const JWT_SECRET = process.env.JWT_SECRET || 'camilo7532';

// Declara una función asíncrona para registrar usuarios nuevos
async function register(req, res) {
  // Muestra en consola que se está intentando registrar un usuario, imprimiendo el email enviado
  console.log('📩 Registro:', req.body.email);
  // Extrae name, email, password, role y contactWhatsapp del cuerpo de la petición
  const { name, email, password, role, contactWhatsapp } = req.body;

  // Valida que name, email y password vengan en el body
  if (!name || !email || !password) {
    // Si falta alguno, devuelve un error 400 (Bad Request) con un mensaje
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    // Busca en la base de datos si ya existe un usuario con ese email
    const userExists = await User.findOne({ email });
    // Si existe, devuelve error 400 indicando que el correo ya fue registrado
    if (userExists) {
      return res.status(400).json({ message: 'El correo ya existe' });
    }

    // Genera un "salt" (valor aleatorio) para el hash de la contraseña, con 10 rondas
    const salt = await bcrypt.genSalt(10);
    // Genera el hash de la contraseña usando bcrypt y el salt generado
    const hashedPassword = await bcrypt.hash(password, salt);

    // Define los roles válidos que se aceptan en el sistema
    const validRoles = ['cliente', 'vendedor', 'admin'];
    // Si el role que viene en el body está dentro de validRoles, se usa ese
    // De lo contrario, se asigna el rol por defecto 'cliente'
    const finalRole = validRoles.includes(role) ? role : 'cliente';

    // Crea una instancia de User (nuevo documento de usuario) con los datos procesados
    const newUser = new User({
      name,
      email,
      password: hashedPassword,   // Guarda la contraseña ya hasheada, no en texto plano
      role: finalRole,            // Rol final validado
      contactWhatsapp,            // Número de contacto de WhatsApp (si viene)
    });

    // Guarda el nuevo usuario en la base de datos
    await newUser.save();

    // Muestra en consola que el usuario fue creado correctamente
    console.log('✅ Usuario creado:', email);
    // Devuelve respuesta 201 (Created) con mensaje y datos básicos del usuario creado
    return res.status(201).json({
      message: 'Usuario registrado con éxito.',
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        contactWhatsapp: newUser.contactWhatsapp,
      },
    });
  } catch (error) {
    // Si ocurre algún error en el try, se captura aquí y se muestra en consola
    console.error('Error registro:', error);
    // Devuelve error 500 (Error interno del servidor)
    return res.status(500).json({ message: 'Error del servidor' });
  }
}

// Declara una función asíncrona para iniciar sesión (login)
async function login(req, res) {
  // Muestra en consola el cuerpo recibido en el login, para depuración
  console.log('🔑 Login body recibido:', req.body);

  // Extrae email y password del body; si req.body es undefined, usa {} para evitar errores
  const { email, password } = req.body || {};

  // Valida que se hayan enviado email y password
  if (!email || !password) {
    // Si falta alguno, responde con status 400 y mensaje de error
    return res.status(400).json({ message: 'Faltan email o contraseña' });
  }

  try {
    // Busca un usuario en la base de datos por su email
    const user = await User.findOne({ email });
    // Si no se encuentra, responde con credenciales inválidas
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Compara la contraseña enviada con el hash almacenado en la base de datos
    const isMatch = await bcrypt.compare(password, user.password);
    // Si la comparación no coincide, las credenciales son inválidas
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Si las credenciales son correctas, genera un token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role }, // Payload del token: id y rol del usuario
      JWT_SECRET,                        // Clave secreta para firmar el token
      { expiresIn: '1h' }                // Configuración: el token expira en 1 hora
    );

    // Devuelve una respuesta con mensaje, token y datos del usuario autenticado
    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactWhatsapp: user.contactWhatsapp,
      },
    });
  } catch (error) {
    // Si ocurre un error en el proceso de login, se muestra en consola
    console.error('Error login:', error);
    // Se responde con error 500 de servidor
    return res.status(500).json({ message: 'Error del servidor' });
  }
}

// Declara una función asíncrona para obtener el perfil del usuario autenticado
async function getProfile(req, res) {
  try {
    // Busca al usuario por su id (que viene en req.user, seteado por el middleware de autenticación)
    // y selecciona sólo algunos campos: name, email, role y contactWhatsapp
    const user = await User.findById(req.user.id).select('name email role contactWhatsapp');

    // Si no se encuentra el usuario, se responde con 404 (no encontrado)
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si se encuentra, se devuelve su información en la respuesta
    return res.json({
      message: 'Usuario autenticado',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactWhatsapp: user.contactWhatsapp,
      },
    });
  } catch (err) {
    // Si ocurre un error al buscar el usuario, se muestra en consola
    console.error('Error en GET /api/me:', err);
    // Y se responde con error 500
    return res.status(500).json({ message: 'Error al recuperar el usuario' });
  }
}

// Declara una función asíncrona para actualizar el perfil del usuario autenticado
async function updateProfile(req, res) {
  try {
    // Extrae name y contactWhatsapp del body de la petición (si req.body es undefined usa {})
    const { name, contactWhatsapp } = req.body || {};

    // Crea un objeto vacío donde se irán guardando las actualizaciones válidas
    const updates = {};

    // Si se envió "name" en el body (aunque sea vacío o null)
    if (name !== undefined) {
      // Si el nombre es una cadena vacía o sólo espacios, se devuelve error 400
      if (!name.trim()) {
        return res.status(400).json({ message: 'El nombre no puede estar vacío.' });
      }
      // Si es válido, se guarda el nombre recortando espacios al inicio y al final
      updates.name = name.trim();
    }

    // Si se envió "contactWhatsapp" en el body
    if (contactWhatsapp !== undefined) {
      // Si viene con un valor "truthy", se hace trim; si viene vacío o null, se setea como undefined
      // (esto puede usarse para limpiar o quitar el número si está vacío)
      updates.contactWhatsapp = contactWhatsapp ? contactWhatsapp.trim() : undefined;
    }

    // Si el objeto updates no tiene ninguna clave, significa que no se envió nada para actualizar
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No se enviaron cambios para actualizar.' });
    }

    // Busca y actualiza al usuario por su id, aplicando los cambios de "updates"
    // { new: true } hace que se devuelva el documento ya actualizado
    // .select(...) limita los campos que se devuelven
    const updated = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select(
      'name email role contactWhatsapp'
    );

    // Si no se encontró el usuario, responde con 404
    if (!updated) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si todo salió bien, responde con mensaje de éxito y los datos del usuario actualizado
    return res.json({
      message: 'Perfil actualizado con éxito',
      user: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        contactWhatsapp: updated.contactWhatsapp,
      },
    });
  } catch (error) {
    // Si ocurre un error en el proceso de actualización, se registra en consola
    console.error('Error en PATCH /api/me:', error);
    // Y se responde con un error 500
    return res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
}

// Función para una ruta sólo de administradores (ejemplo sencillo)
function adminSales(req, res) {
  // Responde un JSON con un mensaje indicando que solo los admins pueden ver esto
  res.json({
    message: 'Solo administradores pueden ver esta información',
  });
}

// Exporta las funciones para poder usarlas en otros archivos (por ejemplo, en las rutas)
module.exports = {
  adminSales,
  getProfile,
  login,
  register,
  updateProfile,
};
