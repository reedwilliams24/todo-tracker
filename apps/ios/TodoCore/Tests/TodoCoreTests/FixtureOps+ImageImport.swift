import TodoCore

/// `image-import` ops; mirrors packages/spec/src/features/image-import.ts.
extension FixtureOps {
    static var imageImportOps: [String: Op] {
        [
            "checkImageUpload": { g in
                return checkImageUpload(mimeType: try g.decode("mimeType"), bytes: try g.decode("bytes"))
            },
            "coerceImageDrafts": { g in
                return coerceImageDrafts(g.raw["value"] ?? .null)
            },
            "imageImportConstants": { _ in
                return imageImport
            },
            "imageImportErrorFor": { g in
                return imageImportErrorFor(status: try g.decode("status"), body: g.raw["body"] ?? .null)
            },
        ]
    }
}
