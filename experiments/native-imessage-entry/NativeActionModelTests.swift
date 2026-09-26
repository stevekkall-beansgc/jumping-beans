import Foundation

@main
enum NativeActionModelTests {
    static func main() throws {
        let offer = OfferContext(
            offerID: "petsupply-cushioned-dog-harness",
            name: "Cushioned Dog Harness",
            price: "$48.00",
            merchant: "Petsupply",
            provenance: OfferProvenance(
                sourceLabel: "WebMCP offer tool",
                sourceDescription: "Partner-provided through the reviewed journey.",
                origin: "https://petsupply.pages.dev",
                observedAt: "2026-09-03T12:00:00Z",
                verification: "Partner-provided; not independently verified"
            )
        )
        let draft = ActionPlanner.draft(action: .compare, offer: offer)
        guard let staged = ActionPlanner.stage(
            draft: draft,
            approvedFields: Set(ActionPlanner.requiredApprovalFields),
            now: "2026-09-09T00:00:00Z"
        ) else {
            fatalError("Expected fully approved draft to stage")
        }

        let url = try ActionPlanner.messageURL(for: ActionPlanner.payload(for: staged))
        precondition(url.scheme == "https")
        precondition(url.absoluteString.utf8.count <= ActionPlanner.maxMSMessageURLLength)
        let decoded = try ActionPlanner.reviewPayload(from: url)
        let expected = try ReviewPayload(action: .compare, offerID: offer.offerID)
        precondition(decoded == expected)

        try expectRejected("unsupported action") {
            let json = Data(#"{"v":1,"a":"purchase","o":"petsupply-cushioned-dog-harness"}"#.utf8)
            let url = URL(string: "https://message.jumpingbeans.example/review#\(base64URL(json))")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("extra schema field") {
            let json = Data(#"{"v":1,"a":"compare","o":"petsupply-cushioned-dog-harness","partner":"write"}"#.utf8)
            let url = URL(string: "https://message.jumpingbeans.example/review#\(base64URL(json))")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("unsupported URL scheme") {
            let url = URL(string: "jumpingbeans://message/review#ignored")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("unexpected URL credentials") {
            let url = URL(string: "https://reviewer@message.jumpingbeans.example/review#ignored")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("unexpected URL port") {
            let url = URL(string: "https://message.jumpingbeans.example:443/review#ignored")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("unexpected URL query") {
            let url = URL(string: "https://message.jumpingbeans.example/review?operation=send#ignored")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("non-base64url fragment") {
            let url = URL(string: "https://message.jumpingbeans.example/review#abc%2Bdef")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("unsupported payload version") {
            let json = Data(#"{"v":2,"a":"compare","o":"petsupply-cushioned-dog-harness"}"#.utf8)
            let url = URL(string: "https://message.jumpingbeans.example/review#\(base64URL(json))")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("non-ASCII offer identifier") {
            let json = Data(#"{"v":1,"a":"compare","o":"pétsupply"}"#.utf8)
            let url = URL(string: "https://message.jumpingbeans.example/review#\(base64URL(json))")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        try expectRejected("overlong URL") {
            let fragment = String(repeating: "a", count: ActionPlanner.maxMSMessageURLLength)
            let url = URL(string: "https://message.jumpingbeans.example/review#\(fragment)")!
            _ = try ActionPlanner.reviewPayload(from: url)
        }
        print("NativeActionModel tests passed.")
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func expectRejected(_ description: String, operation: () throws -> Void) throws {
        do {
            try operation()
            fatalError("Expected \(description) to be rejected")
        } catch {
            // Rejection is the expected outcome.
        }
    }
}
