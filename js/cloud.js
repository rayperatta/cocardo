/* Cocardo: ¡Rescate Helado! — Nube: cuenta de Google, apodo, progreso sincronizado y rankings (Firebase).
 * Contrato: docs/ARQUITECTURA.md §14. Configuración: js/cloud-config.js. Reglas: firebase/firestore.rules.
 *
 * Sin configuración (apiKey vacío), desde file:// o dentro de un iframe, todo es un no-op silencioso y el juego
 * sigue en modo local. El SDK de Firebase (build compat, sin empaquetador) se carga solo cuando hace falta:
 * al tocar «Entrar» o al abrir el juego si ya hubo una sesión. Los rankings se leen por la API REST de
 * Firestore (sin SDK), así cualquier visitante los ve sin descargar nada extra. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : null;
  if (!root) return;
  var Cocardo = (root.Cocardo = root.Cocardo || {});
  var doc = root.document;

  var FLAG = 'cocardo.cloud.on';     // hubo sesión en este navegador: al abrir se restaura sola
  var CACHE_MS = 45000;              // los rankings se vuelven a pedir como mucho cada 45 s
  var MAXL = (Cocardo.Roadmap && Cocardo.Roadmap.MAX_LEVELS) || 120;   // mismo tope que firebase/firestore.rules
  var listeners = [];
  var state = 'off';                 // off | idle | loading | ready | error
  var fb = null, auth = null, db = null;
  var user = null;                   // { uid, name, photo, anon }
  var authSeen = false;              // Firebase ya dijo si había sesión (primer onAuthStateChanged)
  var anonLeft = null;               // { uid, token } sesión con apodo que se dejó al entrar con un Google que ya existía
  var profile = null;                // { nick, nickKey, avatar, stars, levels, rescued, bestStreak, finished }
  var profileReady = false;          // ya se consultó el perfil del usuario actual (null = aún sin apodo)
  var loadPromise = null;
  var pushTimer = 0, pushPending = false, pushing = false;
  var lastError = null;
  var cache = {};
  var sentDaily = {};

  /* ---------- utilidades ---------- */

  function cfg() { return (Cocardo.CloudConfig && Cocardo.CloudConfig.firebase) || {}; }
  function configured() { var c = cfg(); return !!(c.apiKey && c.projectId && c.appId); }
  function httpOk() { try { return /^https?:$/.test(location.protocol); } catch (e) { return false; } }
  function framed() { try { return root.top !== root.self; } catch (e) { return true; } }
  function available() { return configured() && httpOk() && !framed() && typeof fetch === 'function'; }
  // Navegadores dentro de apps (TikTok, Instagram, Facebook…): Google no permite iniciar sesión ahí
  function inAppBrowser() {
    var ua = (root.navigator && root.navigator.userAgent) || '';
    return /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Bytedance|Snapchat|Line\/|Twitter|WhatsApp|\bwv\b/i.test(ua);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(v, def, lo, hi) { var n = Number(v); if (!isFinite(n)) return def; n = Math.floor(n); return clamp(n, lo, hi); }
  function ts() { return fb.firestore.FieldValue.serverTimestamp(); }
  function saveData() { return Cocardo.Save ? Cocardo.Save.get() : {}; }
  function persist() { try { Cocardo.Save.save(); } catch (e) { /* nada */ } }
  function flag(on) {
    try { if (on) root.localStorage.setItem(FLAG, '1'); else root.localStorage.removeItem(FLAG); } catch (e) { /* nada */ }
  }
  function hadSession() { try { return root.localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } }

  function emit() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) { console.error('[Cocardo.Cloud]', e); } });
  }
  function snapshot() { return { state: state, user: user, profile: profile, profileReady: profileReady, error: lastError ? message(lastError) : '' }; }

  // Mensaje corto para el jugador a partir de un error de Firebase
  function message(e) {
    var c = (e && e.code) || '';
    if (c === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase (Authentication → Authorized domains).';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request' || c === 'auth/user-cancelled') return '';
    if (c === 'auth/network-request-failed' || (e && /Failed to fetch|NetworkError/i.test(String(e.message)))) return 'Sin conexión. Inténtalo de nuevo.';
    if (c === 'auth/operation-not-allowed') return 'Falta activar el proveedor en Firebase (Authentication → Sign-in method).';
    if (c === 'permission-denied') return 'La nube rechazó el cambio (revisa las reglas de Firestore).';
    if (e && /No se pudo cargar/.test(String(e.message))) return 'No se pudo cargar la conexión con la nube.';
    return 'Algo falló en la nube. Inténtalo otra vez.';
  }

  /* ---------- carga del SDK ---------- */

  function script(src) {
    return new Promise(function (res, rej) {
      var s = doc.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('No se pudo cargar ' + src)); };
      doc.head.appendChild(s);
    });
  }

  function load() {
    if (loadPromise) return loadPromise;
    if (!available()) return Promise.reject(new Error('cloud-off'));
    state = 'loading';
    emit();
    var v = (Cocardo.CloudConfig && Cocardo.CloudConfig.firebaseVersion) || '10.14.1';
    var base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    loadPromise = script(base + 'firebase-app-compat.js')
      .then(function () { return Promise.all([script(base + 'firebase-auth-compat.js'), script(base + 'firebase-firestore-compat.js')]); })
      .then(function () {
        fb = root.firebase;
        if (!fb || !fb.auth || !fb.firestore) throw new Error('No se pudo cargar firebase');
        if (!fb.apps || !fb.apps.length) fb.initializeApp(cfg());
        auth = fb.auth();
        try { auth.useDeviceLanguage(); } catch (e) { /* nada */ }
        db = fb.firestore();
        auth.onAuthStateChanged(onAuth, function (e) { lastError = e; emit(); });
        // vuelta de un inicio de sesión por redirección (ver popupFallback); sin redirección pendiente no hace nada
        auth.getRedirectResult().catch(function (e) {
          if (e && e.code === 'auth/credential-already-in-use' && e.credential) return leaveAnon(auth.currentUser, e.credential);
          lastError = e;
          emit();
        });
        state = 'ready';
        emit();
        return fb;
      })
      .catch(function (err) {
        state = 'error';
        lastError = err;
        loadPromise = null;
        emit();
        throw err;
      });
    return loadPromise;
  }

  function fromFirebase(u) { return { uid: u.uid, name: u.displayName || '', photo: u.photoURL || '', anon: !!u.isAnonymous }; }
  function onAuth(u) {
    authSeen = true;
    if (u) {
      user = fromFirebase(u);
      lastError = null;
      profileReady = false;
      flag(true);
      emit();
      loadProfile().then(function () { profileReady = true; emit(); return sync(); }).then(function () { emit(); }, function (e) { lastError = e; emit(); });
    } else {
      user = null;
      profile = null;
      profileReady = false;
      flag(false);
      cacheProfile();
      emit();
    }
  }

  /* ---------- perfil ---------- */

  function cleanProfile(raw) {
    raw = raw || {};
    return {
      nick: String(raw.nick || '').slice(0, 16),
      nickKey: String(raw.nickKey || '').slice(0, 16),
      avatar: String(raw.avatar || 'lima').slice(0, 20),
      stars: num(raw.stars, 0, 0, MAXL * 3), levels: num(raw.levels, 0, 0, MAXL), rescued: num(raw.rescued, 0, 0, 16),
      bestStreak: num(raw.bestStreak, 0, 0, 1e6), finished: !!raw.finished,
    };
  }
  // Copia del perfil en el guardado local: la Portada muestra el apodo aunque el SDK no haya cargado
  function cacheProfile() {
    var d = saveData();
    if (!d) return;
    d.cloud = { on: !!user, nick: profile ? profile.nick : '', avatar: profile ? profile.avatar : '', uid: user ? user.uid : '' };
    persist();
  }
  function loadProfile() {
    if (!user || !db) return Promise.resolve(null);
    return db.collection('users').doc(user.uid).get().then(function (snap) {
      profile = (snap.exists && snap.data().nick) ? cleanProfile(snap.data()) : null;
      cacheProfile();
      return profile;
    });
  }

  // Apodo sugerido: neutro («Heladero» + 3 cifras al azar), nunca a partir del nombre de Google. El ranking es público
  // (cualquiera puede leer users/{uid}) y la Política de privacidad promete que el nombre de Google no se muestra
  function suggestNick() {
    var n = Math.floor(Math.random() * 900) + 100;
    return 'Heladero' + n;
  }

  function saveProfile(o) {
    o = o || {};
    if (!user || !db) return Promise.resolve({ ok: false, reason: 'Primero entra con tu cuenta' });
    var P = Cocardo.Progress;
    var v = P.validNick(o.nick);
    if (!v.ok) return Promise.resolve(v);
    var avatar = String(o.avatar || (profile && profile.avatar) || 'lima').slice(0, 20);
    var uid = user.uid;
    var usersRef = db.collection('users').doc(uid);
    var newRef = db.collection('nicknames').doc(v.key);
    var oldKey = profile && profile.nickKey;
    var sum = P.summary(saveData());
    var pub = { nick: v.nick, nickKey: v.key, avatar: avatar, stars: sum.stars, levels: sum.levels, rescued: sum.rescued, bestStreak: sum.bestStreak, finished: sum.finished, updatedAt: ts() };
    return db.runTransaction(function (t) {
      return t.get(newRef).then(function (snap) {
        if (snap.exists && snap.data().uid !== uid) throw { code: 'nick-taken' };
        if (!snap.exists) t.set(newRef, { uid: uid });
        if (oldKey && oldKey !== v.key) t.delete(db.collection('nicknames').doc(oldKey));
        t.set(usersRef, pub, { merge: true });
      });
    }).then(function () {
      profile = cleanProfile(pub);
      cacheProfile();
      cache = {};
      emit();
      return { ok: true, nick: v.nick };
    }, function (e) {
      if (e && e.code === 'nick-taken') return { ok: false, reason: 'Ese apodo ya está en uso' };
      if (e && e.code === 'permission-denied') return { ok: false, reason: 'Ese apodo no se puede usar' };
      lastError = e;
      return { ok: false, reason: message(e) };
    });
  }

  /* ---------- sesión ---------- */

  function provider() {
    var p = new fb.auth.GoogleAuthProvider();
    try { p.setCustomParameters({ prompt: 'select_account' }); } catch (e) { /* nada */ }
    return p;
  }
  // Sin ventana emergente se va a Google y se vuelve: la marca hace que init() cargue el SDK al regresar, y load()
  // recoge el resultado con getRedirectResult(). Si la sesión era anónima se vincula (no se pierde el apodo).
  function popupFallback(e, p, link) {
    var c = (e && e.code) || '';
    if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported') {
      flag(true);
      return link ? auth.currentUser.linkWithRedirect(p) : auth.signInWithRedirect(p);
    }
    throw e;
  }
  // Se deja la sesión con apodo para entrar con una cuenta de Google que ya existía (Firebase cambia de uid). Con la
  // venta encendida se guarda antes su token: Cocardo.Pay se lo pasa al Worker para traer la compra (takeAnonToken)
  function leaveAnon(anon, cred) {
    var keep = anon && anon.isAnonymous && Cocardo.Pay && Cocardo.Pay.on && Cocardo.Pay.on();
    var tok = keep ? anon.getIdToken().then(function (t) { anonLeft = { uid: anon.uid, token: t }; }, function () { anonLeft = null; }) : Promise.resolve();
    return tok.then(function () { return auth.signInWithCredential(cred); });
  }
  // Token de la sesión con apodo uid que se acaba de dejar ('' si no hay); se entrega una sola vez
  function takeAnonToken(uid) {
    var h = anonLeft;
    anonLeft = null;
    return h && h.uid === uid ? h.token : '';
  }
  // Entrar con Google. Si la sesión actual es anónima (apodo sin cuenta) se vincula: el progreso y el apodo
  // se conservan; si esa cuenta de Google ya existía, se entra con ella y el progreso local se junta al suyo.
  function signIn() {
    return load().then(function () {
      var p = provider();
      var cur = auth.currentUser;
      if (cur && cur.isAnonymous) {
        return cur.linkWithPopup(p).then(function () {
          // mismo uid, pero ya no es anónima (vincular no avisa por onAuthStateChanged)
          if (auth.currentUser && user && auth.currentUser.uid === user.uid) { user = fromFirebase(auth.currentUser); emit(); }
        }, function (e) {
          if (e && e.code === 'auth/credential-already-in-use' && e.credential) return leaveAnon(cur, e.credential);
          return popupFallback(e, p, true);
        });
      }
      return auth.signInWithPopup(p).catch(function (e) { return popupFallback(e, p); });
    }).then(function () { return user; }, function (e) {
      if (e && e.message === 'cloud-off') return null;
      lastError = e;
      emit();
      throw e;
    });
  }
  // Apodo sin cuenta (sesión anónima de Firebase): sirve dentro de TikTok/Instagram, donde Google no deja entrar
  function signInAnon() {
    return load().then(function () { return auth.signInAnonymously(); }).then(function () { return user; }, function (e) {
      lastError = e;
      emit();
      throw e;
    });
  }
  function signOut() {
    if (!auth) { user = null; profile = null; profileReady = false; flag(false); cacheProfile(); emit(); return Promise.resolve(); }
    return auth.signOut().then(function () { user = null; profile = null; profileReady = false; flag(false); cacheProfile(); emit(); });
  }

  /* ---------- progreso ---------- */

  // Baja el guardado de la nube, lo junta con el local (sin perder nada) y sube el resultado.
  function sync() {
    if (!user || !db) return Promise.resolve(false);
    var ref = db.collection('users').doc(user.uid).collection('private').doc('save');
    return ref.get().then(function (snap) {
      var remote = snap.exists ? snap.data() : null;
      var local = saveData();
      var merged = Cocardo.Progress.merge(local, remote);
      Object.keys(merged).forEach(function (k) { local[k] = merged[k]; });
      persist();
      return push(true);
    }).then(function () { emit(); return true; });
  }
  // Sube el progreso local (con retardo, para agrupar varios cambios seguidos)
  function push(now) {
    pushPending = true;
    if (!user || !db) return Promise.resolve(false);
    if (!now) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () { push(true); }, 1500);
      return Promise.resolve(true);
    }
    clearTimeout(pushTimer);
    pushTimer = 0;
    if (pushing) return Promise.resolve(true);   // al terminar la subida en curso se vuelve a subir
    pushing = true;
    pushPending = false;
    var P = Cocardo.Progress;
    var d = saveData();
    var save = P.forCloud(d);
    var rev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);   // marca única de esta subida
    save.rev = rev;
    save.updatedAt = ts();
    var sum = P.summary(d);
    var batch = db.batch();
    batch.set(db.collection('users').doc(user.uid).collection('private').doc('save'), save);
    if (profile) {
      batch.set(db.collection('users').doc(user.uid), {
        stars: sum.stars, levels: sum.levels, rescued: sum.rescued, bestStreak: sum.bestStreak, finished: sum.finished, updatedAt: ts(),
      }, { merge: true });
      profile.stars = sum.stars; profile.levels = sum.levels; profile.rescued = sum.rescued; profile.bestStreak = sum.bestStreak; profile.finished = sum.finished;
    }
    return batch.commit().then(function () {
      pushing = false;
      // la nube tiene ya esta versión: al volver a juntar, lo de este aparato manda (ver Progress.merge)
      d.rev = rev;
      persist();
      if (pushPending) push(true);
      return true;
    }, function (e) {
      pushing = false;
      lastError = e;
      emit();
      return false;
    });
  }

  /* ---------- Reto Diario ---------- */

  // Envía el intento oficial del día (solo se acepta el primero: las reglas no permiten sobrescribirlo)
  function submitDaily(key, r) {
    key = String(key);
    if (!user || !db || !profile || sentDaily[key]) return Promise.resolve(false);
    r = r || {};
    var ref = db.collection('daily').doc(key).collection('scores').doc(user.uid);
    var won = !!r.won;
    var entry = {
      nick: profile.nick, avatar: profile.avatar, won: won,
      score: num(r.score, 0, 0, 999999), stars: won ? num(r.stars, 1, 1, 3) : 0,
      movesUsed: num(r.movesUsed, 0, 0, 99), movesTotal: num(r.movesTotal, 0, 0, 99), maxCombo: num(r.maxCombo != null ? r.maxCombo : r.maxCascade, 0, 0, 99),
      num: num(r.num, 0, 0, 1e6), at: ts(),
    };
    return ref.set(entry).then(function () {
      sentDaily[key] = true;
      delete cache['daily' + key];
      return true;
    }, function (e) {
      if (e && e.code === 'permission-denied') { sentDaily[key] = true; return false; }   // ya estaba enviado
      lastError = e;
      return false;
    });
  }

  /* ---------- lecturas públicas por REST (sin SDK) ---------- */

  function restUrl(path) {
    var c = cfg();
    return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(c.projectId) + '/databases/(default)/documents' + path + '?key=' + encodeURIComponent(c.apiKey);
  }
  function decode(v) {
    if (!v || typeof v !== 'object') return null;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return !!v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('mapValue' in v) return decodeDoc(v.mapValue);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    return null;
  }
  function decodeDoc(d) {
    var o = {}, f = (d && d.fields) || {};
    Object.keys(f).forEach(function (k) { o[k] = decode(f[k]); });
    return o;
  }
  function runQuery(parent, collectionId, orderField, limit) {
    var body = { structuredQuery: { from: [{ collectionId: collectionId }], orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }], limit: limit } };
    return fetch(restUrl(parent + ':runQuery'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) {
        return (Array.isArray(rows) ? rows : []).filter(function (x) { return x && x.document; }).map(function (x) {
          var o = decodeDoc(x.document);
          o.uid = String(x.document.name || '').split('/').pop();
          return o;
        });
      });
  }
  function cached(key, make) {
    var c = cache[key];
    var t = Date.now();
    if (c && t - c.at < CACHE_MS) return c.p;
    var p = make().then(function (v) { return v; }, function (e) { delete cache[key]; throw e; });
    cache[key] = { at: t, p: p };
    return p;
  }
  // Mejores del reto de un día: [{ uid, nick, avatar, score, stars, won, movesUsed, movesTotal }]
  function dailyTop(key, n) {
    if (!available()) return Promise.resolve([]);
    key = String(key);
    return cached('daily' + key, function () {
      return runQuery('/daily/' + key, 'scores', 'score', n || 20).then(function (rows) {
        return rows.map(function (r) {
          return { uid: r.uid, nick: String(r.nick || '').slice(0, 16), avatar: String(r.avatar || 'lima').slice(0, 20), score: num(r.score, 0, 0, 1e9),
            stars: num(r.stars, 0, 0, 3), won: !!r.won, movesUsed: num(r.movesUsed, 0, 0, 999), movesTotal: num(r.movesTotal, 0, 0, 999) };
        });
      });
    });
  }
  // Mejores rescatistas de todos los tiempos (por estrellas): [{ uid, nick, avatar, stars, levels, rescued, bestStreak }]
  function topPlayers(n) {
    if (!available()) return Promise.resolve([]);
    return cached('top', function () {
      return runQuery('', 'users', 'stars', n || 20).then(function (rows) {
        return rows.filter(function (r) { return r.nick; }).map(cleanProfile).map(function (p, i) { p.uid = rows[i].uid; return p; });
      });
    });
  }

  /* ---------- escucha en vivo, sesión y token (los usa Cocardo.Pay; también authKnown y takeAnonToken) ---------- */

  // Escucha un documento: cb({ exists, fromCache, data }) en cada cambio, también los de metadatos (el primer aviso
  // puede venir de la caché local y luego llega el del servidor con fromCache = false). Devuelve la función que
  // deja de escuchar. onError(e): tras un error Firestore ya no avisa más.
  function watchDoc(path, cb, onError) {
    var off = null, stopped = false;
    load().then(function () {
      if (stopped) return;
      off = db.doc(path).onSnapshot({ includeMetadataChanges: true }, function (snap) {
        try {
          cb({ exists: !!snap.exists, fromCache: !!(snap.metadata && snap.metadata.fromCache), data: snap.exists ? snap.data() : null });
        } catch (e) { console.error('[Cocardo.Cloud.watchDoc]', e); }
      }, function (e) { if (onError) onError(e); });
    }).catch(function (e) { if (onError) onError(e); });
    return function () { stopped = true; if (off) { off(); off = null; } };
  }
  // uid de la sesión ('' si no hay) cuando Firebase ya sabe si había una (restaurada o no): así no se crea una
  // anónima encima de una cuenta que todavía se está restaurando
  function authReady() {
    return load().then(function () {
      return new Promise(function (res) {
        var off = auth.onAuthStateChanged(function (u) {
          res(u ? u.uid : '');
          setTimeout(function () { off(); }, 0);
        }, function () { res(''); });
      });
    });
  }
  // Token de identidad del usuario actual (Authorization: Bearer … para el Worker de pagos)
  function idToken(force) {
    if (!auth || !auth.currentUser) return Promise.reject(new Error('sin-usuario'));
    return auth.currentUser.getIdToken(!!force);
  }

  /* ---------- arranque ---------- */

  function init() {
    if (!available()) { state = 'off'; return; }
    state = 'idle';
    // la sesión anterior se restaura sin molestar al arranque (el SDK se carga después del primer dibujo)
    if (hadSession()) setTimeout(function () { load().catch(function () { /* ya avisó emit() */ }); }, 1200);
  }

  Cocardo.Cloud = {
    init: init,
    configured: configured,
    available: available,
    inAppBrowser: inAppBrowser,
    state: function () { return state; },
    user: function () { return user; },
    profile: function () { return profile; },
    error: function () { return lastError ? message(lastError) : ''; },
    message: message,
    onChange: function (fn) { if (listeners.indexOf(fn) < 0) listeners.push(fn); },
    offChange: function (fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    load: load,
    signIn: signIn,
    signInAnon: signInAnon,
    signOut: signOut,
    suggestNick: suggestNick,
    saveProfile: saveProfile,
    sync: sync,
    push: function () { return push(false); },
    submitDaily: submitDaily,
    dailyTop: dailyTop,
    topPlayers: topPlayers,
    watchDoc: watchDoc,
    authReady: authReady,
    authKnown: function () { return authSeen; },
    idToken: idToken,
    takeAnonToken: takeAnonToken,
  };
})();
