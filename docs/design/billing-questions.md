# The billing questions — what direction has to answer before the first euro

**Six questions, addressed to direction.** They exist as a file because one line in a table was
not enough to act on: `HANDOFF.md`'s open list says «Who issues the invoice and how VAT is
handled — Direction — Needed before the first euro is charged», and that single line hides at
least six separate decisions, each of which changes different code.

**Development cannot answer any of them**, and this document does not try. It does not say what
Spanish law requires, what a given entity must do, or which option is correct — the same
discipline ADR 0019 applied to the footer's warning, for the same reason: we do not know, it
depends on the business, and a tool that guesses is worse than one that asks. What each question
does carry is **what is blocked until it is answered**, so the cost of leaving it open is visible.

Written 28 September 2026, at the close of sprint 3, when charging was moved out of sprint 4
because of it.

---

## What is already decided, and is not being reopened

Listed first so none of it is answered again by accident. All of it is `docs/protocolo.md`, Part 15
(«Pagos»), and none of the questions below touch it:

- **Stripe, single payment, through Checkout.** Not a subscription. No card data reaches our
  server, which keeps us out of PCI scope.
- **The price is a Stripe Price object, not a number in the code.** Setting the «XX €» is a
  configuration change.
- **The webhook is idempotent**, and is tested for it on purpose: the same event twice neither
  publishes twice nor charges twice.
- **Three states exist and are stored**: pending payment, paid, published. A paid site whose
  publication fails publishes itself on retry, without charging again.

And **the amount itself is a different open question**, already filed: `HANDOFF.md`'s first row.
Two owners answered it and overlap at 50 €. Nothing below depends on the number.

---

## The six

### 1. Who issues the invoice, and as what entity?

The legal name, the tax number, and the address that appear on it. Whether that entity is the
same one the customer's contract is with.

**Blocked until answered:** the invoice template has no issuer, and the terms of use have no
counterparty — which is the document Part 15 says has to exist before the first euro anyway.

### 2. Is the advertised price VAT-inclusive or VAT-exclusive?

Mockups 12 and 15 show one number, `XX €`. Whether that number is what the buyer pays or what the
buyer pays before tax is not a detail of the total: it changes what the screen says next to it.

**Blocked until answered:** how the Stripe Price object is created, and the Spanish copy on the
checkout screen. A price shown one way and charged the other is the kind of thing a customer is
right to complain about, and it is invisible in code review.

### 3. Is the buyer a business, a consumer, or both?

If a business can buy, its tax number belongs on the invoice, which means checkout has to ask for
one — a field on a screen that is already designed without it.

**Blocked until answered:** whether the checkout screen grows a field, and whether that field is
required, optional, or shown only on request.

### 4. What happens on a sale outside Spain?

Whether we sell outside Spain at all is the first half of this. If we do, someone has to decide
whether tax is calculated by the payment provider or by whoever issues the invoice, and whether a
buyer's tax number is verified or merely recorded.

**Blocked until answered:** whether checkout needs the buyer's country, and whether anything
validates what they type. This is also the question most likely to be answered «not yet», which is
a perfectly good answer — it just has to be the written one, because the alternative is discovering
it from the first foreign card.

### 5. Who owns the invoice series and its numbering?

Either the payment provider mints the number, or whoever keeps the books does. They cannot both.

**Blocked until answered:** whether our webhook is allowed to create an invoice record at all. If
the numbering belongs to someone else's accounting, then the webhook's job is to notify, not to
number — and that is a different piece of code from the one we would otherwise write.

### 6. What refund is possible once the ZIP has been handed over?

**This is the one that comes out of the product rather than out of accounting, and development has
something to say about it.** The constraint, and then the question:

By ADR 0001 a published site is static files with no dependency on us. Once the customer has the
ZIP, they have the whole thing; their site does not call our API, and by ADR 0008 we do not host
it. **There is nothing to switch off.** A refund cannot take the product back, and no feature
could be added to make it: that is the same property the download promise and the cost per site
rest on.

So the question is not «how do we revoke it» — we cannot. It is: **what does the buyer get if they
ask for their money back, and does the answer differ before and after the download?** Those are the
two states that actually exist in the product.

**Blocked until answered:** the terms of use, and whether the product needs any cancel path at all.
Today it has none.

---

## Not a billing question, but also standing between here and the first euro

Recorded here because it is the same deadline and it is easy to discover late. Part 15, verbatim:

> «Aviso legal, política de privacidad y condiciones de uso antes de cobrar el primer euro, no
> después. Las condiciones incluyen lo aprobado sobre plantillas de terceros: entrar en el catálogo
> no se retribuye y solo se aprovecha la estructura.»

Three documents, none of which exists. Question 1 gives them a counterparty and question 6 gives
the conditions their hardest clause, so answering those two is where they start.

---

## What happens once these are answered

The answers do not go into this file. Each lands where it is enforceable:

- **Questions 1, 5 and 6** become the terms of use and, where they constrain code, an ADR — the
  invoice numbering in particular, since «the webhook does not mint the number» is a decision a
  future reader would otherwise reverse by accident.
- **Questions 2, 3 and 4** become the checkout screens and the Price object's configuration, which
  is `REVIEW.md`'s territory: mockups 12 and 15 were drawn before any of this was asked, so
  whatever the answers are, that is where the divergence gets written down.
- **This file then stops being a question list** and becomes a pointer to those, the same way every
  other row of `docs/tasks/backlog.md` works.
