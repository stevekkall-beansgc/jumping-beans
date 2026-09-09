# Jumping Beans — native iMessage next-session handoff

Date: 2026-09-04
Scope: `experiments/native-imessage-entry`

## Current state

- Simulator path: **working**. Xcode ran `JumpingBeansMessages MessagesExtension` on **iPhone 17 Pro, iOS 26.5** and the native panel rendered fully, including the offer/provenance copy and the Compare, Adapt presentation, and Preview handoff controls.
- Physical-device path: **blocked by an iMessage-extension launch failure**, not by general app trust. On the test iPhone running iOS 26.6.1, both the Jumping Beans extension and a clean stock Messages extension failed before debugger attachment with Code 85 / “Bad executable (or shared library).” A temporary ordinary app launched successfully on the same device.
- Physical cleanup: complete. The following test apps were removed from the iPhone, including their app data: `SigningLaunchControl`, `JumpingBeansMessages`, and `StockMessagesCheck`. The installed-app list is empty.
- Project source: preserve the existing dirty worktree. No source-code edits were made during this wrap-up session, and nothing should be reset or discarded.

## Next-session objective

Keep development and verification on the simulator while Steve considers the paid Apple Developer Program. Use the simulator to validate the native interaction contract and message staging; do not treat simulator success as proof that the physical-device signing problem is resolved.

## Suggested opening prompt

Continue the Jumping Beans native iMessage feasibility spike from this handoff. Use the existing Xcode project at `/Users/stephenkall/beans/products/jumping-beans/experiments/native-imessage-entry/JumpingBeansMessages/JumpingBeansMessages.xcodeproj`. Select the iPhone 17 Pro iOS 26.5 simulator and run the `JumpingBeansMessages MessagesExtension` scheme. In Messages, exercise the extension’s allowable-action flow: select Compare, Adapt presentation, and Preview handoff; verify the exact-field approval boundary; stage the native message; and confirm that Send remains a human action. Preserve provenance and the no-browser/no-network/no-auto-send boundary. Do not reinstall test apps on the physical iPhone or rewrite the controller to chase the already-isolated Code 85 unless a new, reproducible simulator failure appears.

## Paid-device decision point

If the paid Developer Program is chosen, first test a clean stock Messages extension signed by the paid team on the same physical iPhone. If that launches, sign and test Jumping Beans unchanged with that team. If the clean stock extension still fails with Code 85, stop local UI rewrites and capture the device-console/sysdiagnose evidence for Apple Feedback or DTS.

## References

- Native prototype overview: `experiments/native-imessage-entry/README.md`
- Session memory: `experiments/native-imessage-entry/SESSION_MEMORY_2026-09-04.md`
- Prior Code 85 investigation: `/Users/stephenkall/beans/review-worktrees/jumping-beans-native-code85-memory/experiments/native-imessage-entry/INVESTIGATION_2026-09-04.md`
