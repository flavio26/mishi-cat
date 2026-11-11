# Mishi · tu gato de bolsillo

Mascota virtual para Android, en español. Un pequeño compañero al que acariciar, alimentar, limpiar y acompañar mientras duerme. Incluye un minijuego de atrapar el juguete, niveles, nombre y pelaje personalizables.

## Android

- Android 8.0 o posterior (API 26); compatible con móviles ARM y x86.
- APK autónoma: funciona sin conexión y no solicita permisos.
- Sin anuncios, cuentas, analítica, compras ni llamadas externas.
- Guarda el progreso en el dispositivo. Borrar los datos o desinstalar elimina la partida.
- Mantén Android System WebView actualizado para la mejor compatibilidad.

La publicación y el enlace de descarga se añadirán cuando esté disponible la release verificada.

## Desarrollo

La interfaz vive en `app/src/main/assets`, sin paquetes ni CDN. `MainActivity.java` la sirve desde los assets de la APK a una WebView con origen HTTPS local interceptado, acceso a archivos desactivado y navegación externa bloqueada. No requiere servidor real ni permiso INTERNET.

### Previsualizar

```sh
python -m http.server 8787 --bind 127.0.0.1 --directory app/src/main/assets
```

Abre `http://127.0.0.1:8787`.

### Compilar una APK firmada

Requisitos: Python 3.10+, JDK 17, Android SDK Platform 35, Build Tools 35.0.0. Los componentes del SDK están sujetos a las licencias de Android SDK. No es necesario Gradle.

Variables de entorno:

- `JAVA_HOME`: carpeta del JDK.
- `ANDROID_BUILD_TOOLS`: carpeta de Build Tools 35.0.0.
- `ANDROID_JAR`: ruta completa a `platforms/android-35/android.jar`.
- `MISHI_KEYSTORE`: almacén de firma privado con alias `mishi`.
- `MISHI_STORE_PASS`: contraseña del almacén y de la clave.

Crea tu clave privada con `keytool -genkeypair`, alias `mishi`, algoritmo RSA, 3072 bits o superior. Guarda una copia segura: necesitas **la misma clave** para actualizar la app sin borrar el progreso. Nunca subas la clave ni su contraseña a GitHub.

```sh
python scripts/build.py
```

Resultado: `dist/Mishi-1.0.0.apk` y `dist/SHA256SUMS.txt`. El script verifica firma, alineación y metadatos antes de terminar.

## Privacidad

Todo el estado permanece local. Los sonidos se sintetizan en el dispositivo. No se utiliza micrófono, cámara, ubicación ni almacenamiento compartido. El proyecto no incorpora datos o recursos de empresa.
