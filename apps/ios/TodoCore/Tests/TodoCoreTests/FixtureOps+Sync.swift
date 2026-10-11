import Foundation
import TodoCore

/// `sync` ops; mirrors packages/spec/src/features/sync.ts.
extension FixtureOps {
    static var syncOps: [String: Op] {
        [
            "syncConstants": { _ in
                return ["columns": syncColumns]
            },
            "toRow": { g in
                let deletedAt = try g.decode("deletedAt", as: String?.self).flatMap { Timestamp.parse($0) }
                return try rowJson(toRow(try g.decode("todo"), userId: try g.decode("userId"), deletedAt: deletedAt))
            },
            "fromRow": { g in
                return fromRow(try g.decode("row"))
            },
            "applyRemote": { g in
                return applyRemote(
                    try g.decode("local"), inFlight: try g.decode("inFlight"), rows: try g.decode("rows"),
                    cursor: try g.decode("cursor"))
            },
            "advanceCursor": { g in
                return advanceCursor(try g.decode("cursor"), rows: try g.decode("rows"))
            },
            "rollbackPush": { g in
                return rollbackPush(
                    try g.decode("local"), before: try g.decode("before"), failedIds: try g.decode("failedIds"))
            },
            "guestToRows": { g in
                return try guestToRows(try g.decode("guest"), userId: try g.decode("userId"), now: try g.date("now"))
                    .map(rowJson)
            },
            "planPush": { g in
                let plan = planPush(
                    try g.decode("before"), after: try g.decode("after"),
                    tombstoned: Set(try g.decode("tombstoned", as: [String].self)), userId: try g.decode("userId"),
                    now: try g.date("now"))
                return PlanJSON(todos: plan.todos, rows: try plan.rows.map(rowJson))
            },
        ]
    }

    private struct PlanJSON: Encodable {
        let todos: [Todo]
        let rows: [JSONValue]
    }

    /// Fixtures can't hold null values (spec/README.md#normalization), so rows list their null columns separately.
    private static func rowJson(_ row: TodoRow) throws -> JSONValue {
        let value = try JSONDecoder().decode(JSONValue.self, from: try JSONEncoder().encode(row))
        guard case .object(let fields) = value else { throw BadGiven(description: "row did not encode to an object") }
        return .object([
            "row": .object(fields.filter { $0.value != .null }),
            "nulls": .array(fields.filter { $0.value == .null }.keys.sorted().map(JSONValue.string)),
        ])
    }
}
