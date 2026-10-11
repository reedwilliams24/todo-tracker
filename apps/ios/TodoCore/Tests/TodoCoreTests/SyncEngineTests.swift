import Foundation
import XCTest

@testable import TodoCore

private let user = "user-1"
private let t0 = "2026-01-05T09:00:00.000Z"
private let t1 = "2026-01-05T10:00:00.000Z"
private let now = Date(timeIntervalSince1970: 1_767_700_800)

private func todo(_ id: String, title: String? = nil, updatedAt: String = t0, completed: Bool = false) -> Todo {
    Todo(id: id, title: title ?? "Todo \(id)", completed: completed, createdAt: t0, updatedAt: updatedAt)
}

/// In-memory `todos` table: LWW on updated_at, tombstones win, server_seq per write.
private actor FakeServer: SyncServer {
    var rows: [String: TodoRow] = [:]
    var seq: Int64 = 0
    var failPush = false
    var pulls: [Int64] = []

    func setFailPush(_ value: Bool) { failPush = value }

    func push(_ rows: [TodoRow]) async throws -> [TodoRow] {
        if failPush { throw URLError(.notConnectedToInternet) }
        for row in rows {
            if let stored = self.rows[row.id],
                stored.deletedAt != nil || (row.deletedAt == nil && stored.updatedAt > row.updatedAt)
            {
                continue
            }
            seq += 1
            var next = row
            next.serverSeq = seq
            self.rows[row.id] = next
        }
        return rows.compactMap { self.rows[$0.id] }
    }

    func pull(after cursor: Int64, limit: Int) async throws -> [TodoRow] {
        pulls.append(cursor)
        return Array(
            rows.values.filter { $0.serverSeq! > cursor }.sorted { $0.serverSeq! < $1.serverSeq! }.prefix(limit))
    }

    func write(_ id: String, title: String? = nil, updatedAt: String = t1, deletedAt: String? = nil) {
        seq += 1
        rows[id] = TodoRow(
            id: id, userId: user, title: title ?? "Todo \(id)", createdAt: t0, updatedAt: updatedAt,
            deletedAt: deletedAt, serverSeq: seq)
    }
}

@MainActor
private final class Harness {
    let server = FakeServer()
    var todos: [Todo]
    var cursor: Int64 = 0
    var failures = 0
    lazy var engine = SyncEngine(
        server: server, userId: user, loadCursor: { [unowned self] in cursor },
        saveCursor: { [unowned self] in cursor = $0 }, current: { [unowned self] in todos },
        replace: { [unowned self] in todos = $0 }, onPushFailed: { [unowned self] in failures += 1 },
        now: { now })

    init(_ initial: [Todo] = []) { todos = initial }

    /// A local edit the way the UI makes one: show `after`, then hand it to the engine.
    func edit(_ after: [Todo]) async {
        let before = todos
        todos = after
        await engine.edit(before: before, after: after)
    }
}

@MainActor
final class SyncEngineTests: XCTestCase {
    func testPushesAnAdd() async {
        let h = Harness()
        await h.edit([todo("a")])
        let stored = await h.server.rows["a"]
        XCTAssertEqual(stored?.title, "Todo a")
        XCTAssertEqual(h.todos.map(\.id), ["a"])
    }

    func testPushesADeleteAsATombstone() async {
        let h = Harness()
        await h.edit([todo("a"), todo("b")])
        await h.edit([todo("b")])
        let stored = await h.server.rows["a"]
        XCTAssertEqual(stored?.deletedAt, Timestamp.iso(now))
    }

    func testRollsBackAFailedPush() async {
        let h = Harness([todo("a")])
        await h.server.setFailPush(true)
        await h.edit([todo("a", title: "Renamed", updatedAt: t1)])
        XCTAssertEqual(h.todos, [todo("a")])
        XCTAssertEqual(h.failures, 1)
    }

    func testRollsBackAFailedAdd() async {
        let h = Harness([todo("a")])
        await h.server.setFailPush(true)
        await h.edit([todo("new"), todo("a")])
        XCTAssertEqual(h.todos.map(\.id), ["a"])
    }

    func testUndoneDeleteGetsAFreshId() async {
        let h = Harness()
        await h.edit([todo("a")])
        await h.edit([])
        await h.edit([todo("a")])
        XCTAssertEqual(h.todos.count, 1)
        XCTAssertNotEqual(h.todos[0].id, "a")
        let stored = await h.server.rows[h.todos[0].id]
        XCTAssertNil(stored?.deletedAt)
    }

    func testUndoneEditIsStampedNow() async {
        let h = Harness([todo("a")])
        await h.edit([todo("a", updatedAt: t1, completed: true)])
        await h.edit([todo("a")])
        let stored = await h.server.rows["a"]
        XCTAssertEqual(stored?.completed, false)
    }

    func testPullsEveryPageAndAdvancesTheCursor() async throws {
        let h = Harness()
        for i in 0..<(pullPageSize + 3) { await h.server.write("r\(i)") }
        try await h.engine.pull()
        let pulls = await h.server.pulls
        XCTAssertEqual(pulls, [0, Int64(pullPageSize)])
        XCTAssertEqual(h.todos.count, pullPageSize + 3)
        XCTAssertEqual(h.cursor, Int64(pullPageSize + 3))
    }

    func testPullsAnotherDevicesEditAndDelete() async throws {
        let h = Harness()
        await h.server.write("a")
        await h.server.write("b")
        try await h.engine.pull()
        await h.server.write("a", title: "Edited elsewhere", updatedAt: "2026-01-05T11:00:00.000Z")
        await h.server.write("b", deletedAt: t1)
        try await h.engine.pull()
        XCTAssertEqual(h.todos.map(\.title), ["Edited elsewhere"])
    }
}
