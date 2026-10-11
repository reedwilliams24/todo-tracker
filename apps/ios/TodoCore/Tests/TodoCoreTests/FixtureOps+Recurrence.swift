import TodoCore

/// `recurrence` ops; mirrors packages/spec/src/features/recurrence.ts.
extension FixtureOps {
    static var recurrenceOps: [String: Op] {
        [
            "recurrenceConstants": { _ in
                return RecurrenceConstants()
            },
            "nextOccurrence": { g in
                return nextOccurrence(try g.decode("dueDate"), try g.decode("recurrence"))
            },
            "scheduleNext": { g in
                return scheduleNext(try g.decode("todo"), now: try g.date("now"))
            },
        ]
    }

    private struct RecurrenceConstants: Encodable {
        let recurrences = Recurrence.allCases
    }
}
