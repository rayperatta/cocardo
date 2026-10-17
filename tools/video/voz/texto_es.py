"""Texto en español para el estudio de voces: números a letras y normalización para comparar transcripciones.

Solo usa la biblioteca estándar: lo importan voz.py (con cualquier Python) y revisar_voz.py (venv de whisper).
"""
import re
import unicodedata

_UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
             'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
             'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
             'veintisiete', 'veintiocho', 'veintinueve']
_DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
_CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
             'setecientos', 'ochocientos', 'novecientos']


def _menor_mil(n):
    if n < 30:
        return _UNIDADES[n]
    if n < 100:
        d, u = divmod(n, 10)
        return _DECENAS[d] + ('' if u == 0 else ' y ' + _UNIDADES[u])
    if n == 100:
        return 'cien'
    c, r = divmod(n, 100)
    return _CENTENAS[c] + ('' if r == 0 else ' ' + _menor_mil(r))


def _apocope(s):
    # «uno» se acorta delante de «mil» y «millones»: veintiún mil, treinta y un mil
    if s.endswith('veintiuno'):
        return s[:-9] + 'veintiún'
    return s[:-3] + 'un' if s.endswith('uno') else s


def numero_a_letras(n):
    """Entero de 0 a 999.999.999 en letras, como se dice en voz alta."""
    if n < 1000:
        return _menor_mil(n)
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        cab = 'mil' if m == 1 else _apocope(_menor_mil(m)) + ' mil'
        return cab + ('' if r == 0 else ' ' + _menor_mil(r))
    mm, r = divmod(n, 1_000_000)
    cab = 'un millón' if mm == 1 else _apocope(numero_a_letras(mm)) + ' millones'
    return cab + ('' if r == 0 else ' ' + numero_a_letras(r))


def numeros_en_letras(texto):
    """Cambia «500», «4,000» o «4.000» por letras para que el TTS los lea bien."""
    def cambio(m):
        cifras = re.sub(r'[.,](?=\d{3}\b)', '', m.group(0))
        return numero_a_letras(int(cifras)) if cifras.isdigit() and len(cifras) <= 9 else m.group(0)
    return re.sub(r'\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+', cambio, texto)


def para_tts(texto):
    """Texto listo para el motor: números en letras, espacios simples y puntos suspensivos con un solo carácter."""
    t = numeros_en_letras(texto)
    t = t.replace('...', '…')
    return ' '.join(t.split())


# Interjecciones sin vocal (psst, shh, mmm): whisper nunca las escribe igual («Pez», «PS», «C», «Sí, este»…), así que
# en la referencia valen como comodín: cuadran con nada o con hasta 2 palabras de lo que oyó
COMODIN = '*'
RISA = 'jaja'  # toda risa cuenta como esta sola palabra
_INTERJECCION = re.compile(r'p+s+t*|s+h+|h?m{2,}')
_SILABA_RISA = re.compile(r'(?:[jh][aeiou])+')


def limpiar(texto):
    """Minúsculas, sin acentos ni puntuación y con los números en letras: la lista de palabras."""
    t = numeros_en_letras(texto.lower())
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = re.sub(r"(?<=[a-z])['’](?=[a-z])", '', t)  # «Coco's» = «Cocos»: el apóstrofo no separa palabras
    return re.sub(r"[^a-z0-9\s]", ' ', t).split()


def risas(palabras):
    """Marca qué palabras (ya limpias) son risa: una tanda de «ja», «ji», «he»… seguidas, o una sola con «j» o con
    varias sílabas («jajaja»). Un «ha» o «he» suelto es una palabra («ha llegado»)."""
    marcas, i = [False] * len(palabras), 0
    while i < len(palabras):
        j = i
        while j < len(palabras) and _SILABA_RISA.fullmatch(palabras[j]):
            j += 1
        if j == i:
            i += 1
            continue
        if j - i > 1 or len(palabras[i]) > 2 or palabras[i][0] == 'j':
            marcas[i:j] = [True] * (j - i)
        i = j
    return marcas


def normalizar(texto):
    """Para el WER: limpiar() más cada risa como una sola palabra («ja, ja, ja» = «jejeje» = «jaja»; whisper escribe
    igual «ji, ji» que «he, he, he») e interjecciones sin vocal como comodín."""
    palabras = limpiar(texto)
    salida = []
    for p, es_risa in zip(palabras, risas(palabras)):
        if es_risa:
            if not salida or salida[-1] != RISA:
                salida.append(RISA)
        else:
            salida.append(COMODIN if _INTERJECCION.fullmatch(p) else p)
    return salida


def wer(referencia, hipotesis):
    """Tasa de error por palabra (distancia de edición / palabras de la referencia) con textos ya normalizados.
    Un comodín de la referencia se come gratis 0, 1 o 2 palabras de la hipótesis."""
    r, h = referencia, hipotesis
    if not r:
        return 0.0 if not h else 1.0
    fila = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        previa = fila
        if r[i - 1] == COMODIN:
            fila = [previa[0]] + [0] * len(h)
            for j in range(1, len(h) + 1):
                fila[j] = min(previa[j], previa[j - 1], previa[j - 2] if j >= 2 else previa[j - 1], fila[j - 1] + 1)
            continue
        fila = [previa[0] + 1] + [0] * len(h)
        for j in range(1, len(h) + 1):
            fila[j] = min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + (r[i - 1] != h[j - 1]))
    return fila[-1] / len(r)
