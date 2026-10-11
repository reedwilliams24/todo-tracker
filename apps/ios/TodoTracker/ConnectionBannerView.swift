import SwiftUI
import TodoCore

/// Reconnecting / offline banner for the signed-in list (spec/features/realtime.md#connection-status).
struct ConnectionBannerView: View {
    let status: ConnectionStatus

    var body: some View {
        switch status {
        case .reconnecting:
            banner(announce: t("connection.reconnecting")) {
                ProgressView()
                    .controlSize(.small)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t("connection.reconnecting"))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.foreground)
                    Text(t("connection.readOnly"))
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                }
            }
        case .offline:
            banner(announce: t("connection.offline")) {
                Text(t("connection.offline"))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.foreground)
            }
        case .guest, .connected, .expired:
            EmptyView()
        }
    }

    private func banner(announce: String, @ViewBuilder content: () -> some View) -> some View {
        HStack(spacing: 12) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier(TestID.connectionBanner)
            .onAppear { UIAccessibility.post(notification: .announcement, argument: announce) }
    }
}
