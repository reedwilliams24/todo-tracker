import { describe, expect, it } from "vitest";
import type { TodoRow } from "../domain";
import {
  type RealtimeChannelHandle,
  RealtimeConnection,
  type RealtimeHandlers,
  type RealtimeTarget,
  type RealtimeTransport,
} from "./realtime";

const USER = "6a1f1c2e-0000-4000-8000-000000000001";

function row(id: string, seq: number): TodoRow {
  return {
    id,
    user_id: USER,
    title: id,
    notes: null,
    completed: false,
    priority: "medium",
    due_date: null,
    recurrence: null,
    completed_at: null,
    created_at: "2026-01-05T09:00:00.000Z",
    updated_at: "2026-01-05T09:00:00.000Z",
    deleted_at: null,
    server_seq: seq,
    subtasks: null,
  };
}

/** Counts sockets: `open` opens one, its handle's `close` closes it. */
class FakeTransport implements RealtimeTransport {
  log: string[] = [];
  opened = 0;
  live = 0;
  maxLive = 0;
  failNext = 0;
  handlers: RealtimeHandlers | null = null;
  gate: Promise<void> | null = null;

  async refreshAuth() {
    this.log.push("refreshAuth");
  }

  async open(userId: string, handlers: RealtimeHandlers): Promise<RealtimeChannelHandle> {
    this.log.push(`open ${userId}`);
    if (this.gate) await this.gate;
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("join failed");
    }
    this.opened++;
    this.live++;
    this.maxLive = Math.max(this.maxLive, this.live);
    this.handlers = handlers;
    let closed = false;
    return {
      close: async () => {
        if (closed) return;
        closed = true;
        this.live--;
        this.log.push("close");
      },
    };
  }
}

class FakeTimers {
  pending: { fn: () => void; ms: number }[] = [];
  set = (fn: () => void, ms: number) => {
    const timer = { fn, ms };
    this.pending.push(timer);
    return timer;
  };
  clear = (handle: unknown) => {
    this.pending = this.pending.filter((timer) => timer !== handle);
  };
  fire() {
    const timer = this.pending.shift()!;
    timer.fn();
    return timer.ms;
  }
}

function target(transport: FakeTransport, userId = USER) {
  const applied: TodoRow[][] = [];
  let release: (() => void) | null = null;
  let blockPull = false;
  const t: RealtimeTarget & { applied: TodoRow[][]; pulls: number; block(): void; release(): void } = {
    userId,
    applied,
    pulls: 0,
    async pull() {
      t.pulls++;
      transport.log.push("pull");
      if (blockPull) await new Promise<void>((resolve) => (release = resolve));
    },
    applyRemote: (rows) => void applied.push([...rows]),
    block: () => void (blockPull = true),
    release: () => release?.(),
  };
  return t;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const transport = new FakeTransport();
  const timers = new FakeTimers();
  const connection = new RealtimeConnection(transport, timers);
  const states: string[] = [];
  connection.subscribe((state) => states.push(state));
  return { transport, timers, connection, states };
}

describe("RealtimeConnection", () => {
  it("refreshes the token, joins, then pulls before it is connected", async () => {
    const { transport, connection, states } = setup();
    connection.connect(target(transport));
    expect(connection.current).toBe("connecting");
    await flush();
    expect(transport.log).toEqual(["refreshAuth", `open ${USER}`, "pull"]);
    expect(states).toEqual(["connecting", "connected"]);
  });

  it("repeated connects and foreground events never open a second socket", async () => {
    const { transport, connection } = setup();
    const t = target(transport);
    connection.connect(t);
    connection.connect(t);
    await flush();
    connection.connect(t);
    connection.connect(target(transport));
    await flush();
    expect(transport.opened).toBe(1);
    expect(transport.maxLive).toBe(1);
    expect(t.pulls).toBe(1);
    expect(connection.current).toBe("connected");
  });

  it("background then foreground closes the socket and reconnects with a fresh pull", async () => {
    const { transport, connection, states } = setup();
    const t = target(transport);
    for (let i = 0; i < 3; i++) {
      connection.connect(t);
      await flush();
      connection.disconnect();
      expect(transport.live).toBe(0);
    }
    expect(transport.opened).toBe(3);
    expect(transport.maxLive).toBe(1);
    expect(t.pulls).toBe(3);
    expect(states.slice(0, 3)).toEqual(["connecting", "connected", "offline"]);
    expect(connection.current).toBe("offline");
  });

  it("hands live rows to applyRemote, holding the ones that arrive during the pull", async () => {
    const { transport, connection } = setup();
    const t = target(transport);
    t.block();
    connection.connect(t);
    await flush();
    transport.handlers!.onRow(row("a", 6));
    expect(t.applied).toEqual([]);
    t.release();
    await flush();
    expect(t.applied).toEqual([[row("a", 6)]]);
    transport.handlers!.onRow(row("b", 7));
    expect(t.applied).toEqual([[row("a", 6)], [row("b", 7)]]);
  });

  it("drops rows from a channel it already left", async () => {
    const { transport, connection } = setup();
    const t = target(transport);
    connection.connect(t);
    await flush();
    const stale = transport.handlers!;
    connection.disconnect();
    stale.onRow(row("a", 6));
    stale.onClosed();
    expect(t.applied).toEqual([]);
    expect(connection.current).toBe("offline");
  });

  it("retries with backoff while connecting, and resets after it connects", async () => {
    const { transport, timers, connection, states } = setup();
    transport.failNext = 2;
    connection.connect(target(transport));
    await flush();
    expect(connection.current).toBe("connecting");
    expect(timers.fire()).toBe(1000);
    await flush();
    expect(timers.fire()).toBe(2000);
    await flush();
    expect(connection.current).toBe("connected");
    expect(states).toEqual(["connecting", "connected"]);
    transport.handlers!.onClosed();
    expect(transport.live).toBe(0);
    expect(connection.current).toBe("connecting");
    expect(timers.fire()).toBe(1000);
    await flush();
    expect(connection.current).toBe("connected");
    expect(transport.maxLive).toBe(1);
  });

  it("connect during a backoff retries now instead of waiting", async () => {
    const { transport, timers, connection } = setup();
    transport.failNext = 1;
    const t = target(transport);
    connection.connect(t);
    await flush();
    expect(timers.pending).toHaveLength(1);
    connection.connect(t);
    expect(timers.pending).toHaveLength(0);
    await flush();
    expect(connection.current).toBe("connected");
  });

  it("disconnecting mid-join closes the channel once it opens", async () => {
    const { transport, connection } = setup();
    let open!: () => void;
    transport.gate = new Promise((resolve) => (open = resolve));
    const t = target(transport);
    connection.connect(t);
    await flush();
    connection.disconnect();
    open();
    await flush();
    expect(transport.live).toBe(0);
    expect(t.pulls).toBe(0);
    expect(connection.current).toBe("offline");
  });

  it("a different user disconnects the old channel first", async () => {
    const { transport, connection } = setup();
    connection.connect(target(transport));
    await flush();
    connection.connect(target(transport, "other"));
    await flush();
    expect(transport.log).toContain("close");
    expect(transport.log.at(-2)).toBe("open other");
    expect(transport.maxLive).toBe(1);
  });
});
