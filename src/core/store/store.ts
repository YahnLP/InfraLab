import { emptyState, type DomainEvent, type EntityRef, type State } from '../model/types';
import { nextId } from '../ids';
import { defaultRoles } from '../model/rbac';

/** Erreur de précondition : la commande est refusée, l'état est inchangé. */
export class CommandError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'CommandError'; }
}

export interface Command { type: string; payload?: Record<string, unknown>; actor?: DomainEvent['actor']; actorId?: string }

export interface CommandContext {
  /** Brouillon mutable : validé seulement si le handler ne lève pas d'erreur. */
  state: State;
  now: number;
  actor: DomainEvent['actor'];
  actorId: string | undefined;
  emit(type: string, subject: EntityRef, payload?: Record<string, unknown>): DomainEvent;
}

/** Garde d'accès : renvoie le motif du refus, ou null. N'est appliquée qu'aux actions d'un utilisateur incarné. */
export type Guard = (cmd: Command, state: Readonly<State>, actorId: string) => string | null;
export type CommandHandler = (ctx: CommandContext, payload: Record<string, unknown>) => void;
/** Réacteur : fonction pure (événement, état) → commandes à enchaîner. N'a aucun accès à l'UI. */
export type Reactor = (event: DomainEvent, state: Readonly<State>) => Command[];

export interface DispatchResult { ok: boolean; events: DomainEvent[]; error?: CommandError }
type Listener = (events: DomainEvent[], state: Readonly<State>) => void;

const MAX_REACTION_DEPTH = 16;

export class Store {
  private state: State;
  private handlers = new Map<string, CommandHandler>();
  private reactors = new Map<string, Reactor[]>();
  private listeners = new Set<Listener>();
  private log: DomainEvent[] = [];
  private clock: () => number;
  private guard: Guard | null = null;

  constructor(opts: { clock?: () => number; state?: State } = {}) {
    this.clock = opts.clock ?? (() => 0);
    this.state = opts.state ?? emptyState();
  }

  /* ---- lecture ---- */
  getState(): Readonly<State> { return this.state; }
  getLog(): readonly DomainEvent[] { return this.log; }
  /** Chaîne causale d'un événement, de la racine à l'événement. */
  trace(eventId: string): DomainEvent[] {
    const byId = new Map(this.log.map(e => [e.id, e]));
    const chain: DomainEvent[] = [];
    for (let e = byId.get(eventId); e; e = e.causedBy ? byId.get(e.causedBy) : undefined) chain.unshift(e);
    return chain;
  }

  /* ---- enregistrement ---- */
  registerCommand(type: string, handler: CommandHandler): void {
    if (this.handlers.has(type)) throw new Error(`Commande déjà enregistrée : ${type}`);
    this.handlers.set(type, handler);
  }
  /** `on` : type d'événement ou '*'. */
  registerReactor(on: string, reactor: Reactor): void {
    const l = this.reactors.get(on) ?? []; l.push(reactor); this.reactors.set(on, l);
  }
  setGuard(g: Guard): void { this.guard = g; }
  subscribe(l: Listener): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }

  /* ---- écriture : unique point d'entrée ---- */
  dispatch(cmd: Command): DispatchResult {
    const all: DomainEvent[] = [];
    const res = this.run(cmd, undefined, all, 0);
    if (all.length) this.listeners.forEach(l => l(all, this.state));
    return { ...res, events: all };
  }

  private run(cmd: Command, causedBy: string | undefined, sink: DomainEvent[], depth: number): { ok: boolean; error?: CommandError } {
    const handler = this.handlers.get(cmd.type);
    if (!handler) return { ok: false, error: new CommandError('unknown_command', `Commande inconnue : ${cmd.type}`) };
    const acting = depth === 0 && (cmd.actor ?? 'user') === 'user' ? this.state.actingAs : null;
    if (acting && this.guard) { const why = this.guard(cmd, this.state, acting); if (why) return { ok: false, error: new CommandError('forbidden', why) }; }
    const draft = structuredClone(this.state);
    const produced: DomainEvent[] = [];
    const ctx: CommandContext = {
      state: draft, now: this.clock(), actor: cmd.actor ?? 'user', actorId: cmd.actorId ?? (acting ?? undefined),
      emit: (type, subject, payload = {}) => {
        const e: DomainEvent = {
          id: nextId(draft.counters, 'evt', 6), t: this.clock(), type, actor: ctx.actor,
          subject, payload, ...(ctx.actorId ? { actorId: ctx.actorId } : {}),
          ...(causedBy ? { causedBy } : {}),
        };
        if (!causedBy && produced.length) e.causedBy = produced[0]!.id; // événements d'une même commande : chaînés au premier
        produced.push(e);
        return e;
      },
    };
    try { handler(ctx, cmd.payload ?? {}); }
    catch (err) {
      if (err instanceof CommandError) return { ok: false, error: err };
      throw err;
    }
    this.state = draft; // commit
    this.log.push(...produced); sink.push(...produced);
    if (depth < MAX_REACTION_DEPTH) {
      for (const e of produced) {
        const rs = [...(this.reactors.get(e.type) ?? []), ...(this.reactors.get('*') ?? [])];
        for (const r of rs) for (const next of r(e, this.state)) this.run({ actor: 'system', ...next }, e.id, sink, depth + 1);
      }
    }
    return { ok: true };
  }

  /* ---- snapshot / reset ---- */
  snapshot(): { state: State; log: DomainEvent[] } { return structuredClone({ state: this.state, log: this.log }); }
  restore(s: { state: State; log: DomainEvent[] }): void {
    const c = structuredClone(s); c.state.management.tickets ??= {}; c.state.session ??= null; c.state.actingAs ??= null; (c.state.management as { roles?: unknown }).roles ??= defaultRoles(); c.state.management.problems ??= {}; c.state.management.changes ??= {}; c.state.management.articles ??= {};
    for (const k of ['suppliers', 'contracts', 'licenses', 'softwarePolicy', 'cis', 'relations'] as const) (c.state.management as unknown as Record<string, unknown>)[k] ??= {}; this.state = c.state; this.log = c.log;
    this.listeners.forEach(l => l([], this.state));
  }
}
