import PhotosUI
import SwiftUI
import TodoCore
import UniformTypeIdentifiers

/// Paste or pick an image and add the todos AI finds in it (spec/features/image-import.md).
struct ImageImportView: View {
    let onAddMany: ([TodoDraft]) -> [Todo]
    let onUndo: ([String]) -> Void

    private enum Status: Equatable {
        case reading
        case added(ids: [String], first: String)
        case empty
        case failed(String)

        var isFailure: Bool {
            if case .failed = self { return true }
            return false
        }
    }

    @Environment(\.isEnabled) private var isEnabled
    @State private var status: Status?
    @State private var photo: PhotosPickerItem?
    @State private var choosing = false

    private var busy: Bool { status == .reading }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Menu {
                    PasteButton(supportedContentTypes: [.image]) { providers in
                        guard let provider = providers.first else { return fail("noImage") }
                        provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, _ in
                            Task { @MainActor in
                                if let data { await importImage(data) } else { fail("invalid") }
                            }
                        }
                    }
                    .accessibilityIdentifier(TestID.imageImportPaste)
                    Button(t("image.choose"), systemImage: "photo.on.rectangle") { choosing = true }
                        .accessibilityIdentifier(TestID.imageImportChoose)
                } label: {
                    Image(systemName: "photo")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 44, height: 44)
                        .background(Theme.soft, in: Circle())
                }
                .disabled(busy)
                .opacity(busy ? 0.4 : 1)
                .accessibilityLabel(t("image.import"))
                .accessibilityIdentifier(TestID.imageImportButton)
                Text(t("image.hint"))
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
            }
            if let status {
                HStack(spacing: 8) {
                    Text(text(for: status))
                        .font(.subheadline)
                        .foregroundStyle(status.isFailure ? Theme.danger : Theme.muted)
                    if case .added(let ids, _) = status {
                        Button(t("image.undo")) {
                            onUndo(ids)
                            self.status = nil
                        }
                        .font(.subheadline.weight(.semibold))
                        .underline()
                        .foregroundStyle(Theme.foreground)
                        .accessibilityIdentifier(TestID.imageImportUndo)
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier(TestID.imageImportStatus)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .photosPicker(isPresented: $choosing, selection: $photo, matching: .images)
        .onChange(of: photo) { _, item in
            guard let item else { return }
            photo = nil
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await importImage(data)
                } else {
                    fail("invalid")
                }
            }
        }
    }

    private func fail(_ key: String) {
        status = .failed(key)
    }

    @MainActor
    private func importImage(_ data: Data) async {
        guard isEnabled, !busy else { return }
        status = .reading
        switch await ImageTodosClient.importTodos(from: data) {
        case .failure(let error):
            status = .failed(error.rawValue)
        case .success(let drafts) where drafts.isEmpty:
            status = .empty
        case .success(let drafts):
            let added = onAddMany(drafts)
            status = .added(ids: added.map(\.id), first: added.first?.title ?? "")
        }
    }

    private func text(for status: Status) -> String {
        switch status {
        case .reading: t("image.reading")
        case .added(let ids, let first): t("image.added", ["count": ids.count, "first": first])
        case .empty: t("image.empty")
        case .failed(let key): t("image.error.\(key)")
        }
    }
}
