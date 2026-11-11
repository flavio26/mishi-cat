# Instalar Mishi en Android

1. Descarga `Mishi-1.0.0.apk` desde la release de este repositorio.
2. Abre el archivo descargado.
3. Si Android lo solicita, permite **Instalar aplicaciones desconocidas** únicamente para el navegador o gestor de archivos con el que lo estás abriendo.
4. Pulsa **Instalar** y luego **Abrir**.
5. Puedes retirar de nuevo ese permiso al navegador después de instalar.

No desactives Play Protect. Si Android muestra un bloqueo de seguridad o detecta un problema, detente y revisa el aviso.

## Requisitos y límites

- Android 8.0 o posterior. Una APK no se instala en iPhone.
- Android System WebView actualizado.
- El juego funciona sin internet. No hay registro ni permisos de cámara, ubicación o micrófono.
- La partida se guarda localmente. Desinstalar la app o borrar sus datos borra el progreso.
- Una actualización debe conservar el identificador de paquete y la firma de la versión instalada.

## Verificar la descarga

La release incluye `SHA256SUMS.txt`. En PowerShell puedes calcular el hash del archivo:

```powershell
Get-FileHash .\Mishi-1.0.0.apk -Algorithm SHA256
```

Debe coincidir con el valor publicado en `SHA256SUMS.txt`.
