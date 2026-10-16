// Nivel 4, semilla 2465: la mejor apertura entre 472.206 probadas (tools/video/plan.cjs cascadas): 18 cascadas
// rompen 15 de 16 hielos. Dos jugadas después se gana con 19 movimientos de sobra: ¡Helado Final!
module.exports = {
  semilla: 2465,
  async correr(T) {
    await T.pausar();
    await T.ir(4, 2465);
    await T.seguir();
    await T.esperar(1.0);
    await T.deslizar({ r: 7, c: 2 }, { r: 7, c: 3 }, { antes: 0.35, dur: 0.2 });
    await T.paso();
    await T.quieto(40);
    T.marca('fin-cascada');
    await T.esperar(0.6);
    await T.jugar({ r: 4, c: 5 }, { r: 5, c: 5 }, { antes: 0.25 });
    T.marca('jugada2-fin');
    await T.esperar(0.3);
    await T.deslizar({ r: 6, c: 6 }, { r: 7, c: 6 }, { antes: 0.25 });
    await T.paso();
    await T.quieto(40);
    T.marca('ganado');
    await T.hasta(() => Cocardo.debug.screen() === 'victory', 40);
    T.marca('victoria');
    await T.esperar(3.0);
  },
};
