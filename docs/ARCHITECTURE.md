# Arquitectura y límites de seguridad

## Aplicación

- Identificador: `com.flavio26.mishi`.
- Versión: `1.3.1`, código `5`.
- Cerebro (1.3.1): `brain.js` decide qué hace Mishi sin que le toques (explorar, patrullar, mirar por la ventana, cazar, siesta, lavarse, pedir, buscarte, locuras, amasar, arañar, olfatear) puntuando cada acción según sus necesidades, la hora, su personalidad (curioso, juguetón, cariñoso, vago; aleatoria al nacer) y lo aprendido. Aprende por refuerzo: caricias, comida y juego refuerzan lo que hacía y dónde estaba; ignorarle o el desorden lo debilitan. Guarda sitios favoritos y horas habituales en `localStorage` `mishi.brain.v1`. `behavior.js` ejecuta el plan (pasos ir/acción/esperar, cancelables).
- Gato pixel-art (1.3.0): `sprite.js` dibuja a Mishi de perfil en un canvas 64×48 (poses: andar, trotar, correr, sentado, tumbado, dormir, estirarse, lavarse, comer, saltar, caca, vómito); `behavior.js` lo anima a ~15 fps. `model.js` añade el arenero (`litter` 0–3; lleno = caca en el suelo) y la noche real (23–7 h: se cansa antes y no se despierta solo).
- Vida propia (1.2.0): `model.js` guarda la suciedad (`mess[]`, caca y vómito) y la programa tras comer; `behavior.js` hace que Mishi camine hasta el sitio, la escenifique, la huela y se duerma solo con poca energía; `app.js` la dibuja en `#mess`, la limpia al tocarla o con «Limpiar», y ejecuta el minijuego dentro de la habitación (el gato persigue el ovillo).
- Android mínimo: API 26; objetivo: API 35.
- Una Activity Java muestra los recursos de `assets/` en una WebView.
- `model.js` contiene el estado y las reglas; `behavior.js` solo anima: paseo por la habitación, reacciones a cuidados y llamada tocando el suelo. No modifica estadísticas.
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
