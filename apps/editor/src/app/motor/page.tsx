import { render } from "@retorika/renderer";
import { parseDocument } from "@retorika/schema";
import fixture from "../../../../../fixtures/documents/contacto-y-horario.json" with {
  type: "json",
};

/**
 * Day one's spike proof, kept reachable as a technical check rather than deleted: that
 * @retorika/renderer resolves and runs inside this Next.js app, rendering a real document
 * through the same render(doc, "html") path the golden corpus checks byte for byte. Moved off
 * "/" on day two, which now holds the real questionnaire.
 */
export default function MotorCheck() {
  const doc = parseDocument(fixture);
  const { html } = render(doc, "html");

  return (
    <main style={{ padding: "24px", maxWidth: "1180px", margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "6px" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            background: "linear-gradient(135deg, #2B9BF4, #1554D8)",
            borderRadius: "9px",
            color: "#FFFFFF",
            fontSize: "17px",
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          R
        </span>
        <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em" }}>
          Retorika Builder — comprobación técnica
        </span>
      </header>

      <p style={{ margin: "0 0 20px", color: "var(--ui-muted)", fontSize: "15px" }}>
        Esto no es una maqueta: la web de abajo la ha dibujado el motor de Retorika a partir de un
        documento real, con el mismo código que se descargará el cliente.
      </p>

      <div
        style={{
          background: "var(--ui-surface)",
          border: "1px solid var(--ui-border)",
          borderRadius: "var(--ui-radius)",
          overflow: "hidden",
        }}
      >
        <iframe
          title={`Vista previa de ${doc.siteName}`}
          srcDoc={html}
          style={{ display: "block", width: "100%", height: "860px", border: 0 }}
        />
      </div>
    </main>
  );
}
