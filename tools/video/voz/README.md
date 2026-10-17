# Voces de personajes (`tools/video/voz/`)

El estudio genera en esta PC las voces de los personajes en español latino, sin pagar y con modelos de licencia
comercial. Los modelos, los venvs y la caché de Hugging Face viven fuera del repo, en
`~/.local/share/cocardo-estudio/`. Los audios generados van a `dist/estudio/` (no se sube).

## Motores y licencias

Licencias revisadas el 17 de octubre de 2026 en las fichas oficiales (Hugging Face y GitHub) y en los metadatos de
los paquetes instalados. Todas permiten el uso comercial.

| Motor | Para qué | Pesos (revisión fija en `voces.json`) | Código |
|---|---|---|---|
| Qwen3-TTS 12Hz 1.7B **VoiceDesign** | Crea cada voz a partir de una descripción en texto: es la referencia del personaje. | `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`: Apache-2.0 | `qwen-tts` 0.1.1 (QwenLM/Qwen3-TTS): Apache-2.0 |
| **Chatterbox** Multilingual V3, ajuste fino `es-mx-latam` | Clona la referencia con acento latino y controla la emoción (exageración y cfg). | `ResembleAI/Chatterbox-Multilingual-es-mx-latam` y `ResembleAI/chatterbox` (codificador de voz): MIT | `chatterbox-tts` 0.1.7 (resemble-ai/chatterbox): MIT |
| Qwen3-TTS 12Hz 1.7B **Base** | Clona la misma referencia; muy fiel a la voz diseñada, sin control de emoción. | `Qwen/Qwen3-TTS-12Hz-1.7B-Base`: Apache-2.0 | `qwen-tts`: Apache-2.0 |
| faster-whisper large-v3 turbo | Revisa lo generado: WER, idioma, ritmo y recortes. | `dropbox-dash/faster-whisper-large-v3-turbo` (conversión de `openai/whisper-large-v3-turbo`): MIT | `faster-whisper` 1.2.1 y `ctranslate2` 4.8.3: MIT |

- Chatterbox mete en cada audio una marca de agua inaudible (Perth, de Resemble AI; `resemble-perth`, MIT). No se
  oye y no limita el uso. Su README solo pide no usarlo para hacer daño.
- El resto de lo instalado es de licencia permisiva: torch y torchaudio (BSD-3), transformers, diffusers, tokenizers,
  safetensors y accelerate (Apache-2.0), librosa (ISC), pyloudnorm y onnxruntime (MIT). Las bibliotecas de CUDA
  (`nvidia-cublas-cu12`, `nvidia-cudnn-cu12`) tienen licencia propia de NVIDIA, de uso gratuito. Solo corren en
  esta PC para generar el audio: no se reparten ni van dentro de los videos.

## Archivos

- `voces.json`: reparto. `personajes.<id>.voz` es la voz por defecto. Si trae `"fija": true`, se eligió a mano y el
  casting ya no la cambia. `voces.<voz>` tiene el motor, la descripción (para personas), la instrucción de diseño (en
  inglés, el modelo la entiende mejor), la referencia y los parámetros (`velocidad` 1,0 = normal; `tono` en
  semitonos). `emociones` traduce los ánimos de `js/story.js` (burlon, furioso, coqueta…) a parámetros del motor;
  `noticia` es el tono de la reportera.
- `voz.py`: genera una línea, un lote o las líneas de un video del calendario. Solo usa la biblioteca estándar:
  corre con el `python3` del sistema y lanza `motor.py` en el venv que toque, con el candado de la GPU.
- `motor.py`: carga el modelo una vez por lote, genera y deja cada WAV a 48 kHz mono, sin silencio en las puntas,
  a −16 LUFS y con pico ≤ −1 dBFS.
- `revisar_voz.py`: revisión objetiva con whisper (línea suelta, lote o video terminado contra su guion). Corre en el
  venv de whisper y toma el candado él solo.
- `casting.py`: arma `dist/estudio/casting/` para elegir voces escuchando.
- `texto_es.py`: números a letras y normalización de texto para el WER.
- `referencias/`: la voz diseñada de cada candidato (FLAC 24 kHz, unos 150-450 KB cada una).

## Instalación (una sola vez)

```bash
E=~/.local/share/cocardo-estudio
~/.local/bin/uv venv --python 3.11 $E/voz-chatterbox
~/.local/bin/uv pip install --python $E/voz-chatterbox/bin/python chatterbox-tts==0.1.7 resemble-perth==1.0.1
~/.local/bin/uv venv --python 3.11 $E/voz-qwen
~/.local/bin/uv pip install --python $E/voz-qwen/bin/python torch==2.8.0 torchaudio==2.8.0 qwen-tts==0.1.1 pyloudnorm==0.1.1
~/.local/bin/uv venv --python 3.11 $E/voz-whisper
~/.local/bin/uv pip install --python $E/voz-whisper/bin/python faster-whisper==1.2.1 ctranslate2==4.8.3 nvidia-cublas-cu12 'nvidia-cudnn-cu12==9.*'
python3 tools/video/voz/voz.py --descargar
$E/voz-whisper/bin/python tools/video/voz/revisar_voz.py --descargar
```

## Uso

Todo se corre desde la raíz del repo. `voz.py` y `casting.py` van con el `python3` del sistema;
`revisar_voz.py`, con el Python del venv de whisper.

```bash
V=tools/video/voz
W=~/.local/share/cocardo-estudio/voz-whisper/bin/python

# Una línea (imprime JSON con ruta y duración)
python3 $V/voz.py --quien cocardo --texto "No está viejo, está experimentado." --emocion burlon

# Un lote para un video: revisado con whisper (repite con otra semilla lo que falle, hasta 3 tomas)
# y copiado a una carpeta. El JSON que sale es el que lee K.guion en kit.js
python3 $V/voz.py lote.json --revisar --salida dist/estudio/voz/mi-video > dist/estudio/voz/mi-video.json

# Las líneas de un video del calendario (parametros.lineas), en orden
python3 $V/voz.py --calendario --video D01-2 --revisar --salida dist/estudio/voz/D01-2 > dist/estudio/voz/D01-2.json
# …de su alternativa (rama 1, 2…; la 0 es el plan normal)
python3 $V/voz.py --calendario --video D18-3 --rama 1 --revisar --salida dist/estudio/voz/D18-3-alt1 > dist/estudio/voz/D18-3-alt1.json
# Todas las líneas distintas del calendario de una vez (deja la caché lista)
python3 $V/voz.py --calendario --revisar > dist/estudio/voz/calendario.json

# Revisar una línea, un lote o un video terminado contra su guion (código de salida 1 si algo falla)
$W $V/revisar_voz.py dist/estudio/voz/D01-2/02-cocardo.wav --texto "No está viejo, está experimentado."
$W $V/revisar_voz.py --lote dist/estudio/voz/D01-2.json
$W $V/revisar_voz.py dist/videos/mi-video.mp4 --guion dist/estudio/voz/D01-2.json

# Cambiar la voz de un personaje
python3 $V/voz.py --listar                        # reparto actual («fija» = elegida a mano)
python3 $V/voz.py --elegir cocardo cocardo-a      # la deja fija
python3 $V/voz.py --elegir cocardo auto           # la suelta: casting.py pagina vuelve a poner la recomendada
python3 $V/voz.py --aplicar elegidas.json         # lo que se copió de la página del casting
python3 $V/voz.py --quien cocardo --voz cocardo-b --texto "…"   # probar un candidato sin cambiar el reparto
```

Un lote es una lista de `{"quien": "cocardo", "texto": "…", "emocion": "burlon"}` (`emocion`, `voz` e `id` son
opcionales; sin `id`, cada línea lleva su número de orden). Lo demás que traiga cada línea (`hueco`, `escena`…) pasa
tal cual al JSON de salida. Con `--salida`, los WAV quedan como `01-quien.wav`, `02-…` y `ruta` apunta a esa copia.

La caché (`dist/estudio/voz-cache/`) usa un hash del motor, el contenido de la referencia, el texto, los parámetros
de la voz, la emoción y la toma:
repetir un lote no gasta GPU (sin `--revisar`, ni siquiera abre un modelo; con `--revisar`, solo whisper). Si cambias
el posproceso de `motor.py`, sube `VERSION_POST` en `voz.py`. Todo lo que usa la GPU toma el candado
`~/.local/share/cocardo-estudio/gpu.lock` y suelta el modelo al terminar.

### Qué revisa `revisar_voz.py`

- **WER ≤ 0,15** contra el texto, con texto normalizado: sin acentos ni puntuación, números en letras, «Coco's» =
  «Cocos» y cada risa como una sola palabra («ja, ja, ja» = «jejeje»; un «ha» suelto sigue siendo palabra). Las
  interjecciones sin vocal (psst, shh, mmm) valen como comodín: whisper nunca las escribe igual («Pez», «PS»,
  «Sí, este»), así que no cuentan; cómo suenan solo se juzga escuchando.
- **Idioma «es»** según whisper.
- **Ritmo de 1,8 a 4,5 palabras por segundo.** En una línea, de la primera a la última palabra, sin contar las risas
  que whisper oye como risa. Solo cuenta en líneas de 4 palabras o más: con menos («Luces.», «Una menos.») mide
  cuánto se alarga una palabra, no el paso de la voz. En un video terminado, sobre el tiempo que el VAD de whisper
  marca como voz (no cuentan la música ni las pausas entre líneas).
- **Sin recortes** (3 o más muestras seguidas pegadas al techo).

El acento, la actuación y si la emoción se nota no se pueden medir: hay que escucharlos.

## Casting

```bash
python3 tools/video/voz/casting.py todo          # referencias + frases + audición con el calendario + página
python3 tools/video/voz/casting.py calendario    # solo la audición con el guion del calendario
python3 tools/video/voz/casting.py pagina        # rehace la página y la recomendación (no usa la GPU)
xdg-open dist/estudio/casting/index.html
```

Cada personaje tiene 3 candidatos (cocardo, cereza, lima, piña, banano y narrador) o 2 (el resto). Cada candidato
dice dos frases suyas (el WAV de la página) y, en una sola toma, todas las líneas de su personaje en el calendario de
videos. La **recomendada** (y la voz por defecto en `voces.json`, si no está fija) es la que, en este orden: pasa sus
frases; pasa más líneas del calendario a la primera; tiene menor WER medio (con castigo si el ritmo sale de 2,3–3,5
palabras/s); pidió menos tomas; y queda más cerca de 2,9 palabras/s.

En la página marcas la voz de cada personaje (se guarda en el navegador), copias el JSON, lo guardas como
`elegidas.json` y lo aplicas con `python3 tools/video/voz/voz.py --aplicar elegidas.json`.

Lo que deja en `dist/estudio/casting/`: `index.html`, un WAV por candidato (sus dos frases seguidas),
`casting.json` (cifras y recomendación), `frases.json` (las frases, revisadas) y `calendario.json` (la audición).

## Medidas (RTX 4060 Ti 16 GB, octubre de 2026)

| Paso | GPU por línea | VRAM del proceso | Carga del modelo |
|---|---|---|---|
| Chatterbox | mediana 2,4 s (p90 3,7 s; 0,84 × la duración del audio) | 3,8 GB en lotes cortos; hasta 7-8 GB en lotes de 50-100 líneas con muchas voces | 17-25 s por lote |
| Qwen3-TTS Base | mediana 4,7 s (p90 8,1 s; 1,6 × la duración) | 4,6 GB | 10-16 s por lote |
| Qwen3-TTS VoiceDesign (referencias) | mediana 15 s por referencia de 9 s | 4,6 GB | 10-13 s |
| faster-whisper (revisión) | 0,4-0,6 s por línea; 0,5-0,8 s por un video de 17 s | 2,3 GB | 2-3 s |

Con la caché llena, repetir un lote tarda menos de 0,1 s y no toca la GPU. Las 119 líneas distintas del calendario,
con la voz por defecto y hasta 3 tomas, salen en unos 3 minutos si la audición ya llenó la caché; desde cero, la
audición de los 38 candidatos con esas líneas (325 tomas) tardó unos 20 minutos. Cada línea sale a −16 LUFS (en la
práctica de −16,0 a −16,6) con pico de −1,5 dBFS (pico real ≤ −1,4 dBFS medido con `ebur128`). El silencio de las
puntas queda en una mediana de 10 ms al inicio y 30 ms al final; en 4 de las 119 líneas del calendario, una
respiración o un chasquido suelto a −48/−54 dBFS alarga una punta hasta 0,2-0,6 s (el recorte de `motor.py` lo toma
por voz). En el montaje casi no se nota: `K.guion` sitúa el subtítulo con lo que suena por encima de −40 dBFS, y solo
en una de esas líneas el chasquido pasa ese umbral y deja el subtítulo medio segundo más.

### Voz nueva

Agrégala a `voces.json` (`personaje`, `motor`, `descripcion`, `diseno` con `instruccion`, `texto` y `semilla`, y los
parámetros), sus dos frases a `FRASES` en `casting.py`, y corre `python3 tools/video/voz/casting.py todo`. Solo se
genera lo nuevo; lo demás sale de la caché. Si whisper no entiende bien la referencia, el casting la rediseña con otra
semilla (hasta 3 veces). Cuando pasa, queda `"aprobada"` y ya no se rediseña sola. Para rehacer una a mano:
`python3 tools/video/voz/voz.py --disenar <voz>` (luego, `casting.py todo`).
