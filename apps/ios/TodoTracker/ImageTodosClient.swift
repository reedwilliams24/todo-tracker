import Foundation
import TodoCore
import UIKit

/// Sends an image to `/api/image-todos` (spec/features/image-import.md) and validates the drafts it returns.
enum ImageTodosClient {
    static var baseURL: URL? {
        (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String).flatMap(URL.init(string:))
    }

    static func importTodos(from data: Data) async -> Result<[TodoDraft], ImageImportError> {
        guard let image = UIImage(data: data) else { return .failure(.invalid) }
        guard let jpeg = downscale(image) else { return .failure(.invalid) }
        switch checkImageUpload(mimeType: "image/jpeg", bytes: jpeg.count) {
        case "ok": break
        case "tooLarge": return .failure(.tooLarge)
        default: return .failure(.invalid)
        }
        guard let url = baseURL?.appendingPathComponent("api/image-todos") else { return .failure(.unavailable) }

        var request = URLRequest(url: url, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        let body: [String: String] = [
            "image": jpeg.base64EncodedString(),
            "mimeType": "image/jpeg",
            "today": localDateKey(Date()),
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            return .failure(.offline)
        }
        let json = (try? JSONDecoder().decode(JSONValue.self, from: data)) ?? .null
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { return .failure(imageImportErrorFor(status: status, body: json)) }
        return .success(coerceImageDrafts(json))
    }

    /// Scales the longer edge to `imageImport.maxDimension` and re-encodes as JPEG.
    private static func downscale(_ image: UIImage) -> Data? {
        let longest = max(image.size.width, image.size.height)
        guard longest > 0 else { return nil }
        let scale = min(1, CGFloat(imageImport.maxDimension) / longest)
        let size = CGSize(
            width: max(1, (image.size.width * scale).rounded()), height: max(1, (image.size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return rendered.jpegData(compressionQuality: imageImport.jpegQuality)
    }

    private static func localDateKey(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
