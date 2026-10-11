import { type ConnectionState, reconnectDelayMs, type TodoRow } from "../domain";

export type { ConnectionState };

/** Callbacks a joined channel reports to. */
export interface RealtimeHandlers {
  onRow(row: TodoRow): void;
  /** The channel or socket dropped after joining. */
  onClosed(): void;
}

/** A joined channel; `close` leaves it and closes the socket. */
export interface RealtimeChannelHandle {
  close(): Promise<void>;
}

/** The Supabase Realtime socket, behind an interface so the lifecycle can be tested without a server. */
export interface RealtimeTransport {
  /** Refreshes the access token if it's close to expiry and hands it to the socket. */
  refreshAuth(): Promise<void>;
  /** Opens the socket and joins the user's `todos` channel; resolves once joined. */
  open(userId: string, handlers: RealtimeHandlers): Promise<RealtimeChannelHandle>;
}

/** The signed-in list the connection feeds: REED-68's `SyncEngine`. */
export interface RealtimeTarget {
  userId: string;
  pull(): Promise<void>;
  applyRemote(rows: readonly TodoRow[]): void;
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Owns the tab's one Realtime socket and `todos` channel. Lifecycle: spec/features/realtime.md. */
export class RealtimeConnection {
  private state: ConnectionState = "offline";
  private readonly listeners = new Set<(state: ConnectionState) => void>();
  private target: RealtimeTarget | null = null;
  private channel: RealtimeChannelHandle | null = null;
  private held: TodoRow[] | null = null;
  private retry: unknown = null;
  private attempt = 0;
  /** Bumped on every (re)start and disconnect, so callbacks from an older attempt are dropped. */
  private generation = 0;

  constructor(
    private readonly transport: RealtimeTransport,
    private readonly timers: Timers = realTimers,
  ) {}

  get current(): ConnectionState {
    return this.state;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  connect(target: RealtimeTarget): void {
    if (this.state !== "offline" && this.target?.userId === target.userId) {
      this.target = target;
      if (this.retry !== null) {
        this.timers.clear(this.retry);
        this.retry = null;
        this.start();
      }
      return;
    }
    if (this.state !== "offline") this.disconnect();
    this.target = target;
    this.attempt = 0;
    this.start();
  }

  disconnect(): void {
    this.generation++;
    this.stop();
    this.target = null;
    this.setState("offline");
  }

  private start(): void {
    const generation = ++this.generation;
    this.setState("connecting");
    void this.run(generation);
  }

  private async run(generation: number): Promise<void> {
    const live = () => generation === this.generation;
    try {
      await this.transport.refreshAuth();
      if (!live()) return;
      this.held = [];
      const channel = await this.transport.open(this.target!.userId, {
        onRow: (row) => {
          if (!live()) return;
          if (this.held) this.held.push(row);
          else this.target?.applyRemote([row]);
        },
        onClosed: () => {
          if (live()) this.fail();
        },
      });
      if (!live()) {
        void channel.close().catch(() => undefined);
        return;
      }
      this.channel = channel;
      await this.target!.pull();
      if (!live()) return;
      const held = this.held ?? [];
      this.held = null;
      if (held.length > 0) this.target!.applyRemote(held);
      this.attempt = 0;
      this.setState("connected");
    } catch {
      if (live()) this.fail();
    }
  }

  private fail(): void {
    this.generation++;
    this.stop();
    this.setState("connecting");
    this.retry = this.timers.set(() => {
      this.retry = null;
      this.start();
    }, reconnectDelayMs(this.attempt++));
  }

  private stop(): void {
    if (this.retry !== null) this.timers.clear(this.retry);
    this.retry = null;
    this.held = null;
    const channel = this.channel;
    this.channel = null;
    void channel?.close().catch(() => undefined);
  }

  private setState(state: ConnectionState): void {
    if (state === this.state) return;
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
