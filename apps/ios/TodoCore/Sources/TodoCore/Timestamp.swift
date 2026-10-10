import Foundation

/// ISO-8601 timestamps matching JavaScript `Date#toISOString` and `new Date(string)`.
public enum Timestamp {
    private static func calendar(_ timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    /// Epoch milliseconds, like JavaScript `Date#getTime`.
    public static func milliseconds(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1000).rounded())
    }

    /// `2026-01-05T09:00:00.000Z`
    public static func iso(_ date: Date) -> String {
        let ms = milliseconds(date)
        let seconds = ms >= 0 ? ms / 1000 : (ms - 999) / 1000
        let millis = Int(ms - seconds * 1000)
        let parts = calendar(TimeZone(identifier: "UTC")!).dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: Date(timeIntervalSince1970: TimeInterval(seconds))
        )
        return String(
            format: "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
            parts.year!, parts.month!, parts.day!, parts.hour!, parts.minute!, parts.second!, millis
        )
    }

    private static let pattern = try! NSRegularExpression(
        pattern: #"^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]{1,3}))?)?(Z)?$"#
    )

    /// Parses `YYYY-MM-DDTHH:mm[:ss[.sss]][Z]`. A trailing `Z` means UTC; without it the
    /// value is local time in `localTimeZone`, as in JavaScript.
    public static func parse(_ value: String, localTimeZone: TimeZone = .current) -> Date? {
        let ns = value as NSString
        guard let match = pattern.firstMatch(in: value, range: NSRange(location: 0, length: ns.length)) else {
            return nil
        }
        func group(_ index: Int) -> String? {
            let range = match.range(at: index)
            return range.location == NSNotFound ? nil : ns.substring(with: range)
        }
        let isUTC = group(8) != nil
        var parts = DateComponents()
        parts.year = Int(group(1)!)
        parts.month = Int(group(2)!)
        parts.day = Int(group(3)!)
        parts.hour = Int(group(4)!)
        parts.minute = Int(group(5)!)
        parts.second = Int(group(6) ?? "0")
        let cal = calendar(isUTC ? TimeZone(identifier: "UTC")! : localTimeZone)
        guard let base = cal.date(from: parts) else { return nil }
        let fraction = (group(7) ?? "").padding(toLength: 3, withPad: "0", startingAt: 0)
        return base.addingTimeInterval(TimeInterval(Int(fraction) ?? 0) / 1000)
    }
}
