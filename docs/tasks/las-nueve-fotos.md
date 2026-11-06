# Las nueve fotos de `restaurante-bar`, una a una

> **Para David, porque generar y mirar las fotos es tuyo.** Las nueve aprobadas el 8 de octubre de
> 2026 están por debajo del suelo de 1344 × 896 (ADR 0035): ocho a 1024 × 1024 y la `.07` a 866 × 942.
> Siguen publicadas gracias a una exención por id que **falla desde el 1 de diciembre de 2026**: ese día
> `packages/photobank/test/bank.test.ts` se pone rojo en toda PR abierta. Esta hoja dice, foto por
> foto, qué enseña, con qué prompt se hizo, qué mirar y qué comandos llevan la nueva a su sitio.
> Preparada el 6 de noviembre de 2026 (sprint 34, día 7).

## Cinco cosas antes de empezar

1. **El objetivo es 1600 × 1072** (ADR 0035). Lo que exige la herramienta es al menos 1344 × 896 en
   los dos lados; lleva el lado largo a 1600 y **nunca amplía**. Si Draw Things no ofrece 1072 exacto,
   cualquier tamaño mayor en los dos lados sirve. Una foto recortada después de generarla vuelve a
   quedar por debajo: la `.07` se recortó para quitar un cartel legible y por eso mide 866 de ancho.
   Si sale un cartel, se genera otra, no se recorta.
2. **La nueva entra bajo el id de la vieja.** Un documento guardado nombra su foto por fichero
   (`muestra-restaurante-bar.03.webp`) y el editor la pide por id antes de cada descarga. Con un id
   nuevo y la vieja retirada, toda web guardada que la usa dejaría de descargarse. Por eso no se usa
   `photos:approve` sino `photos:replace`, que escribe la nueva con el `id` y el `file` de la vieja.
3. **El `alt` viejo se queda en las webs guardadas.** El generador copia el `alt` en el documento al
   crear la web —como `alt` de la imagen y, en la galería, **como el pie que se lee bajo la foto**—,
   así que las guardadas antes del cambio seguirán describiéndola con el texto de hoy. **La foto
   nueva tiene que enseñar lo que dice el `alt` de hoy** («Qué enseña», en cada foto); el que
   escribas en `--alt` es el de las webs nuevas y puede afinarlo, pero no contradecirlo.
4. **El modelo**: Draw Things con `z_image_turbo_1.0_q6p.ckpt` (Z-Image-Turbo, de Tongyi-MAI),
   licencia Apache 2.0, leída el 8 de octubre de 2026. La ADR 0035 pide releerla para este lote: la
   fecha en que la leas va en `--checked`. Otro modelo necesita su licencia en `KNOWN_MODELS` antes de
   que la herramienta lo acepte.
5. **La semilla es una referencia, no una receta.** Abajo va la de cada original (leída del PNG de la
   raíz, emparejado píxel a píxel con la foto del banco); a otro tamaño la misma semilla da otra
   imagen.

## El circuito, para cada foto

```sh
# 1. Genera en Draw Things a 1600 × 1072 con el prompt grabado de la foto (abajo).

# 2. La entrada: lee prompt, modelo y semilla del PNG, lo pasa a WebP y crea el borrador
#    restaurante-bar.NN (del 10 en adelante).
pnpm photos:intake <archivo.png> --sector restaurante-bar --alt "<alt en español>" --checked AAAA-MM-DD

# 3. El borrador tiene que estar en git para que el `git mv` lo mueva.
git add packages/photobank/drafts

# 4. Mírala contra la lista de abajo. Si no pasa, se genera otra; el borrador se borra a mano.

# 5. La sustitución: el borrador ocupa el sitio de la vieja, con su id y su fichero.
pnpm photos:replace restaurante-bar.0X restaurante-bar.NN --by David
```

`--by` es el nombre de quien ha mirado la foto contra la lista. Desarrollo puede teclear estos
comandos, pero nunca pone ahí su nombre, ni el tuyo sin que lo digas.

`photos:replace` se niega a una foto por debajo del suelo aunque el id que escribe esté exento, y al
terminar dice cuáles quedan por debajo. **Con la novena** dice que no queda ninguna: en esa misma PR
se borran `FLOOR_EXEMPT_IDS`, `FLOOR_EXEMPTION_FAILS_FROM` (`packages/photobank/src/schema.ts`) y sus
dos pruebas en `bank.test.ts`. Pueden ir las nueve en una PR o en varias; la exención sale con la
última.

Lo que una sustitución no alcanza: una web guardada en un navegador antes del cambio conserva los
bytes que ya guardó, y su `alt` (punto 3). El editor pide cada foto por una dirección que lleva la
versión del registro (`sampleUrl`), así que ningún navegador recibe de su caché la foto vieja como si
fuera la nueva.

## La lista de revisión

La de `packages/photobank/README.md`, más dos de este lote.

- **La licencia**: uso comercial, y que nuestros clientes puedan publicarla; leída para la
  herramienta y el plan exactos; con fecha.
- **Ninguna persona reconocible**: ni cara, ni tatuaje, ni otro rasgo que identifique.
- **Ninguna marca, logotipo ni letra**, tampoco el pseudotexto que estos modelos dibujan en
  carteles, cartas y botellas.
- **Ningún artefacto**: dedos de más, herramientas deformadas, objetos imposibles.
- **Verosímil para un negocio pequeño en España.**
- **De este lote: enseña lo que dice el `alt` de hoy** (punto 3).
- **De este lote: no hay que recortarla** (punto 1), y no se parece tanto a otra de las nueve que
  dos tarjetas enseñen lo mismo (la `.01` y la `.02` salen del mismo prompt).

El fichero (WebP, 1600 de lado largo, calidad 75, sin EXIF ni XMP, como mucho 200 KB) lo comprueba la
herramienta; si a calidad 75 pasa de 200 KB se niega en vez de bajar la calidad en silencio.

## Foto a foto

Los prompts son los grabados en cada registro del banco (`origin.prompt`), copiados tal cual. Los de
la `.01` y la `.02` empiezan con la línea del sector, que Draw Things guardó como parte del prompt.

### `restaurante-bar.01` — hoy 1024 × 1024

**Qué enseña:** Mesa de madera con mantel de lino junto a una ventana, con una copa de vino tinto y un
panecillo en un plato; al fondo, la barra de madera del local.
**Original:** semilla 2453309451 (`hostelería_de_barrio__…_2453309451.png`).
**Qué mirar:** que al fondo siga siendo la barra (la `.02`, del mismo prompt, tiene la cocina).

> Hostelería de barrio: mesa, barra, terraza y cocina — nunca el rostro de quien sirve o cocina.
> Mesa de madera junto a una ventana con luz de mañana, mantel de lino, una copa de vino y pan recién
> hecho, al fondo el comedor desenfocado. Fotografía documental realista, luz natural, profundidad de
> campo media, 35mm. Sin ninguna persona con el rostro reconocible (de espaldas, de perfil recortado o
> solo las manos). Sin tatuajes identificables. Sin texto, logotipos, letras ni carteles legibles de
> ningún tipo. Sin manos con más de cinco dedos ni objetos deformados. Ambientación de un pequeño
> negocio real en España, cuidada pero modesta, sin lujo de catálogo.

### `restaurante-bar.02` — hoy 1024 × 1024

**Qué enseña:** Mesa de madera con mantel de lino y sillas de respaldo recto, con una copa de vino
tinto y pan en un plato; al fondo, la cocina del local con su campana extractora.
**Original:** semilla 3146560404 (`hostelería_de_barrio__…_3146560404.png`).
**Qué mirar:** la campana extractora al fondo, que es lo que la distingue de la `.01`; que la campana
no lleve marca.

> El mismo prompt que la `.01`.

### `restaurante-bar.03` — hoy 1024 × 1024

**Qué enseña:** Terraza con mesas redondas, sillas de mimbre y sombrillas abiertas sobre una acera
empedrada, a la luz del atardecer.
**Original:** semilla 1554108680 (`terraza_exterior_con_sillas_de_mimbre_…_1554108680.png`).
**Qué mirar:** las sombrillas, que en una terraza real suelen llevar una marca de cerveza.

> Terraza exterior con sillas de mimbre y sombrillas, luz de atardecer, calle empedrada al fondo.
> Fotografía documental realista, luz natural, profundidad de campo media, 35mm. Sin ninguna persona
> con el rostro reconocible (de espaldas, de perfil recortado o solo las manos). Sin tatuajes
> identificables. Sin texto, logotipos, letras ni carteles legibles de ningún tipo. Sin manos con más
> de cinco dedos ni objetos deformados. Ambientación de un pequeño negocio real en España, cuidada
> pero modesta, sin lujo de catálogo.

### `restaurante-bar.04` — hoy 1024 × 1024 · **un plato reconocible** (ver la pregunta abierta)

**Qué enseña:** Paellera con arroz amarillo humeante recién hecho, servido con un cucharón; a un lado,
un cuenco con una ración ya emplatada.
**Original:** semilla 203682070 (`plato_de_arroz_recién_servido_…_203682070.png`).
**Qué mirar:** el cucharón y los cubiertos, que no estén deformados. Nota: el prompt pide «un plato de
arroz visto desde arriba» y la foto aprobada es una paellera con cucharón; el `alt` describe la foto,
no el prompt, y es la foto lo que la nueva tiene que repetir.

> Plato de arroz recién servido visto desde arriba, vapor subiendo, cubiertos al lado. Fotografía
> documental realista, luz natural, profundidad de campo media, 35mm. Sin ninguna persona con el
> rostro reconocible (de espaldas, de perfil recortado o solo las manos). Sin tatuajes identificables.
> Sin texto, logotipos, letras ni carteles legibles de ningún tipo. Sin manos con más de cinco dedos
> ni objetos deformados. Ambientación de un pequeño negocio real en España, cuidada pero modesta, sin
> lujo de catálogo.

### `restaurante-bar.05` — hoy 1024 × 1024 · **un plato reconocible** (ver la pregunta abierta)

**Qué enseña:** Primer plano de unas manos cortando lonchas de jamón con un cuchillo sobre una tabla
de madera.
**Original:** semilla 4098318768 (`primer_plano_de_manos_cortando_jamón_…_4098318768.png`).
**Qué mirar:** los dedos (cinco, y bien puestos), y que no se vea un tatuaje ni un anillo distintivo.

> Primer plano de manos cortando jamón ibérico sobre una tabla de madera. Fotografía documental
> realista, luz natural, profundidad de campo media, 35mm. Sin ninguna persona con el rostro
> reconocible (de espaldas, de perfil recortado o solo las manos). Sin tatuajes identificables. Sin
> texto, logotipos, letras ni carteles legibles de ningún tipo. Sin manos con más de cinco dedos ni
> objetos deformados. Ambientación de un pequeño negocio real en España, cuidada pero modesta, sin
> lujo de catálogo.

### `restaurante-bar.06` — hoy 1024 × 1024

**Qué enseña:** Mesa cuadrada puesta para la cena con mantel blanco, dos platos con las servilletas
dobladas encima y una vela encendida en un vaso; al fondo, otras mesas del comedor desenfocadas.
**Original:** semilla 3660790135 (`a_single_table_set_for_dinner_…_3660790135.png`).
**Qué mirar:** que en las mesas del fondo no aparezca una carta con letras.

> A single table set for dinner in the foreground of a small restaurant: white cloth, two plates,
> folded napkins, a lit candle in a glass holder. The rest of the dining room dissolves into soft
> bokeh behind it — only warm lamp glows and blurred shapes. Tight framing on that one table, seen
> slightly from above at table height. Realistic documentary photography, warm evening light, shallow
> depth of field, 35mm. A real small Spanish restaurant, well kept but modest, not catalogue luxury.
> No people at all, no recognisable faces, no readable text, lettering, signage, menus or logos of any
> kind, no warped objects.

### `restaurante-bar.07` — hoy 866 × 942, la única recortada

**Qué enseña:** Mostrador de mármol de un bar con un tirador de cerveza dorado, una caña recién
tirada y un paño blanco doblado al lado; al fondo, las estanterías de botellas desenfocadas.
**Original:** semilla 4290515965 (`close_up_of_the_marble_counter_…_4290515965.png`), al que se le
quitaron 82 px arriba y 158 a la derecha por un cartel legible.
**Qué mirar:** **ningún cartel en todo el encuadre**, porque esta vez no se puede recortar; el
tirador, que no lleve marca; las botellas del fondo, sin etiqueta legible.

> Close-up of the marble counter of a traditional Spanish bar: a brass beer tap and a freshly pulled
> glass of beer with a white head, a folded cotton cloth beside it. The shelves behind are thrown
> completely out of focus, reduced to soft amber blooms of light with no distinguishable bottle or
> label shape. Tight framing on the counter top; the ceiling, the façade and any wall stay outside the
> frame. Realistic documentary photography, natural light, shallow depth of field, 35mm. A real small
> Spanish bar, well kept but modest, not catalogue luxury. No people, no recognizable faces, no
> readable text, lettering, signage or logos of any kind, no warped objects.

### `restaurante-bar.08` — hoy 1024 × 1024

**Qué enseña:** Toldo de lona a rayas sobre la entrada de un bar de barrio, con una mesa alta y dos
taburetes en la acera a primera hora de la mañana.
**Original:** semilla 2155796720 (`close_diagonal_view_of_a_striped_canvas_awning_…_2155796720.png`).
**Qué mirar:** el faldón del toldo y el rótulo encima de la puerta, donde sale el nombre del bar; y
que haya dos taburetes, como dice el `alt` (el prompt pide uno).

> Close diagonal view of a striped canvas awning over a neighbourhood bar in Spain, with one tall
> pavement table and a stool directly beneath it, early morning light on a quiet street. The framing
> crops tightly on the awning and the table; the doorway, the shopfront window and the fascia board
> above the awning stay outside the frame. Realistic documentary photography, natural morning light,
> medium depth of field, 35mm. A real small Spanish bar, well kept but modest, not catalogue luxury. No
> people, no recognisable faces, no readable text, lettering, signage or logos of any kind, no warped
> objects.

### `restaurante-bar.09` — hoy 1024 × 1024

**Qué enseña:** Hilera de cazos y sartenes de cobre colgados de una barra sobre los fogones de una
cocina, con una sartén al fuego y vapor subiendo.
**Original:** semilla 1198047027 (`copper_pots_and_pans_hanging_in_a_row_…_1198047027.png`).
**Qué mirar:** los mangos y las asas, que no estén deformados; ninguna persona en el encuadre.

> Copper pots and pans hanging in a row in the foreground of a small professional kitchen, with a lit
> gas burner and a copper pan on the stove below them, steam rising. Tight framing on the pots and the
> stove top; the rest of the kitchen falls away into soft focus. Realistic documentary photography,
> natural light, shallow depth of field, 35mm. A real small Spanish restaurant kitchen, well kept but
> modest, not catalogue luxury. No people in the frame at all, no recognisable faces, no readable
> text, lettering, signage or logos of any kind, no warped objects.

## La pregunta abierta: ¿puede el banco enseñar un plato reconocible?

La dejó nombrada la ADR 0039 (§2 y la fila del backlog del sprint 18): una galería generada pone
cuatro fotos del banco en la web de un restaurante, y **un restaurador podría publicar como suyo un
plato que no es suyo**. La `.04` (la paellera) y la `.05` (el jamón) son platos. Hoy lo cubren la
insignia «Foto de ejemplo» en el lienzo, el aviso de la descarga que nombra cada una y un pie que
describe una escena en vez de afirmarla. Es una regla de contenido, y es tuya.

- **Si el banco puede enseñarlos**, la `.04` y la `.05` se regeneran como las demás.
- **Si no**, la regla entra en la lista de revisión, y la `.04` y la `.05` se sustituyen por escenas
  sin plato. **Con un coste que trae el id compartido**: las webs guardadas que las usan conservan su
  `alt` y, en la galería, su pie («Paellera con arroz amarillo…»), que describirían una foto que ya
  no es esa (punto 3). La
  salida limpia sería dejar de usarlas en webs nuevas sin retirarlas, y eso hoy no existe: un sector
  tiene cero fotos o al menos ocho, y las nueve se sortean igual. Si eliges esto, el día que lo haga
  lo mide primero.

## Los 16 PNG de la raíz del repositorio

Son los del 11 de octubre, sin seguimiento en git y fuera de todo lo que el código lee. **Ninguno
llega al suelo** (todos de 1024 de ancho; tres a 1024 × 1088), así que ninguno puede ser una de las
nueve nuevas. Nueve son los originales de las aprobadas, emparejados píxel a píxel; siete son
alternativas que no se aprobaron.

| PNG (inicio del nombre) | Semilla | Qué es |
|---|---|---|
| `hostelería_de_barrio__…` | 2453309451 | original de la `.01` |
| `hostelería_de_barrio__…` | 3146560404 | original de la `.02` |
| `terraza_exterior_con_sillas_de_mimbre…` | 1554108680 | original de la `.03` |
| `plato_de_arroz_recién_servido…` | 203682070 | original de la `.04` |
| `primer_plano_de_manos_cortando_jamón…` | 4098318768 | original de la `.05` |
| `a_single_table_set_for_dinner…` | 3660790135 | original de la `.06` |
| `close_up_of_the_marble_counter…` | 4290515965 | original de la `.07`, sin recortar |
| `close_diagonal_view_of_a_striped_canvas_awning…` | 2155796720 | original de la `.08` |
| `copper_pots_and_pans_hanging_in_a_row…` | 1198047027 | original de la `.09` |
| `a_wooden_table_by_a_window…` | 2303879259 | alternativa, no aprobada |
| `barra_de_bar_tradicional_española…` | 3170731622 | alternativa, no aprobada (camarero de espaldas) |
| `barra_de_bar_tradicional_española…` | 3465640006 | alternativa, no aprobada (camarero de espaldas) |
| `barra_de_bar_tradicional_española…` | 4113191436 | alternativa, no aprobada (camarero de espaldas) |
| `cocina_profesional_con_ollas_de_cobre…` | 3112654573 | alternativa, no aprobada (cocinero de espaldas), 1024 × 1088 |
| `fachada_de_un_bar_de_barrio_con_toldo…` | 1252251809 | alternativa, no aprobada, 1024 × 1088 |
| `rincón_acogedor_con_mesas_puestas…` | 1036593439 | alternativa, no aprobada, 1024 × 1088 |

**Qué hacer con ellos es tuyo, y no se borran sin tu palabra.** Tres salidas:

1. **Sacarlos del repositorio a una carpeta tuya** (por ejemplo, un archivo de originales del 11 de
   octubre). Es la que recomiendo: los PNG guardan en su XMP el prompt, el modelo y la semilla, que es
   la procedencia de las nueve aprobadas, y fuera del repositorio dejan de aparecer en cada
   `git status`.
2. **Borrarlos.** El banco ya tiene las nueve en WebP con su prompt, y esta hoja apunta las semillas;
   lo que se pierde es el PNG original sin recortar de la `.07` y las siete alternativas.
3. **Dejarlos donde están.** No rompen nada; ensucian el árbol de trabajo, y un `git add .` los
   subiría.
