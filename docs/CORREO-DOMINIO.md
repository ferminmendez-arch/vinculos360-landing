# Correo desde el dominio vinculos360.com

**Objetivo:** que los correos a clientes salgan de **fermin.mendez@vinculos360.com** y que los avisos internos lleguen a ese mismo buzón.

## Por qué hace falta Microsoft 365
`vinculos360.com` recibe correo en Microsoft 365 (MX `vinculos360-com.mail.protection.outlook.com`).

Su SPF (`v=spf1 include:spf.protection.outlook.com -all`) y su DMARC (`p=quarantine`) solo autorizan a los servidores de Microsoft. Si Google enviara con ese remitente, el correo caería en spam.

Por eso el receptor de leads envía con **Microsoft Graph** (`sendMail`) usando una aplicación registrada en el Microsoft 365 del negocio.

Mientras esa aplicación no exista, o si Graph falla, el correo sale de la cuenta de Google del script con:
- nombre "Fermín Mendez · Vínculos 360";
- Reply-To `fermin.mendez@vinculos360.com`.

El lead se guarda siempre antes del envío.

## Pasos del dueño (una vez, ~15 minutos; requiere ser administrador de Microsoft 365)
1. Entra a <https://entra.microsoft.com> con tu cuenta de administrador → **Applications → App registrations → New registration**.
   - Nombre: `Vínculos 360 — Receptor de leads`.
   - Cuentas: *Single tenant*.
   - **Register**.
2. En la aplicación: **API permissions → Add a permission → Microsoft Graph → Application permissions → Mail.Send → Add**.
   Luego **Grant admin consent for …** → **Yes**.
3. **Certificates & secrets → New client secret**: descripción `apps-script`, vence en 24 meses. Copia el **Value** en ese momento: no se vuelve a mostrar.
4. En **Overview**, copia **Directory (tenant) ID** y **Application (client) ID**.
5. En Apps Script, abre el proyecto **Vínculos 360 — Receptor de leads** → **Project Settings → Script properties** → agrega:
   - `MS_TENANT_ID` = Directory (tenant) ID;
   - `MS_CLIENT_ID` = Application (client) ID;
   - `MS_CLIENT_SECRET` = el Value del secreto;
   - `MS_SENDER` = `fermin.mendez@vinculos360.com`.
6. (Recomendado) Limita la aplicación a tu buzón con *RBAC for Applications* de Exchange Online. Sin esto, `Mail.Send` de aplicación puede enviar desde cualquier buzón del inquilino. Si solo tienes tu buzón, el riesgo es bajo.

**No compartas el secreto** en chats, correos ni en GitHub: solo va en las propiedades del script. Pon un recordatorio para renovarlo antes de que venza. Si vence, el sistema vuelve solo al envío por Google.

## Avisos internos
En el proyecto de Apps Script **Vinculos 365** (agentes), la propiedad `OWNER_EMAIL` define a dónde llegan los avisos de leads nuevos, recordatorios de vencimiento, el resumen diario y el reporte semanal. Para recibirlos en el negocio: `OWNER_EMAIL = fermin.mendez@vinculos360.com`.

## Verificación
Haz una prueba en la vista previa con nombre "Prueba …" y un correo tuyo. El correo debe llegar:
- con remitente `fermin.mendez@vinculos360.com`;
- con copia en **Elementos enviados** de Outlook.

En los encabezados del correo deben aparecer `spf=pass`, `dkim=pass` y `dmarc=pass`.

## Apagar o revertir
- Para volver al envío por Google: borra las propiedades `MS_*`.
- Para apagar las confirmaciones: `CONFIRMATION_EMAIL_ENABLED = false`.
- Para quitar el acceso a Microsoft: elimina la aplicación en Entra.
