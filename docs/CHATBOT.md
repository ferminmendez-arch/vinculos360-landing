# Chatbot de calificación de leads — Vínculos 360

Asistente flotante, bilingüe (español en `/`, inglés en `/en/`), con preguntas fijas (sin IA y sin servicios de pago). Califica al visitante, pide su consentimiento explícito y guarda la solicitud.

## Cómo funciona

```
Sitio (widget)  ──POST /api/leads──▶  Azure Function (funciones administradas de Static Web Apps)
                                         ├─ valida, filtra spam, exige consentimiento
                                         ├─▶ Hoja "Vínculos 360 — Leads" (receptor de Apps Script)   ← destino actual
                                         └─▶ Azure Table Storage (opcional, requiere aprobación)
Hoja Leads ──(cada 15 min)──▶ Agente de leads: Seguimiento + correo al dueño + borrador de WhatsApp
```

- **Servicios:** Electricidad y ahorro · Internet para el hogar · Seguridad del hogar · Otros servicios. Cada uno tiene 3–4 preguntas propias.
- **Datos que pide:** ZIP Code, nombre, medio de contacto preferido (WhatsApp, llamada, texto o correo), teléfono, correo (solo si eligió correo) y consentimiento explícito (casilla sin marcar por defecto).
- **Comparación de precio (solo electricidad, para casa):**
  - el chat pide el total de la última factura y los kWh de ese mes; en cada uno se puede responder "No lo sé";
  - calcula el precio por kWh que paga el visitante (factura ÷ kWh) y lo compara con el **promedio residencial de Texas de la EIA**;
  - el promedio está en `TX_RESIDENTIAL_AVG` (`api/src/lib/rules.js`): 16.0¢, 12 meses a septiembre de 2026; actualízalo cada trimestre;
  - resultado: **alta** (10 % o más arriba del promedio), **media** o **baja** (10 % o más abajo). Sale en *Device* (`Mobile · Chatbot · Ahorro: alta`) y en *Answers* (`precio_kwh=20c; oportunidad=alta`);
  - no usa tarifas de ningún proveedor, no lo nombra y no promete un ahorro concreto. Los términos de la tienda de ACN (Sección 2) prohíben reutilizar sus listas de precios;
  - para negocios no se compara, porque el promedio es residencial.
- **Respuestas como códigos:** las preguntas se guardan como códigos (`property=casa; decision=si`), no como texto libre.
- **Precalificado:** decide sobre el servicio, es para casa, y para electricidad el ZIP es de Texas fuera de Austin/San Antonio/El Paso. Para seguridad, además, no está "solo explorando". Es una ayuda para priorizar; el estado **Calificado** lo sigue poniendo el dueño en *Seguimiento*.
- **Nunca se pierde un lead:** el sitio solo muestra "Recibimos tu solicitud" cuando la API confirma que se guardó en al menos un destino. Si la API no existe o no conecta, el widget envía directo al receptor de Apps Script. Si nada funciona, conserva las respuestas, ofrece WhatsApp con los datos y reintenta en la próxima visita.
- **Duplicados:** la misma solicitud (teléfono + servicio) no se registra dos veces en 30 minutos. El agente de leads marca duplicados de 30 días.

### Archivos

| Archivo | Qué hace |
| --- | --- |
| `src/components/Chatbot.jsx` | Botón flotante. El panel se descarga solo al abrir el chat. |
| `src/components/ChatPanel.jsx` | Conversación, entradas, consentimiento y estados de envío. |
| `src/lib/chatbot/flow.js` | Flujo determinista (siguiente paso, Atrás, payload). |
| `src/lib/chatbot/strings.js` | Textos ES/EN, consentimiento y aviso de privacidad. |
| `src/lib/chatbot/api.js` | Envío verificado, respaldo directo a la hoja y métricas. |
| `api/src/lib/rules.js` | Validación y precalificación **compartidas** por el sitio y la API. |
| `api/src/lib/handlers.js` | Endpoints: `/api/leads`, `/api/chat-event`, `/api/health`. |
| `api/src/lib/sinks.js` | Hoja (Apps Script) y Azure Table Storage (REST + SAS, sin SDK). |
| `api/src/functions/api.js` | Registro en Azure Functions (modelo v4, Node 22). |
| `automation/apps-script/receptor/Receptor.js` | Receptor **v2** (compatible con v1): columnas del chatbot y pestaña *Chatbot* con métricas. |
| `automation/chatbot/metrics.mjs` | Reporte de métricas desde Azure Table (si se aprueba Storage). |

## Seguridad y privacidad

- **Validación en el servidor:**
  - servicio y respuestas contra listas cerradas;
  - nombre (sin URLs ni `<>{}=`), teléfono de EE. UU. de 10 dígitos, ZIP de 5 dígitos y correo;
  - consentimiento `true` con la versión vigente del texto (`CONSENT_VERSION`);
  - cuerpo de hasta 8 KB.
- **Anti-spam:**
  - campo trampa oculto;
  - tiempo mínimo de 4 s entre abrir el chat y enviar;
  - lista de orígenes permitidos (vinculos360.com, entornos de Static Web Apps de este sitio y localhost);
  - límite de 6 solicitudes cada 10 min por IP, por instancia.
  - Al bot se le responde "éxito", pero no se guarda nada.
- **Fórmulas neutralizadas:** los valores que empiezan con `= + - @` se guardan como texto (hoja y tabla).
- **Sin datos personales en registros ni métricas:**
  - los registros de la función solo tienen el id del lead, el destino y el motivo del error;
  - los eventos (`chat_open`, `chat_start`, `chat_complete`, `chat_qualified`) solo llevan el idioma y el servicio.
- **Mínimo privilegio en Azure Storage:** la función usa una URL SAS de **una tabla** con permiso **solo agregar** (`sp=a`). No puede leer, cambiar ni borrar registros. Para leer métricas se usa otra SAS de solo lectura (`sp=r`) que se queda en la computadora del dueño.
- **Sin secretos en el repositorio:** la URL del receptor de Apps Script es pública (ya estaba en el sitio). Las URLs SAS se guardan en la configuración de Azure.
- **CSP sin cambios:** `/api` es del mismo origen (`connect-src 'self'`).
- **Textos legales:** el consentimiento y el aviso de privacidad son un borrador razonable, **no asesoría legal**. Conviene que el dueño los revise. Si se cambian, sube `CONSENT_VERSION` en `api/src/lib/rules.js`.

## Configuración de la API (Azure → Static Web App → Variables de entorno)

Todas son opcionales. Sin ninguna, la API guarda en la hoja actual.

| Variable | Valor por defecto | Para qué |
| --- | --- | --- |
| `LEADS_SHEET_ENABLED` | `true` | `false` apaga el envío a la hoja. Si no queda ningún destino, el widget envía directo a la hoja. |
| `LEADS_SHEET_ENDPOINT` | receptor de producción | Apuntar a una hoja de pruebas. |
| `LEADS_TABLE_SAS_URL` | (vacío) | Guardar también en Azure Table (SAS de tabla, `sp=a`). |
| `EVENTS_TABLE_SAS_URL` | (vacío) | Métricas en Azure Table (SAS de tabla, `sp=a`). |
| `CHAT_EVENTS_TO_SHEET` | `true` | Métricas en la pestaña *Chatbot* (receptor v2, instalado el 26 nov 2026). `false` las apaga. |
| `ALLOWED_ORIGINS` | (vacío) | Orígenes extra separados por comas. |

## Notificaciones por correo (sin costo)

No hace falta un servicio nuevo. Los leads del chatbot llegan a la pestaña **Leads** igual que los del formulario. El agente de leads ("Vinculos 365", cada 15 min) ya hace tres cosas con cada lead nuevo:
- lo agrega a *Seguimiento*;
- envía un correo al dueño;
- prepara el borrador de WhatsApp.

En la columna *Device* aparecen como `Mobile · Chatbot`. Si quieres avisos más rápidos, cambia el activador de `processNewLeads` a cada 5 min. Apps Script tampoco cobra por eso.

## Métricas de conversión

| Métrica | Evento | Cuándo |
| --- | --- | --- |
| Aperturas | `chat_open` | El visitante abre el chat (1 por visita) |
| Conversaciones iniciadas | `chat_start` | Elige un servicio |
| Completadas | `chat_complete` | La solicitud quedó guardada (confirmada) |
| Precalificadas | `chat_qualified` | Completada y precalificada |

Dónde verlas (elige una):
1. **Sin costo (activo):** pestaña **Chatbot** de la hoja, una fila por día (receptor v2).
2. **Azure Table** (si se aprueba): `EVENTS_TABLE_SAS_URL` y `node automation/chatbot/metrics.mjs 30`.

Si hay Google Tag Manager, también se envían a `dataLayer`. El píxel de Meta (si existe) recibe `Lead` al completar.

## Despliegue

1. **PR → vista previa.** El PR despliega un entorno de vista previa de Static Web Apps con el sitio **y** la API (`api_location: "api"`). CI corre:
   - lint;
   - las pruebas (`npm test`);
   - el build;
   - la prueba de humo de la API (`npm run smoke --prefix api`).
2. **Probar en la vista previa** con datos de prueba: nombre "Prueba QA" y teléfono `(281) 555-01xx`. El agente de leads las marca como *Prueba* y no envía correo.
3. **Fusionar el PR en `main`** (requiere tu aprobación). Static Web Apps publica el sitio y la API en producción.
4. **Receptor v2 (opcional, requiere tu aprobación).** Es un cambio en producción de Apps Script:
   1. abre "Vínculos 360 — Receptor de leads";
   2. reemplaza el código por `automation/apps-script/receptor/Receptor.js`;
   3. guarda;
   4. ejecuta `setupLeadsSheet()` una vez: agrega 10 columnas a la derecha de *LeadId* y crea la pestaña *Chatbot*;
   5. en Implementar → Administrar implementaciones → editar la implementación **existente**, elige *Versión nueva*. Así el `/exec` no cambia.
   6. Las métricas a la hoja ya están activas por defecto (`CHAT_EVENTS_TO_SHEET`).
5. **Azure Table Storage (opcional, requiere aprobación porque es un recurso con costo):**
   1. crea una cuenta de almacenamiento Standard LRS en Central US;
   2. crea las tablas `chatleads` y `chatevents`;
   3. genera SAS de tabla con permiso `a` (solo agregar) y vencimiento de 1 año;
   4. copia las URLs en `LEADS_TABLE_SAS_URL` y `EVENTS_TABLE_SAS_URL`.

### Verificación después de desplegar

- `GET https://www.vinculos360.com/api/health` → `{"ok":true,…,"sinks":{"sheet":true,…}}`.
- Abrir el chat en `/` y `/en/`, completar una solicitud "Prueba QA" y confirmar la fila en *Leads* (con `· Chatbot`).
- El formulario de contacto sigue funcionando igual: no se modificó.

## Reversión

| Qué | Cómo | Efecto |
| --- | --- | --- |
| Todo el chatbot | Revertir el commit de fusión en `main` (botón *Revert* del PR → fusionar) | El workflow vuelve a desplegar la versión anterior: sitio sin chat, sin API. |
| Solo la API | `LEADS_SHEET_ENABLED=false` (sin SAS) | La API responde `no_storage_configured` y el widget envía directo a la hoja. No se pierden leads. |
| Receptor v2 | Apps Script → Administrar implementaciones → editar → elegir la versión anterior | La URL `/exec` no cambia. Las columnas extra quedan vacías y no afectan al agente. |
| Azure Storage | Borrar las variables `*_TABLE_SAS_URL` (y, si se desea, la cuenta) | La API vuelve a guardar solo en la hoja. |

Versión de producción antes de este cambio: `main` en `f94a676`.

## Recursos de Azure y costos estimados

| Recurso | Estado | Costo estimado |
| --- | --- | --- |
| Static Web App `Vinculos360-Landing` (existente) | Sin cambios de plan | Funciones administradas incluidas en el plan actual: $0 adicional. |
| Azure Functions administradas (`/api`) | Nuevo, dentro de la Static Web App | $0 adicional. No crea recursos aparte. |
| Azure Storage (Table) | **No creado. Requiere aprobación.** | Con decenas de leads y miles de eventos al mes: centavos al mes (menos de $1). |
| Apps Script / Google Sheets | Existente | $0 |
| IA / servicios de correo de pago | No se usan | $0 |

## Comparación de tarifas e inscripción segura (agente de leads, nov. 2026)

**Distribuidora por ZIP.** Cuando llega un lead de electricidad de Texas, la API consulta el servicio público de Power to Choose (PUCT) y guarda la distribuidora en *Answers* (`distribuidora=CenterPoint`). Si la consulta falla, el lead se guarda igual, sin ese dato.

**Pestaña privada "Tarifas"** (la crea el agente):

| Distribuidora | Plan | Plazo (meses) | ¢/kWh a 500 | ¢/kWh a 1000 | ¢/kWh a 2000 | Actualizado | Notas |
|---|---|---|---|---|---|---|---|

- El dueño la llena con los precios promedio de la hoja de datos (EFL) de cada plan, por distribuidora: CenterPoint, Oncor, AEP Central, AEP North, TNMP o Lubbock.
- Acepta centavos (16.9) o dólares (0.169). Si solo hay precio a 2,000 kWh, usa ese.
- Cuando el sitio del proveedor vuelva a estar disponible, se puede agregar un lector automático que llene esta pestaña.

**En Seguimiento**, por cada lead de electricidad, el agente agrega:
- *Distribuidora*;
- *Precio actual* (factura ÷ kWh);
- *Plan sugerido*: el más barato de esa distribuidora al consumo del cliente, interpolando 500/1,000/2,000 kWh;
- *Precio plan*;
- *Diferencia estimada ($/mes)*.

El correo de aviso incluye esa línea, sin nombre ni teléfono. Nada de esto se muestra al visitante.

**Inscripción segura.** En *Seguimiento* también aparecen dos columnas: *Mensaje inscripción* y *Abrir WhatsApp (inscripción)*.
- El mensaje lleva el enlace oficial de inscripción con el ID de IBO: `https://acn.xoomenergy.com/en/?p=04893385`. Se puede cambiar con la propiedad del script `ENROLL_URL_ELECTRICIDAD`.
- El cliente escribe su identificación y su SSN directamente en el sitio del proveedor: ni el sitio, ni la hoja, ni WhatsApp los reciben.
- **El sitio y el chat nunca deben pedir SSN, identificación ni datos bancarios.**

## Copia a Sales Hub CRM

La copia se ejecuta en la API del sitio después de una confirmación de Sheets. La hoja conserva el `ChatLeadId`, que la copia usa como `externalKey`. La respuesta al visitante y las notificaciones existentes mantienen sus destinos actuales. Los formularios que van directamente a Apps Script, incluidos los respaldos del navegador, quedan en Sheets para reconciliación.

| Variable del servidor | Configuración |
| --- | --- |
| `CRM_INGEST_ENABLED` | Desactivada por defecto. El valor exacto `true` habilita la copia. |
| `CRM_INGEST_URL` | Vista previa `https://kind-river-0a4356110-preview.centralus.4.azurestaticapps.net/api/ingest/lead`. Producción `https://crm.vinculos360.com/api/ingest/lead`. |
| `CRM_INGEST_SECRET` | Secreto de al menos 32 bytes, igual al de la API receptora del CRM. Usa uno distinto por entorno, en la configuración privada del servidor. |

Para probar en Azure, configura primero una **hoja de pruebas** en el entorno de vista previa del sitio y confirma que el CRM de vista previa usa almacenamiento en memoria. Configura el secreto en ambos servidores, habilita la copia en la vista previa y usa datos sintéticos. Comprueba la misma clave en la hoja y en el CRM. Verifica también que Sheets siga aceptando solicitudes si el CRM rechaza la firma o deja de responder.

La copia tiene un máximo de dos intentos, de dos segundos cada uno. Se reintentan errores de transporte y estados transitorios conservando la clave. Si falla, el registro de la API anota el ID y el motivo para reconciliar con Sheets. Los datos siguen en la hoja. La recuperación posterior a esos intentos es manual. Antes de activar en producción, verifica el receptor firmado, acuerda quién revisa la reconciliación y confirma el tratamiento de reintentos de llaves secundarias en el CRM. Para detener la copia, cambia `CRM_INGEST_ENABLED` a `false`.
