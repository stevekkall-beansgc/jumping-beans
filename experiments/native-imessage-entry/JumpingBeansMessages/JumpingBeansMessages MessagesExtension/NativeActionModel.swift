import Foundation

/// The small, explicit action vocabulary shared by the Messages UI and its
/// message payload. These are proposals, not partner operations.
enum AllowedAction: String, CaseIterable, Codable {
    case compare
    case adapt
    case previewHandoff

    var title: String {
        switch self {
        case .compare: return "Compare"
        case .adapt: return "Adapt presentation"
        case .previewHandoff: return "Preview handoff"
        }
    }

    var detail: String {
        switch self {
        case .compare: return "Show the bounded alternatives already in the reviewed journey."
        case .adapt: return "Change how the selected offer is presented without changing the offer."
        case .previewHandoff: return "Prepare a partner review preview; do not open, send, or commit it."
        }
    }
}

struct OfferProvenance: Codable, Equatable {
    let sourceLabel: String
    let sourceDescription: String
    let origin: String
    let observedAt: String
    let verification: String
}

struct OfferContext: Codable, Equatable {
    let offerID: String
    let name: String
    let price: String
    let merchant: String
    let provenance: OfferProvenance
}

struct ActionDraft: Codable, Equatable {
    let action: AllowedAction
    let offer: OfferContext
    let boundary: String
    let retention: String
}

struct StagedAction: Codable, Equatable {
    let draft: ActionDraft
    let approvedFields: [String]
    let stagedAt: String
}

struct MessagePayload: Codable, Equatable {
    let schemaVersion: String
    let staged: StagedAction
    let nativeSurface: String
    let webMCPStatement: String
}

/// The deliberately small message contract placed in `MSMessage.url`. It
/// carries an identifier and an allowed review action only; it never carries
/// credentials, a partner URL, or instructions to perform an operation.
struct ReviewPayload: Codable, Equatable {
    static let version = 1

    let version: Int
    let action: AllowedAction
    let offerID: String

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case version = "v"
        case action = "a"
        case offerID = "o"
    }

    init(action: AllowedAction, offerID: String) throws {
        guard Self.isAllowedOfferID(offerID) else { throw ReviewPayloadError.invalidOfferID }
        self.version = Self.version
        self.action = action
        self.offerID = offerID
    }

    init(from decoder: Decoder) throws {
        let allKeys = try decoder.container(keyedBy: AnyCodingKey.self).allKeys.map(\.stringValue)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        guard Set(allKeys) == Set(CodingKeys.allCases.map(\.rawValue)) else {
            throw ReviewPayloadError.unsupportedSchema
        }
        let version = try container.decode(Int.self, forKey: .version)
        guard version == Self.version else { throw ReviewPayloadError.unsupportedSchema }
        let action = try container.decode(AllowedAction.self, forKey: .action)
        let offerID = try container.decode(String.self, forKey: .offerID)
        guard Self.isAllowedOfferID(offerID) else { throw ReviewPayloadError.invalidOfferID }
        self.version = version
        self.action = action
        self.offerID = offerID
    }

    private static func isAllowedOfferID(_ value: String) -> Bool {
        guard !value.isEmpty, value.utf8.count <= 128 else { return false }
        return value.utf8.allSatisfy {
            ($0 >= 48 && $0 <= 57) ||
            ($0 >= 65 && $0 <= 90) ||
            ($0 >= 97 && $0 <= 122) ||
            $0 == 45 ||
            $0 == 95
        }
    }
}

private struct AnyCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}

enum ReviewPayloadError: Error, Equatable {
    case invalidOfferID
    case unsupportedSchema
    case unsupportedURL
    case payloadTooLong
}

enum ActionPlanner {
    static let requiredApprovalFields = ["action", "offer", "provenance", "boundary"]
    static let maxMSMessageURLLength = 5_000
    private static let messageURLBase = "https://message.jumpingbeans.example/review"

    static func draft(action: AllowedAction, offer: OfferContext) -> ActionDraft {
        let boundary: String
        switch action {
        case .compare:
            boundary = "Read-only comparison. No partner call, message send, or saved state."
        case .adapt:
            boundary = "Presentation-only adaptation. The selected product facts and source remain unchanged."
        case .previewHandoff:
            boundary = "Review-only partner preview. No HTTPS handoff, open, send, order, payment, or account change."
        }

        return ActionDraft(
            action: action,
            offer: offer,
            boundary: boundary,
            retention: "This draft stays in the current Messages extension session until staged."
        )
    }

    static func stage(draft: ActionDraft, approvedFields: Set<String>, now: String = ISO8601DateFormatter().string(from: Date())) -> StagedAction? {
        guard Set(requiredApprovalFields).isSubset(of: approvedFields) else { return nil }
        return StagedAction(draft: draft, approvedFields: requiredApprovalFields, stagedAt: now)
    }

    static func payload(for staged: StagedAction) -> MessagePayload {
        MessagePayload(
            schemaVersion: "1.0.0",
            staged: staged,
            nativeSurface: "Apple Messages app extension",
            webMCPStatement: "Provenance was carried into this review; Messages did not discover or invoke WebMCP."
        )
    }

    static func messageURL(for payload: MessagePayload) throws -> URL {
        let review = try ReviewPayload(
            action: payload.staged.draft.action,
            offerID: payload.staged.draft.offer.offerID
        )
        let data = try JSONEncoder().encode(review)
        let fragment = data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        guard let url = URL(string: "\(messageURLBase)#\(fragment)") else {
            throw ReviewPayloadError.unsupportedURL
        }
        guard url.absoluteString.utf8.count <= maxMSMessageURLLength else {
            throw ReviewPayloadError.payloadTooLong
        }
        return url
    }

    static func reviewPayload(from url: URL) throws -> ReviewPayload {
        guard url.absoluteString.utf8.count <= maxMSMessageURLLength,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == "https",
              components.user == nil,
              components.password == nil,
              components.host == "message.jumpingbeans.example",
              components.port == nil,
              components.percentEncodedPath == "/review",
              components.percentEncodedQuery == nil,
              let fragment = components.percentEncodedFragment,
              !fragment.isEmpty,
              fragment.utf8.allSatisfy({
                  ($0 >= 48 && $0 <= 57) ||
                  ($0 >= 65 && $0 <= 90) ||
                  ($0 >= 97 && $0 <= 122) ||
                  $0 == 45 ||
                  $0 == 95
              }) else {
            throw ReviewPayloadError.unsupportedURL
        }
        var base64 = fragment
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        guard let data = Data(base64Encoded: base64) else { throw ReviewPayloadError.unsupportedSchema }
        return try JSONDecoder().decode(ReviewPayload.self, from: data)
    }
}
