# Arquitectura y límites de seguridad

## Aplicación

- Identificador: `com.flavio26.mishi`.
- Versión: `1.0.0`, código `1`.
- Android mínimo: API 26; objetivo: API 35.
- Una Activity Java muestra los recursos de `assets/` en una WebView.
- El origen `https://mishi.local` es interno y se resuelve mediante `shouldInterceptRequest`: no existe servidor ni conexión a ese dominio.
- El manifiesto no solicita permisos. La WebView bloquea red, archivos, contenido externo y navegación fuera del juego.
- No se expone un puente `addJavascriptInterface`.
- El estado pertenece al almacenamiento DOM privado de la app; las copias de seguridad Android están deshabilitadas.

## Ciclo de vida

Al pausar y reanudar la Activity se envían los eventos `mishi-pause` y `mishi-resume`. La interfaz debe guardar el estado y pausar sus recursos; al regresar actualiza los valores según el tiempo transcurrido, con un máximo para que una ausencia prolongada no penalice ilimitadamente.

El botón atrás envía `mishi-back`, cancelable. Si la interfaz cierra un panel o juego, cancela el evento; en caso contrario, Android lleva la tarea al fondo. El juego no necesita ejecutarse en segundo plano.

## Compilación y firma

`scripts/build.py` utiliza `aapt2`, `javac`, D8, `zipalign` y `apksigner`. La clave y su contraseña se suministran exclusivamente mediante variables de entorno y permanecen fuera del repositorio. No hay dependencias Android de terceros.

La APK se verifica tras firmar. La suma SHA-256 corresponde al archivo final, no a una versión intermedia sin firma.

## Alcance de las pruebas

Las pruebas web comprueban la lógica y la interfaz, pero no sustituyen una ejecución en Android real. La compilación y la verificación de firma tampoco demuestran por sí solas que todas las versiones de Android System WebView se comporten igual. Consulta `TESTING.md` para el resultado de las pruebas efectuadas.
