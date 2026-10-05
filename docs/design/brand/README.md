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

- `apps/editor/public/brand/retorika-lockup.png`
- `apps/editor/public/brand/retorika-mark.png`
- `apps/editor/src/app/icon.png` — el favicon. Next sirve `app/icon.png` por convención, sin que
  haya que escribir ni una etiqueta.

## Lo que falta, por si alguna vez importa

Los servidos van **a su resolución nativa** y el lockup pesa 137 KB para dibujarse a unos 200px. No
se redimensionan porque no hay librería de imagen en el repositorio y `sips` solo existe en macOS,
así que un script que la usara se rompería en CI. Si alguna vez molesta, la salida es entregar el
logo ya a la resolución que se va a usar.
