const test = require("node:test");
const assert = require("node:assert/strict");
const { parseBoard, readFile } = require("../app/files.js");

const marco = { id: "marco", type: "rect", x: -20, y: 10, w: 80, h: 60 };
const flecha = { id: "flecha", type: "arrow", x: 10, y: 20, w: 40, h: 5, points: [[0, 0], [40, 5]] };

test("la importación nativa conserva coordenadas, estilos y texto multilínea", () => {
  const nota = { ...marco, type: "note", fill: "#ffeeba", text: "Día 1\nDía 2",
    fontSize: 18, align: "middle", dash: "dashed", width: 3, opacity: 0.5 };
  const tablero = parseBoard({ format: "freedraw", version: 1, title: "  Plan  ", elements: [nota] });
  assert.deepEqual(tablero, { title: "Plan", elements: [nota], warnings: [] });
});

test("al normalizar asigna identificadores únicos y enlaza con el identificador reparado", () => {
  const origen = { ...marco, id: "con espacios", stroke: 42, propiedadDesconocida: 123 };
  const conexion = { ...flecha, startBinding: { id: origen.id, u: 1, v: 0.5, gap: 4 },
    endBinding: { id: "ausente", u: 0, v: 1 } };
  const { elements, warnings } = parseBoard({ elements: [origen, conexion, { ...flecha }] });
  const [figura, primera, segunda] = elements;
  assert.notEqual(figura.id, origen.id);
  assert.equal(new Set(elements.map(elemento => elemento.id)).size, 3);
  assert.equal(primera.id, flecha.id);
  assert.notEqual(segunda.id, primera.id);
  assert.equal(figura.stroke, undefined);
  assert.equal(figura.propiedadDesconocida, undefined);
  assert.deepEqual(primera.startBinding, { id: figura.id, u: 1, v: 0.5, gap: 4 });
  assert.equal(primera.endBinding, undefined);
  assert.match(warnings.join(" "), /destino/);
  assert.equal(origen.id, "con espacios");
});

test("rechaza formatos, medidas, puntos y objetos que no se pueden importar", () => {
  assert.throws(() => parseBoard({}), /lista de elementos/);
  assert.throws(() => parseBoard({ format: "freedraw", version: 2, elements: [] }), /no es compatible/);
  assert.throws(() => parseBoard({ elements: [{ ...marco, type: "desconocido" }] }), /elemento desconocido/);
  assert.throws(() => parseBoard({ elements: [{ ...marco, w: Infinity }] }), /medida/);
  assert.throws(() => parseBoard({ elements: [{ ...flecha, points: [[15]] }] }), /punto inválido/);
  assert.throws(() => parseBoard({ elements: [marco, { ...flecha, endBinding: { id: marco.id, u: 2, v: 1 } }] }), /medida/);
});

test("readFile reconoce documentos antiguos sin cabecera y usa el nombre del archivo", async () => {
  const file = new Blob(["\uFEFF", JSON.stringify({ elements: [marco] })]);
  file.name = "Mi boceto.freedraw.json";
  assert.deepEqual(await readFile(file), { title: "Mi boceto", elements: [marco], warnings: [] });
  await assert.rejects(readFile(new Blob(["json incompleto"])), /JSON válido/);
});

test("convierte trazos Excalidraw con puntos negativos, estilo y opacidad", () => {
  const trazo = { id: "boceto", type: "freedraw", x: 100, y: 70, width: 12, height: 9,
    points: [[0, 0], [-8, 5], [4, -4]], opacity: 75, strokeStyle: "dotted", strokeWidth: 2 };
  const { title, elements, warnings } = parseBoard({
    type: "excalidraw", appState: { name: "Ideas" }, elements: [trazo]
  });
  assert.equal(title, "Ideas");
  assert.deepEqual(elements, [{ id: "boceto", type: "pen", x: 92, y: 66, w: 12, h: 9,
    points: [[8, 4], [0, 9], [12, 0]], width: 2, opacity: 0.75, dash: "dashed" }]);
  assert.deepEqual(warnings, []);
  assert.deepEqual(trazo.points, [[0, 0], [-8, 5], [4, -4]]);
});

test("importa texto Excalidraw y avisa de simplificaciones y tipos omitidos", () => {
  const texto = { id: "texto", type: "text", x: 9, y: 8, width: 100, height: 20,
    originalText: "Etapa 1", textAlign: "right", fontSize: 18, groupIds: ["g"] };
  const datos = { type: "excalidraw/clipboard", elements: [
    texto, { type: "image" }, { type: "rectangle", isDeleted: true }
  ] };
  const { elements, warnings } = parseBoard(datos);
  assert.deepEqual(elements, [{ id: "texto", type: "text", x: 9, y: 8, w: 100, h: 20,
    text: "Etapa 1", align: "end", fontSize: 18 }]);
  assert.match(warnings.join(" "), /omitidos: 1/);
  assert.match(warnings.join(" "), /independientes/);
  assert.throws(() => parseBoard({ type: "excalidraw", elements: [{ type: "image" }] }), /no puede importar/);
});
