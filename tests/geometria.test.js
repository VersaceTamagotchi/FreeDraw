const test = require("node:test");
const assert = require("node:assert/strict");
const { bounds, wrapLines } = require("../app/scene.js");
const { perimeterPoint, setPath, snapEndpoint } = require("../app/editor.js");

test("bounds normaliza las dimensiones negativas de una figura", () => {
  assert.deepEqual(bounds({ type: "rect", x: 30, y: 40, w: -22, h: -10 }), { x: 8, y: 30, w: 22, h: 10 });
});

test("bounds calcula los extremos del trazo en coordenadas del lienzo", () => {
  for (const type of ["arrow", "line", "pen"]) {
    assert.deepEqual(bounds({ type, x: -10, y: 100, points: [[2, 5], [-4, 9], [8, -3]] }),
      { x: -14, y: 97, w: 12, h: 12 });
    assert.deepEqual(bounds({ type, x: 0, y: 2, w: -5, h: 6 }), { x: -5, y: 2, w: 5, h: 6 });
  }
});

test("setPath conserva el orden de los puntos y traslada el origen al mínimo", () => {
  const trazo = { id: "trazo", type: "pen", stroke: "blue" };
  const puntos = [{ x: 7, y: 9 }, { x: -2, y: 3 }, { x: 12, y: -4 }];
  assert.deepEqual(setPath(trazo, puntos), { ...trazo, x: -2, y: -4, w: 14, h: 13,
    points: [[9, 13], [0, 7], [14, 0]] });
  assert.equal(trazo.points, undefined);
  assert.deepEqual(setPath(trazo, [puntos[0]]), { ...trazo, x: 7, y: 9, w: 0, h: 0, points: [[0, 0]] });
});

test("perimeterPoint proyecta sobre los lados del rectángulo, rombo y elipse", () => {
  const forma = { x: 0, y: 0, w: 100, h: 100 };
  assert.deepEqual(perimeterPoint({ ...forma, type: "rect" }, { x: 104, y: 21 }), { x: 100, y: 21 });
  assert.deepEqual(perimeterPoint({ ...forma, type: "diamond" }, { x: 80, y: 20 }), { x: 75, y: 25 });
  const punto = perimeterPoint({ ...forma, type: "ellipse", h: 40 }, { x: 0, y: 0 });
  assert.ok(Math.abs(punto.x - (50 - 50 / Math.sqrt(2))) < 1e-9);
  assert.ok(Math.abs(punto.y - (20 - 20 / Math.sqrt(2))) < 1e-9);
});

test("snapEndpoint une al borde de la figura superior y deja fijo el extremo opuesto", () => {
  const forma = { id: "superior", type: "rect", x: 30, y: 10, w: 40, h: 40 };
  const flecha = { id: "flecha", type: "arrow", x: 0, y: 0, w: 20, h: 30, points: [[0, 0], [20, 30]] };
  const objetos = [{ ...forma, id: "inferior" }, forma, { ...forma, id: "texto", type: "text" }];
  const unida = snapEndpoint(flecha, "endBinding", { x: 26, y: 30 }, objetos, 1);
  assert.deepEqual(unida.endBinding, { id: "superior", u: 0, v: 0.5 });
  assert.deepEqual(unida.points, [[0, 0], [30, 30]]);
  assert.equal(flecha.endBinding, undefined);

  const libre = snapEndpoint(unida, "endBinding", { x: 26, y: 30 }, objetos, 4);
  assert.equal(libre.endBinding, undefined);
  assert.deepEqual(libre.points, [[0, 0], [26, 30]]);
});

test("snapEndpoint mueve también el extremo inicial sin desplazar el final", () => {
  const forma = { id: "nota", type: "note", x: 0, y: 0, w: 40, h: 50 };
  const flecha = { type: "arrow", x: 35, y: 25, w: 45, h: 5, points: [[0, 0], [45, 5]] };
  const unida = snapEndpoint(flecha, "startBinding", { x: 44, y: 25 }, [forma], 1);
  assert.deepEqual(unida.startBinding, { id: "nota", u: 1, v: 0.5 });
  assert.deepEqual([unida.x, unida.y, unida.w, unida.h], [40, 25, 40, 5]);
  assert.deepEqual(unida.points, [[0, 0], [40, 5]]);
});

test("wrapLines conserva las líneas vacías y ajusta las palabras al ancho disponible", () => {
  assert.deepEqual(wrapLines("sol mar\n\nluz", 24, 10), ["sol", "mar", "", "luz"]);
  assert.deepEqual(wrapLines("sol mar\n\nluz", 100, 10), ["sol mar", "", "luz"]);
  assert.deepEqual(wrapLines("", 100, 10), [""]);
});

test("wrapLines divide las palabras anchas sin perder letras ni partir un emoji", () => {
  const palabra = "zorro😀azul";
  const renglones = wrapLines(palabra, 14, 10);
  assert.ok(renglones.length > 1);
  assert.equal(renglones.join(""), palabra);
  assert.ok(renglones.some(linea => linea.includes("😀")));
  assert.ok(renglones.every(linea => linea.length <= 2));
});
