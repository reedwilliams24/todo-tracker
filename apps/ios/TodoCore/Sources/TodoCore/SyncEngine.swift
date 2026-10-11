import Foundation

/// Rows per pull request (spec/server.md#pull).
public let pullPageSize = 500

/// The backend calls sync needs (spec/server.md).
public protocol SyncServer: Sendable {
    func push(_ rows: [TodoRow]) async throws -> [TodoRow]
    /// Rows with `server_seq > cursor`, ordered by `server_seq`, at most `limit`.
    func pull(after cursor: Int64, limit: Int) async throws -> [TodoRow]
}

/// Keeps a signed-in list in step with the server (spec/features/sync.md). `edit` pushes each local change and
/// rolls it back if the push fails; `pull` and `applyRemote` bring in other devices' changes (REED-70 feeds
/// Realtime rows to `applyRemote`).
@MainActor
public final class SyncEngine {
    private let server: any SyncServer
    private let userId: String
    private let loadCursor: () -> Int64
    private let saveCursor: (Int64) -> Void
    private let current: () -> [Todo]
    private let replace: ([Todo]) -> Void
    private let onPushFailed: () -> Void
    private let now: () -> Date
    private var inFlight: [Int: [Todo]] = [:]
    private var tombstoned: Set<String> = []
    private var nextPush = 0
    private var pulling = false
    private var pullAgain = false
    private var closed = false

    /// `current`/`replace` read and swap the shown list; `replace` must not push again.
    public init(
        server: any SyncServer, userId: String, loadCursor: @escaping () -> Int64,
        saveCursor: @escaping (Int64) -> Void, current: @escaping () -> [Todo], replace: @escaping ([Todo]) -> Void,
        onPushFailed: @escaping () -> Void, now: @escaping () -> Date = Date.init
    ) {
        self.server = server
        self.userId = userId
        self.loadCursor = loadCursor
        self.saveCursor = saveCursor
        self.current = current
        self.replace = replace
        self.onPushFailed = onPushFailed
        self.now = now
    }

    /// A local edit from `before` to `after` (already shown): shows the planned list and pushes it.
    public func edit(before: [Todo], after: [Todo]) async {
        let plan = planPush(before, after: after, tombstoned: tombstoned, userId: userId, now: now())
        if plan.todos != after { replace(plan.todos) }
        guard !plan.rows.isEmpty else { return }
        let ids = plan.rows.map(\.id)
        let idSet = Set(ids)
        let key = nextPush
        nextPush += 1
        inFlight[key] = plan.todos.filter { idSet.contains($0.id) }
        do {
            let stored = try await server.push(plan.rows)
            inFlight[key] = nil
            guard !closed else { return }
            for row in plan.rows where row.deletedAt != nil { tombstoned.insert(row.id) }
            replace(TodoCore.applyRemote(current(), inFlight: pending, rows: stored, cursor: 0))
        } catch {
            inFlight[key] = nil
            guard !closed else { return }
            replace(rollbackPush(current(), before: before, failedIds: ids))
            onPushFailed()
        }
    }

    /// Pulls every row past the cursor, a page at a time. A call during a pull makes it run once more.
    public func pull() async throws {
        if pulling {
            pullAgain = true
            return
        }
        pulling = true
        defer { pulling = false }
        repeat {
            pullAgain = false
            try await pullPages()
        } while pullAgain && !closed
    }

    /// Applies pulled or Realtime rows and advances the stored cursor.
    public func applyRemote(_ rows: [TodoRow]) {
        guard !closed, !rows.isEmpty else { return }
        let cursor = loadCursor()
        replace(TodoCore.applyRemote(current(), inFlight: pending, rows: rows, cursor: cursor))
        saveCursor(advanceCursor(cursor, rows: rows))
    }

    /// Stops applying results (sign out, scope change).
    public func close() { closed = true }

    private func pullPages() async throws {
        while !closed {
            let rows = try await server.pull(after: loadCursor(), limit: pullPageSize)
            applyRemote(rows)
            if rows.count < pullPageSize { return }
        }
    }

    private var pending: [Todo] { inFlight.values.flatMap { $0 } }
}
