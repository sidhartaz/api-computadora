// Función para eliminar la información de contacto (contactWhatsapp) de un listing
function stripContactInfo(listing) {
  // Si no viene listing (null, undefined, etc.), simplemente lo devuelve tal cual
  if (!listing) return listing;

  // Usa destructuring para separar contactWhatsapp del resto de propiedades
  // - contactWhatsapp se descarta
  // - rest contiene todas las demás propiedades del listing
  const { contactWhatsapp, ...rest } = listing;

  // Devuelve el objeto listing sin el campo contactWhatsapp
  return rest;
}

// Exporta la función para poder usarla en otros archivos (ej: controladores)
module.exports = { stripContactInfo };
