import TodoCore

/// `quick-add` ops; mirrors packages/spec/src/features/quick-add.ts.
extension FixtureOps {
    static var quickAddOps: [String: Op] {
        [
            "parseQuickAdd": { g in
                return parseQuickAdd(try g.decode("input"), now: try g.date("now"))
            },
            "hasQuickAddMeta": { g in
                return hasQuickAddMeta(try g.decode("parse"))
            },
            "quickAddToDraft": { g in
                return quickAddToDraft(
                    try g.decode("parse"),
                    fallbackPriority: try g.decode("fallbackPriority"),
                    fallbackDueDate: try g.decode("fallbackDueDate", as: String?.self)
                )
            },
        ]
    }
}
