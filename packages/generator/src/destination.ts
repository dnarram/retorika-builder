import type { Answers } from "./answers.ts";

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
