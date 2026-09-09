# Native iMessage entry — session memory

Date: 2026-09-04

## Durable findings

- The Jumping Beans Messages extension renders successfully in the iOS Simulator: Xcode launched `JumpingBeansMessages MessagesExtension` on **iPhone 17 Pro, iOS 26.5**, and the full native panel appeared with the offer, provenance text, and allowable-action controls.
- The physical test iPhone is **iPhone 14 Pro Max, iOS 26.6.1**. All three debugging apps were removed from it: `SigningLaunchControl`, `JumpingBeansMessages`, and `StockMessagesCheck`. Xcode’s installed-app list is now empty.
- The physical-device failure is isolated to the Messages-extension execution path. The primary and clean stock Messages extensions both failed with Xcode Code 85 (“Bad executable (or shared library)”) before debugger attachment, while the ordinary `SigningLaunchControl` app launched successfully.

## Decision

Continue simulator-first testing while the paid Apple Developer Program decision is pending. Do not keep changing the extension UI/controller to chase the physical Code 85; the next meaningful device experiment is a clean stock Messages extension signed by a paid team, followed by the unchanged Jumping Beans extension if that succeeds.

## Safety / scope

This note contains no credentials or device identifiers. Existing dirty source changes in the primary worktree were preserved; this session made no source-code edits.
