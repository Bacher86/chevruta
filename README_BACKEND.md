# Chevruta — poner en marcha el backend real (una sola vez)

Esto convierte la app en una PWA instalable con notificaciones push de
verdad (funcionan aunque tengas la app cerrada). Ya armé el GitHub
Action para que, de acá en más, **con un solo `git push` se publique
todo** (frontend + backend). Los pasos de abajo son los que solo vos
podés hacer una vez, porque necesitan tu login.

## 1) Generar la clave VAPID (para que las notificaciones puedan enviarse)
1. Andá a la [Consola de Firebase](https://console.firebase.google.com/project/app-encuentro-596c8/settings/cloudmessaging).
2. Pestaña **Cloud Messaging** → bajá hasta **"Certificados push web"** → **Generar par de claves**.
3. Copiá la clave (es pública del lado del cliente, no es secreta).
4. Abrí `src/lib/push.js` y reemplazá:
   ```js
   const VAPID_KEY = "REEMPLAZAR_CON_TU_VAPID_KEY";
   ```
   por tu clave real.

## 2) Crear una cuenta de servicio para que GitHub pueda desplegar el backend
1. [Consola de Firebase → Configuración del proyecto → Cuentas de servicio](https://console.firebase.google.com/project/app-encuentro-596c8/settings/serviceaccounts/adminsdk).
2. Botón **"Generar nueva clave privada"** → se descarga un archivo `.json`.
3. Abrí ese archivo con el Bloc de notas (o similar) y copiá TODO el contenido.
4. En tu repo de GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   - Nombre: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: pegá el contenido completo del JSON.
5. Guardar.

⚠️ Ese JSON es sensible (da acceso administrativo a tu proyecto) — nunca
lo subas al repo ni lo compartas fuera de ese secreto de GitHub.

## 3) Habilitar la API de Cloud Messaging (si no está ya activa)
[Google Cloud Console → Habilitar API](https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=app-encuentro-596c8)
(a veces viene desactivada por defecto en proyectos nuevos).

## 4) Subir el contenido de este zip a tu repo y hacer push
Reemplazá los archivos de tu repo por los de este zip (mantiene tu
`.git`, así que hacé esto en tu carpeta local del repo, no en una
carpeta nueva), y:
```bash
git add -A
git commit -m "Backend real: PWA + notificaciones push"
git push
```

## Qué pasa automáticamente desde acá
Cada `git push` a `main`/`master` va a disparar dos cosas en paralelo:
- **Frontend**: compila y publica en GitHub Pages (como ya veníamos haciendo).
- **Backend**: despliega las Cloud Functions y las reglas de Firestore
  contra tu proyecto de Firebase, usando el secreto que configuraste en
  el paso 2.

Podés ver el progreso en la pestaña **Actions** de tu repo en GitHub.

## Qué hace el backend exactamente
`functions/index.js` escucha cada vez que se escribe una conexión en
la base de datos y manda una notificación push cuando:
- alguien inicia una conexión nueva con vos,
- te llega un mensaje nuevo,
- vos y tu conexión aceptan revelarse del todo.

No hace falta tocar nada de este archivo para que funcione — ya está
completo. Si en algún momento querés que avise de otras cosas (por
ejemplo, recordatorio diario de la pregunta del día), decímelo y lo
sumo ahí mismo.

