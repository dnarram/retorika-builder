# La Fase 1, lo que prometió y lo que hay

> **De dónde viene esto.** David, al planificar el sprint 17: «quiere el material preparado para el
> ADR de aceptación de la fase 1, que escribe él». El protocolo lo exige desde el ADR 0031:
>
> > **Criterio de aceptación (enmendado el 2 de octubre de 2026, ADR 0031):** David juzga que la
> > Fase 1 está lista, y lo escribe — en un ADR, con su fecha y su razón. **Hasta que ese ADR
> > exista, la Fase 1 no está aceptada.**
>
> El ADR más alto que existe es el 0037. Ese ADR no existe, y el proyecto lleva sprints trabajando
> en fases 2 y 3.

**Esto no juzga nada, y es la mitad del encargo.** Aquí hay medidas, sitios donde mirar y huecos con
su fuente. No hay ni una frase que diga si la Fase 1 está lista: eso es lo que tú escribes, y si este
documento lo insinuara te estaría quitando la decisión mientras finge dártela. Donde hace falta
elegir, hay una pregunta al final y no una respuesta.

Todo lo de abajo está medido o leído el **11 de octubre de 2026**, sprint 17 día 6.

---

## 1. Qué prometió la Fase 1, literal

`docs/protocolo.md`, parte «Fase 1 — Lo imprescindible»:

> Cuestionario de cinco preguntas, generación de las tres variantes, catálogo de secciones, edición
> sobre el propio texto, reordenar, duplicar, borrar, guardado automático y deshacer.

Nueve cosas. Ni una palabra más.

---

## 2. Las nueve, una por una

Cada fila dice **qué existe**, **dónde** y **qué lo demuestra**. La última columna es el nombre del
fichero de pruebas o de la caminata, para que puedas abrir cualquiera sin buscarlo.

| | Lo prometido | Dónde está | Qué lo demuestra |
|---|---|---|---|
| 1 | Cuestionario de cinco preguntas | `apps/editor/src/questionnaire/steps/Step1Name.tsx` … `Step5Action.tsx`, orquestadas por `Questionnaire.tsx` | Cinco ficheros, uno por pregunta. **59 sitios del `e2e` abren el cuestionario**, de los cuales 50 escriben la primera respuesta en el sitio y 35 lo recorren a través de un ayudante (`intoTheCanvas`, `intoTheEditor`). Los tres números no coinciden y se dan los tres: contar por lo que una caminata **menciona** no es contarla por lo que **hace**, que es un error que este repositorio ya cometió una vez contando esperas de foto |
| 2 | Generación de las tres variantes | `packages/generator/src/index.ts`, `generateVariants` | `packages/generator/test/generate.test.ts`: tres tarjetas, tres composiciones distintas, y desde el 10 de octubre **tres fotografías distintas** (ADR 0036) |
| 3 | Catálogo de secciones | `packages/catalog/src/presets.ts` | **10 secciones y 21 composiciones**, contadas hoy: portada 3, servicios 3, ubicación 2, opiniones 2, precios 2, galería 2, equipo 2, contacto 2, pie 2, avance 1 |
| 4 | Edición sobre el propio texto | `wireEditing` en `Editor.tsx`, sobre `contenteditable` dentro del iframe | `apps/editor/src/editor/textEdits.test.ts` para las decisiones, y caminatas del `e2e` que escriben dentro del marco — incluida una que escribe **antes de que el marco acabe de cargar** |
| 5 | Reordenar | `moveSection` en `packages/schema/src/sections.ts` | `packages/schema/test/sections.test.ts`, `apps/editor/test/documentHistory.test.ts`, y desde el 10 de octubre con el teclado (`e2e`, «mueve una sección dos veces») |
| 6 | Duplicar | `duplicateSection`, mismo fichero | `sections.test.ts` y la caminata «duplica, convierte en página y borra» |
| 7 | Borrar | `deleteSection`, mismo fichero | `sections.test.ts`, `destinations.test.ts` y la caminata «deja un hueco discontinuo donde estaba la sección borrada» |
| 8 | Guardado automático | `apps/editor/src/editor/autosave.ts` | `apps/editor/test/autosave.test.ts`, y el indicador «Guardado en este navegador» que varias caminatas esperan como señal de que un cambio llegó |
| 9 | Deshacer | `apps/editor/src/editor/documentHistory.ts` y `shortcuts.ts` | `documentHistory.test.ts`, `shortcuts.test.ts`, y las caminatas «deshace y rehace desde el teclado» y «quita un texto de la página al vaciarlo, y deshacer lo devuelve» |

**Las nueve tienen código y tienen prueba.** Eso es lo que dice esta tabla y es todo lo que dice.

### Un matiz del punto 9 que conviene que esté delante

El atajo de teclado de «deshacer» **no funcionaba** cuando siete sitios del repositorio decían que
sí. Se midió en el sprint 9 día 1: `Meta+Z`, `Control+Z` y `Meta+Shift+Z` no hacían nada contra un
cambio real, mientras el botón «Deshacer» lo deshacía correctamente. El backlog planteó la elección
—escribir el atajo o corregir las siete afirmaciones— y elegiste escribirlo. Está en
`shortcuts.ts` con su regla: dentro de una caja de texto la pulsación es del navegador, porque ahí
`Meta+Z` deshace las letras que se están escribiendo.

Lo cuento porque es el único de los nueve puntos donde el registro llegó a afirmar algo que no era
cierto, y porque la corrección es tuya y tiene fecha.

---

## 3. Qué se midió contra el criterio viejo

El criterio anterior al ADR 0031 decía: «una persona de fuera del equipo, sin explicación previa y
sin ayuda, monta la web de un negocio real en menos de diez minutos. Se cronometra y se observa, no
se pregunta.» **El ADR 0031 lo anuló.** Las medidas se quedan porque son el registro de lo que se
hizo, no porque rijan.

| Sesión | Hasta el final del cuestionario | Hasta el ZIP |
|---|---|---|
| Conchi, 27 de septiembre de 2026 | 2 minutos | **8 minutos** |
| Un taller, 30 de septiembre de 2026 | 1 minuto 30 | **6 minutos** |

Actas: `docs/sessions/2026-09-27-conchi.md` y `docs/sessions/2026-09-30-taller.md`.

Tres cosas que el backlog deja dichas sobre esas medidas, y que no cambian porque el criterio ya no
las use:

- **Hay dos cronometrajes y una sola sesión con evidencia de uso sin ayuda.** El acta de Conchi lo
  recoge («El cliente no hizo preguntas y usó correctamente la app»); la del taller no dice nada al
  respecto.
- **La mesa de observación está en blanco en las tres sesiones.** El criterio pedía «se cronometra
  **y se observa**».
- **Las tres personas dijeron que no publicarían el resultado tal cual**, cada una por motivos
  distintos, y está en sus actas. Eso es la puerta del ADR 0021 sobre el cobro, no la de la Fase 1.

---

## 4. Los huecos, con su fuente

Lo que el propio registro dice que falta o está sin resolver, **ordenado por si toca a la Fase 1 o
no**. La columna de la derecha dice dónde está escrito, para que puedas comprobar cualquiera.

### Toca a la Fase 1

| Hueco | Qué se sabe | Fuente |
|---|---|---|
| **La exención del banco de fotos caduca el 1 de noviembre de 2026** | Las nueve fotografías aprobadas de `restaurante-bar` miden 1024 px y el suelo del ADR 0035 son 1344 × 896. La exención está en el esquema con su fecha, y `bank.test.ts` la lee dentro del `pnpm test` normal: **desde ese día cualquier PR sale en rojo** hasta que se regeneren a 1600 × 1072. Es producción de contenido tuya, y el circuito es el del ADR 0011 | ADR 0035, `packages/photobank/src/schema.ts` |
| **Un intermitente del `e2e` sigue abierto** | «selects a section clicked before the frame has finished loading» falla de vez en cuando. El mecanismo que el backlog propuso quedó **falsado** con medición el 9 de octubre: el documento que recibe el clic ya está cableado a 0, 300 y 800 ms de retraso de la foto. El 11 de octubre volvió a fallar en una ejecución completa limpia, y pasó cuatro de cuatro en aislamiento. La dirección de las tasas se ha invertido respecto a la medición del día 6 | `docs/tasks/backlog.md`, sección del intermitente |
| **Dos cosas que una sesión pidió y no están planificadas** | Formato dentro de un texto (negritas en medio de una frase) necesitaría cambiar el esquema y su propio ADR. Mover imágenes libremente **choca de frente con la regla 4** del modelo de documento | nota de la Fase 1 en `docs/protocolo.md` |

### No toca a la Fase 1, y está aquí para que no tengas que volver a deducirlo

| Qué | Dónde queda |
|---|---|
| Color, varias páginas navegables, publicar, SEO, fotos | Fase 2 por el protocolo. Todo construido salvo el cobro |
| El cobro | Bloqueado por el ADR 0021, que espera un producto «profesionalmente vendible», más seis preguntas de facturación sin responder y tres documentos legales que no existen |
| Un formulario de contacto | Fuera de la Fase 1 por el ADR 0020, que aceptó el alcance del ADR 0016 |
| Las copias de seguridad de la base de datos | `docs/tasks/copias.md`, propuesta sin ejecutar esperando tu aprobación |
| El arranque en frío y si la landing va aparte | `docs/tasks/arranque-en-frio.md`, con las dos medidas que necesitan el despliegue |
| El recorrido de la cuenta, dieciséis pasos | `docs/tasks/el-recorrido-de-la-cuenta.md`, necesita un proyecto real e incluye el acceso con Google, que desarrollo no pudo verificar |

---

## 5. El estado de la verificación, en números

Lo que hay hoy alrededor de las nueve cosas, contado y no estimado:

| | |
|---|---|
| Pruebas unitarias | **2.438** en 115 ficheros |
| Caminatas del `e2e` contra la aplicación real | **136** bloques |
| Corpus golden (HTML publicado, byte a byte) | **17** páginas |
| Suite de accesibilidad sobre páginas publicadas | **511** comprobaciones |
| ADR escritos | **37** |
| Puertas que corren en cada PR | `typecheck`, `lint`, `test`, `test:invariants`, `test:golden`, `size`, `schema:guard`, `renderer:deps`, `secrets:scope`, `build:editor`, `e2e`, `test:a11y` |

Dos cosas sobre esos números que son hallazgos y no adornos:

- **`test:a11y` no cubría el editor.** Su raíz es `packages/renderer`, así que las 511
  comprobaciones son sobre **páginas publicadas**. El cromo con el que se edita se escaneó por
  primera vez el 10 de octubre de 2026 (sprint 17 día 3): 39 comprobaciones, cero violaciones serias
  o críticas, y dos cosas por debajo de ese umbral anotadas con su selector en el backlog.
- **El corpus golden no ejercitaba el `aria-current` del menú.** Cada documento se renderiza en su
  página de inicio y el menú omite la entrada de la página en la que estás, así que el atributo no
  aparecía en ninguno de los 17. Encontrado el 10 de octubre al escribir la guarda del renderer, que
  ahora sí lo ejercita.

---

## 6. Lo que tienes que decidir

Preguntas, no respuestas. Cada una con lo que haría falta para contestarla.

1. **¿Está la Fase 1 lista?** El ADR 0031 dice que es tu juicio escrito, con su fecha y su razón. Lo
   que hay delante es la tabla del punto 2 (las nueve con código y prueba) y la del punto 4 (tres
   huecos que la tocan).
2. **¿La exención del banco es un hueco de la Fase 1 o una tarea aparte con fecha?** Si es lo
   primero, la aceptación espera a que las nueve fotografías se regeneren. Si es lo segundo, el ADR
   puede decirlo y la fecha del 1 de noviembre sigue siendo una tarea tuya.
3. **¿El intermitente del `e2e` bloquea una aceptación?** No está resuelto y nadie sabe aún si es
   «una máquina más lenta ensancha otra ventana» o «el estado de otra caminata se filtra». El
   siguiente paso escrito es instrumentar la caminata **dentro** de una ejecución completa.
4. **¿Las dos cosas que una sesión pidió y no están planificadas quedan fuera por escrito?** El
   formato dentro de un texto necesita un ADR propio; mover imágenes libremente choca con la regla
   4, así que decidirlo sería enmendar el modelo de documento.
5. **¿El ADR de aceptación dice algo sobre las sesiones?** El ADR 0031 las anuló y dejó escrito lo
   que se pierde con ellas: la mesa de observación, el precio, el «¿publicarías esto tal y como
   está?» y lo que hay detrás del interruptor. Si la aceptación no lo menciona, esa lista se queda
   solo en el 0031.

---

## 7. Lo que este documento no hace

- **No dice si la Fase 1 está lista.** Ni lo insinúa. Si al leerlo te parece que lo insinúa, es un
  defecto de este fichero y hay que corregirlo.
- **No propone un número de ADR.** Sería el 0038 por orden, y eso es aritmética, no una decisión.
- **No cuenta como aceptación.** Un fichero en `docs/tasks/` no acepta nada: el protocolo pide un
  ADR con tu firma, y desarrollo no firma.
