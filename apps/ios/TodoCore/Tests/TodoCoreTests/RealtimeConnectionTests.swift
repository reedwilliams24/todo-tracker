import Foundation
import XCTest

@testable import TodoCore

private let user = "6a1f1c2e-0000-4000-8000-000000000001"

private func row(_ id: String, _ seq: Int64) -> TodoRow {
    TodoRow(
        id: id, userId: user, title: id, notes: nil, completed: false, priority: .medium, dueDate: nil,
        recurrence: nil, completedAt: nil, createdAt: "2026-01-05T09:00:00.000Z",
        updatedAt: "2026-01-05T09:00:00.000Z", deletedAt: nil, serverSeq: seq)
}

/// Counts sockets: `open` opens one, its handle's `close` closes it. Only touched on the main actor.
@MainActor
private final class FakeTransport: RealtimeTransport, @unchecked Sendable {
    var log: [String] = []
    var opened = 0
    var live = 0
    var maxLive = 0
    var failNext = 0
    var onRow: (@MainActor @Sendable (TodoRow) -> Void)?
    var onClosed: (@MainActor @Sendable () -> Void)?

    nonisolated func refreshAuth() async throws {
        await MainActor.run { log.append("refreshAuth") }
    }

    nonisolated func open(
        userId: String, onRow: @escaping @MainActor @Sendable (TodoRow) -> Void,
        onClosed: @escaping @MainActor @Sendable () -> Void
    ) async throws -> any RealtimeChannelHandle {
        try await MainActor.run {
            log.append("open \(userId)")
            if failNext > 0 {
                failNext -= 1
                throw URLError(.notConnectedToInternet)
            }
            opened += 1
            live += 1
            maxLive = max(maxLive, live)
            self.onRow = onRow
            self.onClosed = onClosed
            return Handle(transport: self)
        }
    }

    func closed() {
        live -= 1
        log.append("close")
    }

    private struct Handle: RealtimeChannelHandle {
        let transport: FakeTransport
        func close() async { await transport.closed() }
    }
}

@MainActor
private final class FakeTarget {
    let transport: FakeTransport
    let userId: String
    var applied: [[TodoRow]] = []
    var pulls = 0

    init(_ transport: FakeTransport, userId: String = user) {
        self.transport = transport
        self.userId = userId
    }

    var target: RealtimeTarget {
        RealtimeTarget(
            userId: userId,
            pull: { [self] in
                pulls += 1
                transport.log.append("pull")
            },
            applyRemote: { [self] in applied.append($0) })
    }
}

/// Lets the connection's tasks run to their next real suspension point.
@MainActor
private func settle() async {
    for _ in 0..<50 { await Task.yield() }
}

@MainActor
final class RealtimeConnectionTests: XCTestCase {
    func testRefreshesTheTokenJoinsThenPullsBeforeItIsConnected() async {
        let transport = FakeTransport()
        let connection = RealtimeConnection(transport: transport)
        var states: [ConnectionState] = []
        connection.onStateChange = { states.append($0) }
        connection.connect(FakeTarget(transport).target)
        XCTAssertEqual(connection.state, .connecting)
        await settle()
        XCTAssertEqual(transport.log, ["refreshAuth", "open \(user)", "pull"])
        XCTAssertEqual(states, [.connecting, .connected])
    }

    func testRepeatedConnectsAndForegroundEventsNeverOpenASecondSocket() async {
        let transport = FakeTransport()
        let connection = RealtimeConnection(transport: transport)
        let target = FakeTarget(transport)
        connection.connect(target.target)
        connection.connect(target.target)
        await settle()
        connection.connect(target.target)
        connection.connect(FakeTarget(transport).target)
        await settle()
        XCTAssertEqual(transport.opened, 1)
        XCTAssertEqual(transport.maxLive, 1)
        XCTAssertEqual(target.pulls, 1)
        XCTAssertEqual(connection.state, .connected)
    }

    func testBackgroundThenForegroundClosesTheSocketAndReconnectsWithAFreshPull() async {
        let transport = FakeTransport()
        let connection = RealtimeConnection(transport: transport)
        let target = FakeTarget(transport)
        for _ in 0..<3 {
            connection.connect(target.target)
            await settle()
            connection.disconnect()
            await settle()
            XCTAssertEqual(transport.live, 0)
            XCTAssertEqual(connection.state, .offline)
        }
        XCTAssertEqual(transport.opened, 3)
        XCTAssertEqual(transport.maxLive, 1)
        XCTAssertEqual(target.pulls, 3)
    }

    func testHandsLiveRowsToApplyRemoteAndDropsRowsFromAChannelItLeft() async {
        let transport = FakeTransport()
        let connection = RealtimeConnection(transport: transport)
        let target = FakeTarget(transport)
        connection.connect(target.target)
        await settle()
        transport.onRow?(row("a", 6))
        XCTAssertEqual(target.applied, [[row("a", 6)]])
        let stale = transport.onRow
        let staleClosed = transport.onClosed
        connection.disconnect()
        stale?(row("b", 7))
        staleClosed?()
        await settle()
        XCTAssertEqual(target.applied, [[row("a", 6)]])
        XCTAssertEqual(connection.state, .offline)
    }

    func testRetriesWithBackoffAndResetsAfterItConnects() async {
        let transport = FakeTransport()
        transport.failNext = 2
        let delays = Delays()
        let connection = RealtimeConnection(transport: transport, sleep: { await delays.record($0) })
        connection.connect(FakeTarget(transport).target)
        await settle()
        XCTAssertEqual(connection.state, .connected)
        transport.onClosed?()
        await settle()
        XCTAssertEqual(connection.state, .connected)
        XCTAssertEqual(transport.maxLive, 1)
        let recorded = await delays.values
        XCTAssertEqual(recorded, [1000, 2000, 1000])
    }

    func testConnectDuringABackoffRetriesNowInsteadOfWaiting() async {
        let transport = FakeTransport()
        transport.failNext = 1
        let connection = RealtimeConnection(
            transport: transport, sleep: { _ in try await Task.sleep(for: .seconds(3600)) })
        let target = FakeTarget(transport)
        connection.connect(target.target)
        await settle()
        XCTAssertEqual(connection.state, .connecting)
        connection.connect(target.target)
        await settle()
        XCTAssertEqual(connection.state, .connected)
    }

    func testADifferentUserDisconnectsTheOldChannelFirst() async {
        let transport = FakeTransport()
        let connection = RealtimeConnection(transport: transport)
        connection.connect(FakeTarget(transport).target)
        await settle()
        connection.connect(FakeTarget(transport, userId: "other").target)
        await settle()
        XCTAssertTrue(transport.log.contains("close"))
        XCTAssertTrue(transport.log.contains("open other"))
        XCTAssertEqual(transport.maxLive, 1)
    }
}

private actor Delays {
    var values: [Int64] = []
    func record(_ ms: Int64) { values.append(ms) }
}
