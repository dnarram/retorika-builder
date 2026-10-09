/**
 * What the account's copy of a site's photographs is missing, and what it is still keeping.
 *
 * **A pure function, and that is the whole design.** The decision of what to upload and what to
 * delete is arithmetic over three lists; the round trips that produce those lists and act on the
 * answer are the caller's. So the part that can delete somebody's photograph is the part that can
 * be exhausted in a test with no network and no Supabase.
 *
 * ADR 0037 §5 is the rule it implements, including the one David added while approving the sprint:
 * **this only ever runs after a save that passed the version check.** A tab holding a document
 * somebody else has already replaced names photographs the winning document may have changed, and
 * letting it tidy up would delete the photographs of the version that won. That condition cannot
 * be expressed here — this function cannot see a save — so it is the caller's, and the caller has
 * a test that says so by name.
 */

export interface PhotoSyncPlan {
  /** Referenced by the document, not in the bucket, and this browser holds the bytes. */
  upload: string[];
  /** In the bucket and no longer referenced by the document. Full object paths, not `src`s. */
  remove: string[];
  /**
   * Referenced by the document, not in the bucket, and **this browser has no bytes either**.
   *
   * Not a failure and not an action: it is a photograph uploaded from somewhere else, or a site
   * saved before the photographs travelled. Nothing here can fix it, and the only honest thing to
   * do with it is count it — which is what the indicator does.
   */
  missing: string[];
}

export function photoSyncPlan(state: {
  /** The `src`s of the owner's own photographs the document references. */
  wanted: readonly string[];
  /** The `src`s already in the bucket for this site. */
  remote: readonly string[];
  /** The `src`s this browser holds bytes for. */
  local: readonly string[];
  /** Turns a `src` into the object path to delete. The caller's, because it needs the owner. */
  pathFor: (src: string) => string;
}): PhotoSyncPlan {
  const wanted = new Set(state.wanted);
  const remote = new Set(state.remote);
  const local = new Set(state.local);

  const upload: string[] = [];
  const missing: string[] = [];
  for (const src of state.wanted) {
    if (remote.has(src)) continue;
    if (local.has(src)) upload.push(src);
    else missing.push(src);
  }

  // Deleting is the half that can lose somebody's work, so it is deliberately the narrowest: an
  // object is removed only when the document does not reference it at all. A photograph the
  // document still names is never touched, whatever else is true of it.
  const remove = [...remote].filter((src) => !wanted.has(src)).map(state.pathFor);

  return { upload, remove, missing };
}

/**
 * Runs the reconciliation **only** after a save the database accepted.
 *
 * David's condition while approving the sprint 16 plan: «un test que demuestre que una pestaña con
 * un documento desactualizado no puede borrar fotos del bucket: la reconciliación solo corre tras
 * un guardado que pasó la comprobación de versión».
 *
 * It exists as a function rather than as an `if` inside an effect so that condition can be
 * asserted. A tab holding a document somebody else has already replaced names photographs the
 * winning document may have changed, and the version check of ADR 0034 §8 is what tells the two
 * apart — so «the save was accepted» is the only safe moment to delete anything, and this is where
 * that is written down once.
 */
export async function afterAcceptedSave<Result extends { ok: boolean }>(
  save: () => Promise<Result>,
  reconcile: () => Promise<void>,
): Promise<Result> {
  const result = await save();
  if (result.ok) await reconcile();
  return result;
}
