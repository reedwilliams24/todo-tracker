import SwiftUI
import TodoCore

/// Optional sign-in (spec/features/account.md). Not shown when the build has no Supabase config.
struct AuthPanelView: View {
    let model: TodoViewModel

    @State private var email = ""
    @State private var code = ""
    @Environment(\.openURL) private var openURL

    var body: some View {
        if model.auth.enabled {
            if let user = model.auth.user {
                signedIn(user)
            } else {
                signIn
            }
        }
    }

    private func signedIn(_ user: AuthUser) -> some View {
        HStack(spacing: 12) {
            Text("Signed in as \(user.email ?? user.id) · \(syncStatus(pending: model.unsynced))")
                .font(.system(size: 14))
                .foregroundStyle(Theme.foreground.opacity(0.8))
                .lineLimit(nil)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)
                .accessibilityIdentifier(TestID.authUser)
            Button("Sign out", action: model.signOut)
                .buttonStyle(.plain)
                .font(.system(size: 14))
                .underline()
                .foregroundStyle(Theme.foreground.opacity(0.7))
                .fixedSize()
                .disabled(model.auth.busy)
                .accessibilityIdentifier(TestID.authSignOut)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .cardStyle()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(TestID.authPanel)
    }

    private var signIn: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sign in to sync your todos across devices. Your local list comes with you.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
            if model.auth.pendingEmail == nil {
                HStack(spacing: 8) {
                    field("you@example.com", text: $email, id: TestID.authEmail, label: "Email")
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .submitLabel(.send)
                        .onSubmit(sendCode)
                    button("Email me a code", id: TestID.authSendCode, filled: true, enabled: canSend, action: sendCode)
                }
            } else {
                HStack(spacing: 8) {
                    field("6-digit code", text: $code, id: TestID.authCode, label: "Sign-in code")
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .onChange(of: code) { _, value in code = String(value.filter(\.isNumber).prefix(6)) }
                    button("Verify", id: TestID.authVerify, filled: true, enabled: canVerify, action: verifyCode)
                }
            }
            HStack(spacing: 8) {
                button("Continue with Google", id: TestID.authGoogle, enabled: !model.auth.busy) { open("google") }
                button("Continue with Apple", id: TestID.authApple, enabled: !model.auth.busy) { open("apple") }
            }
            if let status = model.auth.status {
                Text(status)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .accessibilityIdentifier(TestID.authStatus)
            }
            if model.auth.pendingEmail != nil {
                Button("Use a different email", action: model.changeEmail)
                    .buttonStyle(.plain)
                    .font(.system(size: 12))
                    .underline()
                    .foregroundStyle(Theme.muted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(TestID.authPanel)
    }

    private var canSend: Bool { email.contains("@") && !model.auth.busy }
    private var canVerify: Bool { code.count == 6 && !model.auth.busy }

    private func sendCode() {
        guard canSend else { return }
        model.sendCode(email: email.trimmingCharacters(in: .whitespaces))
    }

    private func verifyCode() {
        guard canVerify else { return }
        model.verifyCode(code)
        code = ""
    }

    private func open(_ provider: String) {
        if let url = model.providerURL(provider) { openURL(url) }
    }

    private func field(_ placeholder: String, text: Binding<String>, id: String, label: String) -> some View {
        TextField(placeholder, text: text, prompt: Text(placeholder).foregroundStyle(Theme.muted))
            .font(.system(size: 14))
            .foregroundStyle(Theme.foreground)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border, lineWidth: 1))
            .accessibilityLabel(label)
            .accessibilityIdentifier(id)
    }

    private func button(_ title: String, id: String, filled: Bool = false, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: filled ? .medium : .regular))
                .foregroundStyle(filled ? Theme.card : Theme.foreground)
                .lineLimit(1)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .frame(maxWidth: filled ? nil : .infinity)
                .background(filled ? Theme.foreground : .clear, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(filled ? .clear : Theme.border, lineWidth: 1))
        }
        .buttonStyle(UndimmedButtonStyle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityIdentifier(id)
    }
}
