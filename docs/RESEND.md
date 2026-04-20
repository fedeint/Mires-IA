# Integración Resend

Todos los correos transaccionales (activación de cuenta y recuperación de contraseña) se envían a través de **Resend** desde **Supabase Edge Functions**.
La API key nunca se expone en el navegador: vive como _secret_ en Supabase.

## 1. Rotar la API key
1. Entra a <https://resend.com/api-keys>.
2. Revoca la key anterior (la que quedó expuesta en el chat).
3. Genera una nueva de tipo **Full Access** o **Sending Access**. Cópiala una sola vez.

## 2. Configurar secrets en Supabase
Instala el CLI de Supabase si no lo tienes y vincula el proyecto:

```bash
supabase login
supabase link --project-ref twneirdsvyxsdsneidhi
```

Configura los secrets (reemplaza `re_xxx` por la nueva key):

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM_EMAIL=onboarding@resend.dev \
  RESEND_FROM_NAME="MiRest con IA" \
  ACTIVATION_REDIRECT_ORIGIN=https://mires-ia.vercel.app \
  RECOVERY_REDIRECT_ORIGIN=https://mires-ia.vercel.app
```

Variables:
| Variable | Descripción | Requerido |
| --- | --- | --- |
| `RESEND_API_KEY` | Key privada de Resend | Sí |
| `RESEND_FROM_EMAIL` | Remitente. `onboarding@resend.dev` funciona en modo prueba; en producción usa un correo de un dominio verificado en Resend. | No (default `onboarding@resend.dev`) |
| `RESEND_FROM_NAME` | Nombre del remitente | No (default `MiRest con IA`) |
| `ACTIVATION_REDIRECT_ORIGIN` | URL base para el enlace de invitación | No (default `https://mires-ia.vercel.app`) |
| `RECOVERY_REDIRECT_ORIGIN` | URL base para el enlace de recuperación | No (cae en `ACTIVATION_REDIRECT_ORIGIN`) |

## 3. Desplegar las Edge Functions

```bash
# Función privada: solo superadmin autenticado
supabase functions deploy approve-access-request --no-verify-jwt

# Función pública: llamada desde la pantalla de login sin sesión
supabase functions deploy send-recovery-email --no-verify-jwt
```

> Ambas usan `verify_jwt = false` porque el proyecto firma los JWT con `ES256`, que la verificación automática del gateway no soporta. La validación se hace manualmente dentro de cada función.

## 4. Verificar dominio (producción)
Mientras uses `onboarding@resend.dev` estás en modo sandbox: solo puedes enviar al correo registrado en Resend.
Para abrir el envío a cualquier destinatario, verifica un dominio:

1. Resend Dashboard → **Domains** → **Add domain** (ej. `mires-ia.com`).
2. Añade los registros DNS (SPF, DKIM, DMARC) sugeridos.
3. Cuando el dominio quede **verified**, actualiza el secret:
   ```bash
   supabase secrets set RESEND_FROM_EMAIL=no-reply@tu-dominio.com
   ```

## 5. Redirect URLs en Supabase Auth
En **Authentication → URL Configuration** del dashboard, asegúrate de tener:

- **Site URL:** `https://mires-ia.vercel.app`
- **Redirect URLs:**
  - `https://mires-ia.vercel.app/activate.html`
  - `https://mires-ia.vercel.app/**`
  - `http://localhost:3000/activate.html` (solo dev local)

## 6. Probar el flujo
- **Invitación**: desde `Accesos`, aprueba una solicitud y confirma que llega el correo con el branding de MiRest.
- **Recuperación**: en el login, abre "Olvidé mi contraseña", introduce un correo aprobado y confirma que llega el correo de recuperación.

Si algo falla, revisa logs en:
```bash
supabase functions logs approve-access-request
supabase functions logs send-recovery-email
```
