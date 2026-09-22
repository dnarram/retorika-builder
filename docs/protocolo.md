# Protocolo de desarrollo — Retorika Builder

**MacBook Air M4 · 16 GB · Claude Code + OpenCode · Estándares de producción**

Este documento sustituye al protocolo general de desarrollo con IA y lo reescribe alrededor
de un proyecto concreto: Retorika Builder. Se sigue de arriba abajo. Los comandos se copian
y se pegan; los encargos a la IA también, porque están redactados para dar un resultado
determinado y cambiarlos a mitad suele salir caro.

---

## Qué cambia respecto al protocolo general

| | Protocolo general | Este protocolo |
|---|---|---|
| Alcance | Cualquier proyecto | Solo Retorika Builder |
| Stack | Sin decidir | Decidido y justificado (Parte 3) |
| Calidad | Linter, tipos, tests | Además: invariantes del documento, presupuesto de peso y accesibilidad del sitio publicado |
| Reparto con la IA | Por dificultad | Por zona del código: hay paquetes que OpenCode no toca nunca |
| Orden de trabajo | Libre | Fases 0 a 4 con criterios de aceptación |
| Fuente de verdad | El código | Los dos dossiers aprobados, y los ADR cuando cambien |

---

## Índice

- **Parte 1** — Las cinco ideas que rigen este proyecto
- **Parte 2** — Reparto de trabajo entre Claude y OpenCode
- **Parte 3** — Arquitectura y stack
- **Parte 4** — Preparación del Mac *(una vez)*
- **Parte 5** — Preparación del relevo *(una vez)*
- **Parte 6** — Arranque del proyecto *(una vez)*
- **Parte 7** — El `CLAUDE.md` de Retorika Builder
- **Parte 8** — Las invariantes y su arnés de pruebas
- **Parte 9** — Calidad automática: pre-commit, CI y presupuestos
- **Parte 10** — Ramas, commits y pull requests
- **Parte 11** — El protocolo de tarea
- **Parte 12** — Rutina diaria
- **Parte 13** — El relevo cuando se agota la cuota
- **Parte 14** — Orden de construcción por fases
- **Parte 15** — Secretos, pagos y datos personales
- **Parte 16** — Despliegue, copias y el compromiso de no secuestrar webs
- **Parte 17** — Observabilidad y qué hacer cuando algo se cae
- **Parte 18** — Rendimiento en un M4 de 16 GB
- **Parte 19** — Chuleta de comandos
- **Parte 20** — Problemas frecuentes
- **Parte 21** — Reglas de oro y lo que nunca se hace aquí
- **Parte 22** — El límite honesto de este sistema

---

# Parte 1 — Las cinco ideas que rigen este proyecto

**1. Un proyecto es una carpeta.**
Vive en `~/proyectos/retorika-builder`. Se ve en el Finder, se copia y se respalda como
cualquier otra carpeta.

**2. La IA solo ve la carpeta desde la que se la llama.**
Si se arranca en el sitio equivocado, no sabe nada del proyecto. Es el error número uno.

**3. Hay dos IAs con papeles distintos.**
Claude decide y revisa; OpenCode teclea lo que ya está decidido. La regla que lo resume:
**si equivocarse sale caro, es de Claude.**

**4. La calidad no la garantiza la IA, la garantizan las comprobaciones automáticas.**
Un modelo que dice «los tests pasan» no lo ha comprobado, lo ha escrito. El proyecto lleva
un revisor que no puede mentir ni ser complaciente.

**5. En este proyecto hay un núcleo que no se toca a la ligera.**
El modelo de documento y el renderizador son el corazón del producto. Si se rompe una de
sus siete reglas, se rompen a la vez el editor sencillo, el modo estudio, la vuelta atrás,
la generación del móvil, las plantillas y el sitio publicado. Todo lo demás se puede
rehacer en una tarde; esto no.

---

# Parte 2 — Reparto de trabajo entre Claude y OpenCode

El protocolo general reparte por dificultad. En este proyecto se reparte además **por zona
del código**, que es más fácil de cumplir y no depende del juicio del momento.

## Zonas exclusivas de Claude

| Zona | Por qué |
|---|---|
| `packages/schema` | Es el contrato de todo el producto. Un cambio mal hecho corrompe documentos de clientes. |
| `packages/renderer` | Su salida es la web del cliente y viaja en el ZIP. Un fallo aquí se publica. |
| `packages/catalog` | Define los huecos y las cardinalidades de cada sección; de ahí depende que volver a la original no pierda contenido. |
| `packages/publisher` | Es quien construye el ZIP. El motivo del renderizador se aplica palabra por palabra: su salida es la web del cliente y viaja en el ZIP. |
| `apps/serve` | Asignar un subdominio a un sitio es multitenencia: un error sirve la web de un cliente bajo el dominio de otro. Es también donde se referencian las credenciales del almacenamiento. |
| Migraciones de base de datos | Irreversibles en producción. |
| Cualquier cosa que toque dinero | Stripe, precios, webhooks, facturación. |
| Permisos y propiedad | Quién puede editar, desbloquear, transferir o borrar una web. |

## Zona libre para OpenCode

Componentes de interfaz a partir de un diseño cerrado, tests escritos desde un plan,
refactores mecánicos, renombrados, textos de la interfaz, documentación, presets nuevos del
catálogo **a partir de una plantilla ya existente y revisada**, scripts de utilidad.

## La regla de oro del reparto

**Nunca la misma IA escribe y aprueba.** Lo que teclea OpenCode lo revisa Claude. Y de vez
en cuando al revés: pasarle a OpenCode un cambio de Claude y pedirle que busque fallos. Una
IA distinta encuentra cosas que el autor no ve, igual que ocurre con las personas.

---

# Parte 3 — Arquitectura y stack

> Esta parte es nueva y es la más importante del documento. El resto del protocolo protege
> lo que aquí se decide.

## 3.1 La decisión que manda sobre todas las demás

**El sitio publicado es HTML, CSS y (casi) nada más.**

De los dossiers aprobados salen tres promesas que apuntan a lo mismo: el usuario puede
descargar sus archivos y subirlos a cualquier hosting, el mismo precio cubre las dos vías
porque el coste por web es mínimo, y nadie se queda fuera de su propia web. Eso solo se
cumple si lo que generamos es estático.

Consecuencias directas, y no son negociables:

- El sitio publicado **no lleva React ni ningún framework en tiempo de ejecución**. Lleva
  HTML con CSS en línea o en un fichero, y JavaScript solo en las secciones que de verdad
  lo necesitan (carrusel, acordeón, formulario).
- El editor sí es una aplicación grande, pero eso es nuestro problema, no el del cliente.
- Nada del sitio publicado depende de una API nuestra. Una web descargada tiene que
  funcionar abriéndola con doble clic.

## 3.2 Un solo renderizador, dos destinos

El mismo documento se pinta en dos sitios: dentro del editor, vivo y editable, y en el
sitio publicado, estático. **Si se escriben dos renderizadores, acaban divergiendo** y el
usuario ve una cosa al editar y otra al publicar. Es el fallo clásico de estas
herramientas.

Por eso el renderizador se escribe una sola vez, en TypeScript, con dos salidas:

```
documento ──► render(doc, "dom")   ──► nodos del DOM para el editor
        └───► render(doc, "html")  ──► cadena de HTML + CSS para publicar
```

La lógica de maquetación, rejilla, tokens y puntos de ruptura vive en el renderizador y en
ningún otro sitio. El editor añade encima la interacción (selección, arrastre, barra
flotante), nunca la maquetación.

## 3.3 Stack propuesto

> Pendiente de aprobación formal, igual que figura en los dossiers. Cada línea lleva el
> motivo, para poder discutirla sin rehacer el razonamiento.

| Pieza | Elección | Por qué esta y no otra |
|---|---|---|
| Lenguaje | TypeScript en todo | Un solo lenguaje para editor, renderizador, generador y API. El modelo de documento se comparte sin traducirlo. |
| Gestor de paquetes | pnpm | Enlaza en vez de copiar: en un monorepo ahorra varios GB de disco y bastante memoria en un portátil de 16 GB. |
| Aplicación | Next.js (App Router) + React | Da en un solo despliegue las páginas públicas, el editor, la autenticación y los endpoints de Stripe. |
| Estilos del editor | Tailwind | Rápido de escribir y no interfiere con los estilos del sitio generado, que son propios. |
| Validación y esquema | Zod | El esquema del documento es código y test a la vez: valida en escritura, como exige la Parte 8. |
| Base de datos | PostgreSQL | Ya se conoce y se maneja con DBeaver. El modelo es relacional de verdad: cuentas, webs, plantillas, pagos. |
| Acceso a datos | Drizzle | SQL a la vista, sin binario que compilar, arranca rápido en Apple Silicon. |
| Postgres gestionado | Supabase (Postgres + Auth + Storage) | Evita mantener base de datos, sesiones y almacenamiento a mano. Se usa como Postgres, con Drizzle encima, para no quedar atrapado. |
| Pagos | Stripe en modo pago único | Lo aprobado es pago único, no suscripción. El precio vive en un objeto Price de Stripe, así que fijar el «XX €» será configuración y no código. |
| Archivos de sitios publicados | Cloudflare R2 + Worker con subdominio comodín | Servir estáticos desde almacenamiento de objetos es lo que hace que el coste por web sea de céntimos, que es la base de la decisión de precio. |
| Correo transaccional | Resend | Accesos de cliente, facturas y avisos. |
| Errores | Sentry | Sin esto, un fallo en el editor de un cliente no se sabe nunca. |
| Tests | Vitest + fast-check + Playwright | Unitarios y de propiedades donde están las invariantes; navegador donde está el flujo. |
| Accesibilidad | axe-core sobre la salida del renderizador | La revisión previa a publicar es una promesa del producto: se comprueba en CI, no a ojo. |
| Peso | size-limit | El presupuesto del sitio publicado se vigila solo. |
| Formato y linter | Biome | Un binario en Rust hace formato y linter; en este portátil se nota frente a ESLint más Prettier. |
| Revisor local | pre-commit | Ya está instalado y funciona con cualquier lenguaje. |

## 3.4 Estructura del repositorio

```
retorika-builder/
├── apps/
│   ├── editor/              # Next.js: web pública, editor, API, Stripe
│   └── serve/               # Worker que sirve los sitios publicados desde R2
├── packages/
│   ├── schema/              # Modelo de documento, versión y migraciones (Zod)
│   ├── renderer/            # documento -> DOM | documento -> HTML+CSS
│   ├── catalog/             # Presets de sección: huecos, cardinalidad, variantes
│   ├── tokens/              # Sistema de tokens + tema propio de Retorika
│   ├── publisher/           # Empaqueta el sitio: HTML, CSS, imágenes, sitemap, ZIP
│   └── templates/           # Extracción y aplicación de plantillas
├── fixtures/
│   └── documents/           # Corpus de documentos reales para las pruebas doradas
├── docs/
│   ├── dossiers/            # Los dos dossiers aprobados (fuente de verdad del producto)
│   ├── decisions/           # ADR: una decisión por fichero, numerada
│   ├── tasks/               # Planes de tarea (Parte 11)
│   └── runbook.md           # Qué hacer cuando algo se cae
└── .claude/
    ├── skills/              # Checklists de especialista
    └── commands/            # Comandos propios del proyecto
```

## 3.5 La fuente de verdad del producto

Los dos dossiers aprobados manda**n** sobre el código. Si el código hace algo distinto de
lo que dice un dossier, el dossier gana hasta que un ADR diga lo contrario, y ese ADR se
escribe antes de tocar el código, no después.

Cada ADR ocupa media página: contexto, decisión, consecuencias, y el enlace al apartado del
dossier que cambia. `docs/decisions/0001-static-published-sites.md` es el primero y ya
está decidido en la Parte 3.1. El nombre va en inglés, como el resto de la documentación.

---

# Parte 4 — Preparación del Mac

> Una sola vez en la vida del ordenador. Si `brew --version` y `claude --version` responden
> con un número, saltar a la Parte 5 y volver solo a 4.4.

## 4.1 Herramientas de Apple

```
xcode-select --install
```

## 4.2 Homebrew

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Pedirá la contraseña del Mac. Al escribirla no se ve nada: es a propósito.

## 4.3 Conectar Homebrew con la Terminal

Este paso se lo salta mucha gente y luego nada funciona. Una línea cada vez:

```
echo >> ~/.zprofile
```
```
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```
```
eval "$(/opt/homebrew/bin/brew shellenv)"
```

## 4.4 Herramientas del proyecto

```
brew install git gh fnm uv pre-commit gitleaks jq
```

| Herramienta | Para qué |
|---|---|
| `git` | Historial de cambios |
| `gh` | Conecta el Mac con GitHub |
| `fnm` | Fija la versión de Node del proyecto |
| `uv` | Python moderno, para scripts auxiliares |
| `pre-commit` | El revisor local |
| `gitleaks` | Busca claves antes de que entren en el historial |
| `jq` | Leer respuestas JSON en la terminal sin sufrir |

**Ni `node` ni `pnpm` se instalan con Homebrew.** Node lo fija `fnm`, y el binario de `pnpm` de
Homebrew es autónomo e **ignora el campo `packageManager`** del proyecto, así que la versión
fijada en el repositorio dejaría de mandar. Tener además el Node de Homebrew crea un segundo
Node compitiendo en el PATH. Si ya están instalados: `brew uninstall node pnpm`.

Tres pasos más, y los tres importan:

```
fnm install 24.21.0
```
```
fnm default 24.21.0
```

`fnm use` solo afecta a la sesión actual. **Sin versión predeterminada, una Terminal nueva se
queda sin Node en el PATH**, y sin el de Homebrew de reserva eso es un `node not found`.

Después, la línea que activa `fnm` en cada shell. Va en **`~/.zshenv`**, no en `~/.zshrc` ni en
`~/.zprofile`:

```
echo '[ -x /opt/homebrew/bin/fnm ] && eval "$(/opt/homebrew/bin/fnm env --use-on-cd --shell zsh)"' >> ~/.zshenv
```

Dos detalles que parecen quisquillosos y no lo son:

- **En `~/.zshenv`** porque zsh lo lee en *todas* las invocaciones, incluida la shell no
  interactiva con la que git ejecuta los hooks. `~/.zshrc` solo cubre las interactivas y
  `~/.zprofile` solo las de inicio de sesión, así que con cualquiera de los dos el pin quedaría
  inactivo justo donde hace falta.
- **Con la ruta absoluta** porque `~/.zshenv` se lee *antes* que `~/.zprofile`, que es donde vive
  `brew shellenv`. En ese momento `fnm` todavía no está en el PATH, el `eval` falla con
  `command not found: fnm` y no se añade ningún Node.

Por último, pnpm, que llega por corepack y no por Homebrew:

```
corepack enable pnpm
```

Comprobación, y conviene hacerla **desde una shell no interactiva**, que es la que usan los
hooks, y no desde el prompt, donde puede verse bien y estar mal:

```
zsh -c 'node -v; pnpm -v'
```

No se instala Docker Desktop. En esta máquina la base de datos es gestionada, y si algún
día hace falta Postgres en local se instala nativo con `brew install postgresql@17`, que
consume una fracción de la memoria.

## 4.5 Claude Code

```
curl -fsSL https://claude.ai/install.sh | bash
```

**Cerrar la Terminal con ⌘+Q y volver a abrirla.** Solo detecta programas nuevos al
reiniciarse.

```
claude --version
```

## 4.6 Primer arranque

```
mkdir -p ~/proyectos/prueba && cd ~/proyectos/prueba && claude
```

Elegir la configuración recomendada de la Terminal y, en el inicio de sesión, **la opción
de cuenta con suscripción**, no la de clave de API. Si el enlace no se abre solo, mantener
⌘ y hacer clic encima: copiarlo a mano lo corta.

## 4.7 Protección de credenciales

```
mkdir -p ~/.claude
```
```
cat > ~/.claude/settings.json << 'EOF'
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./**/.env)",
      "Read(./**/.env.*)",
      "Read(./**/*.pem)",
      "Read(./**/id_rsa*)",
      "Read(./**/*.key)"
    ]
  }
}
EOF
```
```
cat ~/.claude/settings.json
```

Esto impide que ninguna IA lea claves aunque se le pida por error. En este proyecto importa
más que en otros: ahí dentro van las claves de Stripe y la clave de servicio de la base de
datos.

---

# Parte 5 — Preparación del relevo

> Una sola vez. La suscripción de Claude tiene un límite que se agota cada pocas horas; sin
> esta parte el trabajo se detiene, con ella no.

```
brew install anomalyco/tap/opencode
```
```
opencode --version
```

Crear la cuenta gratuita en **console.groq.com** (no pide tarjeta), ir a **API Keys**,
**Create API Key** y copiar la clave a un sitio seguro: solo se muestra una vez.

```
cd ~/proyectos/prueba && opencode
```

Dentro: `/connect`, elegir **Groq**, pegar la clave. Después `/models` y elegir el modelo
más capaz de la lista. Salir con `/exit`. La clave queda guardada para siempre.

> La suscripción de Claude no se conecta a herramientas de terceros. Anthropic lo prohíbe
> expresamente y se arriesga la cuenta. Claude se usa desde `claude`; OpenCode con su
> propia clave gratuita. Son dos puertas distintas.

---

# Parte 6 — Arranque del proyecto

## 6.1 Crear la carpeta

```
mkdir -p ~/proyectos/retorika-builder
```
```
cd ~/proyectos/retorika-builder
```
```
git init
```

## 6.2 Dejar los dossiers dentro antes de empezar

```
mkdir -p docs/dossiers docs/decisions docs/tasks fixtures/documents
```

Copiar dentro de `docs/dossiers/` los dos documentos aprobados. **Esto se hace antes del
primer encargo**: Claude va a tomar decenas de decisiones pequeñas y, si tiene los dossiers
delante, las toma alineadas con lo aprobado en lugar de inventarse un producto parecido.

## 6.3 El encargo inicial

```
claude
```

Shift+Tab hasta que aparezca **plan mode**. Después pegar:

```
Voy a construir Retorika Builder: una herramienta web para que pequeños
comercios creen su propia web en menos de diez minutos sin saber programar,
y para que el equipo de Retorika monte webs de cliente y se las entregue.

En docs/dossiers/ están los dos dossiers aprobados por dirección. Léelos
completos antes de proponer nada: son la fuente de verdad del producto.

Restricción de arquitectura que no se negocia: el sitio publicado es HTML
y CSS estáticos, sin framework en tiempo de ejecución, y tiene que funcionar
abriéndolo con doble clic después de descargarlo.

Prepara el proyecto para trabajar conmigo. Todo el código, los comentarios,
los commits y la documentación en inglés; solo los textos de la interfaz de
usuario en español, y en ficheros de traducción separados.

Quiero que crees:

1. Un monorepo con pnpm workspaces con la estructura de la Parte 3.4 del
   protocolo que te paso en docs/protocolo.md.
2. packages/schema: el modelo de documento con Zod, con número de versión y
   carpeta de migraciones, respetando las siete reglas del anexo técnico del
   dossier del módulo avanzado.
3. packages/renderer: firma pública render(doc, target) con target "dom" y
   "html", aunque por ahora solo sepa pintar una sección.
4. packages/catalog: una sola sección (Portada) con sus huecos, sus papeles
   y su cardinalidad declarados.
5. CLAUDE.md de menos de 200 líneas siguiendo la Parte 7 del protocolo.
6. .pre-commit-config.yaml con los cinco hooks de la Parte 9.1: gitleaks,
   biome, tsc, el guardián de migraciones y renderer-deps.
7. .gitignore y .claudeignore apropiados para un monorepo de TypeScript,
   incluyendo siempre .env y .env.*
8. README.md en inglés: qué es, cómo se arranca, cómo se ejecutan los tests.
9. docs/decisions/0001-static-published-sites.md como primer ADR.

No escribas todavía el editor ni la interfaz. Primero quiero el esqueleto y
el arnés de pruebas.

Si algo de los dossiers te parece contradictorio o incompleto, para y
pregúntame antes de decidir por tu cuenta. Cuando termines, explícame en
cinco líneas qué has hecho y qué has dejado sin hacer.
```

Copiar también este protocolo a `docs/protocolo.md` antes de pegar el encargo, porque el
texto lo referencia.

## 6.4 Activar el revisor local

Salir con `/exit` y en la Terminal:

```
pre-commit install
```
```
git add . && git commit -m "Add project skeleton and quality harness"
```

Si alguna comprobación sale `Failed` no es un error: el revisor ha arreglado algo por su
cuenta. Se repiten los dos comandos y la segunda vez pasan. Ocurrirá a menudo y es
exactamente lo que se busca.

## 6.5 Subir a GitHub y blindar la rama

```
gh auth login
```
```
gh repo create retorika-builder --source=. --private --push
```

En la web del repositorio: **Settings → Branches → Add rule** sobre `main`, exigiendo que
las comprobaciones pasen antes de fusionar. A partir de ese momento nada entra en el
proyecto con el build en rojo, y es el momento exacto en que esto deja de ser un
experimento.

---

# Parte 7 — El `CLAUDE.md` de Retorika Builder

Es el fichero que la IA lee al empezar cada sesión. Menos de 200 líneas, en inglés, y con
esto dentro:

**Qué es el producto, en cinco líneas.** Con el enlace a los dossiers.

**La restricción de arquitectura.** El sitio publicado es estático y sin framework. Es lo
primero que debe leer, porque es lo que más fácilmente se olvida al escribir código.

**Las siete reglas del documento**, resumidas en una línea cada una, con el enlace al anexo
técnico. La maquetación nunca posee el contenido. Cada elemento lleva un papel de
vocabulario cerrado. Los papeles se ocultan, nunca se borran. Las posiciones son relativas
a la rejilla de la sección. No hay elementos huérfanos. El estilo son referencias al
sistema. El móvil es un parche sobre el automático.

**Las zonas exclusivas de Claude** de la Parte 2, para que no delegue lo que no debe.

**Los comandos del proyecto**: `pnpm dev`, `pnpm test`, `pnpm test:invariants`,
`pnpm test:golden`, `pnpm typecheck`, `pnpm lint`, `pnpm size`, `pnpm e2e`.

**Reglas de idioma**: código, comentarios, commits y documentación en inglés; textos de
interfaz en español y siempre en ficheros de traducción.

**Reglas de estilo**: sin clases donde valga una función, sin abstracciones de tres usos
cuando hay dos, errores explícitos en lugar de silenciosos, y ninguna dependencia nueva en
`packages/renderer` sin discutirlo.

**Qué hacer antes de dar algo por terminado**: la definición de terminado de la Parte 11.

Lo que **no** va en el `CLAUDE.md`: el historial del proyecto, explicaciones largas, ni
nada que esté ya en los dossiers. Cada línea que sobra se paga en cuota todos los días.

---

# Parte 8 — Las invariantes y su arnés de pruebas

> Esta parte es la que convierte las promesas de los dossiers en algo comprobable. Sin
> ella, las siete reglas del documento son una intención.

## 8.1 La validación va en la escritura, no en el pintado

Toda mutación del documento pasa por el validador de `packages/schema`. Si un cambio
produce un documento inválido, se rechaza ahí. Así **el editor no puede generar un
documento roto**, y no hace falta que el renderizador se defienda de casos imposibles.

## 8.2 Las cinco pruebas que no se pueden saltar

Van en un job propio de CI llamado `invariants`. Si una falla, no se fusiona nada.

1. **La vista sencilla abre cualquier documento** del corpus y expone todos los campos de
   contenido, sin excepciones.
2. **Quitar la maquetación de una sección** da un resultado equivalente en contenido al
   preset del catálogo.
3. **Escalar y volver** devuelve un documento idéntico al de partida.
4. **Accionar el interruptor de herramientas cien veces** deja el documento byte a byte
   igual.
5. **Publicar produce lo mismo** con las herramientas encendidas o apagadas.

Las tres primeras se escriben también como pruebas de propiedades con fast-check:
generadores de documentos aleatorios válidos, y la afirmación de que la ida y vuelta no
pierde nada. Un caso concreto prueba un ejemplo; una propiedad prueba la regla.

## 8.3 El corpus dorado

En `fixtures/documents/` viven documentos reales, no inventados: uno por sector del
catálogo, uno con secciones libres, uno con colecciones, uno con código propio, uno con
contenido oculto y uno deliberadamente raro. Cada vez que aparezca un fallo real en
producción, **su documento entra en el corpus** antes de arreglarlo. Así el corpus crece
solo hacia donde duele.

Las pruebas doradas comparan el HTML generado con una salida guardada. Cuando cambia a
propósito, se regenera con `UPDATE_GOLDEN=1 pnpm test:golden` y **el diff se revisa en el pull request**:
es la única forma de ver que un cambio de estilo no ha alterado doscientas webs publicadas.

## 8.4 El guardián de migraciones

Un hook de pre-commit y un job de CI que fallan si `packages/schema` cambia y no aparece a
la vez un fichero nuevo en `packages/schema/migrations/` y un test de ida y vuelta entre la
versión anterior y la nueva. No es burocracia: es lo que permite que una web guardada hoy
siga abriéndose en dos años.

## 8.5 Accesibilidad y peso como pruebas, no como buenas intenciones

Los dossiers prometen una revisión previa a publicar que avisa de contraste insuficiente y
de desbordes por debajo de 320 píxeles. Eso es una función del producto, pero el
renderizador tiene que cumplirlo de serie:

- axe-core sobre el HTML de **cada preset del catálogo, cada variante y cada paleta de
  `packages/tokens`**. Contraste mínimo AA.

  > Antes esta línea decía «en claro y en oscuro», y no se podía cumplir tal cual: un documento
  > lleva exactamente un tema y en el modelo no existe el concepto de oscuro. El contraste es una
  > propiedad de la paleta, y una paleta oscura es sencillamente otra paleta de la lista. Además,
  > el contraste entre dos colores declarados es aritmética sobre la luminancia relativa, así que
  > se comprueba también en el origen, en `packages/tokens`, sin navegador: una paleta con mal
  > contraste no se puede ni declarar, y axe confirma el resultado renderizado en lugar de
  > descubrirlo.
- Comprobación de desborde horizontal a 320, 768 y 1280 píxeles.
- Presupuesto de peso por página publicada: **HTML y CSS por debajo de 60 KB comprimidos**,
  **cero JavaScript** si ninguna sección lo necesita, y **8 KB comprimidos como máximo**
  por sección interactiva.
- Lighthouse de 95 o más en rendimiento y accesibilidad sobre un sitio de muestra.

Estos números son parte del producto: son la diferencia visible frente a una web hecha con
un constructor de plantillas.

---

# Parte 9 — Calidad automática

## 9.1 El revisor local

`.pre-commit-config.yaml` con estos hooks. Se deja que Claude lo genere, pero debe contener
exactamente esto:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: <última versión>
    hooks:
      - id: gitleaks
  - repo: local
    hooks:
      - id: biome
        name: biome check
        entry: pnpm biome check --write
        language: system
        types_or: [ts, tsx, javascript, json]
      - id: typecheck
        name: tsc
        entry: pnpm typecheck
        language: system
        pass_filenames: false
      - id: schema-guard
        name: schema migration guard
        entry: pnpm schema:guard
        language: system
        pass_filenames: false
      - id: renderer-deps
        name: renderer dependency allowlist
        entry: pnpm renderer:deps
        language: system
        pass_filenames: false
      - id: coverage-ratchet
        name: coverage floor ratchet
        entry: pnpm coverage:ratchet
        language: system
        pass_filenames: false
```

Son **seis** hooks. Los tres últimos son propios de este proyecto: `schema-guard` exige la
migración cuando cambia el esquema; `renderer:deps` falla si alguien añade una dependencia de
tiempo de ejecución a `packages/renderer`, porque todo lo que entre ahí acaba viajando al sitio
del cliente; y `coverage-ratchet` falla si el suelo de cobertura baja.

Ese último existe por un motivo que conviene entender: el ADR 0006 dice que el suelo solo puede
subir, y **una regla que solo vive en prosa se incumple**. Sin el hook, bajar el umbral para
poner el CI en verde es un momento de debilidad a las once de la noche; con él, hay que escribir
un ADR y explicarse.

En local no hay rama base, así que compara contra `HEAD`. Cuando no hay nada con qué comparar
lo dice y pasa, y el bloqueo de verdad vive en CI, donde sí hay rango. Un hook que falla siempre
es un hook que se acaba saltando con `--no-verify`, y así es como se pierde un guardián.

Los commits se hacen **desde la Terminal**, no desde el panel de control de versiones del
editor. Las aplicaciones de escritorio de macOS no leen los ficheros de configuración del shell,
así que ahí los hooks se ejecutarían sin el Node fijado en el PATH.

## 9.2 La máquina que no miente

GitHub Actions en **`pull_request` hacia `main` y `push` en `main`**, con jobs separados para
poder ver de un vistazo qué ha fallado:

| Job | Qué ejecuta | Cuándo |
|---|---|---|
| `lint` | Biome | Siempre |
| `types` | `tsc --noEmit` en todos los paquetes | Siempre |
| `unit` | Vitest con suelo de cobertura sobre los paquetes del núcleo | Siempre |
| `invariants` | Las cinco pruebas de la Parte 8.2 | Siempre |
| `golden` | HTML generado contra el corpus | Siempre |
| `a11y-size` | axe-core, desbordes y presupuesto de peso | Siempre |
| `security` | `pnpm audit`, gitleaks, análisis estático | Siempre |
| `guards` | `schema:guard` con el rango de diff, `renderer:deps` y `coverage:ratchet` | Siempre |
| `e2e` | Playwright sobre los flujos críticos | Solo en pull request hacia `main` |

El disparador **no es «en cada push y cada pull request»**, como decía antes esta parte. Con un
pull request abierto, `pull_request` ya cubre cada push de esa rama, así que añadir `push` en
ramas solo duplicaría unos minutos que esta misma parte llama finitos. La consecuencia, que
conviene saber: **hasta que existe el pull request, un push a una rama no ejecuta nada.** Es
deliberado.

Los jobs corren en paralelo y ninguno depende de otro: un lint en rojo no debe esconder una
invariante rota. Cada job ejecuta **un script con nombre del repositorio**, nunca un comando
escrito solo en el YAML; si el comando vive únicamente ahí, en el portátil no se puede ejecutar
lo mismo y acaban siendo dos cosas que se mantienen por separado.

> **La protección de la rama se activa después de que estos workflows existan, no antes.**
> Un check no aparece en la lista de la protección hasta que se ha ejecutado al menos una vez,
> así que al revés te bloqueas a ti mismo: o la lista sale vacía, o exiges un nombre que no va a
> reportar nunca. El orden es: empujar la rama, abrir el pull request, esperar a que los jobs
> reporten, y entonces configurar la protección.

Los flujos críticos de Playwright son cinco y no más: cuestionario hasta web generada,
edición de un texto y recarga, cambio de paleta, pago de prueba y publicación, y descarga
del ZIP con comprobación de que el HTML abre sin servidor.

El job `e2e` se limita a los pull request porque los minutos de Actions son finitos y
Playwright es lo más lento de todo.

## 9.3 Las skills de especialista

Los roles de una empresa de software son útiles como **checklists que se invocan**, no como
agentes independientes hablando entre ellos. Aquello multiplica errores y ningún modelo
puede certificarse a sí mismo.

En `.claude/skills/` van, cada una con su checklist en inglés:

- `security-review` — entradas sin validar, permisos, propiedad de la web, webhooks.
- `db-review` — índices, claves, migración reversible, qué pasa con los datos existentes.
- `renderer-review` — invariantes, peso, accesibilidad, salida determinista.
- `payments-review` — idempotencia del webhook, estados intermedios, qué pasa si el pago
  se cae a mitad.
- `release-check` — antes de tocar producción.

Se invocan a mano: *«usa la skill renderer-review sobre estos cambios»*.

## 9.4 Comandos propios del proyecto

En `.claude/commands/` conviene tener al menos tres, porque son las tareas que se repiten
cada semana:

- `/invariantes` — ejecuta el arnés completo y resume en cinco líneas qué ha fallado.
- `/sitio-de-prueba` — genera un sitio del corpus, lo abre en el navegador y mide peso.
- `/repasar-tarea` — compara lo que hay sin guardar con `docs/tasks/<tarea>.md` y lista las
  desviaciones.

---

# Parte 10 — Ramas, commits y pull requests

- `main` siempre desplegable y protegida.
- Una rama corta por tarea: `feat/questionnaire`, `fix/revert-loses-mobile-diff`. Vida
  máxima de dos días; más allá, se parte la tarea.
- Commits en inglés y en formato convencional: `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`. El historial así se puede leer y se pueden generar notas de versión.
- Un pull request por tarea, con el enlace a su fichero de `docs/tasks/`. La descripción
  dice qué invariantes toca y, si toca alguna, qué prueba lo demuestra.
- **Guardar a menudo.** Cada vez que algo funcione, `git add .` y `git commit`. Es la red
  de seguridad, y con IA de por medio se usa más de lo que parece.

---

# Parte 11 — El protocolo de tarea

El fichero de tarea es el contrato entre Claude, OpenCode y el yo de dentro de tres días.
Se escribe **siempre** antes de implementar, en `plan mode`, y cuesta poca cuota.

## 11.1 La plantilla

```markdown
# <Nombre de la tarea>

## Objetivo
Una frase. Qué tiene que ser cierto cuando esté hecho.

## De dónde viene
Apartado del dossier o ADR que lo pide.

## Ficheros que se pueden tocar
Lista cerrada. Nada fuera de esta lista sin preguntar.

## Invariantes que toca
Ninguna / las que sean, con la prueba que lo demuestra.

## Pasos
1. ...
2. ...

## Definición de terminado
- [ ] Tests nuevos que fallaban antes y ahora pasan
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` en verde
- [ ] `pnpm test:invariants` en verde
- [ ] Si cambia la salida publicada: golden regenerado y diff revisado
- [ ] Si cambia el esquema: migración y test de ida y vuelta
- [ ] Textos de interfaz en español y en el fichero de traducción
- [ ] Sin claves ni datos reales en el código

## Fuera de alcance
Lo que alguien podría añadir por su cuenta y no debe.
```

## 11.2 Cómo se pide

```
Antes de implementar nada, escribe el plan en docs/tasks/<nombre>.md
siguiendo la plantilla de la Parte 11 del protocolo. Sé concreto y
explícito, porque este plan lo puede ejecutar otro modelo menos capaz que
tú. Si el plan toca packages/schema, packages/renderer o packages/catalog,
dilo en la primera línea, porque entonces lo ejecutas tú y no OpenCode.
```

La lista cerrada de ficheros es la parte que más se agradece: es lo que evita que un
encargo de dos horas vuelva con veinte ficheros cambiados.

---

# Parte 12 — Rutina diaria

Para volver al proyecto hacen falta dos comandos:

```
cd ~/proyectos/retorika-builder
```
```
claude
```

Nada de `git init`, ni encargo inicial, ni `pre-commit install`. Eso ya está hecho.

## Los cinco hábitos

**1. Plan primero.** Shift+Tab hasta *plan mode* antes de pedir algo que importe.
Descubrir que el enfoque era equivocado en el plan es barato; descubrirlo a medio construir
es caro.

**2. `/clear` al cambiar de tarea.** Si se lleva una hora con el renderizador y ahora toca
Stripe, primero `/clear`. Arrastrar conversación vieja empeora las respuestas y consume
cuota mucho más rápido. **Es el hábito que más ahorra.**

**3. Un servidor a la vez.** En un portátil de 16 GB, `pnpm dev` más Vitest en modo watch
más Playwright a la vez se traduce en ventilador y en respuestas lentas. Se arranca lo que
se está usando.

**4. Commit cada vez que algo funcione.**

**5. Mirar `/usage` de vez en cuando.** Cuando quede poca cuota, cambiar de estrategia: en
lugar de pedir implementación, pedir **planes**. Un plan cuesta poco y desbloquea horas de
trabajo en OpenCode.

## Atajos dentro de Claude

| Tecla o comando | Qué hace |
|---|---|
| **Shift + Tab** | Cambia de modo. Hasta que ponga *plan mode*. |
| **`/clear`** | Conversación limpia. |
| **`/usage`** | Cuánta cuota queda. |
| **`Esc`** | Para a la IA en seco. |
| **`/exit`** | Salir. |

---

# Parte 13 — El relevo cuando se agota la cuota

No es «usar OpenCode cuando Claude se acabe». Es **preparar el relevo antes de que ocurra**.

**Paso 1, con cuota.** Escribir el fichero de tarea de la Parte 11. Ese fichero es el
testigo de la carrera: con él, OpenCode no necesita criterio propio.

**Paso 2, sin cuota.** En el mismo proyecto:

```
opencode
```
```
Lee docs/tasks/<nombre>.md y ejecútalo exactamente como está descrito. No
toques ningún fichero que no esté en la lista de ficheros permitidos. No
toques packages/schema, packages/renderer ni packages/catalog bajo ninguna
circunstancia. Si algo del plan no queda claro, para y pregúntame en vez de
improvisar.
```

Mientras teclea, el revisor local vigila cada cambio que se guarda.

**Paso 3, cuando Claude vuelve.** Lo primero:

```
Revisa los cambios sin guardar buscando bugs, problemas de seguridad y
desviaciones respecto a docs/tasks/<nombre>.md. Ejecuta pnpm test:invariants
y dime qué hay que arreglar antes de hacer commit.
```

Claude no ha escrito ni una línea, pero ha decidido qué hacer y ha certificado que está
bien hecho. Ahí está la calidad de producción.

## Qué delegar y qué no

| A Claude, siempre | A OpenCode, sin miedo |
|---|---|
| Modelo de documento y renderizador | Componentes de interfaz desde un diseño cerrado |
| Presets nuevos del catálogo | Tests a partir de un plan |
| Cualquier cosa con dinero o permisos | Refactores mecánicos y renombrados |
| Migraciones | Textos de interfaz y traducciones |
| Depurar algo que no se entiende | Documentación y comentarios |
| Revisar antes de dar algo por bueno | Scripts de utilidad |

---

# Parte 14 — Orden de construcción por fases

Las fases 1 a 4 vienen de los dossiers. La **fase 0 es nueva** y es la aportación más
importante de este protocolo: construye primero el esqueleto completo y delgado, de punta a
punta, porque es donde está todo el riesgo técnico del producto.

## Fase 0 — Esqueleto andante

Una sola sección, un solo tema, sin editor apenas. Pero el camino completo funcionando:
documento validado, renderizado a HTML, empaquetado y descargable en ZIP, con las cinco
invariantes en verde y el CI montado.

**Criterio de aceptación:** generar un sitio de una sección, descargar su ZIP, abrirlo con
doble clic y que se vea igual; y servir esos mismos archivos desde un servidor estático
cualquiera, como haría el alojamiento del cliente, sin cambiar un byte. Y las cinco
invariantes en verde en CI, no en local.

> Antes el camino decía «empaquetado, publicado en un subdominio y descargable en ZIP», y el
> criterio empezaba por «publicar un sitio de una sección en un subdominio real». La dirección
> ha dejado en pausa la publicación en un dominio o subdominio de Retorika hasta elegir el
> dominio y la cuenta de alojamiento (ADR 0007, 22 de septiembre de 2026): al lanzamiento, la
> web se entrega al cliente para que la publique en su propio dominio. El servidor estático
> cualquiera ocupa el lugar del subdominio en lo que importa para el lanzamiento —que los
> archivos funcionan servidos por HTTP, no solo abiertos desde el disco— sin depender de una
> infraestructura nuestra. Lo que solo comprobaba el subdominio (el Worker, R2 y el DNS
> comodín) queda pendiente para cuando se reactive. El Worker que sirve los subdominios
> (`apps/serve`) sigue construido y probado, pero no se despliega.

Si esto funciona, el resto del proyecto es trabajo. Si no, cualquier cosa que se construya
encima habrá que rehacerla.

## Fase 1 — Lo imprescindible

Cuestionario de cinco preguntas, generación de las tres variantes, catálogo de secciones,
edición sobre el propio texto, reordenar, duplicar, borrar, guardado automático y deshacer.

**Criterio de aceptación:** una persona de fuera del equipo, sin explicación previa y sin
ayuda, monta la web de un negocio real en menos de diez minutos. Se cronometra y se
observa, no se pregunta.

## Fase 2 — El producto completo

Estilo global, variantes de sección, fotos, lo mínimo de SEO, páginas orgánicas, publicar,
descargar y **el cobro por pago único con su factura**.

**Criterio de aceptación:** un desconocido paga y publica sin ayuda, y la factura sale bien.
Probado también el camino desagradable: pago que falla a mitad, webhook duplicado y tarjeta
rechazada.

> Mientras dure la pausa del ADR 0007, «publicar» significa entregar los archivos, también en
> el criterio de aceptación: el cliente descarga su web y la sube a su propio alojamiento. La
> publicación en un subdominio de Retorika vuelve a formar parte del alcance cuando se
> reactive.

## Fase 3 — Lo que diferencia

Modo estudio completo: rejilla, sistema de estilo, control por dispositivo, colecciones,
interacciones. Escalada y vuelta. Galería de plantillas con filtros y valoraciones.
Extracción de plantillas sin contenido, sin tipografías subidas y sin código propio.

**Criterio de aceptación:** la ida y vuelta es sin pérdidas sobre todo el corpus, y un
diseñador externo publica una plantilla que entra en el catálogo con su estructura intacta y
sin un solo byte de su contenido.

## Fase 4 — Lo que cambia el producto

Áreas privadas con login. Deja de ser un archivo estático y pasa a ser una aplicación con
base de datos, así que **no cabe en el pago único** y necesita su propio modelo de cobro,
que se decide al llegar. Antes de escribir una línea de esta fase, un ADR.

---

# Parte 15 — Secretos, pagos y datos personales

## Secretos

- Nunca dentro del proyecto. Ni en un comentario, ni «temporalmente». Siempre en
  `.env.local`, que está en el `.gitignore`.
- Un `.env.example` con los nombres de las variables y sin un solo valor, para que se sepa
  qué hace falta sin filtrar nada.
- Claves distintas para desarrollo y producción. La clave de servicio de la base de datos
  no se usa nunca desde el navegador.
- Si una clave se filtra, se rota primero y se investiga después. Reescribir el historial
  de git no sirve: hay que asumir que ya está fuera.

## Pagos

- Stripe en modo pago único, con Checkout. **Ningún dato de tarjeta pasa por nuestro
  servidor**, y así queda fuera del alcance de PCI.
- El precio es un objeto Price en Stripe, no un número en el código. Cuando dirección fije
  el «XX €», es un cambio de configuración.
- El webhook es idempotente: el mismo evento dos veces no publica dos webs ni cobra dos
  veces. Se prueba a propósito.
- Los estados intermedios existen y se guardan: pendiente de pago, pagada, publicada. Una
  web pagada cuya publicación falle se publica sola al reintentar, sin volver a cobrar.

## Datos personales

Aquí hay datos de dos niveles: los de nuestros clientes y los de los clientes de nuestros
clientes, que llegan por los formularios de sus webs. El segundo nivel es el delicado.

- Recoger lo mínimo y guardarlo el menor tiempo posible.
- Los envíos de formulario van al correo del dueño de la web; si además se guardan, se dice
  claramente y se puede borrar.
- Aviso legal, política de privacidad y condiciones de uso antes de cobrar el primer euro,
  no después. Las condiciones incluyen lo aprobado sobre plantillas de terceros: entrar en
  el catálogo no se retribuye y solo se aprovecha la estructura.
- Borrado de cuenta que borre de verdad, con una ventana de gracia razonable.

---

# Parte 16 — Despliegue, copias y el compromiso de no secuestrar webs

## Despliegue

- La aplicación se despliega sola al fusionar en `main`, con el CI en verde como condición.
- Los sitios publicados no se despliegan: se escriben en el almacenamiento de objetos y los
  sirve un Worker. Publicar una web es una operación de segundos y no toca nuestra
  aplicación.
- Cada publicación guarda una versión. Volver atrás es cambiar un puntero.

> Las dos últimas viñetas, y la de «Sitios publicados» en Copias, se aplican cuando se
> reactive la publicación en un dominio o subdominio de Retorika (ADR 0007). Mientras tanto no
> hay sitios publicados por nosotros: cada web vive en el alojamiento de su cliente.

## Copias

- Base de datos: copia diaria automática y **una restauración de prueba al mes**. Una copia
  que no se ha restaurado nunca no es una copia, es una esperanza.
- Sitios publicados: versionado en el propio almacenamiento.
- El código está en GitHub y en el portátil. Time Machine cubre el portátil.

## El compromiso que condiciona el diseño

Los dossiers prometen que el propietario de una web nunca se queda fuera de ella. Eso se
traduce en tres reglas técnicas:

1. **La exportación siempre funciona**, incluso con la cuenta caducada o en disputa.
2. **El desbloqueo siempre está disponible** para el propietario, con su aviso.
3. **Ninguna web publicada depende de una API nuestra** para seguir viéndose.

Si alguna vez una decisión técnica choca con una de estas tres, gana la regla.

---

# Parte 17 — Observabilidad y qué hacer cuando algo se cae

- Sentry en el editor y en la API, con el número de versión en cada error. Sin esto, un
  fallo en el editor de un cliente no se sabe nunca.
- Una comprobación externa cada cinco minutos sobre un sitio publicado de muestra. Es la
  única forma de enterarse de que los sitios de los clientes han dejado de servirse.

  > Se aplica cuando se reactive la publicación alojada (ADR 0007). Mientras tanto no hay un
  > sitio publicado nuestro que vigilar.
- Registro de las operaciones que importan: publicación, pago, transferencia de propiedad,
  desbloqueo. Quién, cuándo y sobre qué web.
- `docs/runbook.md` con los cuatro casos previsibles y qué se hace en cada uno: un sitio
  publicado no se sirve, un pago cobrado sin web publicada, el editor no guarda, una
  migración a medias. Escrito antes de que pase, porque a las tres de la mañana no se
  improvisa.

---

# Parte 18 — Rendimiento en un M4 de 16 GB

El M4 va sobrado de CPU. Lo que se agota es la memoria, y con ella la paciencia.

**Lo que más se nota**

- `pnpm` en lugar de `npm`: enlaza en vez de copiar y ahorra varios GB en un monorepo. Llega por
  **corepack**, no por Homebrew, para que mande el campo `packageManager` del repositorio.
- Biome en lugar de ESLint más Prettier: un binario nativo frente a dos procesos de Node.
- Base de datos gestionada en lugar de Docker Desktop. Docker en esta máquina se come 2 o
  3 GB para no aportar nada que no dé Supabase.
- Un solo proceso en marcha: o `pnpm dev`, o los tests en watch, o Playwright.

**Ajustes concretos**

- Vitest con 4 hilos como máximo; por defecto abre uno por núcleo y se atraganta.
- Playwright con 2 workers y navegador único (Chromium) en local; el resto de navegadores,
  en CI.
- `NODE_OPTIONS=--max-old-space-size=4096` solo cuando un build concreto lo pida, no de
  forma permanente.
- El proyecto **fuera de iCloud, del Escritorio y de Documentos**. `~/proyectos` es local y
  no se sincroniza: un `node_modules` sincronizándose es el peor enemigo del ventilador.
- Cerrar el navegador antes de lanzar Playwright.

**Lo que no se hace en esta máquina**

No se montan modelos de IA en local. Con 16 GB, lo que cabe es peor que lo que ya se tiene
gratis en la nube, y este portátil no tiene ventilador.

---

# Parte 19 — Chuleta de comandos

| Situación | Qué escribir |
|---|---|
| Volver al proyecto | `cd ~/proyectos/retorika-builder` → `claude` |
| Seguir sin cuota | `cd ~/proyectos/retorika-builder` → `opencode` |
| Arrancar el editor | `pnpm dev` |
| Todas las pruebas | `pnpm test` |
| Solo las invariantes | `pnpm test:invariants` |
| Pruebas doradas | `pnpm test:golden` |
| Regenerar las doradas | `UPDATE_GOLDEN=1 pnpm test:golden` |
| Tipos | `pnpm typecheck` |
| Peso del sitio generado | `pnpm size` |
| Flujos en navegador | `pnpm e2e` |
| Guardar el trabajo | `git add .` → `git commit -m "feat: ..."` |
| Subirlo | `git push` |
| Ver el proyecto en Finder | `open ~/proyectos/retorika-builder` |
| Me he perdido | `cd ~` |
| Otra ventana de Terminal | `⌘ + N` |
| Parar a la IA en seco | `Esc` |
| Conversación limpia | `/clear` |
| Cuota restante | `/usage` |

---

# Parte 20 — Problemas frecuentes

**`command not found: claude` (o `brew`, `pnpm`, `opencode`)**
Cerrar la Terminal con ⌘+Q y abrirla de nuevo. Si persiste con `claude`:
`echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc` y reiniciar la Terminal.

**`node not found` al abrir una Terminal nueva**
Hay dos causas y se distinguen a simple vista. **Si al abrir la Terminal aparece también
`command not found: fnm`**, es que la línea de `~/.zshenv` no usa la ruta absoluta: `~/.zshenv`
se lee antes que `~/.zprofile`, donde vive `brew shellenv`, así que `fnm` todavía no está en el
PATH y el `eval` falla sin añadir ningún Node. Se arregla dejando la línea así:

```
[ -x /opt/homebrew/bin/fnm ] && eval "$(/opt/homebrew/bin/fnm env --use-on-cd --shell zsh)"
```

**Si no aparece ese mensaje**, es que falta la versión predeterminada: `fnm use` solo afecta a la
sesión en curso. Se arregla con `fnm default 24.21.0`.

En los dos casos duele más desde que no hay Node de Homebrew, porque ya no queda ninguno de
reserva. Comprobar siempre con `zsh -c 'node -v'`, que es la shell que usan los hooks.

**La IA no ve los ficheros del proyecto**
Se ha arrancado desde la carpeta equivocada. `/exit`, `cd` a la carpeta correcta y volver a
lanzarla. **Este es el error número uno.**

**Sale `Failed` al hacer commit**
No es un fallo: el revisor ha corregido algo. Repetir `git add .` y el commit.

**`pnpm install` se eterniza o se queda sin memoria**
`pnpm store prune` y volver a intentarlo. Si sigue, cerrar el navegador: son los 2 GB que
faltaban.

**Las pruebas doradas fallan y el cambio era a propósito**
`UPDATE_GOLDEN=1 pnpm test:golden` y **revisar el diff antes de hacer commit**. Si el diff toca secciones
que no se han tocado, no era a propósito.

**El guardián de migraciones bloquea el commit**
Ha cambiado el esquema sin migración. No se desactiva el hook: se escribe la migración.

**Una web publicada no se ve**
`docs/runbook.md`, primer caso. Lo primero es comprobar si es un sitio o todos: si es uno,
es su último despliegue; si son todos, es el Worker o el almacenamiento.

**Se ha alcanzado el límite de uso de Claude**
Se restablece en unas horas. Mientras tanto: OpenCode con un plan ya escrito, o revisar,
documentar y planificar.

**Algo se ha roto y no se sabe por qué**
Si se ha hecho commit a menudo, siempre se puede volver atrás. *«Algo se ha roto, ayúdame a
volver al último estado que funcionaba.»*

---

# Parte 21 — Reglas de oro y lo que nunca se hace aquí

## Las nueve que se cumplen siempre

1. **Un proyecto, una carpeta.** Y siempre `cd` antes de `claude`.
2. **Plan primero, código después.** En `plan mode` y con fichero de tarea.
3. **`/clear` al cambiar de tarea.** El hábito que más cuota ahorra.
4. **Commit cada vez que algo funciona.**
5. **El sitio publicado es estático.** Si una solución exige que la web del cliente llame a
   nuestra API, la solución está mal.
6. **Las siete reglas del documento no se rompen.** Si una tarea parece exigirlo, la tarea
   está mal planteada: se escribe un ADR antes de tocar nada.
7. **Ni el esquema ni el renderizador ni el catálogo los toca OpenCode.**
8. **Nada se fusiona con el CI en rojo.** Tampoco «solo esta vez».
9. **Las claves siempre en `.env.local`.** Nunca en el código, nunca en un comentario.

## Lo que nunca se hace

**No dejar agentes trabajando sin supervisión.** Que una IA despliegue sola es como se
pierde una base de datos.

**No fusionar código generado sin mirarlo.** Aunque sean treinta segundos, siempre pasa por
ojo humano.

**No enviar datos de cliente a la capa gratuita.** Los servicios gratuitos suelen entrenar
con lo que se les manda. Los documentos reales de clientes y cualquier cosa bajo acuerdo de
confidencialidad van por Claude, y punto. Para el corpus de pruebas se usan documentos
anonimizados.

**No conectar la suscripción de Claude a herramientas de terceros.** Anthropic lo prohíbe
expresamente y se arriesga la cuenta.

**No desactivar un hook para poder hacer commit.** El hook es el único que no puede ser
complaciente.

**No tocar producción un viernes por la tarde.**

**No montar modelos de IA en local en este MacBook.**

---

# Parte 22 — El límite honesto de este sistema

Con este protocolo se puede construir, probar, desplegar, cobrar y mantener un producto
real y bien hecho, en solitario, con un portátil de 16 GB. Es más de lo que consigue mucha
gente con un equipo detrás.

Lo que no da es una empresa funcionando sola. Producción de verdad incluye decidir qué
construir, responder cuando algo se cae de madrugada, hablar con quien lo usa y asumir la
responsabilidad de lo que se entrega. **La persona sigue siendo la empresa; la IA es la
plantilla técnica.**

Y hay un límite propio de este proyecto que conviene tener presente: el producto promete
simplicidad al usuario, y la simplicidad no se prueba con tests. Se prueba poniendo la
herramienta delante de alguien que no la ha visto nunca y callándose mientras la usa. Esa
parte no la puede hacer ninguna IA, y es la que decide si Retorika Builder gana a Canva o
no.

---

*Documento de trabajo de Retorika Builder. Si algún paso no se comporta como está descrito,
copiar el mensaje de error completo antes de intentar arreglarlo por cuenta propia.*
