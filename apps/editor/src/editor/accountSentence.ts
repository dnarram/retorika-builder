import es from "../locales/es.json" with { type: "json" };

/**
 * What the indicator says once a site is in the account.
 *
 * Three claims, not one, because a save can land completely and still leave a photograph behind —
 * an upload the store refused, or one whose bytes are in another browser. Saying «Guardado en tu
 * cuenta» then would be true about the document and silent about the picture the owner is looking
 * at; saying «No guardado» would be false about their words. The count is the only sentence that
 * is true about both, and it is the one they can act on.
 *
 * `null` is the plain sentence rather than «0 fotos sin subir», because nothing has been counted
 * yet and a zero would be a claim nobody made.
 *
 * **Since sprint 29 día 6 the owner's own fonts are counted the same way, after the photographs**
 * — by font, not by file, so a regular and its bold that did not make it are «1 fuente». Joined by
 * a key of its own rather than by punctuation in code, so the sentence stays in `es.json`. In a
 * `.ts` of its own, out of `EditorShell.tsx`, so `accountSentence.test.ts` can call it.
 */
export function accountSentence(photosMissing: number | null, fontsMissing: number | null): string {
  const photos =
    photosMissing === null || photosMissing <= 0
      ? es["editor.saved.account"]
      : photosMissing === 1
        ? es["editor.saved.accountPhotosMissing.one"]
        : es["editor.saved.accountPhotosMissing.many"].replace("{count}", String(photosMissing));
  if (fontsMissing === null || fontsMissing <= 0) return photos;
  const fonts =
    fontsMissing === 1
      ? es["editor.saved.fontsMissing.one"]
      : es["editor.saved.fontsMissing.many"].replace("{count}", String(fontsMissing));
  return es["editor.saved.join"].replace("{first}", photos).replace("{second}", fonts);
}
