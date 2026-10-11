import Foundation
import TodoCore

/// `stats` ops; mirrors packages/spec/src/features/stats.ts.
extension FixtureOps {
    static var statsOps: [String: Op] {
        [
            "statsConstants": { g in
                    return StatsConstants()
            },
            "computeStats": { g in
                    let zone: String? = try g.decode("timeZone")
                    guard let timeZone = zone.map({ TimeZone(identifier: $0) }) ?? .current else {
                    throw BadGiven(description: "given.timeZone is not a time zone: \(zone ?? "")")
                    }
                    return computeStats(
                    try g.decode("todos"),
                    now: try g.date("now"),
                    days: try g.decode("days", as: Int?.self) ?? statsDays,
                    timeZone: timeZone
                    )
            },
        ]
    }

    private struct StatsConstants: Encodable {
        let statsDays = TodoCore.statsDays
    }
}
