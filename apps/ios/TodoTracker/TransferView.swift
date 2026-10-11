import SwiftUI
import TodoCore
import UniformTypeIdentifiers

/// Plain-text file handed to the system "save to Files" sheet.
struct TransferDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json, .commaSeparatedText]
    var text: String

    init(text: String) { self.text = text }

    init(configuration: ReadConfiguration) throws {
        text = configuration.file.regularFileContents.map { String(decoding: $0, as: UTF8.self) } ?? ""
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}

/// Export JSON/CSV through the Files sheet and import JSON with a merge/replace confirmation.
struct TransferView: View {
    let todos: [Todo]
    let onImport: ([Todo], ImportMode) -> Void

    @State private var exportFormat: ExportFormat = .json
    @State private var document = TransferDocument(text: "")
    @State private var isExporting = false
    @State private var isImporting = false
    @State private var pending: ImportResult?
    @State private var status: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                link("Export JSON", id: TestID.exportJson, disabled: todos.isEmpty) { export(.json) }
                link("Export CSV", id: TestID.exportCsv, disabled: todos.isEmpty) { export(.csv) }
                link("Import JSON…", id: TestID.importOpen) {
                    status = nil
                    isImporting = true
                }
            }
            // Separate views for the two presenters; SwiftUI drops one when both sit on the same view.
            .fileExporter(
                isPresented: $isExporting,
                document: document,
                contentType: exportFormat == .csv ? .commaSeparatedText : .json,
                defaultFilename: (exportFileName(exportFormat, now: Date()) as NSString).deletingPathExtension
            ) { _ in }
            if let status {
                Text(status)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.importStatus)
            }
            if let pending { panel(pending) }
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json]) { result in
            guard case .success(let url) = result else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            pending = parseImportJson((try? String(contentsOf: url, encoding: .utf8)) ?? "")
        }
    }

    private func export(_ format: ExportFormat) {
        exportFormat = format
        document = TransferDocument(text: format == .csv ? exportTodosCsv(todos) : exportTodosJson(todos, now: Date()))
        isExporting = true
    }

    private func finish(_ mode: ImportMode) {
        guard let pending else { return }
        onImport(pending.todos, mode)
        status = describeImported(count: pending.todos.count, mode: mode)
        self.pending = nil
    }

    private func link(_ title: String, id: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .buttonStyle(.plain)
            .font(.system(size: 12))
            .foregroundStyle(Theme.foreground.opacity(disabled ? 0.3 : 0.7))
            .disabled(disabled)
            .accessibilityIdentifier(id)
    }

    private func panel(_ result: ImportResult) -> some View {
        let canImport = !result.todos.isEmpty
        return VStack(alignment: .leading, spacing: 8) {
            Text(describeImport(valid: result.todos.count, problems: result.errors.count))
                .foregroundStyle(Theme.foreground)
                .accessibilityIdentifier(TestID.importSummary)
            ForEach(Array(result.errors.enumerated()), id: \.offset) { _, error in
                HStack(alignment: .top, spacing: 4) {
                    Text("•")
                    Text(error).accessibilityIdentifier(TestID.importError)
                }
                .foregroundStyle(Theme.danger)
            }
            HStack(spacing: 12) {
                Button("Merge") { finish(.merge) }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.card)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(Theme.foreground, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                    .opacity(canImport ? 1 : 0.3)
                    .disabled(!canImport)
                    .accessibilityIdentifier(TestID.importMode(.merge))
                Button("Replace") { finish(.replace) }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.foreground)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.foreground.opacity(0.2)))
                    .opacity(canImport ? 1 : 0.3)
                    .disabled(!canImport)
                    .accessibilityIdentifier(TestID.importMode(.replace))
                link("Cancel", id: TestID.importCancel) { pending = nil }
            }
        }
        .font(.system(size: 12))
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg).stroke(Theme.border))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Confirm import")
        .accessibilityIdentifier(TestID.importDialog)
    }
}
