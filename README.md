# Chevruta

App de matching anónimo por preguntas para comunidad local. En vez de swipe
por fotos, la gente responde preguntas y va profundizando la conexión en
etapas — como estudiar un texto de a dos (de ahí el nombre: *chevruta*,
compañero/a de estudio).

## Stack

- **Frontend:** React + Vite
- **Backend:** Firebase (Firestore)
- **Deploy sugerido:** Vercel, Netlify o Firebase Hosting

## 1. Poner en marcha Firestore y Auth (una vez)

1. En [console.firebase.google.com](https://console.firebase.google.com), abrí el proyecto `app-encuentro-596c8` (o el que corresponda).
2. Andá a **Firestore Database** → si todavía no existe, **Create database** (modo producción, cualquier región).
3. Andá a la pestaña **Reglas** y pegá el contenido de `firestore.rules` de este repo. Publicar.
4. Andá a **Authentication** → **Get started** (si es la primera vez) → pestaña **Sign-in method** → habilitá **Email/Password** (el primero de la lista). Sin este paso, el login no va a funcionar.

La config del cliente ya está en `src/lib/firebase.js` — no hace falta tocar nada ahí salvo que cambies de proyecto de Firebase.

## 2. Correr localmente

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`. Si abrís la misma URL en otra pestaña o
dispositivo, vas a poder crear un segundo perfil y hacer match de verdad
entre ambos — todo pasa por Firestore.

## 3. Subir a GitHub

```bash
git add .
git commit -m "Chevruta con backend Firebase"
git push
```

## 4. Deploy

**Con GitHub Pages (recomendado si ya activaste Pages en el repo):**

Este repo ya incluye un workflow de GitHub Actions (`.github/workflows/deploy.yml`) que compila el proyecto y lo publica automáticamente en cada push a `main`.

1. En tu repo de GitHub, andá a **Settings → Pages**.
2. En **Source**, elegí **GitHub Actions** (no "Deploy from a branch" — esa opción sirve archivos sin compilar y por eso quedaba en blanco).
3. Hacé un push cualquiera (o `workflow_dispatch` manual desde la pestaña **Actions**) para disparar el primer deploy.
4. Cuando el workflow termine (pestaña **Actions**, ícono verde ✓), la URL va a estar en **Settings → Pages**, arriba de todo.

**Otras opciones**, igual de válidas:

- **Vercel / Netlify:** importás el repo de GitHub, deploy automático en cada push. No hace falta configurar variables de entorno — la config de Firebase ya está en el código.
- **Firebase Hosting:** `npm install -g firebase-tools`, `firebase login`, `firebase init hosting` (elegí `dist` como carpeta pública), `npm run build && firebase deploy`.

## ⚠️ Seguridad — leer antes de compartir con gente real

Las reglas de Firestore de este MVP dejan `kv_store` abierta a lectura y
escritura para cualquiera. Es aceptable para probar la mecánica con un
grupo chico de confianza, pero **antes de lanzarlo más ampliamente**
conviene:

- Agregar autenticación real (Firebase Authentication: magic link, teléfono, o Google)
- Reescribir `firestore.rules` para que cada documento solo lo pueda editar su dueño (usando `request.auth.uid`)
- Mover el "reporte" y bloqueo a reglas propias, para que un usuario reportado no pueda borrar el reporte
- Sumar moderación (revisión humana de reportes, límite de mensajes antes de la primera conexión, verificación real del "vouching" comunitario)

La API key de Firebase que aparece en `firebase.js` no es secreta — es
normal que viva en el código del cliente. La seguridad real la dan las
reglas de Firestore, no ocultar esa key.

## Qué falta del concepto completo

- Modo de matching grupal coordinado (hoy solo sugiere, no coordina)
- Sincronización con el calendario de eventos de la comunidad/sinagoga
- Verificación real de "vouching" (hoy es solo un campo de texto)
- Notificaciones push
- Autenticación real de usuarios

## Estructura del proyecto

```
src/
  App.jsx            — toda la UI y lógica de la app
  lib/firebase.js     — inicialización de Firebase
  lib/storage.js       — capa de acceso a datos (get/set/list sobre Firestore)
firestore.rules        — reglas de seguridad, pegar en Firebase Console
```
 
 
