import type { Answers } from "./answers.ts";

/**
 * The id `buildLocation` gives the section it builds, and the id the cover's "visit" button
 * anchors to. One constant rather than the same string written in two files, because the day
 * they drift the button points at nothing and only the download route notices.
 */
export const LOCATION_SECTION_ID = "sec-location";

/**
 * Whether these answers produce a "Horario y ubicación" section at all — question 4 skipped, or
 * "no tengo local", and there is none.
 */
export function hasLocationSection(answers: Answers): boolean {
  return !answers.noPremises && answers.address.trim() !== "";
}

/**
 * Where the main action's button points, from what question 5 actually collected.
 *
 * Returns `null` for "visit" and for any action whose destination field is empty — a contact
 * section is never generated pointing nowhere, and the cover's button is simply left off, since
 * it is optional there (0..1).
 */
export function resolveDestination(answers: Answers): string | null {
  switch (answers.mainAction) {
    case "call":
      return answers.phone.trim() === "" ? null : `tel:${answers.phone.trim().replace(/\s+/g, "")}`;
    case "book":
      return answers.bookingLink.trim() === "" ? null : answers.bookingLink.trim();
    case "message": {
      const digits = answers.whatsapp.replace(/\D/g, "");
      return digits === "" ? null : `https://wa.me/${digits}`;
    }
    case "email":
      return answers.email.trim() === "" ? null : `mailto:${answers.email.trim()}`;
    case "visit":
    case null:
      return null;
  }
}

/** The secondary phone under "que reserven", when the owner asked for it too. */
export function secondaryPhoneDestination(answers: Answers): string | null {
  if (answers.mainAction !== "book" || !answers.alsoPhone || answers.phone.trim() === "") {
    return null;
  }
  return `tel:${answers.phone.trim().replace(/\s+/g, "")}`;
}

/**
 * Where "que vengan al local" sends someone: down the page, to the address.
 *
 * Question 5's fifth answer names no destination of its own — no phone, no link, nothing to
 * open — so until sections carried anchors the honest thing was to emit no button at all, and
 * ADR 0016 recorded the hole that left: answer question 4, skip question 5, and the site shows
 * an address and opening hours with no call to action anywhere on it.
 *
 * An anchor closes it without inventing anything. The destination is the owner's own address,
 * which they typed, on their own page. `null` when there is no location section to point at,
 * because a button to a section that does not exist is exactly the dead link the download route
 * refuses.
 */
export function visitAnchor(answers: Answers): string | null {
  if (answers.mainAction !== "visit" || !hasLocationSection(answers)) return null;
  return `#${LOCATION_SECTION_ID}`;
}
