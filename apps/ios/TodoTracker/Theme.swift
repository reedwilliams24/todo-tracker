import SwiftUI
import TodoCore

/// Mirrors apps/mobile/src/theme.ts (Tailwind scale, 1 unit = 4pt).
enum Theme {
    static let background = Color(red: 0xF7 / 255, green: 0xF7 / 255, blue: 0xF5 / 255)
    static let card = Color.white
    static let border = Color.black.opacity(0.1)
    static let foreground = Color(red: 0x17 / 255, green: 0x17 / 255, blue: 0x17 / 255)
    static let muted = foreground.opacity(0.6)
    static let danger = Color(red: 0xDC / 255, green: 0x26 / 255, blue: 0x26 / 255)

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
    }

    static func priority(_ priority: TodoPriority) -> (bg: Color, text: Color) {
        switch priority {
        case .high:
            (Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255).opacity(0.15), danger)
        case .medium:
            (Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255).opacity(0.15),
             Color(red: 0xD9 / 255, green: 0x77 / 255, blue: 0x06 / 255))
        case .low:
            (Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255).opacity(0.15),
             Color(red: 0x05 / 255, green: 0x96 / 255, blue: 0x69 / 255))
        }
    }
}

extension View {
    func cardStyle() -> some View {
        background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.border, lineWidth: 1))
    }
}
