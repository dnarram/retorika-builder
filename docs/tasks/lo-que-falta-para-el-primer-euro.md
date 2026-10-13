# Lo que falta para el primer euro

> **Para David, sin juicio.** El 11 de octubre de 2026, al cerrar el sprint 17, pediste «que el
> proyecto avance hacia un producto casi comercial aunque sin incluir aún la pasarela de pago». Este
> fichero es la cuenta de lo que separa el producto de cobrar el primer euro, **medida y con su
> fuente**, repartida en lo que es de desarrollo y lo que es tuyo. No dice si la Fase 1 está lista,
> no propone un precio, no decide nada: enumera. Las preguntas van al final. Escrito el 13 de octubre
> de 2026 (sprint 18, día 6) y revisado contra el código y `git`, no contra la memoria.

La regla que ordena todo lo demás es la Parte 15 del protocolo, literal: «Aviso legal, política de
privacidad y condiciones de uso **antes de cobrar el primer euro, no después**», y el
[ADR 0021](../decisions/0021-charging-waits-for-a-sellable-product.md): el cobro espera a que el
producto se declare «profesionalmente vendible», y esa declaración es de dirección, sin fecha.

## 1. Lo que ya está decidido y no se reabre

| Qué | Dónde |
|---|---|
| Stripe, pago único, Checkout; ningún dato de tarjeta pasa por nuestro servidor | `docs/protocolo.md`, Parte 15 |
| El precio es un objeto Price de Stripe, no un número en el código | Parte 15; `docs/design/billing-questions.md` |
| Webhook idempotente, tres estados guardados (pendiente, pagada, publicada) | Parte 15 |
| Una web descargada no depende de nosotros: no hay nada que apagar en un reembolso | [ADR 0001](../decisions/0001-static-published-sites.md); `billing-questions.md`, pregunta 6 |
| El cobro espera a «profesionalmente vendible», y quién lo declara es dirección | [ADR 0021](../decisions/0021-charging-waits-for-a-sellable-product.md) |
| Los tres documentos legales van atados al primer euro; el aviso breve de privacidad ya existe en la cuenta | [ADR 0034](../decisions/0034-the-account-arrives-at-the-end.md) §13 |

## 2. Lo que es tuyo

### 2.1 Las seis preguntas de facturación, literales

De `docs/design/billing-questions.md` (28 de septiembre de 2026), ninguna respondida. Cada una dice
qué bloquea.

1. **¿Quién emite la factura, y como qué entidad?** Bloquea la plantilla de factura y la contraparte
   de las condiciones de uso.
2. **¿El precio anunciado lleva el IVA incluido o no?** Bloquea cómo se crea el objeto Price y el
   texto de la pantalla de pago.
3. **¿Compra una empresa, un particular, o los dos?** Bloquea si la pantalla de pago pide un NIF.
4. **¿Qué pasa con una venta fuera de España?** Bloquea si se pide el país y si se valida algo.
   «Todavía no» es una respuesta válida, si está escrita.
5. **¿De quién es la serie de facturas y su numeración?** Bloquea si el webhook puede crear una
   factura o solo avisar.
6. **¿Qué reembolso es posible una vez entregado el ZIP?** Bloquea las condiciones de uso y si hace
   falta un camino de cancelación. Hoy no hay ninguno.

### 2.2 Los tres documentos legales

Ninguno existe. Parte 15 pide los tres antes del primer euro; `billing-questions.md` dice por dónde
empiezan: la pregunta 1 les da contraparte y la 6 les da su cláusula más difícil.

| Documento | Lo que la Parte 15 pide de él | Estado |
|---|---|---|
| Aviso legal | Existir | No existe |
| Política de privacidad | Existir, completa; el aviso breve de la cuenta nombra a los encargados (§2.3) | Solo el aviso breve (`account.save.privacy`) |
| Condiciones de uso | Existir, e incluir lo aprobado sobre plantillas de terceros: «entrar en el catálogo no se retribuye y solo se aprovecha la estructura»; y lo que signifique un reembolso cuando no hay nada que apagar | No existen |

### 2.3 Los encargados del tratamiento y sus DPA

| Encargado | Qué procesa | DPA | Fuente |
|---|---|---|---|
| Supabase (UE) | El correo de la cuenta, el documento, las fotos del dueño | **Pendiente de aceptar**, tarea de dirección | ADR 0034 §14 |
| Render (Frankfurt) | La aplicación que lo sirve | **Pendiente de aceptar**, tarea de dirección | ADR 0034 §14 |
| Sentry (UE, si se aprueba) | Qué ha fallado y en qué versión; nunca la web, las fotos ni el correo | **Pregunta abierta desde la PR #219** (12 de octubre): proyecto en Sentry con residencia en la UE, su DPA, y una frase nueva en el aviso de privacidad, redactada allí y **no** metida en `es.json` | PR #219, cuerpo |

El código de Sentry está cableado e inerte: sin `NEXT_PUBLIC_SENTRY_DSN` no envía nada, y el `e2e`
lo comprueba contra un error real. Activarlo es poner la variable en Render **después** de las
tres cosas de arriba, no antes.

### 2.4 El precio

| Dato | Fuente |
|---|---|
| Dos sesiones de usabilidad respondieron y coinciden en **50 €** (25 y 27 de septiembre) | `docs/design/HANDOFF.md`, tabla de abiertos, fila «The price» |
| La tercera sesión no lo registró; la quinta pregunta quedó en blanco | `docs/tasks/backlog.md`, «The price — still two answers» |
| Es un objeto Price en Stripe: fijarlo es configuración, no código | Parte 15 |

«Dos personas no son un precio» es la frase del registro, y se deja como está.

### 2.5 Las copias

| Dato | Fuente |
|---|---|
| El plan gratuito de Supabase tiene **cero días** de retención y se pausa tras una semana sin uso (congela, no borra) | `docs/tasks/copias.md`, comprobado el 4 de octubre |
| La Parte 16 pide copia diaria **y una restauración de prueba al mes** | Parte 16 |
| Tres salidas con precio: A, plan Pro (~25 $/mes); B, copia programada nuestra (0 €); C, aceptar que no hay copia mientras solo haya datos de prueba (0 €). **Recomendación escrita: B ahora, A el día que haya una web de un cliente de verdad** | `copias.md` |
| Estado real hoy: **C**. «No ejecuto nada hasta que elijas» | `copias.md`, último párrafo |

### 2.6 El plan de Render y el arranque en frío

| Dato | Fuente |
|---|---|
| Plan gratuito: duerme a los ~15 minutos y tarda cerca de un minuto en despertar; cambiar de plan es cambiar `plan:` en `render.yaml`, sin migración | `render.yaml`; ADR 0034 §15 |
| **El disparador para dejar el plan gratuito está escrito: cuando la URL se le dé a un prospecto real** | ADR 0034 §15 |
| Los dos números del arranque (frío y caliente, con la landing delante) **siguen sin medirse**: son dos comandos tuyos y nadie los ha ejecutado | `docs/tasks/arranque-en-frio.md`, «dos comandos tuyos» |

### 2.7 El barrido de cuentas

| Dato | Fuente |
|---|---|
| Nada lo programa: los *cron jobs* de Render se pagan y el ADR 0034 eligió 0 € | `docs/runbook.md` §6 |
| Por eso la pantalla dice «se borrará **a partir del**» y no «el» | runbook §6 |
| GitHub Actions no es la salida gratuita que parece: `docs/tasks/ci.md` deja fuera «cualquier secreto en CI», y el barrido necesita `DATABASE_URL` | `ci.md`, «Out of scope» |
| Una vez por semana basta, según el runbook; cada cuánto, y desde dónde, es tuyo | runbook §6 |

### 2.8 La producción de fotos

| Dato | Fuente |
|---|---|
| Once ficheros de sector en el banco; **uno** con fotos (`restaurante-bar`, nueve) y diez a cero (`academia`, `asesoria`, `estetica`, `fisioterapia`, `fotografia`, `otro`, `peluqueria-barberia`, `reformas`, `taller`, `tienda`) | `packages/photobank/bank/*.json`, contados hoy |
| Un sector sin fotos genera una web con la portada en gris y **sin galería** (ADR 0039: la galería solo existe donde hay banco) | ADR 0039 §1 |
| La exención de resolución de las nueve aprobadas **caduca el 1 de noviembre de 2026**: desde ese día `bank.test.ts` pone en rojo cualquier PR hasta que se regeneren a 1600 × 1072 | ADR 0035; `packages/photobank/test/bank.test.ts`, `FLOOR_EXEMPTION_FAILS_FROM` |
| **Dieciséis PNG sin seguimiento en la raíz del repositorio**, generados para el banco y nunca movidos: pertenecen al circuito del ADR 0011 (`drafts/`, revisión, `bank/`) y a ninguna PR | `git status`, hoy |
| Dos de las nueve fotos aprobadas son platos (`.04` paella, `.05` jamón); si el banco puede contener un plato reconocible es una regla de contenido que el ADR 0039 nombra y no decide | ADR 0039, consecuencias |

### 2.9 Las firmas y las declaraciones

| Qué | Estado | Fuente |
|---|---|---|
| ADR 0038, aceptación de la Fase 1 | **El material existe** (`docs/tasks/fase-1-lo-que-prometimos.md`, con sus preguntas al final); el ADR no está escrito ni firmado. Desarrollo no firma | `fase-1-lo-que-prometimos.md` §7 |
| «Profesionalmente vendible» | Es de dirección, sin fecha; el ADR 0021 fija el orden, no el día | ADR 0021 |
| ADR 0039, la galería del banco | **Firmado por ti el 12 de octubre** | ADR 0039 |

### 2.10 Google fuera del modo de pruebas, y una app que pide no ser encontrada

| Dato | Fuente |
|---|---|
| Para salir del modo de pruebas Google exige una página de inicio **en un dominio verificado y propio**, enlaces públicos a la política de privacidad y a las condiciones, y verificación de cada dominio. La URL `*.onrender.com` no es nuestra y **no hay dominio**: el bloqueo es el dominio, no la política | ADR 0034 §4 |
| En modo de pruebas: hasta 100 usuarios añadidos por correo | ADR 0034 §4 |
| La aplicación entera lleva `robots: { index: false, follow: false }`: un producto con URL pública que pide no ser encontrado. Cubre la app, nunca las webs que genera | `apps/editor/src/app/layout.tsx` |

### 2.11 Una enmienda para firmar o rechazar: el `sitemap.xml` en el ZIP

> **Firmada por ti el 13 de octubre de 2026** al planificar el sprint 19, y hecha el mismo día
> (sprint 19, día 1): está en el ADR 0029 como enmienda, `/api/download` pasa el `siteUrl` como
> `baseUrl`, la ayuda de «Compartir» lo dice, y las pruebas lo aseveran en los dos sentidos. Lo que
> sigue es el texto tal como se te puso delante.

El [ADR 0029](../decisions/0029-what-a-published-page-says-about-itself.md) dice que el `siteUrl`
que el dueño escribe en «Compartir» **no** es el `baseUrl` que un sitemap necesita, y que
confundirlos «pondría un sitemap en un ZIP». Un sitemap en el ZIP es lo que una web descargada y
subida a cualquier hosting agradecería. Si quieres reabrirlo, la enmienda cabe en un párrafo:

> **Enmienda propuesta al ADR 0029 (sin firmar):** cuando el documento lleva un `siteUrl` validado
> como origen `https://`, el ZIP incluye un `sitemap.xml` construido sobre ese origen, y la ayuda
> de «Compartir» lo dice. Sin `siteUrl`, ningún sitemap, como hoy. El `siteUrl` sigue siendo la
> dirección pública que el dueño declara, no la dirección desde la que se sirve esta compilación;
> lo que cambia es que esa declaración vale para el sitemap además de para `og:url`.

Si la firmas, entra en el día 7 (`/api/download` pasa `baseUrl`, dos pruebas, un texto en
`es.json`). Si no, la caminata de cierre asevera que el ZIP **no** lleva sitemap, porque eso es lo
cierto.

## 3. Lo que es de desarrollo y este sprint ha hecho o dejado

| Qué | Estado |
|---|---|
| El producto avisa cuando se rompe | Cableado e inerte (día 1); activar es tuyo (§2.3) |
| Lighthouse ≥ 95 medido | 100 / 99 / 99 con cinco fotos (días 2 y 4); el 96 de buenas prácticas es el favicon, fase 2 |
| La galería del banco | Generada, contada y verificada (días 3 y 4) |
| El intermitente del `e2e` | Mecanismo encontrado y corregido (día 5) |
| Registros obsoletos | Tres filas corregidas hoy (fuentes, `tsconfig.json`, el barrido del sprint 14); las fechas del día 4 corregidas el día 5 |
| La máquina de desarrollo | 16 GB y una carga media entre 3 y 9 con lo que tiene abierto: ya no da una ejecución completa del `e2e` limpia con regularidad. Es de la Parte 18, no del producto, y lo decides tú |

## 4. Las preguntas, juntas

1. Las seis de facturación (§2.1), una a una.
2. ¿Quién escribe los tres documentos legales, y cuándo?
3. ¿Aceptas los DPA de Supabase y Render? ¿Y Sentry: proyecto en la UE, DPA y la frase del aviso?
4. ¿Cuál es el precio? (Dos sesiones dicen 50 €.)
5. ¿Qué salida de copias: A, B o C? (Recomendada B; estado real C.)
6. ¿Cuándo se mide el arranque en frío, y cuándo se deja el plan gratuito?
7. ¿Cada cuánto corre el barrido, y desde dónde?
8. ¿Quién produce las fotos de los diez sectores, y las nueve regeneradas antes del 1 de noviembre?
   ¿Y los dieciséis PNG de la raíz?
9. ¿Puede el banco contener un plato reconocible?
10. ¿Escribes y firmas el ADR 0038? ¿Quién declara el producto vendible?
11. ¿Se compra un dominio? (Es lo que saca a Google del modo de pruebas y lo que daría sentido a
    quitar el `noindex`.)
12. ~~¿Firmas la enmienda del ADR 0029 (§2.11), o la rechazas?~~ Firmada el 13 de octubre de 2026.
