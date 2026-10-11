import SwiftUI
import TodoCore

/// Guest / expired banner, plus the sign-in sheet and Move/Discard prompt when they're open.
struct AuthBanner: View {
    @Bindable var auth: AuthViewModel

    var body: some View {
        Group {
            switch auth.state.status {
            case .signedOut:
                banner(t("auth.guest.banner"), id: TestID.authGuestBanner, action: t("auth.signIn"))
            case .expired:
                banner(t("auth.expired.banner"), id: TestID.authExpiredBanner, action: t("auth.expired.signIn"))
            case .signedIn:
                EmptyView()
            }
        }
        .sheet(isPresented: Binding(get: { auth.isSheetPresented }, set: { if !$0 { auth.cancel() } })) {
            SignInSheet(auth: auth)
        }
        .alert(
            auth.movePromptText ?? "",
            isPresented: Binding(get: { auth.movePromptText != nil }, set: { _ in })
        ) {
            Button(t("auth.move.move")) { auth.resolveGuestTodos(move: true) }
                .accessibilityIdentifier(TestID.authMoveConfirm)
            Button(t("auth.move.discard"), role: .destructive) { auth.resolveGuestTodos(move: false) }
                .accessibilityIdentifier(TestID.authMoveDiscard)
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

    var body: some View {
        if auth.state.status != .signedOut {
            Menu {
                Text(t("auth.account.signedInAs", ["email": auth.state.email]))
                    .accessibilityIdentifier(TestID.authAccountEmail)
                Button(t("auth.signOut"), role: .destructive, action: auth.signOut)
                    .accessibilityIdentifier(TestID.authSignOut)
            } label: {
                Text(auth.state.email.isEmpty ? t("auth.account.label") : auth.state.email)
                    .font(.system(size: 14, weight: .medium))
                    .lineLimit(1)
                    .foregroundStyle(Theme.foreground)
            }
            .accessibilityIdentifier(TestID.authAccount)
        }
    }
}
