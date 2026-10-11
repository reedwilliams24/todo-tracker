import TodoCore

/// `voice` ops; mirrors packages/spec/src/features/voice.ts.
extension FixtureOps {
    static var voiceOps: [String: Op] {
        [
            "parseTranscript": { g in
                return parseTranscript(try g.decode("transcript"), now: try g.date("now"))
            },
            "extractPriority": { g in
                return extractPriority(try g.decode("text"))
            },
            "extractDueDate": { g in
                return extractDueDate(try g.decode("text"), now: try g.date("now"))
            },
            "cleanTitle": { g in
                return cleanTitle(try g.decode("text"))
            },
            "coerceDrafts": { g in
                return coerceDrafts(g.raw["value"] ?? .null)
            },
            "reconcileDrafts": { g in
                return reconcileDrafts(heuristic: try g.decode("heuristic"), llm: try g.decode("llm"))
            },
        ]
    }
}
