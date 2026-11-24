# Verificación de Mishi 1.3.0

## Comprobado el 24/11/2026 (1.3.0, gato pixel-art y arenero)
- `node tests/model_life.test.js`: 15 pruebas (arenero, caca fuera si está lleno, limpiar arenero, noche).
- UI (Chrome headless): browser_smoke (canvas pintado), behavior_smoke (poses `data-pose`), life_smoke (arenero en vivo y al volver), offline_origin.
- Pendiente: prueba en móvil físico.

## Comprobado el 24/11/2026 (1.2.0, vida propia)

- `tests/model_life.test.js`: 9 pruebas aprobadas (caca tras comer, vómito al comer lleno, bolas de pelo, sin eventos dormido o jugando, limpieza, guardados antiguos).
- `tests/life_smoke.py` en Chrome móvil: aprobado. La caca hecha en ausencia aparece con contador en «Limpiar»; tocarla la quita; comer estando lleno hace que Mishi camine, vomite (pose visible) y aparezca el vómito; «Limpiar» recoge todo y lo guarda.
- `tests/browser_smoke.py`: el minijuego se abre dentro de la habitación, Mishi corre a por el ovillo y suma puntos solo al atraparlo; cerrarlo oculta ovillo y marcador.
- Resto de pruebas repetidas: aprobadas. Sigue sin probarse en un móvil Android físico.

## Comprobado el 23/11/2026 (1.1.0, paseo y reacciones)

- `tests/behavior_smoke.py` en Chrome móvil: aprobado. Tocar el suelo hace caminar al gato y mirar hacia donde va; acariciar lo hace ronronear con corazones; alimentar lo lleva al cuenco y come; dormir lo lleva a la alfombra antes de dormirse; con «Reducir animaciones» se mueve sin animación; se mantiene dentro de la habitación en 320×600, 390×844 y 844×390.
- Pruebas de lógica, interfaz y origen offline repetidas: aprobadas. APK 1.1.0 (código 2) firmada con el mismo certificado que 1.0.0, para actualizar sin perder la partida.
- Igual que en 1.0.0: no probada en un móvil Android físico.

## 1.0.0

### Comprobado el 11/11/2026

- 14 pruebas extendidas y 17 comprobaciones básicas de la lógica (`node tests/model_extended.test.js` y `node tests/model.test.js`): aprobadas. Incluyen guardado, corrupción, espera entre pulsaciones, límite de 8 horas de ausencia, niveles y minijuego.
- Prueba de interfaz en Chrome headless móvil: aprobada. Acariciar modifica el ánimo; minijuego abre, suma puntos y se cierra; cambiar el nombre se conserva al recargar; sin errores JavaScript ni peticiones externas.
- Tamaños comprobados sin desbordamiento horizontal: 320×640, 360×800, 390×844, 768×1024 y 844×390.
- Prueba del origen `https://mishi.local` con recursos servidos solo desde los assets: aprobada. Sin peticiones externas ni errores al enviar los eventos del ciclo de vida.
- APK compilada con JDK 17, Android Platform 35 y Build Tools 35.0.0. Firma v2/v3 verificada mediante `apksigner`, alineación comprobada con `zipalign`; metadatos `aapt2`: `com.flavio26.mishi`, versión 1.0.0, mínimo Android 8.0 (API 26). `python tests/package_check.py` aprobado.
- Captura visual revisada en Chrome móvil (`build/test-results/mishi-mobile.png`), composición completa con controles y gato visibles.

**Límite:** no hay una ejecución de la APK en un móvil físico ni en un emulador Android. Chrome prueba la interfaz y el origen simulado, no demuestra que Android WebView intercepte los assets igual en todos los dispositivos. No se ha verificado instalación en el teléfono del usuario.

## Reproducir

```sh
node tests/model.test.js
node tests/model_extended.test.js
python -m http.server 8787 --bind 127.0.0.1 --directory app/src/main/assets
```

Con el servidor abierto, ejecuta `python tests/browser_smoke.py` y `python tests/behavior_smoke.py` y `python tests/offline_origin.py` tras instalar Playwright y disponer de Chrome. Para comprobar una APK ya compilada ejecuta `python tests/package_check.py`.

## Prueba manual recomendada en Android

1. Instalar, abrir y verificar que el gato y todos los controles aparecen.
2. Alimentar, acariciar y limpiar; comprobar indicadores y mensajes.
3. Dormir, volver a inicio de Android y regresar; comprobar recuperación.
4. Abrir un minijuego y verificar temporizador, puntuación y resultado.
5. Cambiar nombre y pelaje, cerrar y reabrir: deben conservarse.
6. Comprobar el botón atrás con panel abierto y con pantalla principal.
7. Activar y desactivar sonido; comprobar que deja de sonar al salir.
8. Activar modo avión: toda la app debe seguir funcionando.
