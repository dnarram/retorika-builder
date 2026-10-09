# Copias de seguridad de la base de datos

> **Esto es una propuesta, no algo ya hecho.** David pidió el 4 de octubre de 2026, al aprobar el
> plan del sprint 15: «confirma si el proyecto gratuito de Supabase se pausa por inactividad y si
> incluye copias. Si no las incluye, **propón** una copia programada cifrada y en la UE, **sin
> ejecutarla hasta que yo la apruebe**». Las dos comprobaciones están abajo y la propuesta también.
> **Nada de esto se ejecuta sin su aprobación**, porque una copia es una copia de datos personales
> y dónde vive es una decisión suya.

## Lo que exige el protocolo

Parte 16, «Copias»:

> - Base de datos: copia diaria automática y **una restauración de prueba al mes**. Una copia que
>   no se ha restaurado nunca no es una copia, es una esperanza.

Dos obligaciones, no una: que exista la copia, y que **se haya restaurado al menos una vez**.

## Lo comprobado el 4 de octubre de 2026

| Pregunta | Respuesta | Qué significa |
|---|---|---|
| ¿El proyecto gratuito se pausa por inactividad? | **Sí, tras 1 semana** sin llamadas a la API, sin conexiones a la base y sin entrar al panel | **No borra**: congela el volumen, con cerca de un año de ventana para reactivarlo desde el panel |
| ¿Incluye copias? | **No. Cero días de retención** | Las copias diarias automáticas empiezan en el plan **Pro (~25 $/mes)**, con 7 días de retención |

**Conclusión, dicha sin adornos: con el plan gratuito la Parte 16 no se cumple.** Ni la copia diaria
ni la restauración de prueba. El ADR 0034 §16 lo registra así en lugar de disimularlo.

Fuentes: [precios de Supabase](https://supabase.com/pricing) ·
[copias en el plan gratuito](https://backupdrill.com/guides/supabase-free-plan-backups)

## Las tres salidas, con su precio

| Salida | Coste | Qué cumple | Qué no |
|---|---|---|---|
| **A. Plan Pro de Supabase** | ~25 $/mes | La copia diaria, gestionada, sin código nuestro | Nada que objetar salvo el precio, que es **más que el propio servidor** (~7 $/mes) |
| **B. Copia programada nuestra** (la propuesta) | **0 €** | La copia diaria y la restauración de prueba | Es código nuestro, y hay que vigilarlo: una copia que falla en silencio es peor que ninguna |
| **C. Aceptar que no hay copia mientras se prueba** | 0 € | Nada | Se pierde todo si el proyecto se borra. Sostenible **solo** mientras los únicos datos sean de prueba |

**Recomendación: B ahora, y A el día que haya una web de un cliente de verdad dentro.** Mientras los
datos sean nuestros y de prueba, una copia propia es suficiente y honesta. En cuanto haya datos de
un tercero, 25 $/mes compran que esto no sea nuestro problema, y eso vale su precio.

## La propuesta concreta (salida B), para aprobar o cambiar

1. **Qué se copia.** `pg_dump` del esquema `public` completo — `accounts`, `sites`, `audit_log`,
   `schema_migrations` — y **no** el esquema `auth`. Las cuentas son de Supabase Auth y no nuestras
   para volcar; lo que se recupera de una copia nuestra es *el contenido*, y una cuenta se vuelve a
   crear. Esto hay que decirlo en la restauración de prueba, porque es su límite.

   **Y desde el 9 de octubre de 2026, el bucket `fotos`, que es la mitad nueva de esta propuesta**
   ([ADR 0037](../decisions/0037-the-photos-travel-with-the-account.md)). Las fotos del dueño
   dejaron de estar solo en su navegador y ahora son ficheros en el almacenamiento de objetos de
   Supabase. **`pg_dump` no las contiene**: vuelca `storage.objects`, que es la contabilidad, y los
   bytes se quedan donde están. Una restauración del volcado dejaría webs que nombran fotos que no
   existen — exactamente el estado que el editor bloquea antes de descargar, pero para todas las
   webs a la vez.

   Lo que hay que copiar, entonces, son **dos cosas**: el volcado de `public` y el contenido del
   bucket. Lo segundo es `supabase storage` o la API de Storage con la clave de servicio, y pesa:
   medido el 9 de octubre, **una foto de dueño pesa unos 270 KB** tras el reencodado del navegador
   (1600 px de lado largo, calidad 0,82), así que 1 GB de almacenamiento son unas 3.800 fotos. La
   copia de mil webs de una foto son 270 MB al día si se copia todo cada vez, y mucho menos si se
   copia solo lo que cambió — **y cuál de las dos es otra cosa que conviene que decidas**, porque la
   diferencia es entre un `rsync` y una copia completa.
2. **Dónde vive.** **En la UE**, por coherencia con el §14 del ADR 0034 y con la región de
   Supabase y de Render. La opción de coste cero es el almacenamiento de objetos del propio
   Supabase, en el mismo proyecto; la opción de coste cero **y** fuera del mismo proveedor es un
   `pg_dump` cifrado en el portátil, que Time Machine ya cubre (Parte 16: «Time Machine cubre el
   portátil»). **Esta elección es la que menos clara tengo y la que más me interesa que decidas.**
3. **Cifrado.** `age` o `gpg` con una clave que **no está en el repositorio** y cuya frase va en
   `.env.local` o en el llavero, nunca en un commit ni en un comentario (Parte 15). Un volcado sin
   cifrar es una base de datos entera en un fichero.
4. **Cuándo.** Diaria. Si corre desde el portátil, además **despierta el proyecto**, lo que de
   paso evita la pausa por inactividad de una semana: un efecto secundario útil que conviene
   nombrar en vez de descubrir.
5. **La restauración de prueba, que es la mitad que se olvida.** Una vez al mes: restaurar el
   volcado en una base local y **contar las filas**. Y queda escrito en el runbook, porque «una
   copia que no se ha restaurado nunca no es una copia».

   **Con una foto dentro, desde el ADR 0037.** Contar filas prueba que el volcado tiene webs; no
   prueba que esas webs se puedan abrir. La prueba que sí lo hace es restaurar el volcado, poner
   una foto del bucket copiado en su ruta, y **abrir esa web**: si la portada sale, la copia sirve;
   si sale el marcador gris, la copia es media copia y nadie se habría enterado hasta necesitarla.
6. **Y que falle en voz alta.** Si el volcado no sale, hay que enterarse. Silencio es exactamente
   el fallo que el proyecto ya cazó con la foto de muestra.

## Lo que no propongo

- **Copiar `auth.users`.** Son datos personales de terceros en un fichero nuestro, y el ADR 0034
  §13 acaba de poner un aviso de privacidad que tendría que mencionarlo. No por ahora.
- **Una copia automática en un tercer proveedor.** Sería un cuarto servicio, una cuarta clave y un
  cuarto encargado del tratamiento que habría que nombrar en el aviso.

## Estado

**Pendiente de la aprobación de David.** Hasta entonces, el estado real es la salida C, y el
runbook del día 6 lo dirá con esas palabras: que hoy no hay copia, y qué se pierde si el proyecto
desaparece.

> **Y desde el 9 de octubre de 2026 se pierde más que entonces.** Cuando esto se escribió, lo que
> no había copia era los documentos; las fotos estaban en el navegador de cada dueño, que es un
> sitio malo para la única copia pero es *una* copia. Ahora están en el mismo proyecto de Supabase
> que los documentos, así que un proyecto que desaparece se lleva las dos cosas a la vez. **La
> propuesta no cambia de forma por eso; lo que cambia es cuánto cuesta no aprobarla.**
