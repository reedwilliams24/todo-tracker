public let themeStorageKey = "todo-tracker:theme:v1"

/// Light/dark/system preference; see spec/features/theme.md. Case order is display order.
public enum ThemePreference: String, Codable, CaseIterable, Sendable {
    case light, dark, system

    public var label: String {
        switch self {
        case .light: "Light"
        case .dark: "Dark"
        case .system: "System"
        }
    }
}

public enum ResolvedTheme: String, Codable, Sendable {
    case light, dark
}

public let themePreferences: [ThemePreference] = ThemePreference.allCases
public let defaultTheme: ThemePreference = .system

/// Missing, empty, unknown or differently cased values fall back to the default.
public func parseThemePreference(_ raw: String?) -> ThemePreference {
    raw.flatMap(ThemePreference.init(rawValue:)) ?? defaultTheme
}

public func resolveTheme(_ preference: ThemePreference, systemDark: Bool) -> ResolvedTheme {
    switch preference {
    case .light: .light
    case .dark: .dark
    case .system: systemDark ? .dark : .light
    }
}

/// light -> dark -> system -> light
public func nextThemePreference(_ preference: ThemePreference) -> ThemePreference {
    let index = themePreferences.firstIndex(of: preference) ?? 0
    return themePreferences[(index + 1) % themePreferences.count]
}
