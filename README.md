# FreeDraw

Pizarra en español para dibujar a mano alzada, crear diagramas y preparar sesiones de trabajo. El primer tablero incluye un mapa de producto que puedes editar. Desde el menú del nombre puedes crear uno en blanco o volver a otro tablero.

## Abrir la aplicación

En GitHub, elige **Code → Download ZIP**, extrae la carpeta completa y abre **index.html** en un navegador moderno. No requiere instalación, servidor ni conexión a internet. También puedes servir la carpeta desde cualquier servidor web estático.

## Dibujar y editar

- Elige el lápiz para dibujar o arrastra con una herramienta de forma para crear rectángulos, elipses, rombos, líneas y flechas.
- Para conectar dos figuras, empieza y termina la flecha cerca de sus bordes. Los extremos siguen a las figuras cuando las mueves o cambias su tamaño.
- Agrega texto y notas adhesivas. Haz doble clic en un elemento de texto o una figura para editar su contenido. Pulsa **Enter** para terminar y **Shift + Enter** para insertar un salto de línea.
- Arrastra con la herramienta de selección para marcar varios objetos. Desde **Estilo** puedes cambiar colores y grosor, duplicar elementos o ajustar su orden.
- Abre **Biblioteca** para crear un tablero a partir de un mapa de producto, una retrospectiva o un mapa mental. Cada plantilla se abre en un tablero independiente.

## Guardar y compartir

Los tableros se guardan en el almacenamiento local del navegador. Si utilizas otro equipo, cambias de navegador o borras sus datos, abre una copia del archivo editable para recuperar tu trabajo. En sesiones privadas y al abrir archivos locales, la disponibilidad del guardado depende del navegador.

En **Exportar**, selecciona **Tablero editable** para descargar un archivo `.freedraw.json`, **Imagen PNG** para pegar el dibujo en una presentación o **Vector SVG** para imprimirlo o ampliarlo. Para volver a editar un archivo, arrástralo al lienzo o usa **Abrir archivo** en el menú del tablero.

FreeDraw también importa formas básicas, texto, flechas y trazos de archivos `.excalidraw`. La aplicación avisa cuando omite o simplifica elementos del archivo de origen. Los tableros se editan de manera individual en cada navegador.

## Atajos frecuentes

| Acción | Atajo |
| --- | --- |
| Seleccionar / mover la vista | V / H |
| Rectángulo / elipse / rombo | R / O / D |
| Flecha / línea / lápiz | A / L / P |
| Texto / nota / borrador | T / N / E |
| Desplazar temporalmente el lienzo | Espacio + arrastrar |
| Acercar o alejar | + / −, o Ctrl / ⌘ + rueda |
| Encuadrar el dibujo completo | Shift + 1 |
| Deshacer / rehacer | Ctrl / ⌘ + Z / Ctrl / ⌘ + Shift + Z |
| Copiar / cortar / pegar | Ctrl / ⌘ + C, X o V |
| Duplicar la selección | Ctrl / ⌘ + D |
| Seleccionar todo | Ctrl / ⌘ + A |
| Eliminar la selección | Supr |
| Mover la selección 1 px / 10 px | Flechas / Shift + flechas |
| Mantener la proporción de la figura o trazar líneas y flechas en ángulos de 45° | Shift + arrastrar |
| Descargar el archivo editable / abrir archivo | Ctrl / ⌘ + S / Ctrl / ⌘ + O |

## Código

La interfaz está en `index.html` y `app/styles.css`. `app/editor.js` gestiona interacciones e historial, `app/scene.js` dibuja los elementos SVG y crea las plantillas, `app/files.js` importa y exporta archivos y `app/main.js` conecta la interfaz con los tableros locales.
