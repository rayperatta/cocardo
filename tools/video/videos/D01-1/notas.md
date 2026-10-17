# D01-1 · La mejor jugada (F01, ♻ del 03)

1. Rehecho con la plantilla `tools/video/formatos/F01/plantilla.js` (contador a la vista y 4 tramos propios: «¡faltó UNO!», x3, el último hielo en cámara lenta y el Helado Final); 18,3 s en vez de 24, cuadro 0 con la mano ya en el tablero, reto «¿Le ganas a las 18?» y tarjeta de 1 s que sube al cuadro 0 (bucle).
2. Gancho con cifra comprobable: «Probé 1.220.992 jugadas…» (niveles 1-30, semillas 1-5000; la de 18 es la única de 16 o más). El 472.206 del 03 ya no sale con los niveles de hoy.
3. Toma: `node tools/video/capturar.cjs tools/video/formatos/F01/tomas/cascada.cjs dist/cap/D01-1-cascada --var 4:2465:7,2:7,3:4,5:5,5:6,6:7,6` (igual que la del 03, 0,7 GB).
4. Render: `node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/D01-1/montaje.js" dist/videos-mes/D01-1-mejor-jugada.mp4 --cap dist/cap --volumen ganancia --revisar --fotos 8.1` (portada = el fotograma de 8,1 s: «x18» y «¡¡TELENOVELA!!»).
5. Comprobar antes de rehacer: `node tools/video/plan.cjs verificar`, `node tools/video/formatos/F01/ficha.cjs verificar` y `node tools/video/formatos/F01/ficha.cjs conteo` (unos 2 min).
