import UIKit
import Messages

/// Native iMessage review surface. Compact and transcript interactions are
/// local-only; expanded is the only presentation that can stage a message.
final class MessagesViewController: MSMessagesAppViewController {
    private let offer = OfferContext(
        offerID: "petsupply-cushioned-dog-harness",
        name: "Cushioned Dog Harness",
        price: "$48.00",
        merchant: "Petsupply",
        provenance: OfferProvenance(
            sourceLabel: "WebMCP offer tool",
            sourceDescription: "Partner-provided through the Jumping Beans web journey; not independently verified.",
            origin: "https://petsupply.pages.dev",
            observedAt: "2026-09-03T12:00:00Z",
            verification: "Partner-provided; not independently verified by Jumping Beans"
        )
    )

    private var conversation: MSConversation?
    private var selectedAction: AllowedAction = .compare
    private var reviewedOfferID: String?
    private var stateMessage = "Nothing is saved or sent. Selecting an action only changes this draft."
    private var approvalSwitches: [String: UISwitch] = [:]
    private var approvalLabels: [String: UILabel] = [:]
    private let approvalButton = UIButton(type: .system)
    private let statusLabel = UILabel()
    private let detailLabel = UILabel()
    private let messagePreview = UILabel()
    private let rootStack = UIStackView()
    private let scrollView = UIScrollView()
    private var transcriptContentView: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        configureContainer()
        renderInterface(for: presentationStyle)
    }

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        self.conversation = conversation
        // Parse the selected URL before displaying any message-derived state.
        if let selectedMessage = conversation.selectedMessage {
            applyReviewedMessage(selectedMessage)
        } else {
            renderInterface(for: presentationStyle)
        }
    }

    override func didBecomeActive(with conversation: MSConversation) {
        super.didBecomeActive(with: conversation)
        self.conversation = conversation
    }

    override func didResignActive(with conversation: MSConversation) {
        super.didResignActive(with: conversation)
        self.conversation = nil
    }

    override func didReceive(_ message: MSMessage, conversation: MSConversation) {
        super.didReceive(message, conversation: conversation)
        self.conversation = conversation
        applyReviewedMessage(message)
    }

    override func willTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.willTransition(to: presentationStyle)
    }

    override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.didTransition(to: presentationStyle)
        renderInterface(for: presentationStyle)
    }

    // MARK: MSMessagesAppTranscriptPresentation

    override func contentSizeThatFits(_ size: CGSize) -> CGSize {
        guard presentationStyle == .transcript else {
            return CGSize(width: size.width, height: min(size.height, 220))
        }
        view.setNeedsLayout()
        view.layoutIfNeeded()
        let fittingSize = CGSize(width: size.width, height: UIView.layoutFittingCompressedSize.height)
        let measured = transcriptContentView?.systemLayoutSizeFitting(
            fittingSize,
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        ) ?? CGSize(width: size.width, height: 176)
        return CGSize(width: size.width, height: min(max(measured.height, 148), size.height))
    }

    @available(iOS 26.0, *)
    override var messageTintColor: UIColor? {
        // Messages requires a simple RGB color here, not a dynamic color.
        UIColor(red: 0.13, green: 0.52, blue: 0.27, alpha: 1)
    }

    @available(iOS 26.0, *)
    override var messageCornerRadius: CGFloat {
        18
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory {
            renderInterface(for: presentationStyle)
        }
        if #available(iOS 26.0, *),
           traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            invalidateMessageTintColor()
        }
    }

    private func configureContainer() {
        view.backgroundColor = .systemBackground
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        rootStack.axis = .vertical
        rootStack.spacing = 14
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(rootStack)
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            rootStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 20),
            rootStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -20),
            rootStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 16),
            rootStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -20),
            rootStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -40)
        ])
    }

    private func renderInterface(for style: MSMessagesAppPresentationStyle) {
        rootStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        approvalSwitches.removeAll()
        approvalLabels.removeAll()
        transcriptContentView = nil
        rootStack.spacing = 14
        switch style {
        case .compact:
            buildCompactInterface(showExpandButton: true)
        case .expanded:
            buildExpandedInterface()
        case .transcript:
            transcriptContentView = buildCompactInterface(showExpandButton: false)
            rootStack.spacing = 10
        @unknown default:
            buildCompactInterface(showExpandButton: true)
        }
        rootStack.setNeedsLayout()
        view.setNeedsLayout()
    }

    @discardableResult
    private func buildCompactInterface(showExpandButton: Bool) -> UIView {
        let card = UIView()
        card.backgroundColor = .secondarySystemBackground
        card.layer.cornerCurve = .continuous
        card.layer.cornerRadius = 18
        card.layer.masksToBounds = true

        let cardStack = UIStackView()
        cardStack.axis = .vertical
        cardStack.spacing = 10
        cardStack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(cardStack)
        NSLayoutConstraint.activate([
            cardStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
            cardStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            cardStack.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            cardStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -14)
        ])

        let header = UIStackView()
        header.axis = .horizontal
        header.alignment = .top
        header.spacing = 12
        let imageView = UIImageView(image: LocalProductImage.placeholder)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerCurve = .continuous
        imageView.layer.cornerRadius = 12
        imageView.isAccessibilityElement = true
        imageView.accessibilityLabel = "Offline placeholder image for \(offer.name)"
        NSLayoutConstraint.activate([
            imageView.widthAnchor.constraint(equalToConstant: 64),
            imageView.heightAnchor.constraint(equalToConstant: 64)
        ])

        let copy = UIStackView()
        copy.axis = .vertical
        copy.spacing = 3
        let title = label(offer.name, textStyle: .headline, weight: .semibold)
        title.numberOfLines = 2
        let price = label(offer.price, textStyle: .subheadline, weight: .bold)
        price.textColor = .secondaryLabel
        let provenance = label("\(offer.merchant) · review only", textStyle: .caption1, weight: .regular)
        provenance.textColor = .secondaryLabel
        provenance.numberOfLines = 2
        copy.addArrangedSubview(title)
        copy.addArrangedSubview(price)
        copy.addArrangedSubview(provenance)
        header.addArrangedSubview(imageView)
        header.addArrangedSubview(copy)
        cardStack.addArrangedSubview(header)

        let boundary = label(compactBoundaryText, textStyle: .footnote, weight: .regular)
        boundary.numberOfLines = 0
        boundary.textColor = .secondaryLabel
        cardStack.addArrangedSubview(boundary)

        let actions = UIStackView()
        actions.axis = traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? .vertical : .horizontal
        actions.spacing = 8
        actions.distribution = .fillEqually
        for (index, action) in AllowedAction.allCases.enumerated() {
            let button = UIButton(type: .system)
            button.tag = index
            button.setTitle(action.title, for: .normal)
            button.titleLabel?.font = UIFontMetrics(forTextStyle: .footnote).scaledFont(for: UIFont.systemFont(ofSize: 13, weight: .semibold))
            button.titleLabel?.adjustsFontForContentSizeCategory = true
            button.titleLabel?.numberOfLines = 0
            button.titleLabel?.textAlignment = .center
            button.accessibilityLabel = "Select \(action.title)"
            button.accessibilityHint = "Local-only review action. Does not send or open anything."
            button.accessibilityTraits = selectedAction == action ? [.button, .selected] : [.button]
            button.addTarget(self, action: #selector(compactActionTapped(_:)), for: .touchUpInside)
            actions.addArrangedSubview(button)
        }
        cardStack.addArrangedSubview(actions)

        let feedback = label(stateMessage, textStyle: .caption1, weight: .regular)
        feedback.numberOfLines = 0
        feedback.textColor = .secondaryLabel
        cardStack.addArrangedSubview(feedback)
        rootStack.addArrangedSubview(card)

        if showExpandButton {
            let expand = UIButton(type: .system)
            expand.setTitle("Review and approve in full", for: .normal)
            expand.titleLabel?.font = UIFontMetrics(forTextStyle: .headline).scaledFont(for: UIFont.systemFont(ofSize: 17, weight: .semibold))
            expand.titleLabel?.adjustsFontForContentSizeCategory = true
            expand.accessibilityHint = "Opens the explicit approval screen."
            expand.addTarget(self, action: #selector(requestExpandedReview), for: .touchUpInside)
            rootStack.addArrangedSubview(expand)
        }
        return card
    }

    private func buildExpandedInterface() {
        let eyebrow = label("JUMPING BEANS · NATIVE MESSAGES", textStyle: .caption1, weight: .bold)
        eyebrow.textColor = .systemGreen
        let title = label("Choose what can happen next", textStyle: .largeTitle, weight: .bold)
        title.numberOfLines = 0
        let intro = label("A reviewed offer is already here. Pick one allowable action, inspect its boundary, then approve the exact fields before staging a native message.", textStyle: .body, weight: .regular)
        intro.numberOfLines = 0
        rootStack.addArrangedSubview(eyebrow)
        rootStack.addArrangedSubview(title)
        rootStack.addArrangedSubview(intro)

        let offerCard = label("\(offer.name) · \(offer.price)\n\(offer.merchant) · \(offer.provenance.sourceLabel)\n\(offer.provenance.verification)", textStyle: .body, weight: .semibold)
        offerCard.numberOfLines = 0
        offerCard.backgroundColor = .secondarySystemBackground
        offerCard.layer.cornerCurve = .continuous
        offerCard.layer.cornerRadius = 12
        offerCard.layer.masksToBounds = true
        rootStack.addArrangedSubview(offerCard)

        let choiceLabel = label("ALLOWABLE NEXT ACTION", textStyle: .caption1, weight: .bold)
        choiceLabel.textColor = .secondaryLabel
        rootStack.addArrangedSubview(choiceLabel)
        let actions = UIStackView()
        actions.axis = .vertical
        actions.spacing = 8
        for (index, action) in AllowedAction.allCases.enumerated() {
            let button = UIButton(type: .system)
            button.tag = index
            button.setTitle(action.title, for: .normal)
            button.contentHorizontalAlignment = .leading
            button.titleLabel?.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: UIFont.systemFont(ofSize: 17, weight: .semibold))
            button.titleLabel?.adjustsFontForContentSizeCategory = true
            button.titleLabel?.numberOfLines = 0
            button.accessibilityLabel = "Select \(action.title)"
            button.accessibilityHint = "Choosing a different action changes the local review draft and clears its approvals."
            button.accessibilityTraits = selectedAction == action ? [.button, .selected] : [.button]
            button.addTarget(self, action: #selector(expandedActionTapped(_:)), for: .touchUpInside)
            actions.addArrangedSubview(button)
        }
        rootStack.addArrangedSubview(actions)

        detailLabel.numberOfLines = 0
        detailLabel.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: UIFont.systemFont(ofSize: 15))
        detailLabel.adjustsFontForContentSizeCategory = true
        detailLabel.textColor = .secondaryLabel
        rootStack.addArrangedSubview(detailLabel)

        let approvalLabel = label("EXPLICIT APPROVAL", textStyle: .caption1, weight: .bold)
        approvalLabel.textColor = .secondaryLabel
        rootStack.addArrangedSubview(approvalLabel)
        for field in ActionPlanner.requiredApprovalFields {
            rootStack.addArrangedSubview(approvalRow(field: field))
        }

        messagePreview.numberOfLines = 0
        messagePreview.font = UIFontMetrics(forTextStyle: .footnote).scaledFont(for: UIFont.systemFont(ofSize: 13))
        messagePreview.adjustsFontForContentSizeCategory = true
        messagePreview.textColor = .secondaryLabel
        rootStack.addArrangedSubview(messagePreview)

        approvalButton.removeTarget(self, action: #selector(stageMessage), for: .touchUpInside)
        approvalButton.setTitle("Stage native message", for: .normal)
        approvalButton.titleLabel?.font = UIFontMetrics(forTextStyle: .headline).scaledFont(for: UIFont.systemFont(ofSize: 17, weight: .semibold))
        approvalButton.titleLabel?.adjustsFontForContentSizeCategory = true
        approvalButton.accessibilityHint = "Stages a message in the composer. Messages still requires you to tap Send."
        approvalButton.addTarget(self, action: #selector(stageMessage), for: .touchUpInside)
        rootStack.addArrangedSubview(approvalButton)

        statusLabel.numberOfLines = 0
        statusLabel.font = UIFontMetrics(forTextStyle: .footnote).scaledFont(for: UIFont.systemFont(ofSize: 13))
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.textColor = .secondaryLabel
        rootStack.addArrangedSubview(statusLabel)
        renderExpandedState()
    }

    private func approvalRow(field: String) -> UIView {
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .top
        row.spacing = 10
        let toggle = UISwitch()
        toggle.addTarget(self, action: #selector(approvalChanged), for: .valueChanged)
        toggle.accessibilityLabel = approvalCopy(for: field)
        approvalSwitches[field] = toggle
        let copy = label(approvalCopy(for: field), textStyle: .body, weight: .regular)
        copy.numberOfLines = 0
        approvalLabels[field] = copy
        row.addArrangedSubview(toggle)
        row.addArrangedSubview(copy)
        return row
    }

    private func approvalCopy(for field: String) -> String {
        switch field {
        case "action": return "I approve this exact next action: \(selectedAction.title)."
        case "offer": return "I approve this exact offer: \(offer.name) at \(offer.price)."
        case "provenance": return "I reviewed the source, origin, timestamp, and verification label."
        case "boundary": return "I understand the boundary: this only stages a message; it does not send, open, save, or commit anything."
        default: return "I approve this field."
        }
    }

    private func renderExpandedState() {
        detailLabel.text = ActionPlanner.draft(action: selectedAction, offer: offer).boundary
        messagePreview.text = "Source boundary\n\(offer.provenance.sourceDescription)\n\nNative surface boundary\nProvenance is carried into this review; Messages did not discover or invoke WebMCP."
        for field in ActionPlanner.requiredApprovalFields {
            approvalLabels[field]?.text = approvalCopy(for: field)
            approvalSwitches[field]?.accessibilityLabel = approvalCopy(for: field)
        }
        approvalButton.isEnabled = isFullyApproved
        statusLabel.text = stateMessage
    }

    private var compactBoundaryText: String {
        reviewedOfferID == offer.offerID
            ? "Reviewed \(selectedAction.title) · local-only action · no send or partner call"
            : "Choose a local-only review action. Nothing opens, sends, or saves."
    }

    private var isFullyApproved: Bool {
        ActionPlanner.requiredApprovalFields.allSatisfy { approvalSwitches[$0]?.isOn == true }
    }

    private func applyReviewedMessage(_ message: MSMessage) {
        guard let url = message.url,
              let review = try? ActionPlanner.reviewPayload(from: url),
              review.offerID == offer.offerID else {
            reviewedOfferID = nil
            stateMessage = "This message does not contain a supported Jumping Beans review payload. No action was opened or performed."
            renderInterface(for: presentationStyle)
            return
        }
        reviewedOfferID = review.offerID
        selectedAction = review.action
        stateMessage = "Reviewed \(review.action.title) for \(offer.name). Actions here are local-only."
        renderInterface(for: presentationStyle)
    }

    @objc private func compactActionTapped(_ sender: UIButton) {
        guard AllowedAction.allCases.indices.contains(sender.tag) else { return }
        selectedAction = AllowedAction.allCases[sender.tag]
        stateMessage = "Selected \(selectedAction.title). This local-only control changes the review draft; it does not send or open anything."
        renderInterface(for: presentationStyle)
    }

    @objc private func requestExpandedReview() {
        requestPresentationStyle(.expanded)
    }

    @objc private func expandedActionTapped(_ sender: UIButton) {
        guard AllowedAction.allCases.indices.contains(sender.tag) else { return }
        let action = AllowedAction.allCases[sender.tag]
        guard action != selectedAction else { return }
        selectedAction = action
        stateMessage = "Selected \(selectedAction.title). Review every exact field before staging."
        renderInterface(for: presentationStyle)
    }

    @objc private func approvalChanged() {
        approvalButton.isEnabled = isFullyApproved
        stateMessage = isFullyApproved
            ? "Exact approval captured. The next step will stage a message in the composer."
            : "Review every exact field before staging."
        statusLabel.text = stateMessage
    }

    @objc private func stageMessage() {
        guard let conversation, isFullyApproved else {
            stateMessage = "Nothing staged. Exact approval is required."
            statusLabel.text = stateMessage
            return
        }
        let draft = ActionPlanner.draft(action: selectedAction, offer: offer)
        guard let staged = ActionPlanner.stage(draft: draft, approvedFields: Set(ActionPlanner.requiredApprovalFields)) else {
            stateMessage = "Nothing staged. The approval set was incomplete."
            statusLabel.text = stateMessage
            return
        }
        let payload = ActionPlanner.payload(for: staged)
        let fallback = MSMessageTemplateLayout()
        fallback.caption = "Jumping Beans · \(selectedAction.title)"
        fallback.subcaption = offer.name
        fallback.trailingCaption = offer.price
        fallback.trailingSubcaption = "Review only"
        fallback.image = LocalProductImage.placeholder
        fallback.imageTitle = offer.merchant
        fallback.imageSubtitle = offer.provenance.sourceLabel

        guard let messageURL = try? ActionPlanner.messageURL(for: payload) else {
            stateMessage = "Nothing staged. The compact review payload was invalid or too long."
            statusLabel.text = stateMessage
            return
        }
        let message = MSMessage(session: MSSession())
        message.url = messageURL
        message.summaryText = "\(selectedAction.title): \(offer.name) · \(offer.price) · review only"
        message.accessibilityLabel = "\(selectedAction.title) review for \(offer.name), \(offer.price), from \(offer.merchant). Review only."
        message.layout = MSMessageLiveLayout(alternateLayout: fallback)

        // Insert stages the approved message; Messages still owns final Send.
        conversation.insert(message) { [weak self] error in
            DispatchQueue.main.async {
                if let error {
                    self?.stateMessage = "Message was not staged: \(error.localizedDescription)"
                    self?.statusLabel.text = self?.stateMessage
                    return
                }
                self?.stateMessage = "Staged in the Messages composer. Messages will not send until you tap Send."
                self?.statusLabel.text = self?.stateMessage
            }
        }
    }

    private func label(_ text: String, textStyle: UIFont.TextStyle, weight: UIFont.Weight) -> UILabel {
        let result = UILabel()
        result.text = text
        result.font = UIFontMetrics(forTextStyle: textStyle).scaledFont(
            for: UIFont.systemFont(ofSize: UIFont.preferredFont(forTextStyle: textStyle).pointSize, weight: weight)
        )
        result.adjustsFontForContentSizeCategory = true
        return result
    }
}

private enum LocalProductImage {
    static let placeholder: UIImage = {
        let size = CGSize(width: 320, height: 180)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let bounds = CGRect(origin: .zero, size: size)
            UIColor(red: 0.07, green: 0.15, blue: 0.12, alpha: 1).setFill()
            context.fill(bounds)
            UIColor(red: 0.13, green: 0.52, blue: 0.27, alpha: 1).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 42, y: 26, width: 104, height: 104))
            UIColor.white.withAlphaComponent(0.94).setStroke()
            context.cgContext.setLineWidth(9)
            context.cgContext.strokeEllipse(in: CGRect(x: 61, y: 44, width: 66, height: 66))
            let title = "JB"
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 46, weight: .bold),
                .foregroundColor: UIColor.white
            ]
            let titleSize = title.size(withAttributes: attributes)
            title.draw(
                at: CGPoint(x: 206 - titleSize.width / 2, y: 67 - titleSize.height / 2),
                withAttributes: attributes
            )
        }
    }()
}
