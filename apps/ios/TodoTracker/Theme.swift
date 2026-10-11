import SwiftUI
import TodoCore

/// Tailwind scale (1 unit = 4pt). Colors adapt to the resolved color scheme; dark values mirror the web `.dark` palette.
/// Text meets WCAG AA (spec/features/accessibility.md).
enum Theme {
    static let background = Color(light: 0xF7F7F5, dark: 0x0B0C0F)
    static let card = Color(light: 0xFFFFFF, dark: 0x17181B)
    static let border = Color(
        light: UIColor.black.withAlphaComponent(0.1), dark: UIColor.white.withAlphaComponent(0.15))
    static let foreground = Color(light: 0x171717, dark: 0xE9EAEE)
    static let muted = foreground.opacity(0.7)
    static let danger = Color(light: 0xDC2626, dark: 0xF87171)

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
    }

    static func priority(_ priority: TodoPriority) -> (bg: Color, text: Color) {
        switch priority {
        case .high:
            (
                Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255).opacity(0.15),
                Color(light: 0xB91C1C, dark: 0xF87171)
            )
        case .medium:
            (
                Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255).opacity(0.15),
                Color(light: 0x92400E, dark: 0xFBBF24)
            )
        case .low:
            (
                Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255).opacity(0.15),
                Color(light: 0x047857, dark: 0x34D399)
            )
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
