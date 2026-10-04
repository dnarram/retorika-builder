# El arranque en frío, y si la landing debe ir aparte

> **De dónde viene esto.** David, 4 de octubre de 2026, al aprobar el plan del sprint 15, ajuste 5:
> «Día 5: valora servir la landing como sitio estático de Render (no se duerme) y la app aparte;
> mide los dos arranques.»

## Lo que se midió aquí, y se puede volver a comprobar

`pnpm build:editor` clasifica cada ruta, y la landing sale **prerenderizada**:

```
Route (app)
┌ ○ /                          ← estática
├ ○ /empezar                   ← estática
├ ○ /entrar                    ← estática
├ ○ /mis-webs                  ← estática
├ ƒ /mis-webs/[id]             ← dinámica
├ ƒ /auth/callback             ← dinámica
└ ƒ /api/download              ← dinámica

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

**Eso es el hecho que importa de este día: `/` no lee nada.** Ni sesión, ni base de datos, ni
`cookies()`. Por eso Next la prerenderiza, y por eso **se puede mover a un sitio estático sin
reescribir una línea**. El fichero lo dice en su cabecera para que nadie lo rompa sin darse cuenta.

## La corrección que hay que hacer antes de seguir

**«Prerenderizada» no significa «no se duerme», y es fácil confundirlo.** Que Next genere el HTML en
el build quita el *renderizado* del servidor, no el servidor: el plan gratuito de Render duerme el
**servicio**, y un servicio dormido no sirve ni un fichero estático. Así que la landing de hoy, aun
siendo estática, sigue detrás del minuto de despertar.

Lo que **no** se duerme es otra cosa: un **Static Site** de Render, que es un servicio distinto.
Mover la landing ahí es un cambio de despliegue, no de código — y el código ya está listo.

## Lo que no puedo medir yo, dicho por su nombre

**Los dos arranques que pides se miden contra el despliegue real, y yo no lo tengo.** No voy a
inventar dos números. Son dos comandos tuyos:

```sh
# 1. En frío: con el servicio sin tráfico desde más de 15 minutos.
curl -o /dev/null -s -w 'frío:    %{time_total}s\n' https://<tu-servicio>.onrender.com/

# 2. Caliente: inmediatamente después del anterior.
curl -o /dev/null -s -w 'caliente: %{time_total}s\n' https://<tu-servicio>.onrender.com/
```

El ADR 0012 y `render.yaml` ya anotaron «cerca de un minuto» para el primero y 1266 ms de ida y
vuelta para el segundo, pero **ninguno de los dos se midió con una landing delante**, que es la
primera vez que la cifra le pasa a un desconocido en lugar de a nosotros.

## Lo que compra partirlo, y lo que cuesta

| | Hoy: un servicio | Partido: sitio estático + app |
|---|---|---|
| Primera pintura en frío | **espera el despertar** (~1 min) | **inmediata** |
| Pulsar «Empezar» en frío | ya está despierto | **espera el despertar**, salvo precalentamiento |
| URLs | una | **dos** `*.onrender.com`, y no tenemos dominio (ADR 0034 §4) |
| Estilos | un sitio | duplicados, o un paquete compartido |
| Coste | 0 € | 0 € |

**Y el argumento de verdad a favor de partirlo no es la pintura: es que una landing estática puede
despertar la aplicación mientras el visitante lee.** Un `fetch` en cuanto carga la página, y el
minuto de despertar deja de ser una espera muerta después de pulsar y pasa a solaparse con los
veinte o treinta segundos que alguien tarda en leer de qué va esto. Eso sí vale algo.

## Recomendación: **no partirlo**, y dejar la puerta abierta — que es donde ya está

1. **Un servicio.** Dos URLs `*.onrender.com` sin dominio propio es peor de cara a un cliente que un
   minuto de espera, y añade un segundo despliegue que mantener para ahorrar 7 $.
2. **La puerta queda abierta a coste cero**, y eso es lo que este día ha asegurado: `/` es estática y
   no lee nada, así que el día que convenga, se mueve.
3. **El arreglo de verdad cuesta 7 $/mes y una línea.** `render.yaml` ya lo dice: cambiar `plan:` en
   el mismo servicio, «no migration». Eso compra **una sola URL y ningún despertar**, que es
   estrictamente mejor que dos URLs y un truco de precalentamiento.
4. **El disparador sigue siendo el que pusimos:** cuando le des la URL a alguien de verdad.

**Si los 7 $ no son aceptables**, entonces partirlo sí merece la pena, y en ese caso lo que hay que
construir no es solo la landing estática: es **el precalentamiento**, porque sin él se gana la
pintura y se pierde igual el primer clic. Eso es un día de trabajo y no está en este sprint.

## Estado

**Pendiente de tu decisión y de tus dos medidas.** Lo que queda hecho y comprobado es que la landing
no lo impide: no lee nada, y el build lo demuestra.
