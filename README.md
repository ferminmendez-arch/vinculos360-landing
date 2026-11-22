# Vínculos 360 — Landing page

Sitio de captación de clientes de **www.vinculos360.com** (React 19 + Vite 8 + Tailwind CSS 4), publicado en **Azure Static Web Apps** (`Vinculos360-Landing`, Central US) mediante GitHub Actions.

## Desarrollo

```bash
npm ci          # Node >= 22.12
npm run dev     # servidor local
npm run lint
npm test        # pruebas del flujo de leads y validación (node:test)
npm run build   # genera dist/
```

## Estructura

```
src/
  config.js            WhatsApp, teléfono, endpoint de Apps Script
  content.js           textos, servicios, pasos, testimonios
  lib/leads.js         envío verificado de leads, duplicados, cola de reintentos
  lib/tracking.js      UTM / fbclid / dispositivo
  lib/validation.js    validación y formato de teléfono / ZIP
  lib/whatsapp.js      enlaces y mensaje de WhatsApp
  components/          Header, Hero, Services, HowItWorks, Testimonials,
                       ContactSection (formulario), Footer, MobileCtaBar
public/
  img/                 imágenes optimizadas (AVIF/WebP/JPG)
  staticwebapp.config.json   cabeceras de seguridad, caché, 404
  robots.txt, sitemap.xml, site.webmanifest, og-image.jpg, favicons
tests/                 pruebas unitarias
```

## Flujo de leads

Formulario → `POST` (text/plain, CORS simple) a Google Apps Script `/exec` → hoja **Leads** → WhatsApp.

Campos enviados (sin cambios respecto a producción): `name, phone, zipCode, service, source, medium, campaign, ad, fbclid, device`.

| Resultado del envío | Qué ve el cliente |
| --- | --- |
| Confirmado por el script | Confirmación y redirección a WhatsApp |
| Error del script / sin conexión | Mensaje de error, datos conservados, botón de reintento y opción de WhatsApp; se reintenta en la próxima visita |
| Respuesta ilegible o tiempo agotado | Aviso honesto ("no pudimos confirmar") y botón de WhatsApp con los datos en el mensaje; no se reenvía para evitar duplicados |

- La misma solicitud (teléfono + servicio) no se registra dos veces en 30 minutos.
- Campo trampa anti-spam (`company`).
- `?service=electricidad|internet|otros` preselecciona el servicio.
- Para usar una hoja de pruebas en un entorno de vista previa, define `VITE_LEADS_ENDPOINT`.

### Respuesta recomendada del Apps Script

Para que el sitio confirme cada lead, `doPost` debe devolver JSON:

```js
return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
  .setMimeType(ContentService.MimeType.JSON);
// en caso de error: { result: "error", error: "..." }
```

## Seguridad (Content-Security-Policy)

`public/staticwebapp.config.json` solo permite scripts propios y conexiones a `script.google.com` / `script.googleusercontent.com`. Si se agrega Google Tag Manager, Meta Pixel u otro script externo, hay que añadir sus dominios a la CSP.
