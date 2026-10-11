import TodoCore

/// `theme` ops; mirrors packages/spec/src/features/theme.ts.
extension FixtureOps {
    static var themeOps: [String: Op] {
        [
            "themeConstants": { _ in
                ThemeConstants()
            },
            "parseThemePreference": { g in
                parseThemePreference(try g.decode("raw", as: String?.self))
            },
            "resolveTheme": { g in
                resolveTheme(try g.decode("preference"), systemDark: try g.decode("systemDark"))
            },
            "nextThemePreference": { g in
                nextThemePreference(try g.decode("preference"))
            },
        ]
    }

    private struct ThemeConstants: Encodable {
        let storageKey = TodoCore.themeStorageKey
        let defaultTheme = TodoCore.defaultTheme
        let preferences = TodoCore.themePreferences
        let labels = Dictionary(uniqueKeysWithValues: ThemePreference.allCases.map { ($0.rawValue, $0.label) })
    }
}
