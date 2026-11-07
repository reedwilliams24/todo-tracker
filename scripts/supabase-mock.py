#!/usr/bin/env python3
"""In-memory stand-in for the parts of local Supabase the native apps use, plus Mailpit's API.

For running the `supabase`-tagged Maestro flows where `supabase start` can't run (no Docker, e.g. macOS
CI runners). Standard library only; state lasts for one process.

  API (default 127.0.0.1:54321):
    POST /auth/v1/otp, /auth/v1/verify, /auth/v1/token?grant_type=refresh_token, /auth/v1/logout
    GET  /auth/v1/user
    GET  /rest/v1/todos?server_seq=gt.N&limit=N   (the pull)
    POST /rest/v1/rpc/push_todos, /rest/v1/rpc/delete_account
    GET  /realtime/v1/websocket                  (Phoenix vsn 1.0.0 objects or 2.0.0 arrays; postgres_changes)
  Mailpit (default 127.0.0.1:54324):
    GET  /api/v1/search?query=to:"<email>", /api/v1/message/<id>

Write rules follow supabase/migrations (spec/server.md): last writer wins on updated_at, tombstones win,
server_seq from one sequence. Usage: python3 scripts/supabase-mock.py [--port N] [--mailpit-port N] [--verbose]
(or SUPABASE_MOCK_PORT / MAILPIT_MOCK_PORT).
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import struct
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

COLUMNS = [
    ("id", "text"),
    ("user_id", "uuid"),
    ("title", "text"),
    ("notes", "text"),
    ("completed", "bool"),
    ("priority", "text"),
    ("due_date", "date"),
    ("recurrence", "text"),
    ("completed_at", "utc_timestamp"),
    ("subtasks", "jsonb"),
    ("created_at", "utc_timestamp"),
    ("updated_at", "utc_timestamp"),
    ("deleted_at", "utc_timestamp"),
    ("server_seq", "int8"),
]
TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
JWT_SECRET = secrets.token_bytes(32)
TOKEN_TTL = 3600
VERBOSE = False


def log(*parts):
    if VERBOSE:
        print(*parts, file=sys.stderr, flush=True)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class PgError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


class State:
    def __init__(self):
        self.lock = threading.RLock()
        self.users = {}  # email -> user dict
        self.codes = {}  # email -> pending code
        self.tokens = {}  # access token -> uid
        self.refresh = {}  # refresh token -> uid
        self.todos = {}  # uid -> {id: row}
        self.seq = 0
        self.mail = []  # newest last
        self.sockets = set()

    # ---- auth

    def user_for(self, email, create):
        user = self.users.get(email)
        if user is None and create:
            stamp = now_iso()
            user = {
                "id": str(uuid.uuid4()),
                "aud": "authenticated",
                "role": "authenticated",
                "email": email,
                "app_metadata": {"provider": "email", "providers": ["email"]},
                "user_metadata": {},
                "identities": [],
                "is_anonymous": False,
                "created_at": stamp,
                "updated_at": stamp,
            }
            self.users[email] = user
        return user

    def send_code(self, email):
        with self.lock:
            self.user_for(email, create=True)
            code = "%06d" % secrets.randbelow(1_000_000)
            self.codes[email] = code
            self.mail.append(
                {
                    "ID": secrets.token_hex(8),
                    "To": email,
                    "Created": now_iso(),
                    "Subject": "Your Todo Tracker sign-in code",
                    "Text": "Enter this code in the app to sign in: %s" % code,
                    "HTML": "<p>Enter this code in the app to sign in:</p><p>%s</p>" % code,
                }
            )

    def verify(self, email, code):
        with self.lock:
            user = self.users.get(email)
            if user is None or not code or self.codes.get(email) != code:
                return None
            del self.codes[email]
            stamp = now_iso()
            user["last_sign_in_at"] = user.setdefault("email_confirmed_at", stamp)
            user["confirmed_at"] = user["email_confirmed_at"]
            return self.session(user)

    def session(self, user):
        issued = int(time.time())
        header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
        claims = {
            "sub": user["id"],
            "email": user["email"],
            "role": "authenticated",
            "aud": "authenticated",
            "iat": issued,
            "exp": issued + TOKEN_TTL,
            "session_id": str(uuid.uuid4()),
        }
        body = b64url(json.dumps(claims).encode())
        signature = b64url(hmac.new(JWT_SECRET, ("%s.%s" % (header, body)).encode(), hashlib.sha256).digest())
        access = "%s.%s.%s" % (header, body, signature)
        refresh = secrets.token_urlsafe(16)
        self.tokens[access] = user["id"]
        self.refresh[refresh] = user["id"]
        return {
            "access_token": access,
            "token_type": "bearer",
            "expires_in": TOKEN_TTL,
            "expires_at": issued + TOKEN_TTL,
            "refresh_token": refresh,
            "user": user,
        }

    def user_by_id(self, uid):
        return next((u for u in self.users.values() if u["id"] == uid), None)

    def refresh_session(self, token):
        with self.lock:
            uid = self.refresh.pop(token, None)
            user = self.user_by_id(uid) if uid else None
            return self.session(user) if user else None

    def uid_for(self, access):
        with self.lock:
            uid = self.tokens.get(access)
            return uid if uid and self.user_by_id(uid) else None

    def logout(self, access):
        with self.lock:
            self.tokens.pop(access, None)

    def delete_user(self, uid):
        with self.lock:
            user = self.user_by_id(uid)
            if user:
                del self.users[user["email"]]
                self.codes.pop(user["email"], None)
            self.todos.pop(uid, None)
            for table in (self.tokens, self.refresh):
                for key in [k for k, v in table.items() if v == uid]:
                    del table[key]

    # ---- todos (supabase/migrations: todos_before_write + push_todos)

    def push(self, uid, rows):
        if not isinstance(rows, list):
            raise PgError(400, "22023", "push_todos expects a JSON array of todos")
        incoming = {}
        for raw in rows:
            row = validate(raw, uid)
            best = incoming.get(row["id"])
            if best is None or rank(row) > rank(best):
                incoming[row["id"]] = row
        applied = []
        with self.lock:
            table = self.todos.setdefault(uid, {})
            for todo_id, row in incoming.items():
                old = table.get(todo_id)
                if old is not None:
                    if old["deleted_at"] is not None:
                        continue
                    if row["deleted_at"] is None and row["updated_at"] <= old["updated_at"]:
                        continue
                self.seq += 1
                row["server_seq"] = self.seq
                table[todo_id] = row
                applied.append(("UPDATE" if old else "INSERT", dict(row), old))
            stored = sorted((dict(table[i]) for i in incoming), key=lambda r: r["server_seq"])
        for kind, row, old in applied:
            self.broadcast(uid, kind, row, old)
        return stored

    def pull(self, uid, after, limit):
        with self.lock:
            rows = [dict(r) for r in self.todos.get(uid, {}).values() if r["server_seq"] > after]
        rows.sort(key=lambda r: r["server_seq"])
        return rows[:limit] if limit is not None else rows

    def broadcast(self, uid, kind, row, old):
        data = {
            "schema": "public",
            "table": "todos",
            "commit_timestamp": now_iso(),
            "type": kind,
            "columns": [{"name": n, "type": t} for n, t in COLUMNS],
            "record": row,
            "old_record": {"id": old["id"], "user_id": old["user_id"]} if old else None,
            "errors": None,
        }
        if data["old_record"] is None:
            del data["old_record"]
        with self.lock:
            targets = list(self.sockets)
        for ws in targets:
            ws.deliver(uid, data)


def rank(row):
    return (row["deleted_at"] is not None, row["updated_at"])


def validate(raw, uid):
    if not isinstance(raw, dict):
        raise PgError(400, "22023", "push_todos expects a JSON array of todos")
    row = {name: raw.get(name) for name, _ in COLUMNS}
    row["user_id"], row["server_seq"] = uid, None

    def check(ok, code, what):
        if not ok:
            raise PgError(400, code, what)

    for name in ("id", "title", "completed", "priority", "created_at", "updated_at"):
        check(row[name] is not None, "23502", 'null value in column "%s" violates not-null constraint' % name)
    check(isinstance(row["id"], str) and 1 <= len(row["id"]) <= 200, "23514", "todos_id_check")
    check(isinstance(row["title"], str) and 1 <= len(row["title"]) <= 200, "23514", "todos_title_check")
    check(isinstance(row["completed"], bool), "22P02", "invalid input syntax for type boolean")
    check(row["priority"] in ("low", "medium", "high"), "23514", "todos_priority_check")
    check(row["recurrence"] in (None, "daily", "weekly", "monthly"), "23514", "todos_recurrence_check")
    check(row["due_date"] is None or bool(DATE.match(str(row["due_date"]))), "22007", "invalid date")
    check(row["subtasks"] is None or isinstance(row["subtasks"], list), "23514", "todos_subtasks_check")
    for name in ("completed_at", "created_at", "updated_at", "deleted_at"):
        value = row[name]
        check(value is None or bool(TIMESTAMP.match(str(value))), "23514", "value for domain utc_timestamp")
    return row


STATE = State()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "supabase-mock"

    def log_message(self, fmt, *args):
        log("api:", fmt % args)

    def send_json(self, status, body, headers=None):
        data = b"" if body is None else json.dumps(body).encode()
        self.send_response(status)
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        if body is not None:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def auth_error(self, status, code, message):
        # supabase-swift reads `code` as the error code when the API version is 2024-01-01 or later.
        self.send_json(status, {"code": code, "message": message}, {"X-Supabase-Api-Version": "2024-01-01"})

    def body(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            return json.loads(raw) if raw else {}
        except ValueError:
            return None

    def bearer(self):
        header = self.headers.get("Authorization") or ""
        return header[7:] if header.lower().startswith("bearer ") else ""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.rstrip("/") == "/realtime/v1/websocket":
            return WebSocket(self).run()
        if url.path == "/auth/v1/user":
            uid = STATE.uid_for(self.bearer())
            user = STATE.user_by_id(uid) if uid else None
            if user is None:
                return self.auth_error(403, "bad_jwt", "invalid JWT")
            return self.send_json(200, user)
        if url.path == "/rest/v1/todos":
            return self.rest(lambda uid: self.pull(uid, parse_qs(url.query)))
        if url.path in ("/", "/health", "/auth/v1/health"):
            return self.send_json(200, {"ok": True})
        self.send_json(404, {"message": "not found: %s" % url.path})

    def do_POST(self):
        url = urlsplit(self.path)
        body = self.body()
        if body is None:
            return self.send_json(400, {"code": "PGRST102", "message": "invalid JSON body"})
        if url.path == "/auth/v1/otp":
            email = str(body.get("email") or "").strip().lower()
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
                return self.auth_error(400, "email_address_invalid", "Email address is invalid")
            STATE.send_code(email)
            return self.send_json(200, {})
        if url.path == "/auth/v1/verify":
            email = str(body.get("email") or "").strip().lower()
            session = STATE.verify(email, str(body.get("token") or ""))
            if session is None:
                return self.auth_error(403, "otp_expired", "Token has expired or is invalid")
            return self.send_json(200, session)
        if url.path == "/auth/v1/token":
            session = STATE.refresh_session(str(body.get("refresh_token") or ""))
            if session is None:
                return self.auth_error(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found")
            return self.send_json(200, session)
        if url.path == "/auth/v1/logout":
            STATE.logout(self.bearer())
            return self.send_json(204, None)
        if url.path == "/rest/v1/rpc/push_todos":
            return self.rest(lambda uid: (200, STATE.push(uid, body.get("rows"))))
        if url.path == "/rest/v1/rpc/delete_account":
            return self.rest(lambda uid: (204, STATE.delete_user(uid)))
        self.send_json(404, {"message": "not found: %s" % url.path})

    def rest(self, action):
        uid = STATE.uid_for(self.bearer())
        if uid is None:
            return self.send_json(401, {"code": "42501", "message": "permission denied (not signed in)"})
        try:
            status, result = action(uid)
        except PgError as error:
            return self.send_json(error.status, {"code": error.code, "message": error.message})
        self.send_json(status, None if status == 204 else result)

    @staticmethod
    def pull(uid, query):
        after = 0
        for value in query.get("server_seq", []):
            if value.startswith("gt."):
                after = int(value[3:])
        limit = int(query["limit"][0]) if "limit" in query else None
        return 200, STATE.pull(uid, after, limit)


class WebSocket:
    """A minimal RFC 6455 server side for one Phoenix socket."""

    def __init__(self, handler):
        self.handler = handler
        self.send_lock = threading.Lock()
        self.v2 = parse_qs(urlsplit(handler.path).query).get("vsn", ["1.0.0"])[0].startswith("2")
        self.channels = {}  # topic -> (join_ref, uid, [(id, filter)])
        self.next_id = 1

    def run(self):
        h = self.handler
        key = h.headers.get("Sec-WebSocket-Key")
        if not key or "websocket" not in (h.headers.get("Upgrade") or "").lower():
            return h.send_json(400, {"message": "expected a websocket upgrade"})
        accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest())
        h.send_response(101)
        h.send_header("Upgrade", "websocket")
        h.send_header("Connection", "Upgrade")
        h.send_header("Sec-WebSocket-Accept", accept.decode())
        h.end_headers()
        h.wfile.flush()
        h.close_connection = True
        with STATE.lock:
            STATE.sockets.add(self)
        try:
            self.loop()
        except (OSError, ValueError, struct.error):
            pass
        finally:
            with STATE.lock:
                STATE.sockets.discard(self)

    def read_frame(self):
        rfile = self.handler.rfile
        head = rfile.read(2)
        if len(head) < 2:
            raise OSError("closed")
        opcode, length = head[0] & 0x0F, head[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", rfile.read(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", rfile.read(8))[0]
        mask = rfile.read(4) if head[1] & 0x80 else b""
        data = rfile.read(length)
        if mask:
            data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        return head[0] & 0x80, opcode, data

    def write_frame(self, opcode, data):
        header = bytes([0x80 | opcode])
        if len(data) < 126:
            header += bytes([len(data)])
        elif len(data) < 65536:
            header += bytes([126]) + struct.pack("!H", len(data))
        else:
            header += bytes([127]) + struct.pack("!Q", len(data))
        with self.send_lock:
            self.handler.wfile.write(header + data)
            self.handler.wfile.flush()

    def loop(self):
        message = b""
        while True:
            fin, opcode, data = self.read_frame()
            if opcode == 0x8:
                self.write_frame(0x8, data[:2])
                return
            if opcode == 0x9:
                self.write_frame(0xA, data)
                continue
            if opcode in (0x1, 0x2, 0x0):
                message += data
                if fin:
                    self.on_text(message.decode("utf-8", "replace"))
                    message = b""

    def send(self, join_ref, ref, topic, event, payload):
        if self.v2:
            frame = [join_ref, ref, topic, event, payload]
        else:
            frame = {"join_ref": join_ref, "ref": ref, "topic": topic, "event": event, "payload": payload}
        try:
            self.write_frame(0x1, json.dumps(frame).encode())
        except OSError:
            pass

    def on_text(self, text):
        try:
            frame = json.loads(text)
        except ValueError:
            return
        if isinstance(frame, list):
            join_ref, ref, topic, event, payload = (frame + [None] * 5)[:5]
        else:
            join_ref, ref = frame.get("join_ref"), frame.get("ref")
            topic, event, payload = frame.get("topic"), frame.get("event"), frame.get("payload")
        payload = payload if isinstance(payload, dict) else {}
        log("ws <-", topic, event)
        if topic == "phoenix" and event == "heartbeat":
            return self.send(None, ref, "phoenix", "phx_reply", {"status": "ok", "response": {}})
        if event == "phx_join":
            return self.join(join_ref or ref, ref, topic, payload)
        if event == "phx_leave":
            self.channels.pop(topic, None)
            self.send(join_ref, ref, topic, "phx_reply", {"status": "ok", "response": {}})
            return self.send(join_ref, None, topic, "phx_close", {})
        if event == "access_token":
            token = payload.get("access_token")
            channel = self.channels.get(topic)
            if channel and token:
                uid = STATE.uid_for(token)
                if uid:
                    self.channels[topic] = (channel[0], uid, channel[2])
            return
        self.send(join_ref, ref, topic, "phx_reply", {"status": "ok", "response": {}})

    def join(self, join_ref, ref, topic, payload):
        config = payload.get("config") or {}
        uid = STATE.uid_for(payload.get("access_token") or "")
        bindings, echoed = [], []
        for change in config.get("postgres_changes") or []:
            change = dict(change)
            change["id"] = self.next_id
            self.next_id += 1
            echoed.append(change)
            bindings.append((change["id"], change))
        if bindings and uid is None:
            return self.send(
                join_ref, ref, topic, "phx_reply", {"status": "error", "response": {"reason": "Invalid JWT"}}
            )
        self.channels[topic] = (join_ref, uid, bindings)
        self.send(join_ref, ref, topic, "phx_reply", {"status": "ok", "response": {"postgres_changes": echoed}})
        if bindings:
            status = {"status": "ok", "message": "Subscribed to PostgreSQL", "extension": "postgres_changes"}
            self.send(join_ref, None, topic, "system", dict(status, channel=topic.split(":", 1)[-1]))

    def deliver(self, uid, data):
        for topic, (join_ref, channel_uid, bindings) in list(self.channels.items()):
            if channel_uid != uid:
                continue
            ids = [i for i, b in bindings if matches(b, data)]
            if ids:
                self.send(join_ref, None, topic, "postgres_changes", {"ids": ids, "data": data})


def matches(binding, data):
    if binding.get("schema") not in (None, data["schema"]) or binding.get("table") not in (None, "*", data["table"]):
        return False
    if binding.get("event") not in (None, "*", data["type"]):
        return False
    rule = binding.get("filter")
    if rule:
        column, _, value = rule.partition("=eq.")
        return str(data["record"].get(column)) == value
    return True


class Mailpit(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "mailpit-mock"

    def log_message(self, fmt, *args):
        log("mailpit:", fmt % args)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/api/v1/search":
            query = parse_qs(url.query).get("query", [""])[0]
            match = re.search(r'to:"?([^"\s]+)"?', query)
            to = match.group(1).lower() if match else None
            with STATE.lock:
                found = [m for m in reversed(STATE.mail) if to is None or m["To"] == to]
            summary = [{k: m[k] for k in ("ID", "Created", "Subject")} | {"To": [{"Address": m["To"]}]} for m in found]
            return self.reply(200, {"total": len(summary), "messages_count": len(summary), "messages": summary})
        if url.path.startswith("/api/v1/message/"):
            wanted = url.path.rsplit("/", 1)[-1]
            with STATE.lock:
                message = next((m for m in STATE.mail if m["ID"] == wanted), None)
            if message is None:
                return self.reply(404, {"Error": "message not found"})
            return self.reply(200, message | {"To": [{"Address": message["To"]}]})
        if url.path == "/api/v1/messages":
            with STATE.lock:
                count = len(STATE.mail)
            return self.reply(200, {"total": count, "messages": []})
        self.reply(404, {"Error": "not found"})

    def do_DELETE(self):
        with STATE.lock:
            STATE.mail.clear()
        self.reply(200, {})

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        if VERBOSE:
            super().handle_error(request, client_address)


def main():
    global VERBOSE
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--host", default=os.environ.get("SUPABASE_MOCK_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("SUPABASE_MOCK_PORT", 54321)))
    parser.add_argument("--mailpit-port", type=int, default=int(os.environ.get("MAILPIT_MOCK_PORT", 54324)))
    parser.add_argument("--verbose", action="store_true", help="log every request")
    args = parser.parse_args()
    VERBOSE = args.verbose
    api = Server((args.host, args.port), Handler)
    mail = Server((args.host, args.mailpit_port), Mailpit)
    threading.Thread(target=mail.serve_forever, daemon=True).start()
    print(
        "supabase-mock: API http://%s:%d, Mailpit http://%s:%d" % (args.host, args.port, args.host, args.mailpit_port),
        flush=True,
    )
    try:
        api.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    socket.setdefaulttimeout(None)
    main()
