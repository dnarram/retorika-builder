import { Questionnaire } from "@/questionnaire/Questionnaire.tsx";

/**
 * Day two: the real five-question flow, transcribed from the approved mockups
 * (docs/design/mockups/01–05, 09, 10). See apps/editor/src/questionnaire/ for the pieces, and
 * /motor for day one's proof that the renderer runs inside this app.
 */
export default function Home() {
  return <Questionnaire />;
}
