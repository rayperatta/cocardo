#!/usr/bin/env node
// Revisa un MP4 terminado antes de publicarlo: formato, duración, volumen, negros, congelados y silencios.
// Uso: node tools/video/revisar.cjs <video.mp4> [--json salida.json] [--dir carpeta] [--breve]
//        [--lufs -14] [--tol 1.5] [--tp -1] [--min 6] [--max 60] [--negro-max 0.5]
//   Escribe en --dir (por defecto dist/estudio/revision/<nombre>/): revision.json, hoja.png (un fotograma por segundo en
//   mosaico con la zona segura marcada en rojo) y primero.png (el primer fotograma, el del gancho).
//   Imprime el JSON (o un resumen con --breve) y sale con 0 si aprueba y 1 si no.
// Aprueba si: 1080x1920, 30 fps, H.264 + AAC, yuv420p, de 6 a 60 s, -14 LUFS ± 1,5, pico real ≤ -1 dBTP y sin negros
// largos (más de 0,5 s) ni negro en el primer fotograma. Congelados y silencios solo dan avisos.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
// Zona segura (tools/video/video.js): TikTok tapa la franja derecha y el 25 % de abajo
const SAFE = { left: 70, right: 930, top: 210, bottom: 1440 };

function opcion(argv, nombre, def) {
  const i = argv.indexOf(nombre);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : def;
}

function correr(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r;
}

// Tramos [inicio, fin] de los avisos de los filtros *detect (los que siguen abiertos al final se cierran en `dur`)
function tramos(log, ini, fin, dur) {
  const out = [];
  let abierto = null;
  for (const l of log.split('\n')) {
    const a = l.match(ini), b = l.match(fin);
    if (a) abierto = +a[1];
    if (b && abierto != null) { out.push([abierto, +b[1]]); abierto = null; }
  }
  if (abierto != null) out.push([abierto, dur]);
  return out.map(([a, b]) => ({ desde: +a.toFixed(2), hasta: +b.toFixed(2), dur: +(b - a).toFixed(2) }));
}

function fuente() {
  const r = spawnSync('fc-match', ['-f', '%{file}', 'sans:bold'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout && fs.existsSync(r.stdout) ? r.stdout : null;
}

// Hoja de contacto: un fotograma por segundo, zona insegura sombreada, borde rojo de la zona segura y el segundo arriba
function hoja(video, salida, n) {
  const cols = Math.min(6, Math.max(1, n)), filas = Math.ceil(n / cols);
  const caja = (x, y, w, h, c, t) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${c}:t=${t}`;
  const zona = [
    caja(0, SAFE.bottom, 1080, 1920 - SAFE.bottom, 'red@0.12', 'fill'),
    caja(SAFE.right, 0, 1080 - SAFE.right, SAFE.bottom, 'red@0.12', 'fill'),
    caja(SAFE.left, SAFE.top, SAFE.right - SAFE.left, SAFE.bottom - SAFE.top, 'red@0.9', 8),
  ].join(',');
  const f = fuente();
  const texto = f ? `,drawtext=fontfile='${f}':text='%{eif\\:t\\:d} s':x=24:y=24:fontsize=84:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=14` : '';
  const vf = `fps=1,${zona}${texto},scale=240:427:flags=lanczos,tile=${cols}x${filas}:padding=6:margin=6:color=white`;
  let r = correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-vf', vf, '-frames:v', '1', '-update', '1', salida]);
  if (r.status !== 0 && texto) {
    // sin drawtext (ffmpeg sin freetype): la hoja sale igual, sin los segundos
    r = correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-vf', vf.replace(texto, ''), '-frames:v', '1', '-update', '1', salida]);
  }
  if (r.status !== 0) throw new Error('no pude hacer la hoja de contacto: ' + r.stderr.trim());
}

function main() {
  const argv = process.argv.slice(2);
  const video = argv[0];
  if (!video || video.startsWith('--') || !fs.existsSync(video)) {
    console.error('uso: node tools/video/revisar.cjs <video.mp4> [--json salida.json] [--dir carpeta] [--breve]');
    process.exit(2);
  }
  const U = {
    lufs: +opcion(argv, '--lufs', -14), tol: +opcion(argv, '--tol', 1.5), tp: +opcion(argv, '--tp', -1),
    min: +opcion(argv, '--min', 6), max: +opcion(argv, '--max', 60), negroMax: +opcion(argv, '--negro-max', 0.5),
  };
  const nombre = path.basename(video).replace(/\.[^.]+$/, '');
  const dir = path.resolve(opcion(argv, '--dir', path.join(ROOT, 'dist', 'estudio', 'revision', nombre)));
  fs.mkdirSync(dir, { recursive: true });

  // 1) formato
  const pr = correr('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]);
  if (pr.status !== 0) throw new Error('ffprobe no pudo leer el archivo: ' + pr.stderr.trim());
  const info = JSON.parse(pr.stdout);
  const v = info.streams.find((s) => s.codec_type === 'video') || {};
  const a = info.streams.find((s) => s.codec_type === 'audio') || null;
  const [fn, fd] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
  const fps = fd ? fn / fd : 0;
  const dur = +(info.format.duration || v.duration || 0);

  // 2) una pasada con todos los análisis
  const filtros = a
    ? ['-filter_complex', '[0:v]blackdetect=d=0.1:pic_th=0.98:pix_th=0.10,freezedetect=n=-60dB:d=1.5[v];'
      + '[0:a]ebur128=peak=true:framelog=quiet,silencedetect=n=-50dB:d=1[a]', '-map', '[v]', '-map', '[a]']
    : ['-vf', 'blackdetect=d=0.1:pic_th=0.98:pix_th=0.10,freezedetect=n=-60dB:d=1.5'];
  const an = correr('ffmpeg', ['-hide_banner', '-nostats', '-i', video, ...filtros, '-f', 'null', '-']);
  const log = an.stderr;
  const num = (re) => { const m = log.match(re); return m ? +m[1] : null; };
  const lufs = num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra = num(/LRA:\s+([\d.]+) LU/), pico = num(/Peak:\s+(-?[\d.]+|-inf) dBFS/);
  const negros = [];
  for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)) {
    negros.push({ desde: +(+m[1]).toFixed(2), hasta: +(+m[2]).toFixed(2), dur: +(+m[3]).toFixed(2) });
  }
  const congelados = tramos(log, /freeze_start: ([\d.]+)/, /freeze_end: ([\d.]+)/, dur);
  const silencios = tramos(log, /silence_start: (-?[\d.]+)/, /silence_end: ([\d.]+)/, dur);

  // 3) imágenes
  const hojaPng = path.join(dir, 'hoja.png'), primeroPng = path.join(dir, 'primero.png');
  // fps=1 saca el segundo N si el video llega a N + 0,5
  hoja(video, hojaPng, Math.max(1, Math.floor(dur + 0.5)));
  const p1 = correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-frames:v', '1', '-update', '1', primeroPng]);
  if (p1.status !== 0) throw new Error('no pude sacar el primer fotograma: ' + p1.stderr.trim());

  // 4) veredicto
  const fallos = [], avisos = [];
  if (v.width !== 1080 || v.height !== 1920) fallos.push(`tamaño ${v.width}x${v.height} (debe ser 1080x1920)`);
  if (Math.abs(fps - 30) > 0.01) fallos.push(`${+fps.toFixed(3)} fps (deben ser 30)`);
  if (v.codec_name !== 'h264') fallos.push(`video ${v.codec_name} (debe ser H.264)`);
  if (v.pix_fmt !== 'yuv420p') fallos.push(`píxeles ${v.pix_fmt} (debe ser yuv420p)`);
  if (!a) fallos.push('sin pista de audio');
  else if (a.codec_name !== 'aac') fallos.push(`audio ${a.codec_name} (debe ser AAC)`);
  if (dur < U.min || dur > U.max) fallos.push(`dura ${dur.toFixed(2)} s (de ${U.min} a ${U.max} s)`);
  if (a && (lufs == null || Math.abs(lufs - U.lufs) > U.tol)) fallos.push(`volumen ${lufs} LUFS (objetivo ${U.lufs} ± ${U.tol})`);
  if (a && (pico == null || pico > U.tp)) fallos.push(`pico real ${pico} dBTP (máximo ${U.tp})`);
  negros.forEach((n) => {
    if (n.desde < 0.05) fallos.push(`empieza en negro (${n.dur} s): el gancho tiene que verse desde el primer fotograma`);
    else if (n.dur > U.negroMax) fallos.push(`negro de ${n.dur} s en ${n.desde} s`);
    else avisos.push(`negro corto de ${n.dur} s en ${n.desde} s (¿transición?)`);
  });
  congelados.forEach((c) => avisos.push(`imagen quieta ${c.dur} s desde ${c.desde} s`));
  silencios.forEach((s) => avisos.push(`silencio de ${s.dur} s desde ${s.desde} s`));
  if (a && lra != null && lra > 15) avisos.push(`rango de volumen amplio (LRA ${lra} LU)`);

  const res = {
    archivo: path.resolve(video), aprobado: fallos.length === 0, fallos, avisos,
    medidas: {
      ancho: v.width, alto: v.height, fps: +fps.toFixed(3), video: v.codec_name, pix_fmt: v.pix_fmt, audio: a ? a.codec_name : null,
      audio_hz: a ? +a.sample_rate : null, canales: a ? a.channels : null, duracion: +dur.toFixed(3),
      mb: +(+(info.format.size || 0) / 1048576).toFixed(2), kbps: Math.round(+(info.format.bit_rate || 0) / 1000),
      lufs, lra, pico_dbtp: pico,
    },
    negros, congelados, silencios,
    imagenes: { hoja: hojaPng, primero: primeroPng },
    umbrales: U,
  };
  const json = JSON.stringify(res, null, 2);
  fs.writeFileSync(path.join(dir, 'revision.json'), json + '\n');
  const iJ = argv.indexOf('--json');
  if (iJ >= 0 && argv[iJ + 1]) {
    fs.mkdirSync(path.dirname(path.resolve(argv[iJ + 1])), { recursive: true });
    fs.writeFileSync(argv[iJ + 1], json + '\n');
  }
  if (argv.includes('--breve')) {
    const m = res.medidas;
    console.log(`${res.aprobado ? 'APROBADO' : 'NO APROBADO'} · ${path.basename(video)} · ${m.ancho}x${m.alto} ${m.fps} fps · `
      + `${m.duracion} s · ${m.lufs} LUFS · pico ${m.pico_dbtp} dBTP`);
    fallos.forEach((f) => console.log('  ✗ ' + f));
    avisos.forEach((x) => console.log('  · ' + x));
    console.log('  hoja de contacto: ' + hojaPng);
  } else {
    console.log(json);
  }
  process.exit(res.aprobado ? 0 : 1);
}

try { main(); } catch (e) { console.error(e.message || e); process.exit(2); }
