import Foundation
import TodoCore

/// `storage` ops; mirrors packages/spec/src/features/storage.ts.
extension FixtureOps {
    static var storageOps: [String: Op] {
        [
            "parseStoredTodos": { g in
                return parseStoredTodos(try g.decode("raw", as: String?.self))
            },
            "serializeTodos": { g in
                return try JSONDecoder().decode(JSONValue.self, from: Data(serializeTodos(try g.decode("todos")).utf8))
            },
        ]
    }
}
