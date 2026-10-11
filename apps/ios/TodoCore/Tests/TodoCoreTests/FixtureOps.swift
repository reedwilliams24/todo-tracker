import Foundation
import TodoCore

/// Runs the ops named in spec/fixtures. Each feature's ops live in FixtureOps+<Feature>.swift and
/// mirror packages/spec/src/features/<feature>.ts.
enum FixtureOps {
    struct UnknownOp: Error, CustomStringConvertible {
        let op: String
        var description: String { "Unknown op \"\(op)\"" }
    }

    struct BadGiven: Error, CustomStringConvertible {
        let description: String
    }

    static func run(op: String, given: JSONValue) throws -> JSONValue {
        let result = try encode(try call(op: op, given: Given(raw: given)))
        return normalize(given: given, result: result)
    }

    // MARK: - Dispatch

    typealias Op = (Given) throws -> any Encodable

    /// One table per feature, each in its own FixtureOps+<Feature>.swift. Keep one per line, in
    /// alphabetical order, so features added in parallel don't conflict.
    static var modules: [[String: Op]] {
        [
            listOps,
            quickAddOps,
            recurrenceOps,
            statsOps,
            storageOps,
            todoOps,
            undoOps,
            voiceOps,
        ]
    }

    private static func call(op: String, given g: Given) throws -> any Encodable {
        for module in modules {
            if let impl = module[op] { return try impl(g) }
        }
        throw UnknownOp(op: op)
    }

    // MARK: - Given

    struct Given {
        let raw: JSONValue

        func decode<T: Decodable>(_ key: String, as type: T.Type = T.self) throws -> T {
            let value = raw[key] ?? .null
            let data = try JSONEncoder().encode(value)
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                throw BadGiven(description: "given.\(key) is not \(T.self): \(value)")
            }
        }

        /// UTC when the value ends in Z, local time otherwise (voice ops).
        func date(_ key: String) throws -> Date {
            let value: String = try decode(key)
            guard let date = Timestamp.parse(value) else {
                throw BadGiven(description: "given.\(key) is not a date: \(value)")
            }
            return date
        }
    }

    // MARK: - Normalization (spec/README.md#normalization)

    private static func encode(_ value: any Encodable) throws -> JSONValue {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try JSONDecoder().decode(JSONValue.self, from: try encoder.encode(value))
    }

    /// Drops null values from nested objects (keeping top-level result fields like
    /// `undoLabel: null`) and renames ids that are not in `given` to new-1, new-2, … in
    /// order of first appearance (keys visited in sorted order, as serialized).
    static func normalize(given: JSONValue, result: JSONValue) -> JSONValue {
        var known = Set<String>()
        collectIds(given, into: &known)
        var renamed: [String: String] = [:]

        func walk(_ value: JSONValue, topLevel: Bool = false) -> JSONValue {
            switch value {
            case .array(let items):
                return .array(items.map { walk($0) })
            case .object(let fields):
                var out: [String: JSONValue] = [:]
                for key in fields.keys.sorted() {
                    let child = fields[key]!
                    if child == .null {
                        if topLevel { out[key] = .null }
                        continue
                    }
                    if key == "id", case .string(let id) = child, !known.contains(id), !isNewId(id) {
                        if renamed[id] == nil { renamed[id] = "new-\(renamed.count + 1)" }
                        out[key] = .string(renamed[id]!)
                    } else {
                        out[key] = walk(child)
                    }
                }
                return .object(out)
            default:
                return value
            }
        }
        return walk(result, topLevel: true)
    }

    private static func isNewId(_ id: String) -> Bool {
        id.hasPrefix("new-") && !id.dropFirst(4).isEmpty && id.dropFirst(4).allSatisfy(\.isASCIIDigit)
    }

    private static func collectIds(_ value: JSONValue, into known: inout Set<String>) {
        switch value {
        case .array(let items):
            for item in items { collectIds(item, into: &known) }
        case .object(let fields):
            for (key, child) in fields {
                if key == "id", case .string(let id) = child {
                    known.insert(id)
                } else {
                    collectIds(child, into: &known)
                }
            }
        default:
            break
        }
    }
}

extension Character {
    fileprivate var isASCIIDigit: Bool { isASCII && isNumber }
}
