import Foundation
import TodoCore

/// `realtime` ops; mirrors packages/spec/src/features/realtime.ts.
extension FixtureOps {
    static var realtimeOps: [String: Op] {
        [
            "realtimeConstants": { _ in
                return RealtimeConstants(
                    schema: realtimeSchema, table: realtimeTable, reconnectBaseMs: reconnectBaseMs,
                    reconnectMaxMs: reconnectMaxMs)
            },
            "realtimeTopic": { g in
                return realtimeTopic(userId: try g.decode("userId"))
            },
            "reconnectDelayMs": { g in
                return reconnectDelayMs(try g.decode("attempt"))
            },
        ]
    }
}

private struct RealtimeConstants: Encodable {
    let schema: String
    let table: String
    let reconnectBaseMs: Int64
    let reconnectMaxMs: Int64
}
