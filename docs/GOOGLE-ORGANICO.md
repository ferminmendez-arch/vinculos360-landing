# Google como canal de adquisición — Vínculos 360 (nov. 2026)

Objetivo: captar en Google a personas de Texas (prioridad: hispanohablantes de Greater Houston) que ya buscan resolver algo de su energía eléctrica, y llevarlas al **Analizador de factura** o al chat. Meta del proyecto: **10 leads residenciales calificados en 30 días**.

## 1. Estado del ecosistema Google (verificado el 27 nov. 2026, cuenta fermin.mendez@gmail.com)

| Servicio | Antes | Ahora | Falta |
| --- | --- | --- | --- |
| Google Analytics 4 | Cuenta 116291991 existente, **sin propiedades** | Propiedad **566078481** “Vínculos 360 — vinculos360.com”, flujo web 16431531219, ID **G-D5YCCQLYG1**, zona horaria Chicago, USD | Publicar este PR (el sitio aún no envía datos) |
| Search Console | Sin propiedades | Propiedad URL **https://www.vinculos360.com/** creada, **pendiente de verificar** | Publicar este PR → pulsar “Verificar” (meta etiqueta y archivo HTML incluidos) |
| Google Tag Manager | Sin cuentas | **No se creó**: gtag.js directo es más simple y seguro con la CSP | — |
| Sitemap / robots | `robots.txt` y `sitemap.xml` (2 URLs) | Sitemap con portada, /en/, 4 guías, índice y privacidad | Enviar el sitemap en Search Console después de verificar |
| Google Trends | — | Usado para la investigación (abajo) | — |
| Keyword Planner | **Sin cuenta de Google Ads** | No disponible | Crear cuenta de Ads solo si el dueño lo autoriza (pide aceptar términos y suele pedir forma de pago) |
| Google Business Profile | — | No creado (ver §7) | Decisión del dueño |

Ajuste hecho en la cuenta: se rechazaron los correos promocionales opcionales de Google Analytics (opción más privada del aviso que apareció).

## 2. Medición de conversiones

Implementado en `src/lib/analytics.js` (sitio) y `public/guias/guias.js` (guías estáticas). Todo pasa por una lista cerrada de parámetros (`language`, `service`, `entry_point`); **nunca** se envían nombre, teléfono, correo, ZIP ni montos de factura. Google Signals y personalización de anuncios desactivados.

| Evento GA4 | Cuándo se dispara | También en la hoja (`/api/chat-event` → pestaña de métricas) |
| --- | --- | --- |
| `analyzer_started` | Primer dato escrito en el Analizador | Sí (nuevo) |
| `analyzer_completed` | El Analizador mostró un resultado | Sí, como `analyzer_calc` (columna existente) |
| `comparison_requested` | Clic en “comparación personalizada” | Sí, como `analyzer_cta` (columna existente) |
| `lead_submitted` | **Solo** cuando el receptor confirmó el guardado (formulario, chat o recordatorio). No con duplicados ni con el campo trampa | Sí (nuevo) |
| `whatsapp_clicked` | Clic en un enlace de WhatsApp con el número del negocio, o redirección del formulario. El botón “compartir” no cuenta | Sí (nuevo) |
| `customer_enrolled` | No ocurre en el sitio: se cuenta en la hoja cuando el dueño marca **Inscrito** o **Cliente** | Reporte semanal |

Otros cambios: la CSP permite `googletagmanager.com` y `google-analytics.com`; nueva página `/privacidad/` que explica el uso de Google Analytics; enlaces “Guías” y “Privacidad” en el pie de página. Las columnas nuevas de la pestaña de métricas aparecen solas cuando se guarde la versión nueva del receptor (`Receptor.js`); mientras tanto la tabla de Azure recibe los eventos.

Pendiente en GA4 (después de que lleguen datos): marcar `lead_submitted` y `whatsapp_clicked` como **eventos clave**, y subir la retención de datos a 14 meses (Administrar → Recopilación de datos → Retención).

## 3. Investigación de búsquedas (solo datos verificables)

**Fuente:** Google Trends, Texas, últimos 12 meses, consultado el 27 nov. 2026. Trends da **interés relativo** (0–100 dentro de cada comparación), **no volumen**. Volumen, competencia y CPC por palabra requieren Keyword Planner, que no está disponible (sin cuenta de Ads): **no se reportan cifras de volumen ni CPC por palabra clave**.

| Comparación (Texas, 12 meses) | Interés promedio relativo |
| --- | --- |
| power to choose · electricity plans · no deposit electricity · luz en houston · compañías de luz | 76 · 53 · 10 · 1 · <1 |
| electricity rates · electricity plans · cheap electricity · set up electricity · high electric bill | 45 · 27 · 16 · 2 · 2 |
| luz en houston · energía eléctrica · electricidad en texas · compañías de luz · luz sin depósito | 15 · 12 · 2 · 0 · 0 |

Hallazgos:
1. **Las búsquedas en español son ~50 veces menores** que las equivalentes en inglés. Muchos hispanos de Texas buscan en inglés o en *spanglish*: en consultas en aumento aparecen **“cheap light company”**, **“cheap light companies”** (traducción literal de “compañía de luz”), “compare electric rates” y “why is my electric bill so high this month”.
2. En español la gente busca **“luz”**, no “energía eléctrica”: “energía eléctrica” en Texas se asocia sobre todo con Puerto Rico (consulta relacionada principal: “autoridad de energía eléctrica de puerto rico”). Por eso las guías usan “luz” en el título SEO y “energía eléctrica” en el texto, como pide el dueño.
3. “luz sin depósito” / “compañías de luz baratas y sin depósito” es la intención hispana más clara, pero **no se usa en contenido** (regla del dueño: no mencionar crédito ni depósito en público).
4. Las búsquedas en español tienen picos esporádicos (ene., jun.–oct.) y subieron en la segunda mitad de noviembre.

Palabras clave priorizadas (intención comercial, competencia probablemente menor por ser nicho; no verificado con Keyword Planner):

| Tema | Español | Inglés / spanglish | Página |
| --- | --- | --- | --- |
| Costo efectivo por kWh | costo por kWh, precio de la luz por kWh | compare electric rates, electricity rates | `/guias/costo-por-kwh/` + Analizador |
| Factura elevada | subió mi factura de luz, recibo de luz alto | why is my electric bill so high | `/guias/factura-de-luz-alta/` |
| Renovación | se vence mi contrato de luz, renovar contrato de luz | electricity contract expiring | `/guias/vence-tu-contrato-de-luz/` |
| Mudanza | luz para casa nueva, conectar la luz | set up electricity, new apartment electricity | `/guias/mudanza-luz-texas/` |
| Atención en español | compañías de luz en houston, luz en houston | cheap light company (evitar promesa de “barato”) | Portada / índice de guías |

## 4. Contenido orgánico

Cuatro guías originales en `public/guias/` generadas desde `automation/seo/guides.mjs` (`node automation/seo/build-guides.mjs`). HTML estático (Google lo lee sin JavaScript), datos regulatorios con fuente oficial (PUCT FAQ, 16 TAC §25.475), JSON-LD de artículo, migas y preguntas frecuentes, y una llamada a la acción al Analizador, al recordatorio de vencimiento o al chat. Pasan por `claims-lint` en las pruebas (sin precios, ahorro, “gratis”, marcas ni crédito).

Integración con el Agente de Contenido: en `automation/content/topics.json` los temas `efl-que-es`, `efl-500-1000-2000`, `lee-tu-factura` y `fin-de-contrato` llevan el campo `guide`; sus publicaciones en español enlazan a la guía con UTM.

Atribución: si alguien llega a una guía desde Google y después deja sus datos en el sitio, la hoja guarda el origen (`google.com`) y `utm_content = guia-<slug>`.

Próximo contenido (cuando Search Console muestre consultas reales): versión en inglés de “costo por kWh”, y una guía de “cómo comparar planes con la EFL”.

## 5. Agente de inteligencia de búsqueda

`automation/apps-script/SearchAgent.js`, en el mismo proyecto de Apps Script **Vinculos 365**. Cada lunes 8:30 (Houston): impresiones, clics, CTR, posición, consultas (Search Console API), eventos del embudo (GA4 Data API), leads desde Google, calificados e inscritos (hoja). Escribe la pestaña **Google**, envía el correo y propone oportunidades SEO (subir al top 3, mejorar título, tema sin guía). Si una API falla, lo dice en el reporte.

| API | Costo | Cuota relevante | Permiso (scope) |
| --- | --- | --- | --- |
| Search Console API | $0 | 1,200 consultas/min por sitio y por usuario | `webmasters.readonly` |
| Analytics Data API v1 | $0 | 200,000 tokens/día y 40,000/hora por propiedad estándar | `analytics.readonly` |

Uso: 2 llamadas por semana. Para instalarlo:
1. Verificar Search Console (§1).
2. En Apps Script, vincular el proyecto a un proyecto **estándar** de Google Cloud (gratis, sin facturación) y activar “Google Search Console API” y “Google Analytics Data API”. Los proyectos predeterminados de Apps Script no permiten activar APIs.
3. Copiar `SearchAgent.js` y el `appsscript.json` nuevo; ejecutar `testSearchAccess`, aprobar la ventana de permisos (paso del dueño) y luego `setupSearchAgent`.
Se puede hacer junto con la autorización OAuth que ya estaba pendiente para LeadAgent y OpportunityAgent.

## 6. Google Ads — piloto (evaluación; **no activado, sin gasto**)

| Punto | Recomendación |
| --- | --- |
| Palabras clave | Concordancia de frase: “compañías de luz en houston”, “luz en houston”, “cheap light company houston”, “compare electric rates houston”, “electricidad en español houston” |
| Negativas | trabajo, empleo, jobs, login, pagar factura, pay bill, outage, apagón, número de teléfono, customer service, austin, san antonio, el paso, puerto rico, gratis, free, solar |
| Geografía | Condados de Harris, Fort Bend y Montgomery (zona con opción de proveedor); “presencia” en la zona, no “interés” |
| Idioma | Español e inglés (Google no segmenta por el idioma de la consulta) |
| Página de destino | `/#analizador` (o `/guias/costo-por-kwh/` para tráfico informativo) |
| CPC estimado | No hay CPC por palabra verificado (sin Keyword Planner). Referencia de industria: mediana de **4.57 USD** en “Energy, Utilities & Agriculture” (TwoMinuteReports) y promedio general de **5.42 USD** (WordStream/LocaliQ 2026) |
| Presupuesto mínimo viable | Con 50 USD y CPC de 4.5–5.5 USD salen **~9–11 clics**. Con una tasa de conversión promedio de la industria (~7.5 %) eso da **menos de 1 lead esperado**: no alcanza para aprender ni optimizar. Un piloto con señal mínima necesita ~100 clics (≈450–550 USD) |
| Comparación con Facebook | Facebook/Instagram permite segmentar por idioma y comunidad local y ya tiene página, grupos y borradores listos; Google capta intención más alta, pero con un CPC de referencia que deja muy pocos clics con 50 USD. **Con 50 USD, Facebook es la mejor primera prueba**; Google Ads se evalúa cuando haya presupuesto mayor y datos de conversión del sitio |
| Éxito / suspensión | Éxito: ≥1 lead calificado por cada 50 USD. Suspender si se gastan 25 USD sin ningún `lead_submitted`, o si el CTR < 3 % después de 300 impresiones |

Tope global: 50 USD, **no autorizado**. No se creó cuenta de Ads ni campañas.

## 7. Google Business Profile — elegibilidad

Según las reglas de Google, para tener perfil una empresa debe tener **contacto en persona con clientes durante su horario**; no son elegibles los **negocios solo en línea** ni los **agentes o empresas de generación de leads**. Vínculos 360 hoy opera en línea (sitio, chat, WhatsApp) como representante independiente.

Conclusión: **no se creó perfil**. Solo sería elegible si Fermín atiende clientes cara a cara de forma regular (en casa del cliente o en un local) durante un horario publicado, como negocio de área de servicio con la dirección oculta y con el nombre real del negocio. Si eso no es así hoy, crear el perfil arriesga una suspensión. Decisión del dueño.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Poco volumen de búsqueda en español | Guías con títulos que incluyen “luz” y consultas en spanglish; versión en inglés como siguiente paso |
| SEO tarda semanas en mostrar resultados | No sustituye a Facebook ni a referidos dentro de la meta de 30 días; es inversión a 2–3 meses |
| Datos personales en Analytics | Lista cerrada de parámetros probada en `tests/analytics.test.js` |
| Afirmaciones no autorizadas | `claims-lint` en cada guía (prueba automática) |
| CSP más abierta | Solo dominios de Google Analytics; sin scripts en línea |

## 9. Pasos del dueño
1. Aprobar y publicar el PR (“publica el PR #…”).
2. Después de publicar: Claude pulsa “Verificar” en Search Console, envía el sitemap y comprueba GA4 en tiempo real.
3. Vincular Apps Script a un proyecto de Google Cloud y aprobar permisos (junto con el OAuth pendiente).
4. Decidir sobre Google Business Profile (§7) y, si algún día hay presupuesto, sobre Google Ads (§6).
