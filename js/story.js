/* Cocardo: ¡Rescate Helado! — guion, consejos, burlas y álbum.
   Contrato: docs/ARQUITECTURA.md §7. Personajes y canon: docs/PERSONAJES.md y docs/investigacion/biblia.json.
   La historia sigue las 13 partes de «La Nieve de Lima» y reutiliza sus frases tal cual cuando se puede.
   El giro del juego: tú eres el ayudante secreto que descongela a las víctimas en los niveles jefe.

   Entradas de un guion:
     { who, mood, text }            línea de diálogo (who = id de personaje, mood = ánimo del retrato)
       + frozen:true                retrato congelado (Art.portrait opts.frozen)
       + variant:'carcel'|'huida'|'tubo'|'panecitos'   (Art.portrait opts.variant)
     { sfx:'clac' }                 golpe de efecto; texto y sonido sugeridos en Story.effects
     { card:'CONTINUARÁ...' }       tarjeta a pantalla completa */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  function say(who, mood, text, extra) {
    var o = { who: who, mood: mood, text: text };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  function sfx(name) { return { sfx: name }; }
  function card(text) { return { card: text }; }
  var FROZEN = { frozen: true };
  var TBC = 'CONTINUARÁ...';

  // Efectos de los guiones: texto en pantalla y sonido de Cocardo.Audio que mejor le queda.
  var effects = {
    clac: { text: '¡CLAC!', sound: 'freezerHit' },
    trueno: { text: '¡BRRRUUUM!', sound: 'drama' },
    crash: { text: '¡CRASH!', sound: 'bomba' },
    plaf: { text: '¡PLAF!', sound: 'crate' },
    sirena: { text: '¡UIU, UIU, UIU!', sound: 'villain' },
    drama: { text: '¡TAN-TAN-TAAAN!', sound: 'drama' },
  };

  var scripts = {
    // ===== Capítulo 1 · La nieve de Lima (Parte 1) =====
    pre1: [
      say('lima', 'triste', 'Cocardo, hoy vendemos menos de lo que cuesta prender las luces.'),
      say('cocardo', 'burlon', 'Bueno, entonces mañana prende menos luces.'),
      say('lima', 'enojado', '¡Cocardo! Necesitamos ayuda de verdad.'),
      say('lima', 'feliz', 'Tú, sí, tú: acomoda la fruta en la vitrina. ¡Junta tres iguales!'),
      say('cocardo', 'feliz', "¡Bienvenido a Coco's Scoops, ayudante!"),
    ],
    pre2: [
      say('cocardo', 'feliz', 'Compré un congelador usado. ¡Una ganga: cuatro mil pesos!'),
      say('lima', 'sorprendido', '¿Y por qué hace esos ruidos?'),
      say('cocardo', 'burlon', 'No está viejo, está experimentado.'),
    ],
    pre3: [
      say('lima', 'asustado', 'Cocardo, el congelador está temblando… y huele a quemado.'),
      say('cocardo', 'burlon', 'Así ronronea cuando está contento.'),
      say('lima', 'enojado', 'Ay, Cocardo…'),
    ],
    pre4: [
      say('lima', 'sorprendido', 'Se apagó otra vez… ¡y dejó todo lleno de hielo!'),
      say('cocardo', 'burlon', 'Hielo de importación… del congelador. ¡Rómpelo, ayudante!'),
    ],
    pre5: [
      say('cocardo', 'nervioso', 'Si hoy no vendemos, cerramos.'),
      say('lima', 'feliz', 'Entonces hagamos el mejor helado de la ciudad. ¡Copa Arcoíris!'),
      say('cocardo', 'burlon', '¿Y si el congelador se vuelve a apagar? Dale un golpecito.'),
    ],
    cliff5: [
      say('lima', 'nervioso', 'Se volvió a apagar. Voy a revisar el cable de atrás.'),
      sfx('clac'),
      say('cocardo', 'asustado', 'Lima, hazte para atrás, no abre.'),
      say('lima', 'asustado', 'Ya sé, ya sé, Cocardo… tengo frío.', FROZEN),
      say('cocardo', 'sorprendido', '¡No inventes, estás viva!'),
      say('cocardo', 'burlon', 'Perdóname, amor… solo un poquito.'),
      card(TBC),
    ],

    // ===== Capítulo 2 · Necesitamos un nuevo sabor (Partes 2-3) =====
    pre6: [
      say('lima', 'triste', 'Psst… ayudante. Sigo viva aquí adentro. ¡No le digas a Cocardo!', FROZEN),
      say('cocardo', 'nervioso', 'Uno por persona, ya se me están poniendo violentos.'),
      say('cocardo', 'burlon', 'Mañana habrá un sabor nuevo.'),
      say('fresa', 'nervioso', 'Vine a ver a mi prima Lima, no me responde desde ayer.'),
      say('cocardo', 'burlon', 'Pásale, está atrás… en la trastienda.'),
      sfx('clac'),
      say('cocardo', 'nervioso', 'Lo siento, Fresa, pero te necesito.'),
    ],
    pre7: [
      say('cocardo', 'feliz', '¡Pásele, pásele! Tenemos la famosa nieve de Lima y el nuevo sabor de fresa.'),
      say('pina', 'normal', '¿Tú eres Cocardo?'),
      say('cocardo', 'burlon', 'Depende quién pregunte.'),
      say('pina', 'normal', 'Don Piña.'),
      say('guardaespaldas', 'enojado', '…'),
      say('pina', 'feliz', 'Necesito 500 litros para empezar… 500 por sabor. Consígueme 5 y tenemos un trato.'),
    ],
    pre8: [
      say('pina', 'sorprendido', '¿Y de dónde sacas un sabor tan fresco?'),
      say('cocardo', 'burlon', 'Si te lo digo tendría que cerrar el negocio. Es orgánico, más de lo que imaginas.'),
      say('cocardo', 'feliz', 'Mi amor Lima y su prima Fresa, ¿qué haría yo sin ustedes?'),
      say('fresa', 'enojado', '¡Sácanos de aquí, cabeza de coco!', FROZEN),
    ],
    pre9: [
      say('cocardo', 'sorprendido', 'Oye, tú, el de la fruta… ¿me estás ayudando o estorbando?'),
      say('cocardo', 'burlon', 'Por si acaso, cada pocos turnos te congelo una fruta.'),
      say('lima', 'feliz', 'Psst… no te rindas, ayudante. Ya casi llegas a mi congelador.', FROZEN),
    ],
    pre10: [
      say('lima', 'asustado', 'Ayudante, es ahora: rompe el congelador viejo y luego mi bloque.', FROZEN),
      say('cocardo', 'asustado', '¡Mi congelador no! ¡Costó cuatro mil pesos!'),
      say('cocardo', 'furioso', 'Bueno… cinco mil con envío.'),
    ],
    post10: [
      say('lima', 'feliz', '¡Libre! Gracias, ayudante. Te debo un helado… de otro sabor.'),
      say('cocardo', 'furioso', '¿¡Quién descongeló a mi Lima!? ¡Era mi sabor estrella!'),
      say('lima', 'feliz', 'Me escondo contigo, ayudante. Vamos por mi prima Fresa.'),
    ],
    cliff10: [
      say('cocardo', 'furioso', 'Sin nieve de Lima no hay negocio…'),
      say('pina', 'enojado', 'Consígueme 5 y tenemos un trato. No lo olvides.'),
      say('cocardo', 'burlon', 'Necesito un congelador más grande. Mucho más grande.'),
      sfx('drama'),
      card(TBC),
    ],

    // ===== Capítulo 3 · Voy a ampliar el menú (Partes 4-5) =====
    pre11: [
      say('brocoli', 'sorprendido', 'Oiga, sí está grande, ¿para qué quiere tanto espacio?'),
      say('cocardo', 'burlon', 'Voy a ampliar el menú.'),
      say('cocardo', 'feliz', 'Me piden durazno, plátano y uva morada… y yo cumplo.'),
      say('lima', 'feliz', 'Ayudante, te presto mi Chorro de Lima: limpia una fila entera.'),
    ],
    pre12: [
      say('cocardo', 'burlon', 'Durazna, ¿quieres probar recetas? Helado gratis de por vida.'),
      say('durazna', 'feliz', '¿Helado gratis de por vida? ¡Claro que sí!'),
      say('cocardo', 'burlon', 'Estoy a tres sabores de cerrar el mejor trato de mi vida… tú serás el tercero.'),
      say('cocardo', 'burlon', 'Tranquila, será rápido.'),
      sfx('clac'),
      say('cocardo', 'carcajada', 'Tres de cinco…'),
    ],
    pre13: [
      say('lima', 'nervioso', 'Mi prima Fresa sigue en el hielo, allá abajo.'),
      say('fresa', 'asustado', '¡Prima! ¡Aquí estoy! ¡Tengo frío!', FROZEN),
      say('lima', 'enojado', 'Ayudante, rompe el hielo hasta llegar a ella.'),
    ],
    post13: [
      say('fresa', 'feliz', '¡Gracias! Toma mi Batido de Fresa: revuelve todo el tablero.'),
      say('cocardo', 'furioso', '¿¡Otra vez!? ¿¡Y mi nuevo sabor de fresa!?'),
    ],
    pre14: [
      say('cocardo', 'feliz', 'Uva, eres nueva en la ciudad, ¿no? Pásate esta noche a la hora del cierre.'),
      say('cocardo', 'burlon', 'Y tú, Banana… ¿te corrieron ayer? Tengo trabajo para ti.'),
      say('cocardo', 'burlon', 'Aquí sucede la magia… Entren y véanlo de cerca.'),
      sfx('clac'),
      say('cocardo', 'carcajada', '¡Perfecto, ya están los 5!'),
      say('fresa', 'sorprendido', '¿Cinco? Si Lima y yo ya salimos… ¡Ese coco no sabe contar!'),
    ],
    pre15: [
      say('pina', 'normal', '¿Cómo van mis nuevos sabores?'),
      say('cocardo', 'nervioso', '¡De maravilla, Don Piña! Todo bien congeladito.'),
      say('durazna', 'asustado', 'Ayudante… se me congelan las pelusitas. ¡Sácame!', FROZEN),
      say('fresa', 'enojado', 'Durazna está en el congelador grande. ¡Vamos por ella!'),
    ],
    post15: [
      say('durazna', 'enojado', '¿Helado gratis de por vida? ¡Qué estafa!'),
      say('durazna', 'feliz', 'Gracias, ayudante. Cuenta conmigo.'),
      say('cocardo', 'llorando', '¡Mi congelador nuevo! ¡Ni lo había terminado de pagar!'),
    ],
    cliff15: [
      say('cereza', 'coqueta', 'Cocardo, lo del helado de cereza… quiero que lo hagas.'),
      say('cocardo', 'asustado', 'Cherry, no abra ese congelador.'),
      sfx('drama'),
      say('cereza', 'sorprendido', 'Mira, ahí está Banana… esto es hermoso.'),
      card(TBC),
    ],

    // ===== Capítulo 4 · Cherry conoce el negocio (Partes 6-7) =====
    pre16: [
      say('cereza', 'feliz', 'Cocardo, esto es fantástico, quiero trabajar contigo.'),
      say('cereza', 'coqueta', 'Tú haces el helado, yo te ayudo a convertir esto en un imperio.'),
      say('cocardo', 'nervioso', 'Con cuidado, chicas, no quiero que se me rompa el inventario.'),
      say('cereza', 'burlon', 'Y estas son mis cajas del inventario. Nadie las abre, ¿eh?'),
    ],
    pre17: [
      say('pina', 'sorprendido', '¿Y tú quién eres? ¿Cocardo te hizo socia?'),
      say('cereza', 'coqueta', 'No me hizo socia. Yo vi una oportunidad.'),
      say('cereza', 'burlon', 'Espere, queremos el triple de lo que ofreció.'),
      say('pina', 'feliz', 'Me agradas. Denos el triple.'),
      say('cocardo', 'sorprendido', '¿El triple? Voy a necesitar mucha más fruta…'),
    ],
    pre18: [
      say('banano', 'enojado', 'Otra vez no… esto me resulta demasiado familiar.'),
      say('banano', 'triste', 'Dónde estás, hermana. Voy a encontrarte.'),
      say('cocardo', 'feliz', '¿Le sirvo uno de plátano? Es sabor nuevo.'),
      say('banano', 'sorprendido', 'Demasiado familiar… Mi hermana también era banana.'),
    ],
    pre19: [
      say('naranja', 'feliz', 'Vecina, te traje panecitos calientitos.', { variant: 'panecitos' }),
      sfx('clac'),
      say('cereza', 'burlon', 'Buenas noches, naranjita.'),
      say('cocardo', 'furioso', '¿Qué hiciste?'),
      say('cereza', 'coqueta', 'Es insoportable, solo quise darle un uso… ¿funcionó, no?'),
      say('cocardo', 'enojado', 'Métela en el congelador viejo.'),
    ],
    post19: [
      say('naranja', 'feliz', '¡Gracias, ayudante! Te guardé un panecito… medio congelado.', { variant: 'panecitos' }),
      say('cereza', 'furioso', '¿¡Quién descongeló a mi vecina!?'),
    ],
    pre20: [
      say('cocardo', 'furioso', 'Alguien nos está descongelando el negocio, Cherry.'),
      say('cereza', 'burlon', 'Pues tú pon el congelador… y yo pongo las cajas.'),
      say('naranja', 'enojado', 'Ayudante, ¡son los dos a la vez! Rompe ese congelador.'),
    ],
    cliff20: [
      say('banano', 'sorprendido', 'El expediente de Cherry… esta mujer tiene mucho que esconder.'),
      sfx('trueno'),
      say('cocardo', 'asustado', '¡Se fue la luz!'),
      say('cocardo', 'nervioso', 'Si se descongelan, se acabó el negocio.'),
      card(TBC),
    ],

    // ===== Capítulo 5 · La fuga (Partes 8-10) =====
    pre21: [
      sfx('trueno'),
      say('cocardo', 'nervioso', 'Lima, fresa, durazno, banana… ¿dónde está Uva?'),
      say('cereza', 'burlon', 'Lima, Fresa y Durazna ya se te fueron hace rato, genio.'),
      say('uva', 'asustado', '¡Me descongelé con el apagón! ¡Tengo que salir de aquí!'),
    ],
    post21: [
      say('uva', 'asustado', 'Ayúdame, por favor… un hombre me encerró en un congelador.'),
      say('cereza', 'coqueta', 'Claro, mi amor. Ven conmigo.'),
      say('cereza', 'burlon', 'Aquí termina el paseo.'),
      say('uva', 'sorprendido', '¡Tú estás con él!'),
      say('cereza', 'burlon', 'Sí. Se acabó, Uva.'),
    ],
    pre22: [
      say('banano', 'enojado', 'Solo quiero respuestas.'),
      say('guardaespaldas', 'enojado', '…'),
      say('pina', 'burlon', 'Mientras cumplan con el pedido, no es asunto mío.'),
      say('banano', 'normal', 'Entonces juntaré pruebas: el periódico, el expediente… todo.'),
    ],
    pre23: [
      say('pina', 'enojado', 'Creí que eras un hombre de palabra.'),
      say('cocardo', 'nervioso', 'Una noche de retraso no va a destruir su imperio.'),
      say('pina', 'normal', 'No, pero los malos hábitos sí.'),
      say('cocardo', 'enojado', 'Yo tenía el control antes de que llegaras.'),
      say('cereza', 'burlon', 'No, Cocardo, tenías suerte.'),
    ],
    pre24: [
      say('banano', 'sorprendido', 'La grabación de la tienda… Uva… así que estabas ahí.'),
      say('limon', 'normal', 'El coco y la cereza tienen algo grande escondido en los congeladores.'),
      say('limon', 'burlon', 'Tiene que ver con su nieve.'),
      say('banano', 'enojado', 'Ya casi te tengo, Cocardo.'),
    ],
    pre25: [
      say('cereza', 'coqueta', 'Cocardo, necesitamos otra sucursal.'),
      say('cocardo', 'enojado', 'Más gente haciendo preguntas.'),
      say('cereza', 'burlon', 'Entonces estreno mi propio congelador. Rosita, como yo.'),
      say('banano', 'enojado', 'Ayudante, rompe el congelador de Cherry y bájame las pruebas.'),
    ],
    cliff25: [
      say('cereza', 'sorprendido', 'Ese auto… es de Banano, el hermano de Banana.'),
      say('cocardo', 'nervioso', 'Tenemos que hacer algo con Banano.'),
      sfx('drama'),
      card(TBC),
    ],

    // ===== Capítulo 6 · Se acabó el sabor (Partes 11-13) =====
    pre26: [
      say('banano', 'sorprendido', 'Esta pulsera se la regalé yo… Hermana, estuviste aquí.'),
      say('policia_fresa', 'enojado', 'Dime que no estás haciendo otra vez lo que creo que estás haciendo.'),
      say('banano', 'enojado', 'Mi hermana estuvo en esa heladería.'),
      say('policia_fresa', 'normal', 'Sin una orden no entro. Tráeme más pruebas.'),
    ],
    pre27: [
      say('cocardo', 'nervioso', 'Hay alguien en las cámaras… ¡es Banano!'),
      say('cereza', 'enojado', 'Deja de temblar y piensa.'),
      say('cereza', 'burlon', 'Más cajas, más inventario. Que no encuentre nada.'),
    ],
    pre28: [
      sfx('crash'),
      say('banano', 'furioso', 'Así que tú eres Cocardo… ¿Dónde está mi hermana?'),
      say('cocardo', 'burlon', 'Descuida, te vas a reunir con ella pronto…'),
      say('cocardo', 'carcajada', 'Me acabas de dar una gran idea: helado de plátano con chocolate.'),
    ],
    pre29: [
      say('cereza', 'nervioso', 'Sin luz se descongela todo. ¡Voy a regresar la corriente!'),
      sfx('plaf'),
      say('banano', 'burlon', 'Una menos.'),
      say('policia_sandia', 'sorprendido', '¿Cuántas unidades?'),
      say('policia_fresa', 'enojado', 'Todas las que estén cerca.'),
    ],
    pre30: [
      say('cocardo', 'furioso', 'Te llegó la hora… los años ya te están pesando.'),
      say('banano', 'enojado', 'Todavía sé pegar, pero cada vez más despacio.'),
      say('cereza', 'furioso', '¿Una menos? ¡Todavía no termino contigo!'),
      say('lima', 'enojado', 'Ayudante, ahora sí: ¡saca a Uva y a Banana!'),
    ],
    ending: [
      say('cocardo', 'asustado', 'Se están descongelando.'),
      say('durazna', 'enojado', '¡Aquí ya nadie se vuelve a congelar!', { variant: 'tubo' }),
      say('cocardo', 'sorprendido', 'Lima. Mi amor, eres tú.'),
      say('lima', 'enojado', 'Ya no más.'),
      sfx('sirena'),
      say('policia_sandia', 'normal', 'Ya pasó todo. Arrestamos al culpable.'),
      say('banano', 'enojado', 'El culpable son dos… Cherry.'),
      card('Esa noche, en las noticias…'),
      say('reportera', 'normal', 'Cocardo, dueño de la famosa heladería, fue arrestado esta noche…'),
      say('pina', 'furioso', '¡Idiota! Tenía un negocio que funcionaba y consiguió que lo arrestaran.'),
      say('pina', 'burlon', 'Cherry… interesante.'),
      say('cereza', 'coqueta', 'Un boleto de avión, por favor.', { variant: 'huida' }),
      say('banana', 'llorando', 'Pensé que no iba a volver a verte… Gracias por venir por mí.'),
      say('banano', 'feliz', 'Siempre iba a venir por ti.'),
      say('uva', 'feliz', 'Libre otra vez. Y esta vez, para siempre.'),
      say('fresa', 'triste', 'Nunca imaginé eso de Cocardo.'),
      say('lima', 'triste', 'A veces lo descubres demasiado tarde.'),
      say('lima', 'feliz', 'Gracias, ayudante. Sin ti seguiríamos en el congelador.'),
      say('cocardo', 'sorprendido', '¿Quién anda ahí?', { variant: 'carcel' }),
      card('FIN DE LA TEMPORADA 1'),
      card('¿Segunda temporada…?'),
    ],
  };

  function forLevel(id) {
    var out = {};
    if (scripts['pre' + id]) out.pre = 'pre' + id;
    if (scripts['post' + id]) out.post = 'post' + id;
    if (Number(id) === 30) out.cliff = 'ending';
    else if (scripts['cliff' + id]) out.cliff = 'cliff' + id;
    return out;
  }

  // Consejo de la intro de nivel, en voz de helperFor(id).
  var tips = {
    1: 'Desliza una fruta para juntar 3 iguales. ¡Así se llena la vitrina!',
    2: '¡Junta 4 en línea y sale una Paleta! Limpia toda su fila o columna.',
    3: 'Junta en forma de L o de T: ¡Bomba de Coco! Revienta todo a su alrededor.',
    4: 'Combina junto al hielo para romperlo. ¡Las Paletas lo atraviesan!',
    5: '¡5 en línea: Copa Arcoíris! Cámbiala por una fruta y se lleva todo ese sabor.',
    6: 'Psst… desde aquí lo veo todo: el hielo grueso necesita dos golpes.',
    7: 'Psst… junta los tres sabores del pedido. ¡El Cucharón rompe sin gastar jugada!',
    8: 'Psst… la fruta escarchada no se mueve, pero sí combina. ¡Júntala para soltarla!',
    9: 'Psst… Cocardo escarcha una fruta cada pocos turnos. ¡Mira su cuenta regresiva!',
    10: 'Combina junto al congelador para romperlo… ¡y junto a mi bloque para sacarme!',
    11: 'Mi Chorro de Lima limpia una fila entera. ¡Úsalo cuando te atores!',
    12: '¡Seis sabores! Cuesta más combinar: busca Paletas y Bombas.',
    13: 'Fresa está hasta abajo. Rompe el hielo de encima para llegar a ella.',
    14: 'Mi Batido revuelve todo el tablero. ¡Úsalo si no ves jugadas!',
    15: 'Rompe el congelador grande y el bloque de Durazna. ¡Su hielo aguanta varios golpes!',
    16: 'Las cajas de Cherry se rompen como el hielo: combina junto a ellas.',
    17: 'Cherry convierte fruta en cajas cada pocos turnos. ¡Que no se te junten!',
    18: 'Hielo arriba y abajo, cajas en medio. ¡Las Paletas ayudan!',
    19: 'Naranja está encerrada en hielo. Ábrete paso y pégale a su bloque hasta sacarla.',
    20: '¡Los dos villanos a la vez! Rompe el congelador y no olvides las cajas.',
    21: 'Baja a Uva hasta el fondo del tablero para que escape. ¡Rápido!',
    22: 'Baja cada prueba hasta el fondo. Una Paleta vertical la tira de golpe.',
    23: 'Tres capas de hielo. Empieza por arriba y que las cajas no te encierren.',
    24: 'Dos pruebas a la vez. Abre camino en sus columnas.',
    25: 'El congelador de Cherry escarcha fruta muy seguido. ¡Rómpelo rápido!',
    26: 'El hielo doble tapa el camino. Rómpelo y baja las pruebas.',
    27: 'Muchas cajas y una fila escarchada. Junta uvas con Paletas y Bombas.',
    28: 'Cocardo escarcha fruta cada pocos turnos. Rompe el hielo del centro y baja las pruebas.',
    29: 'Cajas arriba y abajo, hielo grueso en medio. ¡Ya casi lo tenemos!',
    30: 'Rompe el gran congelador y saca a Uva y a mi hermana. ¡Ahora o nunca!',
  };

  // Burlas de los villanos: start (inicio), low (quedan 5 movimientos), act (al congelar o encajonar),
  // win (el jugador gana: el villano llora), lose (el jugador pierde: carcajada).
  var taunts = {
    cocardo: {
      start: ['Mañana habrá un sabor nuevo.', '¡Pásele, pásele! Hoy hay sabor nuevo.', '¿Me estás ayudando o estorbando?', 'No está viejo, está experimentado.'],
      low: ['Habrá que raspar un poquito más.', '¡Se te derrite el tiempo, ayudante!', 'Uno por persona… y a ti ya no te quedan.'],
      act: ['Dale un golpecito… ¡y a congelar!', '¡Fresquito, fresquito!', 'Perdóname… solo un poquito.', 'Una fruta más para el menú.'],
      win: ['¡Mi sabor estrella!', '¿¡Quién me descongeló el menú!?'],
      lose: ['Te dije que se vendería. ¡Seremos ricos!', 'Mañana habrá un sabor nuevo.'],
    },
    cereza: {
      start: ['Te dije que valían el triple.', 'Yo vi una oportunidad, cariño.', '¿Y helado de coco cremosito? …Bromi.', 'Esto va a ser un imperio.'],
      low: ['Deja de temblar y piensa.', 'Aquí termina el paseo.', 'Tic, tac, ayudante.'],
      act: ['Con cuidado, que no se me rompa el inventario.', '¡Una cajita más!', 'Al inventario, mi amor.', 'Buenas noches, fresita.'],
      win: ['¿¡Mi inventario!?', 'Esto no se queda así, cariño.'],
      lose: ['Se acabó, ayudante.', 'Te dije que valían el triple.'],
    },
  };

  // Burbuja de la víctima al salir de su bloque de hielo en el tablero.
  var rescueLines = {
    lima: '¡Libre! Ya no más congelador.',
    fresa: '¡Prima, ya voy! ¡Ya no soy sabor de fresa!',
    durazna: '¿Helado gratis? ¡Mejor libertad gratis!',
    naranja: '¡Libre! ¿Alguien quiere panecitos?',
    uva: '¡Libre otra vez! Y esta vez, para siempre.',
    banana: '¡Libre! ¿Dónde está mi hermano?',
  };

  var cascadeText = ['', '', '¡Rico!', '¡Delicioso!', '¡Escandaloso!', '¡DRAMÁTICO!', '¡¡TELENOVELA!!'];

  // Álbum: 16 cartas. unlock 'level' = se desbloquea al ganar ese nivel (justo antes de la escena que
  // presenta al personaje); 'rescue' = al rescatar a ese personaje; 'start' = desde el principio.
  var album = [
    { id: 'cocardo', name: 'Cocardo', role: "Dueño de Coco's Scoops. Congela frutas y las vende como helado.", quote: 'No está viejo, está experimentado.', unlock: { type: 'start' } },
    { id: 'lima', name: 'Lima', role: 'Novia y socia de Cocardo. La primera en quedar atrapada en el congelador.', quote: 'Cocardo, hoy vendemos menos de lo que cuesta prender las luces.', unlock: { type: 'rescue', who: 'lima' } },
    { id: 'cereza', name: 'Cherry', role: 'Clienta que descubre el secreto y se vuelve socia. Llena todo de cajas.', quote: 'Tú haces el helado, yo te ayudo a convertir esto en un imperio.', unlock: { type: 'level', level: 15 } },
    { id: 'pina', name: 'Don Piña', role: 'Empresario millonario. Su pedido de cinco sabores lo empezó todo.', quote: 'Necesito 500 litros para empezar… 500 por sabor. Consígueme 5 y tenemos un trato.', unlock: { type: 'level', level: 6 } },
    { id: 'banano', name: 'Banano', role: 'Investigador. Busca a su hermana Banana y reúne las pruebas.', quote: 'Así que tú eres Cocardo… ¿Dónde está mi hermana?', unlock: { type: 'level', level: 17 } },
    { id: 'banana', name: 'Banana', role: 'Hermana de Banano. Cocardo la atrajo con una oferta de trabajo.', quote: 'Pensé que no iba a volver a verte… Gracias por venir por mí.', unlock: { type: 'rescue', who: 'banana' } },
    { id: 'fresa', name: 'Fresa', role: 'Prima de Lima. Fue a buscarla y terminó como «el nuevo sabor de fresa».', quote: 'Vine a ver a mi prima Lima, no me responde desde ayer.', unlock: { type: 'rescue', who: 'fresa' } },
    { id: 'durazna', name: 'Durazna', role: 'Clienta fiel. Le prometieron helado gratis de por vida.', quote: '¿Helado gratis de por vida?', unlock: { type: 'rescue', who: 'durazna' } },
    { id: 'uva', name: 'Uva', role: 'Nueva en la ciudad. Escapó en el apagón… y Cherry la regresó.', quote: 'Un hombre me encerró en un congelador.', unlock: { type: 'rescue', who: 'uva' } },
    { id: 'naranja', name: 'Naranja', role: 'Vecina de Cherry. Le llevó panecitos y salió congelada.', quote: 'Vecina, te traje panecitos calientitos.', unlock: { type: 'rescue', who: 'naranja' } },
    { id: 'limon', name: 'Limón', role: 'Vive en el callejón de atrás. Se asoma con pistas.', quote: 'El coco y la cereza tienen algo grande escondido en los congeladores.', unlock: { type: 'level', level: 1 } },
    { id: 'policia_fresa', name: 'La oficial', role: 'Contacto de Banano en la policía. Todo con orden… hasta que no.', quote: 'Dime que no estás haciendo otra vez lo que creo que estás haciendo.', unlock: { type: 'level', level: 25 } },
    { id: 'policia_sandia', name: 'El oficial Sandía', role: 'Esposa a Cocardo y vigila su celda.', quote: 'Ya pasó todo. Arrestamos al culpable.', unlock: { type: 'level', level: 30 } },
    { id: 'guardaespaldas', name: 'El guardaespaldas', role: 'Siempre junto a Don Piña. Nunca dice nada.', quote: '…', unlock: { type: 'level', level: 6 } },
    { id: 'brocoli', name: 'El repartidor', role: 'Entregó el congelador grande e hizo la pregunta correcta.', quote: 'Oiga, sí está grande, ¿para qué quiere tanto espacio?', unlock: { type: 'level', level: 10 } },
    { id: 'reportera', name: 'La reportera', role: 'Da la noticia del arresto en la tele.', quote: 'Cocardo, dueño de la famosa heladería, fue arrestado esta noche.', unlock: { type: 'level', level: 30 } },
  ];

  function nameOf(id) {
    for (var i = 0; i < album.length; i++) if (album[i].id === id) return album[i].name;
    return String(id);
  }

  function lvl(id) { var n = Number(id); return Number.isInteger(n) && n >= 1 && n <= 30 ? n : 1; }

  // Villano principal del HUD (burlas). El HUD además muestra a todos los de level.villains/level.freezer.
  var VILLAIN = [null,
    'cocardo', 'cocardo', 'cocardo', 'cocardo', 'cocardo', // 1-5
    'cocardo', 'cocardo', 'cocardo', 'cocardo', 'cocardo', // 6-10
    'cocardo', 'cocardo', 'cocardo', 'cocardo', 'cocardo', // 11-15
    'cereza', 'cereza', 'cereza', 'cocardo', 'cocardo', // 16-20: cajas de Cherry; Naranja va al congelador viejo
    'cereza', 'cereza', 'cereza', 'cereza', 'cereza', // 21-25: el congelador de Cherry
    'cereza', 'cereza', 'cocardo', 'cereza', 'cocardo', // 26-30: final con el gran congelador de Cocardo
  ];
  function villainFor(id) { return VILLAIN[lvl(id)]; }

  // Quién da el consejo: Lima (aún congelada en 6-10), luego las rescatadas, y Banano desde el capítulo 5.
  function helperFor(id) {
    var n = lvl(id);
    if (n <= 13) return 'lima';
    if (n <= 15) return 'fresa';
    if (n <= 17) return 'durazna';
    if (n <= 19) return 'fresa';
    if (n === 20) return 'naranja';
    return 'banano';
  }

  // Lima da los consejos de los niveles 6 a 10 desde el congelador viejo (la congelan en cliff5 y la
  // rescatas en el nivel 10): su retrato del consejo va congelado.
  function helperFrozen(id) { var n = lvl(id); return helperFor(n) === 'lima' && n >= 6 && n <= 10; }

  // La cabeza que se asoma con la pista: Limón (capítulos 1-4) y Banano (5-6).
  function hintPeeker(id) { return lvl(id) <= 20 ? 'limon' : 'banano'; }

  var chapterTitles = ['Parte 1', 'Partes 2 y 3', 'Partes 4 y 5', 'Partes 6 y 7', 'Partes 8 a 10', 'Partes 11 a 13'];

  var Story = {
    scripts: scripts,
    forLevel: forLevel,
    tips: tips,
    taunts: taunts,
    rescueLines: rescueLines,
    cascadeText: cascadeText,
    album: album,
    villainFor: villainFor,
    helperFor: helperFor,
    helperFrozen: helperFrozen,
    hintPeeker: hintPeeker,
    chapterTitles: chapterTitles,
    effects: effects,
    nameOf: nameOf,
  };

  Cocardo.Story = Story;
  if (typeof module !== 'undefined' && module.exports) module.exports = Story;
})();
