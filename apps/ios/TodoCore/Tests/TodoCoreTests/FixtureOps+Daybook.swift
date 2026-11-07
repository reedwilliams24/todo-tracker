import Foundation
import TodoCore

/// `daybook` ops; mirrors packages/spec/src/features/daybook.ts.
extension FixtureOps {
    static var daybookOps: [String: Op] {
        [
            "daybookSections": { g in
                let s = daybookSections(try g.decode("todos"), today: try g.decode("today"))
                return [
                    "slipped": s.slipped.map(\.id), "today": s.today.map(\.id), "later": s.later.map(\.id),
                    "done": s.done.map(\.id),
                ]
            },
            "daybookProgress": { g in
                let zone: String? = try g.decode("timeZone")
                guard let timeZone = zone.map({ TimeZone(identifier: $0) }) ?? .current else {
                    throw BadGiven(description: "given.timeZone is not a time zone: \(zone ?? "")")
                }
                return daybookProgress(try g.decode("todos"), now: try g.date("now"), timeZone: timeZone)
            },
            "upcomingDays": { g in
                upcomingDays(try g.decode("todos"), today: try g.decode("today")).map {
                    UpcomingDayIds(date: $0.date, ids: $0.todos.map(\.id))
                }
            },
        ]
    }

    private struct UpcomingDayIds: Encodable {
        let date: String
        let ids: [String]
    }
}
