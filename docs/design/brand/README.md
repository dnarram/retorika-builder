# La marca de Retorika

Los dos ficheros de este directorio son **el logo oficial tal y como se entregó**, el 5 de octubre
de 2026. No se editan: si llega una versión nueva, se sustituyen aquí y se ejecuta
`pnpm brand:assets`.

| Fichero | Qué es |
|---|---|
| `LogoOficialRetorikaBuilder.png` | Solo la imagen: la «R» de bloques con el martillo. 244×252 |
| `LogoOficialRetorikaBuilderTexto.png` | La imagen más «Retorika Builder». 898×254 |

**Los dos llegaron con fondo blanco opaco**, medido y no supuesto: 100% de píxeles opacos, esquinas
en `rgba(255,255,255,255)`. La aplicación dibuja su cabecera sobre `#F5F7FA`, así que un PNG blanco
se vería como un recuadro blanco. `scripts/brand-assets.ts` quita ese fondo y escribe lo que se
sirve; estos originales se quedan intactos como lo que de verdad se entregó.

**Los dos vienen etiquetados Display P3** (`iCCP` «kCGColorSpaceDisplayP3», `cICP` 12/13/0/1): una
exportación de Mac en gama amplia. Los bytes guardados no son el color que se ve —el azul de la
marca está guardado como (81, 177, 244) y el navegador lo muestra como (6, 180, 250)—, y hasta el
13 de octubre de 2026 `brand:assets` escribía los servidos sin la etiqueta, con lo que el navegador
los leía como sRGB y la marca salía dieciséis niveles por canal más pálida, medido en Chromium.
Hoy conserva los dos trozos y los servidos se muestran idénticos al original.

## Los vectores, sacados de los PNG

| Fichero | Qué es |
|---|---|
| `retorika-mark.svg` | La marca sola, 244×252, 18 KB |
| `retorika-lockup.svg` | La marca más «Retorika Builder», 898×254, 44 KB |

**No los entregó Retorika: los sacó `pnpm brand:vector` de los dos PNG**, el 13 de octubre de 2026,
a petición de David y en lugar de esperar el original vectorial, que se pidió ese mismo día y se
sustituiría aquí si llega. El trazador es `scripts/brand-vector.ts`, escrito para el repositorio sin
dependencias nuevas (el `potrace` de npm arrastra un `jimp` de 2020 con cinco avisos de auditoría, y
`pnpm security:audit` bloquea por eso), y se vuelve a correr si cambian los originales; los SVG no se
editan a mano. Lo que hace, y lo que mide:

- **Los contornos** salen del propio antialiasing del PNG: cada píxel dice cuánto lo cubre la forma,
  la curva de nivel a medio recubrimiento se sigue a un octavo de píxel y se ajusta con cúbicas de
  Bézier a una décima. La marca dentro del lockup es píxel a píxel la misma que la suelta, desplazada
  (10, 4), comprobado antes de reutilizar el trazado.
- **Los colores** son los del PNG tal como el navegador lo muestra (sRGB), leídos con Chromium:
  «Retorika» plano `#021837`; «Builder» un degradado lineal horizontal de dieciséis paradas; cada
  bloque, que a ojo es plano y a los píxeles un degradado corto, su degradado lineal. **La «R» no la
  explica ningún degradado**: cian en la esquina, un azul más claro por el brazo y la cabeza del
  martillo, el azul hondo por el tronco y el mango. El mejor lineal, a cualquier ángulo, deja 4,6
  niveles de media por canal y bandas de veinte o treinta; con un velo radial o un segundo velo
  encima, 4. Así que el color de la «R» se guarda como lo que es, el campo de color del PNG a un
  cuarto de resolución (52×59 muestras, 3,4 KB), dibujado bajo el recorte vectorial; el navegador
  interpola entre muestras y el campo no tiene nada más fino que perder. La **forma** es vector a
  cualquier tamaño.
- **Lo medido**, dibujando cada SVG con Chromium al tamaño del original y comparando píxel a píxel
  con el PNG tal como se muestra: la marca, 1,00 niveles de media por canal, el 99 % de los píxeles a
  28 o menos, el 0,17 % a más de 48 (el borde); el lockup, 1,40 de media, el 0,35 % a más de 48. Las
  imágenes lado a lado quedan en `.scratch/brand-vector/` cada vez que corre.

## La marca animada

`apps/editor/src/editor/BuildingMark.tsx` dibuja la marca para la pantalla de construcción al
descargar con lo que `pnpm brand:vector` escribe en `buildingMarkPaths.ts`: la «R» partida en
**letra** y **martillo** por una línea trazada a mano por la muesca que separa la garra de la panza
(`SEAM` en el script), las dos como recortes sobre el mismo campo de color, con lo que en reposo
dibujan exactamente `retorika-mark.svg`; el pivote donde el eje del mango sale de la panza, hallado
en las filas del propio mango; y los tres bloques con sus degradados. Los cinco grupos
(`letter`, `hammer`, `block-sky`, `block-blue`, `block-rose`) son lo que la animación conoce: un
vector oficial, si llega, sustituye lo de dentro y no la animación. Los colores son los del logotipo,
no los de la interfaz.

## Cuál se usa dónde, y por qué

**La regla, para que la próxima colocación no tenga que volver a decidirlo:** el **lockup** donde
Retorika se nombra a sí misma y hay sitio a lo ancho; la **marca sola** donde ya hay otro nombre
delante o donde tiene que leerse pequeño.

| Dónde | Cuál | Por qué |
|---|---|---|
| La landing (`/`) | lockup | Es la página cuyo trabajo entero es decir quién es esto. No tenía logo ninguno |
| `Brand()` — cuestionario, entrar, cuenta | lockup | Cabecera de Retorika, con sitio de sobra |
| La barra del editor | **marca sola** | Al lado va el nombre del negocio del cliente. Dos nombres juntos es uno de más |
| La pestaña del navegador | **marca sola** | 32 píxeles: un wordmark ahí no se lee |

## Lo generado, que no se edita a mano

| Fichero | Quién lo escribe |
|---|---|
| `retorika-mark.svg` y `retorika-lockup.svg`, aquí mismo | `pnpm brand:vector`, de los dos PNG entregados |
| `apps/editor/src/editor/buildingMarkPaths.ts` | `pnpm brand:vector` |
| `apps/editor/public/brand/*.svg` | `pnpm brand:assets`, que **copia** los de aquí |
| `apps/editor/src/app/icon.png` | `pnpm brand:assets`, del PNG entregado, quitándole el fondo |

**Un escritor por directorio, y es la regla que evita la deriva que este fichero avisa.**
`brand-vector.ts` sabe qué *es* el logotipo y no sabe dónde guarda sus ficheros la aplicación;
`brand-assets.ts` sabe dónde los guarda y no sabe trazar. Dos scripts escribiendo `public/` serían
dos opiniones sobre el mismo logotipo.

## Lo que se sirve es el vector, desde el 15 de octubre de 2026

Las tres colocaciones de la interfaz piden `.svg`: la landing (232 px de ancho), la cabecera de
`Brand()` (190) y la barra del editor (la marca sola, a 30). **El lockup pasa de 137 KB a 44, que son
21 por el cable**, y la marca de 41 a 18, que son 9. Se dibujan de formas, así que además son nítidos
en cualquier densidad de pantalla; antes se enviaban cuatro o cinco veces más píxeles de los que la
caja pinta.

**El favicon sigue siendo PNG, y es decisión y no olvido:** Safari no dibuja un favicon SVG, y a 32
píxeles no hay nada que un vector gane. Es lo único de este logotipo que la aplicación sirve en
píxeles, y por eso `brand-assets.ts` conserva el recorte del fondo blanco.

**Se sirven por `<img src>` y no en línea.** Un SVG cargado así es un documento cerrado que no pide
nada —ni imágenes, ni hojas de estilo, ni letras—, lo cual importa aquí porque el color de la «R»
viaja dentro como un `data:` URI; y además sus `clipPath` no entran en el DOM de la página, donde sus
identificadores podrían chocar con los de cualquier otro. `apps/editor/test/brandAssets.test.ts` es
lo que mantiene de acuerdo lo que se pide con lo que se sirve.

El tamaño lo reserva el `<img>` con su `width` y su `height`, y los SVG traen los suyos: sin ellos un
navegador dibujaría 300×150 hasta que el fichero llegara, y cualquier maqueta que solo dé un ancho se
recolocaría al aterrizar.
