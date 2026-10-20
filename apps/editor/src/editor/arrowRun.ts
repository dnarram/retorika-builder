/**
 * **A run of arrow presses is one movement and one step of history** (ADR 0050 §6, sprint 25 día 6).
 *
 * David's first condition when he chose «flecha = 1 unidad, Mayús = 8»: «Las pulsaciones seguidas
 * son un solo paso del historial […] se escribe al soltar la tecla (o tras ~300 ms sin pulsar)». A
 * unit is a ninety-sixth of the section, so crossing one is fifty presses — and with a `setPlacement`
 * per press that is fifty documents, fifty rebuilds of the canvas and fifty entries to undo one
 * gesture through. Held down, the element would travel in visible jerks.
 *
 * So the presses accumulate here, the element travels on a `transform` while they do (chrome, never
 * the document, exactly as the pointer's drag does), and **one** placement is written when the run
 * ends. Which also retires the lost keypress of ADR 0049 §4 — there is no rebuild to lose it to
 * until the hand stops.
 *
 * **The decision about time is a function of a clock, not a `setTimeout`.** The editor owns the
 * timer; what «the run has gone quiet» means lives here, where a test can say `now` out loud.
 */

/** How long a run waits for the next press before it is written. David's number. */
export const RUN_IDLE_MS = 300;

/** What a run of presses adds up to so far, and when its last press landed. */
export interface ArrowRun {
  /** Units sideways and rows down, signed. */
  readonly columns: number;
  readonly rows: number;
  /** The clock reading of the last press, so `gone` can tell a pause from a repeat. */
  readonly at: number;
}

/** One press, as `arrowAction` describes it. */
export interface ArrowPress {
  readonly columns: number;
  readonly rows: number;
}

/**
 * The press joins the run it belongs to, or starts a new one.
 *
 * **A pause of its own length starts a new run**, which is what makes «three separate presses are
 * three steps» true while «one held key is one step» is true too: the same arithmetic serves both,
 * and the difference is only how long the hand waited.
 *
 * A clock that goes backwards — a system clock pulled, or a test being careless — starts a new run
 * rather than producing a negative pause.
 */
export function accumulate(run: ArrowRun | null, press: ArrowPress, now: number): ArrowRun {
  if (run === null || gone(run, now)) {
    return { columns: press.columns, rows: press.rows, at: now };
  }
  return { columns: run.columns + press.columns, rows: run.rows + press.rows, at: now };
}

/** Whether the hand has stopped: `RUN_IDLE_MS` since the last press, or the clock went backwards. */
export function gone(run: ArrowRun, now: number): boolean {
  return now < run.at || now - run.at >= RUN_IDLE_MS;
}

/** Whether a run would move anything at all, which is what decides if a step is worth opening. */
export function moves(run: ArrowRun | null): boolean {
  return run !== null && (run.columns !== 0 || run.rows !== 0);
}
