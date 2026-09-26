# Session 1 — Taberna Santo Domingo, 25 September 2026

The first of the two usability sessions the concept dossier asked for, and the first time anyone
outside the team used the tool. Written up from the facilitator's notes.

**Run against:** the deployed `apps/editor`, not the static prototype.

> The facilitator's template still carried the word `prototipo` in its "Contra:" field, left over
> from the blank; the covering note says the deployed editor, and the owner's own remark about
> content being "disponible en la fase 2" only makes sense there — the `Fase 2` badges on the rail
> exist in the editor and in mockup 08, never in `docs/design/prototype/`. Recorded here because
> ADR 0017 makes which one was used load-bearing, and a reader a month from now should not have to
> re-derive it.

**Had a website before:** no.

## What this session does not settle

Three limits, stated before the findings so nothing below is read as more than it is.

1. **It is one business.** ADR 0017 is explicit that the two sessions are "two experiments of one
   subject each", not a sample of two. One is not half of a sample either. Nothing here is a rate,
   a tendency or a majority.
2. **Nothing was timed.** Neither the questionnaire nor the decision at screen 07. **The phase 1
   acceptance criterion is therefore not measured by this session** and is measured by the timed
   session instead.
3. **The ADR 0016 question was not asked word for word.** See the Contact section below. That ADR's
   reopening condition rests on comparing two answers to the *same* question, so this one cannot
   be one of them.

## Screen by screen

**No doubts, on any screen.** The facilitator recorded none for the name and logo, the sector,
what you offer, where you are, the main action, the generation wait or the three variants.

This is the negative finding that matters most this week, and it is worth naming as one:
**ADR 0017's reopening condition is not triggered.** That ADR crossed a gate on the promise that
"if the first session shows the **questionnaire itself** is misunderstood … the screens change
before anything else is built on top of them." It did not. The screens stand and the sprint
proceeds.

## His words → ADR 0009, ADR 0010

- **His trade:** «Restaurante», «negocio familiar», «bar de toda la vida».
- **His services:** «comida con sabor», «comida tradicional».
- **He found his sector among the ten** and did not go looking for his exact case.
- **He read the grid; he did not use the search field.**

## The three variants

- **Chose "Con foto grande", by name.**
- **Looked at all three, then took the highlighted one.** Taberna's rotation put "Con foto grande"
  in the middle, highlighted position (`docs/design/prototype/guion-de-prueba.md`). Looking at all
  three first and still taking the highlighted one is exactly the case the rotation exists to
  detect, and with one session it cannot be told apart from genuinely preferring that composition.
  It needs the second session's rotation to mean anything.
- **Did not open "Ver a tamaño real".**

## Contact → ADR 0016

**Asked word for word: no.** The exact wording used was not recorded.

His answer, quoted:

> «Quiero que el cliente me contacte por teléfono, whatssap, correo, formulario o alguna red
> social en el futuro»

**He said «formulario» and «correo» without anyone suggesting them.**

Two things follow, and they pull in different directions, so both are written down:

- **This cannot count as one of ADR 0016's two answers.** The reopening condition compares two
  answers to one question asked unchanged. Counting a paraphrase would make the comparison
  describe something that did not happen. The ADR stays `proposed`.
- **The unprompted «formulario» is real signal and points at reopening.** ADR 0016's condition is
  "if either of the two says they expect messages to arrive from the web". He named a form
  spontaneously, in a list of five channels, with «en el futuro» attached — which is not the same
  as expecting one today. It is not admissible, and it is not nothing.

## The five closing questions

1. **«¿Publicarías esto tal y como está?»** — «Puede ser.»

   The script treats "Sí, pero…" as a no with a reason. «Puede ser» is the same shape, and the
   reason is the next answer.

2. **«¿Qué le falta?»**

   > «Le falta potencia visual, muchos mas elementos gráficos e imágenes y extension de la página
   > con secciones más extensas para tener apariencia profesional y convencer a clientes. Por
   > ejemplo le falta una sección para mostrar los platos estrella o poner la carta del
   > restaurante.»

3. **«¿Qué le sobra?»** — «No veo que le sobre nada.»

4. **«¿Estos textos suenan a los tuyos?»**

   > «Los míos serían más explicativos, un poco más extensos tal vez pero dependerían del
   > contenido visual e imágenes. En el prototipo mostrado la página me parece algo vacía y fría.»

5. **«Si esto costase un pago único, ¿por cuánto te parecería bien?»**

   > «Ahora mismo no pagaría nada. Pero por una página web profesional podría pagar 50 euros (pago
   > a un extra esta cantidad por un día de trabajo).»

   Worth noting *how* he priced it: against a day of somebody's labour, not against other websites.

## Photos → ADR 0011

Unprompted, he said of the sample photo:

> «La foto de muestra es pobre pero entiendo que debo añadir mi propia foto para que luzca
> profesional»

## "Qué hago" cards → ADR 0013

- **Ticked four suggestions. Added none of his own.**
- **Did not believe they came pre-ticked.**

## What he tried to do and could not

> «No puedo editar el contenido de manera avanzada ya que se indicaba que el contenido estaría
> disponible en la fase 2.»

He read the dimmed `Estilo`, `Fotos` and `Páginas` rail items and their `Fase 2` badges, and took
them as the answer to what he wanted to do. The badges did their job — nobody implemented a
phase-2 feature by reading the screen — and the thing he wanted was a phase-2 feature.

## Not recorded

Left blank on purpose rather than reconstructed: the two timings, the exact wording of the contact
question, and anything about colour (he did not raise it, and the script forbids asking).
