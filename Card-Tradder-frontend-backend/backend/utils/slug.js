// Normaliza un texto para usarlo como base de un slug (sin espacios, acentos ni símbolos raros)
function slugifyBase(text) {
  return text
    .toString()                // Asegura que el valor sea un string
    .trim()                    // Elimina espacios al inicio y al final
    .toLowerCase()             // Convierte todo a minúsculas
    .normalize('NFD')          // Separa los caracteres con acentos en base + marca diacrítica
    .replace(/\p{Diacritic}/gu, '') // Elimina las marcas diacríticas (acentos, tildes, etc.)
    .replace(/[^a-z0-9]+/g, '-')    // Reemplaza cualquier cosa que no sea letras/números por guiones
    .replace(/^-+|-+$/g, '')        // Elimina guiones al principio o al final
    .replace(/-{2,}/g, '-');        // Reemplaza múltiples guiones seguidos por un solo guion
}

// Genera un slug único para un Listing, basado en el nombre
// ListingModel: el modelo de Mongoose (Listing)
// name: el texto base para el slug
// excludeId: opcional, para excluir un _id (útil al editar un listing existente)
async function generateUniqueSlug(ListingModel, name, excludeId = null) {
  // Genera el slug base a partir del nombre; si queda vacío, usa 'publicacion'
  const base = slugifyBase(name) || 'publicacion';
  // Candidate será el slug que vamos a probar en la BD
  let candidate = base;
  // Sufijo numérico que iremos incrementando si ya existe el slug
  let suffix = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Busca en la colección si ya existe un documento con ese slug
    const existing = await ListingModel.findOne({
      slug: candidate,
      // Si excludeId existe, se agrega condición para excluir ese _id
      // (sirve cuando estás editando un listing y no quieres que choque consigo mismo)
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')   // Solo trae el _id para que sea más liviana la consulta
      .lean();         // Devuelve objeto plano, no un documento de Mongoose

    // Si NO existe ningún documento con ese slug, este candidate es válido
    if (!existing) {
      return candidate;
    }

    // Si ya existe, incrementa el sufijo y arma un nuevo candidate:
    // base, base-1, base-2, base-3, etc.
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// Exporta la función para usarla en controladores u otros módulos
module.exports = {
  generateUniqueSlug,
};
