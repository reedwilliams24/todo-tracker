import Foundation

// Live updates over the Supabase Realtime socket. Rules: spec/features/realtime.md.

public enum ConnectionState: String, Sendable {
    case offline, connecting, connected
}

public let realtimeSchema = "public"
public let realtimeTable = "todos"
public let reconnectBaseMs: Int64 = 1_000
public let reconnectMaxMs: Int64 = 30_000

public struct RealtimeTopic: Equatable, Sendable, Encodable {
    public let channel: String
    public let filter: String
}

/// The one channel a signed-in client joins, and the postgres_changes filter that scopes it to the user.
public func realtimeTopic(userId: String) -> RealtimeTopic {
    RealtimeTopic(channel: "\(realtimeTable):\(userId)", filter: "user_id=eq.\(userId)")
}

/// Delay before reconnect attempt `attempt` (0-based): doubles from the base, capped at the max.
public func reconnectDelayMs(_ attempt: Int) -> Int64 {
    min(reconnectMaxMs, reconnectBaseMs << Int64(min(max(attempt, 0), 16)))
}

/// A joined channel; `close` leaves it and closes the socket.
/// What the signed-in list shows about its connection. `guest`: the local-only guest list, which never shows one.
public enum ConnectionStatus: String, Sendable, Codable {
    case guest, connected, reconnecting, offline, expired
}

/// The connection banner's state (spec/features/realtime.md#connection-status). `account`: the shown list is an
/// account's (signed in, or the session expired); `online`: the device has a network; `connection`: nil when there is
/// no live connection.
public func connectionStatus(
    account: Bool, expired: Bool, online: Bool, connection: ConnectionState?
) -> ConnectionStatus {
    if !account { return .guest }
    if expired { return .expired }
    if !online { return .offline }
    return connection == .connected ? .connected : .reconnecting
}

/// Add, edit, complete, delete and voice add are allowed only on the guest list or a connected, caught-up account list.
public func canEdit(_ status: ConnectionStatus) -> Bool {
    status == .guest || status == .connected
}

public protocol RealtimeChannelHandle: Sendable {
    func close() async
}

/// The Supabase Realtime socket, behind a protocol so the lifecycle can be tested without a server.
public protocol RealtimeTransport: Sendable {
    /// Refreshes the access token if it's close to expiry and hands it to the socket.
    func refreshAuth() async throws
    /// Opens the socket and joins the user's `todos` channel; returns once joined. `onRow` gets each new row,
    /// `onClosed` fires if the channel drops after joining.
    func open(
        userId: String, onRow: @escaping @MainActor @Sendable (TodoRow) -> Void,
        onClosed: @escaping @MainActor @Sendable () -> Void
    ) async throws -> any RealtimeChannelHandle
}

/// The signed-in list the connection feeds: REED-68's `SyncEngine`.
@MainActor
public struct RealtimeTarget {
    public let userId: String
    public let pull: () async throws -> Void
    public let applyRemote: ([TodoRow]) -> Void

    public init(userId: String, pull: @escaping () async throws -> Void, applyRemote: @escaping ([TodoRow]) -> Void) {
        self.userId = userId
        self.pull = pull
        self.applyRemote = applyRemote
    }
}

/// Owns the app's one Realtime socket and `todos` channel.
@MainActor
public final class RealtimeConnection {
    public private(set) var state: ConnectionState = .offline {
        didSet { if state != oldValue { onStateChange?(state) } }
    }
    /// Called on every state change.
    public var onStateChange: ((ConnectionState) -> Void)?

    private let transport: any RealtimeTransport
    private let sleep: @Sendable (Int64) async throws -> Void
    private var target: RealtimeTarget?
    private var channel: (any RealtimeChannelHandle)?
    private var held: [TodoRow]?
    private var task: Task<Void, Never>?
    private var waiting = false
    private var attempt = 0
    /// Bumped on every (re)start and disconnect, so callbacks from an older attempt are dropped.
    private var generation = 0

    /// `sleep` waits the given milliseconds before a retry; it should throw when cancelled.
    public init(
        transport: any RealtimeTransport,
        sleep: @escaping @Sendable (Int64) async throws -> Void = { try await Task.sleep(for: .milliseconds($0)) }
    ) {
        self.transport = transport
        self.sleep = sleep
    }

    public func connect(_ next: RealtimeTarget) {
        if state != .offline, target?.userId == next.userId {
            target = next
            if waiting { start() }
            return
        }
        if state != .offline { disconnect() }
        target = next
        attempt = 0
        start()
    }

    public func disconnect() {
        generation += 1
        stop()
        target = nil
        state = .offline
    }

    private func start(delayMs: Int64 = 0) {
        task?.cancel()
        generation += 1
        let gen = generation
        state = .connecting
        waiting = delayMs > 0
        let sleep = sleep
        task = Task { [weak self] in
            if delayMs > 0 {
                do { try await sleep(delayMs) } catch { return }
            }
            guard let self, gen == self.generation else { return }
            self.waiting = false
            await self.run(gen)
        }
    }

    private func run(_ gen: Int) async {
        guard let userId = target?.userId else { return }
        do {
            try await transport.refreshAuth()
            guard gen == generation else { return }
            held = []
            let opened = try await transport.open(
                userId: userId,
                onRow: { [weak self] row in
                    guard let self, gen == self.generation else { return }
                    if self.held != nil {
                        self.held?.append(row)
                    } else {
                        self.target?.applyRemote([row])
                    }
                },
                onClosed: { [weak self] in
                    guard let self, gen == self.generation else { return }
                    self.fail()
                })
            guard gen == generation else {
                await opened.close()
                return
            }
            channel = opened
            try await target?.pull()
            guard gen == generation else { return }
            let rows = held ?? []
            held = nil
            if !rows.isEmpty { target?.applyRemote(rows) }
            attempt = 0
            state = .connected
        } catch {
            if gen == generation { fail() }
        }
    }

    private func fail() {
        generation += 1
        stop()
        let delay = reconnectDelayMs(attempt)
        attempt += 1
        start(delayMs: delay)
    }

    private func stop() {
        task?.cancel()
        task = nil
        waiting = false
        held = nil
        guard let closing = channel else { return }
        channel = nil
        Task { await closing.close() }
    }
}
