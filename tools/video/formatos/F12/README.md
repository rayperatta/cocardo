# F12 · Conoce a…

Retratos del juego (`js/art-characters.js`) con sus humores, su voz y su placa; sin tomas. Dos formas con la misma
plantilla: **galería** (D02-3, los 16 personajes: un plano por personaje, contador «n/16», ráfaga de los que no hablan
y mosaico final) y **uno** (D10-1 Don Piña, D11-1 Cherry, D23-1 Limón: un humor cada ~1,5 s, sus líneas y la cita con
el ¡TAN-TAN-TAAAN!, más un plano de reto antes de la tarjeta). El primero hecho con ella es D02-3.

| Archivo | Qué hace |
|---|---|
| `plantilla.js` | El montaje (`window.F12({...})`, parámetros en su encabezado) y `tiempos()`, la línea de tiempo pura que también corre en Node. |
| `ficha.cjs` | De la ficha del calendario al guion, al borrador del montaje, a la línea de tiempo (sin renderizar) y al texto del post. |

## Un video nuevo (D10-1, D11-1, D23-1…)

```bash
ID=D11-1
node tools/video/formatos/F12/ficha.cjs guion $ID          # guion.json = parametros.lineas tal cual
mkdir -p dist/estudio/voz
python3 tools/video/voz/voz.py tools/video/videos/$ID/guion.json --revisar --salida dist/estudio/voz/$ID > dist/estudio/voz/$ID.json
node tools/video/formatos/F12/ficha.cjs montaje $ID        # borrador de tools/video/videos/$ID/montaje.js
node tools/video/formatos/F12/ficha.cjs tiempos $ID        # planos, clímax (≤ 80 %), duración y avisos; sale con 1 si hay avisos
node tools/video/formatos/F12/ficha.cjs comandos $ID       # render, revisión, WER y post con el nombre de archivo
```

El borrador sale de la ficha: humores de `parametros.humores`, una línea por plano, el ¡TAN! en la última línea de la
protagonista, el guardaespaldas detrás de Don Piña si la idea lo pide y el reto del post («… en el nivel 7») en el
último plano. Lo que la ficha dice en prosa se añade a mano con parámetros:

- D10-1: `textos: [{ texto: '500 × 5', palabra: 'sabor', golpe: true }]` en el plano del pedido y un `dato`
  («Traje vino de tres piezas», «Nunca es víctima»).
- D11-1: humores coqueta → burlón (ojos rojos) → enojado → furioso y la cita con `humores: [..., 'coqueta']`; nada de
  `ret: { variant: 'huida' }` (es del final: la plantilla la rechaza sin `despuesDelFinal: true`).
- D23-1: `tan: { palabra: 'grande' }` (el ¡TAN! cae en «algo grande», con la hora estimada por letras) y `dato` con la
  pista; sin decir quién entra de noche.

Render y revisión: lo que imprime `comandos`. Portada: `--fotos` en el mejor fotograma (el mosaico «16/16» en la
galería, el zoom del ¡TAN! o el cuadro 0 en las de uno) y se copia como `dist/videos-mes/<id>-<slug>-portada.png`.

## Qué trae de serie (lista de dopamina)

1. **Gancho:** cuadro 0 con el primer personaje ya hablando (voz a los 0,05 s; si es víctima, el hielo ya va roto con
   las esquirlas en el aire), la pregunta y su remate grandes arriba (el remate da un golpe a los 0,25 s) y el contador.
2. **Ritmo:** barrido de color + whoosh + pop en cada personaje (1,3-2,4 s), golpe de zoom en cada cambio de humor, la
   mano del tutorial que toca el hielo (toque, crujido, destello suave, esquirlas y sello «¡LIBRE!») y el subtítulo
   con la palabra que suena en dorado.
3. **Escalada:** pops del contador 1,5 semitonos más agudos cada vez, el contador cambia de dorado a rosa y a rojo, el
   nombre crece, los rayos giran más rápido; la ráfaga sube con una subida hasta «N/N», golpe, confeti y jingle.
4. **Tensión y alivio:** ¡TAN-TAN-TAAAN! del juego con tres escalones de zoom a la cara, fondo que se oscurece y la
   música agachada (el clímax; `tiempos` avisa si pasa del 80 %).
5. **Sensorial:** crujido de hielo, motivo de villano al entrar Cherry y Cocardo, golpe de Don Piña, risa del juego,
   voces con el tema agachado debajo (ducking 0,32).
6. **Ganas de jugar:** la mano del tutorial rescata a las víctimas, «¿Cuántos reconociste?» / la banda de reto con el
   nivel, y la tarjeta JUEGA/EMPIEZA GRATIS · link en el perfil · cocardo.app.
7. **Bucle:** tarjeta de 1 s cuyos últimos 0,2 s suben y dejan el cuadro 0; la música de la tarjeta es justo la que
   precede a la del cuadro 0 (desde el inicio del bucle de la pista), así no salta al repetirse.
8. **Duración:** la de las voces (D02-3: 24,5 s); `tiempos` avisa de más de 25,5 s.

## Límites

- El retrato es un busto: su corte queda detrás del mostrador (y ≥ 1445, la franja que tapa TikTok).
- Sin marcas de palabras de las voces: `tan.palabra` y `textos[].palabra` reparten la línea por letras y pausas (como
  los subtítulos del kit); revisa la hora en la hoja de contacto.
- Ninguna variante del final (huida, cárcel, tubo) sin `despuesDelFinal: true`, ni citas del álbum de la reportera y
  del oficial Sandía (sus cartas se abren en el nivel 30): en la ráfaga van con etiqueta neutra.
