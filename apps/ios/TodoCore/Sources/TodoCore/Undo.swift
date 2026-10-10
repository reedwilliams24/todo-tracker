import Foundation

public let undoTimeoutMs: Int64 = 5000

public enum UndoKind: String, Codable, Sendable {
    case complete, delete
}

/// A snapshot of the list before a destructive action, so it can be restored exactly.
public struct UndoEntry: Equatable, Sendable {
    public var label: String
    /// Full list (including order) before the action.
    public var before: [Todo]
    /// Epoch milliseconds.
    public var at: Int64

    public init(label: String, before: [Todo], at: Int64) {
        self.label = label
        self.before = before
        self.at = at
    }
}

public func describeUndo(_ action: UndoKind, count: Int) -> String {
    let noun = count == 1 ? "todo" : "\(count) todos"
    return action == .complete ? "Completed \(noun)" : "Deleted \(noun)"
}

public func isUndoExpired(_ entry: UndoEntry, now: Int64, timeoutMs: Int64 = undoTimeoutMs) -> Bool {
    now - entry.at >= timeoutMs
}
