import es from "@/locales/es.json" with { type: "json" };
import { Questionnaire } from "@/questionnaire/Questionnaire.tsx";

export const metadata = { title: es["landing.start"] };

/**
 * The five questions, which used to live at `/`.
 *
 * They moved when the landing arrived (ADR 0034 §2 and §20), and this is the only navigation
 * change of the sprint — so it is made in one place and said out loud rather than discovered.
 * Nothing about the questionnaire itself changed: no account is asked for here, and `/` links
 * straight in.
 */
export default function Page() {
  return <Questionnaire />;
}
