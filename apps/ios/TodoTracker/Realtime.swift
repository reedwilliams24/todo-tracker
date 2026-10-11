import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import TodoCore

/// Supabase Realtime (Phoenix channel protocol) for the user's todo rows. Calls `onChange` once the channel
/// is joined (so changes made while disconnected show up) and on every row change. Reconnects with a fresh
/// access token when the socket drops. Call `close()` to stop.
@MainActor
final class TodoChangeFeed {
    private let account: AccountSession
    private let userId: String
    private let topic: String
    private let onChange: @MainActor () -> Void
    private var task: Task<Void, Never>?
    private var token = ""
    private var ref = 1

    private static let joinRef = "1"

    init(account: AccountSession, userId: String, onChange: @escaping @MainActor () -> Void) {
        self.account = account
        self.userId = userId
        self.topic = "realtime:\(realtimeTopic(userId: userId))"
        self.onChange = onChange
        task = Task { [weak self] in await self?.run() }
    }

    func close() {
        task?.cancel()
        task = nil
    }

    private func run() async {
        var backoff = 1
        while !Task.isCancelled {
            let joined = (try? await connect()) ?? false
            if joined { backoff = 1 }
            try? await Task.sleep(for: .seconds(backoff))
            backoff = min(backoff * 2, 30)
        }
    }

    /// Runs one socket until it drops; returns whether the channel was ever joined.
    private func connect() async throws -> Bool {
        token = try await account.authorized { $0 }
        let config = account.client.config
        let base = config.url.hasSuffix("/") ? String(config.url.dropLast()) : config.url
        let wsBase = base.replacingOccurrences(of: "http", with: "ws", options: .anchored)
        guard let url = URL(string: "\(wsBase)/realtime/v1/websocket?apikey=\(config.anonKey)&vsn=1.0.0") else { return false }
        let socket = URLSession.shared.webSocketTask(with: url)
        socket.resume()
        defer { socket.cancel(with: .normalClosure, reason: nil) }
        try await socket.send(.string(join()))
        let heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                guard !Task.isCancelled, let self else { return }
                await self.beat(socket)
            }
        }
        defer { heartbeat.cancel() }
        var joined = false
        return try await withTaskCancellationHandler {
            while !Task.isCancelled {
                guard case .string(let text) = try await socket.receive(),
                      let envelope = try? JSONDecoder().decode(Envelope.self, from: Data(text.utf8)),
                      envelope.topic == topic
                else { continue }
                switch envelope.event {
                case "phx_reply" where envelope.ref == Self.joinRef:
                    guard envelope.payload?.status == "ok" else { return joined }
                    joined = true
                    onChange()
                case "postgres_changes":
                    onChange()
                case "phx_error", "phx_close":
                    return joined
                default:
                    break
                }
            }
            return joined
        } onCancel: {
            socket.cancel(with: .normalClosure, reason: nil)
        }
    }

    private func beat(_ socket: URLSessionWebSocketTask) async {
        try? await socket.send(.string(message(topic: "phoenix", event: "heartbeat", payload: [:])))
        guard let fresh = try? await account.authorized({ $0 }), fresh != token else { return }
        token = fresh
        try? await socket.send(.string(message(topic: topic, event: "access_token", payload: ["access_token": fresh])))
    }

    private func join() -> String {
        let filter = todoChangeFilter(userId: userId)
        let config: [String: Any] = [
            "broadcast": ["self": false, "ack": false],
            "presence": ["key": ""],
            "postgres_changes": [["event": filter.event, "schema": filter.schema, "table": filter.table, "filter": filter.filter]],
            "private": false,
        ]
        return message(topic: topic, event: "phx_join", payload: ["config": config, "access_token": token], ref: Self.joinRef)
    }

    private func message(topic: String, event: String, payload: [String: Any], ref fixed: String? = nil) -> String {
        var body: [String: Any] = ["topic": topic, "event": event, "payload": payload]
        if let fixed {
            body["ref"] = fixed
            body["join_ref"] = fixed
        } else {
            ref += 1
            body["ref"] = String(ref)
        }
        let data = (try? JSONSerialization.data(withJSONObject: body)) ?? Data()
        return String(decoding: data, as: UTF8.self)
    }

    private struct Envelope: Decodable {
        struct Payload: Decodable { let status: String? }
        let topic: String
        let event: String
        let ref: String?
        let payload: Payload?
    }
}
