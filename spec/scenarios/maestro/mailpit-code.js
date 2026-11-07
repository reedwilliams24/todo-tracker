// Reads the newest 6-digit sign-in code local Mailpit received for EMAIL into output.code.
// Used by the `supabase`-tagged flows; pass -e MAILPIT_URL=… if Mailpit isn't on 127.0.0.1:54324.
const mailpit = typeof MAILPIT_URL === "undefined" ? "http://127.0.0.1:54324" : MAILPIT_URL;
const query = encodeURIComponent('to:"' + EMAIL + '"');
let code = "";
const deadline = Date.now() + 20000;
while (!code && Date.now() < deadline) {
  const search = json(http.get(mailpit + "/api/v1/search?query=" + query).body);
  const latest = (search.messages || [])[0];
  if (latest) {
    const message = json(http.get(mailpit + "/api/v1/message/" + latest.ID).body);
    const match = ((message.Text || "") + " " + (message.HTML || "")).match(/\b(\d{6})\b/);
    if (match) code = match[1];
  }
  if (!code) {
    const until = Date.now() + 500;
    while (Date.now() < until) {}
  }
}
if (!code) throw new Error("No sign-in code in Mailpit for " + EMAIL);
output.code = code;
