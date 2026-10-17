# F01 · ¿Cuántas cascadas?

Una sola apertura real que encadena cascadas. El contador va tapado («x?» que salta en cada cascada) y se destapa con
confeti, o va a la vista con tramos propios (el D01-1). Sin voces; suena el juego y su cumbia.

| Archivo | Qué hace |
|---|---|
| `plantilla.js` | El montaje con la lista de dopamina de serie (parámetros en su encabezado). |
| `tomas/cascada.cjs` | La toma: `--var <nivel>:<semilla>:<r,c>:<r,c>[:<r,c>:<r,c>…]` (apertura y, si hace falta, las jugadas de después). |
| `ficha.cjs` | Comprueba las fichas con el motor y escribe la toma, el montaje y el texto de cada una. |

## Un video nuevo (D05-2, D19-1, D22-2, D27-1…)

```bash
node tools/video/formatos/F01/ficha.cjs verificar                 # la jugada de cada ficha sigue siendo cierta
node tools/video/formatos/F01/ficha.cjs montaje D05-2             # tools/video/videos/D05-2/montaje.js desde la ficha
$(node tools/video/formatos/F01/ficha.cjs toma D05-2)              # captura dist/cap/D05-2-cascada (~2 min, ~0,3 GB)
node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/D05-2/montaje.js" dist/videos-mes/D05-2-80-piezas.mp4 \
  --cap dist/cap --volumen ganancia --revisar --fotos 0,0.5,1
node tools/video/formatos/F01/ficha.cjs texto D05-2 > dist/videos-mes/D05-2-80-piezas.txt
```

Luego mira la hoja de contacto (`dist/estudio/revision/<nombre>/hoja.png`) y retoca el montaje solo con parámetros:
`gancho` (2 líneas: la 1.ª ya se lee en el cuadro 0), `ganchoSub`, `reto` (`{ texto, sub }`), `revela`
(`{ texto: '¿Acertaste?' }`), `vel` (si la cascada es larga), `tarjeta` (`moodCocardo`…).

## Qué trae de serie (lista de dopamina)

1. **Gancho:** cuadro 0 con la mano del tutorial sobre la pieza y la 1.ª línea del gancho ya escrita; la jugada sale a
   los 0,2 s.
2. **Ritmo:** un pop por cascada (el «x?» o el número saltan), golpes de zoom en cada Paleta, Bomba o Copa y empuje
   lento de cámara.
3. **Escalada:** el contador pasa de dorado a rosa y a rojo, temblor que crece desde el 40 % de las cascadas, pops
   propios que siguen subiendo de tono pasada la cascada 10 (el juego deja de subir ahí) y los textos del juego.
4. **Tensión y alivio:** con el contador tapado, una subida de 1 s antes de destaparlo; se destapa con golpe, destello
   suave y confeti (clímax, hacia el 70-75 %).
5. **Sensorial:** todos los sonidos del juego a su hora y la cumbia del juego.
6. **Ganas de jugar:** reto con el nivel en pantalla («NIVEL 5 · juega gratis»; «tu turno» del 11 en adelante) y la
   tarjeta con «JUEGA GRATIS» (niveles 1-10) o «EMPIEZA GRATIS».
7. **Bucle:** tarjeta de 1 s cuyos últimos 0,2 s suben y dejan el cuadro 0 tal cual (tablero, mano y gancho).
8. **Duración:** 10-12 s con el contador tapado; con tramos, lo que sumen (el D01-1 dura 18,3 s).

Tramos extra tras la cascada (congelado, x3, cámara lenta…): ver `tramos` en `plantilla.js` y el ejemplo de
`tools/video/videos/D01-1/montaje.js`. El gancho y el post no dicen el número que se pide contar.
