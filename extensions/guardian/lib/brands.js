// Marcas mas suplantadas en España (bancos, paqueteria, administracion, grandes plataformas) y sus dominios oficiales.
// [clave, nombre visible, [dominios oficiales (dominio base)], web a la que mandar a la persona]
export const BRANDS = [
  ["bbva", "BBVA", ["bbva.es", "bbva.com", "bbva.mx"], "https://www.bbva.es"],
  ["santander", "Banco Santander", ["bancosantander.es", "santander.com", "santander.es", "santanderbank.com", "santander.co.uk"], "https://www.bancosantander.es"],
  ["caixabank", "CaixaBank", ["caixabank.es", "caixabank.com", "lacaixa.es"], "https://www.caixabank.es"],
  ["lacaixa", "CaixaBank", ["caixabank.es", "lacaixa.es"], "https://www.caixabank.es"],
  ["sabadell", "Banco Sabadell", ["bancsabadell.com", "bancosabadell.com", "sabadell.com"], "https://www.bancsabadell.com"],
  ["bankinter", "Bankinter", ["bankinter.com", "bankinter.es"], "https://www.bankinter.com"],
  ["openbank", "Openbank", ["openbank.es", "openbank.com"], "https://www.openbank.es"],
  ["unicaja", "Unicaja", ["unicajabanco.es", "unicaja.es"], "https://www.unicajabanco.es"],
  ["abanca", "Abanca", ["abanca.com", "abanca.es"], "https://www.abanca.com"],
  ["kutxabank", "Kutxabank", ["kutxabank.es", "kutxabank.com"], "https://www.kutxabank.es"],
  ["ibercaja", "Ibercaja", ["ibercaja.es", "ibercaja.com"], "https://www.ibercaja.es"],
  ["cajamar", "Cajamar", ["cajamar.es", "grupocooperativocajamar.es"], "https://www.cajamar.es"],
  ["evobanco", "EVO Banco", ["evobanco.com"], "https://www.evobanco.com"],
  ["revolut", "Revolut", ["revolut.com"], "https://www.revolut.com"],
  ["bizum", "Bizum", ["bizum.es"], "https://bizum.es"],
  ["paypal", "PayPal", ["paypal.com", "paypal.me", "paypalobjects.com"], "https://www.paypal.com"],
  ["correos", "Correos", ["correos.es", "correos.com", "correosexpress.com"], "https://www.correos.es"],
  ["seur", "SEUR", ["seur.com", "seur.es"], "https://www.seur.com"],
  ["mrw", "MRW", ["mrw.es"], "https://www.mrw.es"],
  ["dhl", "DHL", ["dhl.com", "dhl.es", "dhl.de"], "https://www.dhl.com"],
  ["gls", "GLS", ["gls-spain.es", "gls-group.com", "gls-group.eu"], "https://www.gls-spain.es"],
  ["agenciatributaria", "Agencia Tributaria", ["agenciatributaria.es", "agenciatributaria.gob.es", "aeat.es"], "https://sede.agenciatributaria.gob.es"],
  ["hacienda", "Agencia Tributaria", ["hacienda.gob.es", "agenciatributaria.gob.es", "agenciatributaria.es"], "https://sede.agenciatributaria.gob.es"],
  ["dgt", "DGT", ["dgt.es", "dgt.gob.es"], "https://sede.dgt.gob.es"],
  ["segsocial", "Seguridad Social", ["seg-social.es", "seg-social.gob.es", "importass.es"], "https://sede.seg-social.gob.es"],
  ["seguridadsocial", "Seguridad Social", ["seg-social.es", "seg-social.gob.es", "importass.es"], "https://sede.seg-social.gob.es"],
  ["amazon", "Amazon", ["amazon.es", "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it", "amazon.com.mx", "amazon.jobs", "amazon.dev", "amazonaws.com", "primevideo.com", "aboutamazon.com", "aboutamazon.es"], "https://www.amazon.es"],
  ["netflix", "Netflix", ["netflix.com", "netflix.shop", "netflix.net"], "https://www.netflix.com"],
  ["microsoft", "Microsoft", ["microsoft.com", "microsoftonline.com", "live.com", "office.com", "outlook.com", "azure.com", "microsoft365.com"], "https://www.microsoft.com"],
  ["outlook", "Microsoft", ["outlook.com", "live.com", "microsoft.com", "office.com"], "https://outlook.live.com"],
  ["apple", "Apple", ["apple.com", "icloud.com", "apple.news", "apple.co"], "https://www.apple.com"],
  ["icloud", "Apple", ["icloud.com", "apple.com"], "https://www.icloud.com"],
  ["google", "Google", ["google.com", "google.es", "googleapis.com", "gmail.com", "youtube.com", "withgoogle.com", "google.dev", "googleblog.com", "goo.gl"], "https://www.google.com"],
  ["instagram", "Instagram", ["instagram.com", "cdninstagram.com"], "https://www.instagram.com"],
  ["facebook", "Facebook", ["facebook.com", "fb.com", "meta.com", "fbcdn.net", "messenger.com"], "https://www.facebook.com"],
  ["whatsapp", "WhatsApp", ["whatsapp.com", "whatsapp.net", "wa.me"], "https://www.whatsapp.com"],
  ["wallapop", "Wallapop", ["wallapop.com"], "https://es.wallapop.com"],
  ["vinted", "Vinted", ["vinted.es", "vinted.com", "vinted.fr"], "https://www.vinted.es"],
  ["movistar", "Movistar", ["movistar.es", "movistar.com", "telefonica.com", "telefonica.es"], "https://www.movistar.es"],
  ["vodafone", "Vodafone", ["vodafone.es", "vodafone.com"], "https://www.vodafone.es"],
  ["orange", "Orange", ["orange.es", "orange.com", "orange.fr"], "https://www.orange.es"],
  ["endesa", "Endesa", ["endesa.com", "endesa.es", "endesaclientes.com", "endesax.com"], "https://www.endesa.com"],
  ["iberdrola", "Iberdrola", ["iberdrola.es", "iberdrola.com"], "https://www.iberdrola.es"],
  ["naturgy", "Naturgy", ["naturgy.es", "naturgy.com"], "https://www.naturgy.es"],
  ["dropbox", "Dropbox", ["dropbox.com"], "https://www.dropbox.com"],
  ["linkedin", "LinkedIn", ["linkedin.com", "licdn.com", "lnkd.in"], "https://www.linkedin.com"],
  ["coinbase", "Coinbase", ["coinbase.com"], "https://www.coinbase.com"],
  ["binance", "Binance", ["binance.com", "binance.es"], "https://www.binance.com"],
];

// Palabras que acompañan al nombre de la marca en los dominios de phishing.
export const BAIT_WORDS = ["login", "signin", "acceso", "acceder", "verify", "verificar", "verificacion", "verification", "secure", "seguro", "seguridad", "security", "cliente", "clientes", "client", "soporte", "support", "account", "cuenta", "cuentas", "paquete", "envio", "envios", "entrega", "tracking", "seguimiento", "pago", "pagos", "payment", "update", "actualizar", "actualizacion", "multa", "multas", "aviso", "notificacion", "banca", "online", "particulares", "app", "id", "web", "sede", "devolucion", "reembolso", "factura", "facturas", "refund", "confirm", "confirmar", "validar", "desbloquear", "unlock", "bloqueo", "alerta", "alert", "premio", "bonus", "wallet"];

// TLD baratos que concentran el abuso. No son malos por si solos: solo suman.
export const RISKY_TLDS = ["top", "xyz", "click", "icu", "cfd", "sbs", "rest", "cam", "zip", "mov", "quest", "buzz", "monster", "cyou", "tk", "ml", "ga", "cf", "gq", "lol", "bond", "shop", "live", "online", "site", "website", "space", "fun", "vip", "work", "support", "info"];

// Palabras y empresas REALES que quedan a una letra de una marca: no son imitaciones (revolt.tv, amazone.de, correo.*, goggle...).
// Solo se saltan la regla del "casi igual"; si ademas llevan la marca con cebo o piden datos en un TLD barato, siguen avisando.
export const NOT_TYPOS = new Set(["revolt", "revolute", "amazone", "amazona", "amazonas", "oranje", "orang", "papal", "paypay", "vented", "vined", "goggle", "googly", "abaca", "abanka", "correo", "correa", "haciendas", "fakebook"]);
