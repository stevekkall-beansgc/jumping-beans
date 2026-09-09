#import <UIKit/UIKit.h>
#import <Messages/Messages.h>

@interface JBMessagesViewController : MSMessagesAppViewController
@end

@implementation JBMessagesViewController

- (void)loadView {
    UIView *rootView = [[UIView alloc] initWithFrame:CGRectZero];
    rootView.backgroundColor = UIColor.systemBackgroundColor;
    self.view = rootView;
}

- (void)viewDidLoad {
    [super viewDidLoad];

    self.view.backgroundColor = UIColor.systemBackgroundColor;

    UILabel *eyebrow = [self labelWithText:@"JUMPING BEANS · NATIVE MESSAGES" size:12 weight:UIFontWeightBold];
    eyebrow.textColor = UIColor.systemGreenColor;

    UILabel *title = [self labelWithText:@"Choose what can happen next" size:25 weight:UIFontWeightBold];

    UILabel *intro = [self labelWithText:@"A reviewed offer is already here. Choose an allowable action, inspect its boundary, and approve the exact fields before staging a native message." size:15 weight:UIFontWeightRegular];
    intro.numberOfLines = 0;

    UILabel *offer = [self labelWithText:@"Cushioned Dog Harness · $48.00\nPetsupply · WebMCP offer tool\nPartner-provided; not independently verified by Jumping Beans" size:15 weight:UIFontWeightSemibold];
    offer.numberOfLines = 0;
    offer.textColor = UIColor.labelColor;
    offer.backgroundColor = UIColor.secondarySystemBackgroundColor;
    offer.layer.cornerRadius = 12;
    offer.layer.masksToBounds = YES;

    UILabel *section = [self labelWithText:@"ALLOWABLE NEXT ACTION" size:12 weight:UIFontWeightBold];
    section.textColor = UIColor.secondaryLabelColor;

    UISegmentedControl *actions = [[UISegmentedControl alloc] initWithItems:@[@"Compare", @"Adapt", @"Preview"]];
    actions.selectedSegmentIndex = 0;

    UILabel *boundary = [self labelWithText:@"This review can compare the offer, adapt its presentation, or preview the handoff. It does not send, open, save, or commit anything." size:14 weight:UIFontWeightRegular];
    boundary.numberOfLines = 0;
    boundary.textColor = UIColor.secondaryLabelColor;

    UILabel *approval = [self labelWithText:@"EXPLICIT APPROVAL" size:12 weight:UIFontWeightBold];
    approval.textColor = UIColor.secondaryLabelColor;

    UILabel *approvalCopy = [self labelWithText:@"Review the exact action, offer, provenance, and boundary before staging." size:14 weight:UIFontWeightRegular];
    approvalCopy.numberOfLines = 0;

    UIButton *stage = [UIButton buttonWithType:UIButtonTypeSystem];
    [stage setTitle:@"Stage native message" forState:UIControlStateNormal];
    stage.titleLabel.font = [UIFont preferredFontForTextStyle:UIFontTextStyleHeadline];
    [stage addTarget:self action:@selector(stageMessage:) forControlEvents:UIControlEventTouchUpInside];

    UILabel *status = [self labelWithText:@"Nothing is saved or sent. Selecting an action only changes this draft." size:13 weight:UIFontWeightRegular];
    status.numberOfLines = 0;
    status.textColor = UIColor.secondaryLabelColor;

    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[eyebrow, title, intro, offer, section, actions, boundary, approval, approvalCopy, stage, status]];
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 14;
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:stack];

    [NSLayoutConstraint activateConstraints:@[
        [stack.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
        [stack.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20],
        [stack.topAnchor constraintEqualToAnchor:self.view.topAnchor constant:20],
        [stack.bottomAnchor constraintLessThanOrEqualToAnchor:self.view.bottomAnchor constant:-24]
    ]];
}

- (void)didBecomeActiveWithConversation:(MSConversation *)conversation {
    [super didBecomeActiveWithConversation:conversation];

    // The review surface is intentionally a full-height native flow. Messages
    // launches extensions in compact mode from the app drawer, so expand only
    // after activation instead of trying to fit the approval surface into the
    // keyboard area.
}

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];
    self.preferredContentSize = CGSizeMake(0, 560);
    [self requestPresentationStyle:MSMessagesAppPresentationStyleExpanded];
}

- (UILabel *)labelWithText:(NSString *)text size:(CGFloat)size weight:(UIFontWeight)weight {
    UILabel *label = [[UILabel alloc] init];
    label.text = text;
    label.font = [UIFont systemFontOfSize:size weight:weight];
    return label;
}

- (void)stageMessage:(UIButton *)sender {
    sender.enabled = NO;
    [sender setTitle:@"Native message staged for review" forState:UIControlStateNormal];
}

@end
