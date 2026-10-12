import SwiftUI
import TodoCore

/// Daybook tokens (spec/features/daybook.md); light/dark values match the web `.d-day` palette.
/// Spacing follows the Tailwind scale (1 unit = 4pt). Text meets WCAG AA (spec/features/accessibility.md).
enum Theme {
    static let background = Color(light: 0xF3F4FA, dark: 0x0D0F21)
    static let card = Color(light: 0xFFFFFF, dark: 0x171A33)
    static let border = Color(light: 0xE3E5F1, dark: 0x272B4D)
    static let foreground = Color(light: 0x151833, dark: 0xE8EAFB)
    static let muted = Color(light: 0x686D8E, dark: 0x9196BA)
    static let accent = Color(light: 0x4F46E5, dark: 0x8B8DFF)
    static let accentInk = Color(light: 0xFFFFFF, dark: 0x0D0F21)
    static let soft = Color(light: 0xECEDFF, dark: 0x23274F)
    static let danger = Color(light: 0xE5484D, dark: 0xFF6B6E)
    static let success = Color(light: 0x0E9F6E, dark: 0x34D399)
    static let note = Color(light: 0x8A5300, dark: 0xF5C26B)
    static let noteBackground = Color(light: 0xFFF4E0, dark: 0x2C2414)

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 14
    }

    static func priority(_ priority: TodoPriority) -> Color {
        switch priority {
        case .high: Color(light: 0xE5484D, dark: 0xFF6B6E)
        case .medium: Color(light: 0xE58A00, dark: 0xFBBF24)
        case .low: Color(light: 0x0E9F6E, dark: 0x34D399)
        }
    }
}

extension UIColor {
    fileprivate convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    fileprivate init(light: UIColor, dark: UIColor) {
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? dark : light })
    }

    fileprivate init(light: UInt32, dark: UInt32) {
        self.init(light: UIColor(hex: light), dark: UIColor(hex: dark))
    }
}

extension ThemePreference {
    /// `nil` follows the system appearance.
    var colorScheme: ColorScheme? {
        switch self {
        case .light: .light
        case .dark: .dark
        case .system: nil
        }
    }
}

extension View {
    func cardStyle() -> some View {
        background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.border, lineWidth: 1))
    }
}
