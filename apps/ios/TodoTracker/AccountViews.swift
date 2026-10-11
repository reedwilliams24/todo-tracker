import SwiftUI
import TodoCore

/// Guest / expired banner. Shows nothing while signed in.
struct AuthBanner: View {
    @Bindable var auth: AuthViewModel

    var body: some View {
        switch auth.state.status {
        case .signedOut:
            banner(t("auth.guest.banner"), id: TestID.authGuestBanner, action: t("auth.signIn"))
        case .expired:
            banner(t("auth.expired.banner"), id: TestID.authExpiredBanner, action: t("auth.expired.signIn"))
        case .signedIn:
            EmptyView()
        }
    }

    private func banner(_ text: String, id: String, action: String) -> some View {
        HStack(spacing: 12) {
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action, action: auth.open)
                .buttonStyle(.bordered)
                .accessibilityIdentifier(TestID.authSignIn)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md).stroke(Theme.border))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(id)
    }
}

/// The sign-in sheet and Move/Discard prompt. Attached to the screen, not the banner: the banner is
/// empty once signed in, and a modifier on an empty view never presents.
private struct AuthPresentation: ViewModifier {
    @Bindable var auth: AuthViewModel

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: Binding(get: { auth.isSheetPresented }, set: { if !$0 { auth.cancel() } })) {
                SignInSheet(auth: auth)
            }
            .alert(
                auth.movePromptText ?? "",
                isPresented: Binding(get: { auth.movePromptText != nil }, set: { _ in })
            ) {
                Button(t("auth.move.move")) { auth.resolveGuestTodos(move: true) }
                    .accessibilityIdentifier(TestID.authMoveConfirm)
                Button(t("auth.move.discard")) { auth.resolveGuestTodos(move: false) }
                    .accessibilityIdentifier(TestID.authMoveDiscard)
            }
    }
}

extension View {
    @ViewBuilder
    func authPresentation(_ auth: AuthViewModel?) -> some View {
        if let auth { modifier(AuthPresentation(auth: auth)) } else { self }
    }
}

private struct SignInSheet: View {
    @Bindable var auth: AuthViewModel
    @State private var email = ""
    @State private var code = ""

    var body: some View {
        NavigationStack {
            Form {
                if auth.state.step == .code {
                    Section {
                        Text(t("auth.codeSent", ["email": auth.state.email]))
                            .foregroundStyle(Theme.muted)
                        TextField(t("auth.code.label"), text: $code)
                            .textContentType(.oneTimeCode)
                            .keyboardType(.numberPad)
                            .onChange(of: code) { _, value in code = normalizeCode(value) }
                            .accessibilityIdentifier(TestID.authCode)
                            .onSubmit { auth.verify(code) }
                    }
                    Section {
                        Button(t(auth.state.busy ? "auth.verifying" : "auth.verify")) { auth.verify(code) }
                            .disabled(auth.state.busy)
                            .accessibilityIdentifier(TestID.authVerify)
                        Button(
                            auth.resendSeconds > 0
                                ? t("auth.resendIn", ["seconds": auth.resendSeconds]) : t("auth.resend"),
                            action: auth.resend
                        )
                        .disabled(auth.resendSeconds > 0 || auth.state.busy)
                        .accessibilityIdentifier(TestID.authResend)
                        Button(t("auth.changeEmail")) {
                            code = ""
                            auth.changeEmail()
                        }
                        .accessibilityIdentifier(TestID.authChangeEmail)
                    }
                } else {
                    Section(t("auth.email.label")) {
                        TextField(t("auth.email.placeholder"), text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .accessibilityIdentifier(TestID.authEmail)
                            .onSubmit { auth.sendCode(email) }
                    }
                    Section {
                        Button(t(auth.state.busy ? "auth.sending" : "auth.sendCode")) { auth.sendCode(email) }
                            .disabled(auth.state.busy)
                            .accessibilityIdentifier(TestID.authSendCode)
                    }
                }
                if let error = auth.state.error {
                    Text(t("auth.error.\(error.rawValue)"))
                        .foregroundStyle(Theme.danger)
                        .accessibilityIdentifier(TestID.authError)
                }
            }
            .navigationTitle(t("auth.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(t("auth.cancel"), action: auth.cancel)
                        .accessibilityIdentifier(TestID.authCancel)
                }
            }
        }
        .accessibilityIdentifier(TestID.authSheet)
        .onAppear { email = auth.state.email }
    }
}

/// Header button with the signed-in email; opens a menu with Sign out.
struct AccountMenu: View {
    let auth: AuthViewModel
    @State private var confirmingDelete = false
    @State private var deleting = false
    @State private var deleteError: TodoCore.AuthError?

    var body: some View {
        if auth.state.status != .signedOut {
            Menu {
                Text(t("auth.account.signedInAs", ["email": auth.state.email]))
                    .accessibilityIdentifier(TestID.authAccountEmail)
                Button(t("auth.signOut"), role: .destructive, action: auth.signOut)
                    .accessibilityIdentifier(TestID.authSignOut)
                Button(t("auth.delete.menu"), role: .destructive) {
                    deleteError = nil
                    confirmingDelete = true
                }
                .accessibilityIdentifier(TestID.authDeleteAccount)
            } label: {
                Text(label)
                    .font(.system(size: 14, weight: .medium))
                    .lineLimit(1)
                    .foregroundStyle(Theme.foreground)
            }
            .disabled(deleting)
            .accessibilityIdentifier(TestID.authAccount)
            .alert(t("auth.delete.title"), isPresented: $confirmingDelete) {
                Button(t("auth.cancel"), role: .cancel) {}
                    .accessibilityIdentifier(TestID.authDeleteCancel)
                Button(t("auth.delete.confirm"), role: .destructive, action: deleteAccount)
                    .accessibilityIdentifier(TestID.authDeleteConfirm)
            } message: {
                Text(deleteMessage)
            }
        }
    }

    private var label: String {
        if deleting { return t("auth.delete.deleting") }
        return auth.state.email.isEmpty ? t("auth.account.label") : auth.state.email
    }

    private var deleteMessage: String {
        let message = t("auth.delete.message", ["email": auth.state.email])
        guard let deleteError else { return message }
        return t("auth.error.\(deleteError.rawValue)") + "\n\n" + message
    }

    private func deleteAccount() {
        deleting = true
        Task {
            defer { deleting = false }
            do {
                try await auth.deleteAccount()
            } catch {
                // Re-ask with the failure shown; nothing was deleted.
                deleteError = (error as? AuthFailure)?.kind ?? .unknown
                confirmingDelete = true
            }
        }
    }
}
