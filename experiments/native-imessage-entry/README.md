# Jumping Beans native iMessage entry prototype

This directory is a build-oriented native iMessage App Extension source
prototype for the Jumping Beans allowable-actions/chains thesis. It is kept
isolated from the web engine and does not pretend that a static HTTPS page is
an iMessage app.

## Current status

This is a bounded feasibility spike, not the physical-device live demo path. A
2026-09-04 run rendered the full native panel in the iPhone 17 Pro / iOS 26.5
Simulator. On the physical iPhone 14 Pro Max / iOS 26.6.1, both this extension
and a clean stock Messages extension failed before debugger attachment with
Xcode Code 85 ("Bad executable (or shared library)"); an ordinary signed iOS app
did launch. Treat that as a device/signing-path failure, not proof that the
Messages UI is blank on every runtime. Use the browser/engine gallery for the
reliable live demonstration until the physical-device path is resolved.

During the 2026-09-09 final QA pass, the local validator, model tests, Swift
parsing, direct SDK type-checks, and unsigned device/simulator `xcodebuild`
builds all passed when DerivedData was redirected to a writable temporary
directory. CoreSimulatorService/simdiskimaged is still unavailable on this
host, so simulator device discovery and launch remain blocked.

This host currently reports no valid code-signing identities. A signed device
install/debug session therefore still requires an unlocked Mac with an Apple
Developer or personal-team signing identity available to Xcode.

The intended Messages flow is:

1. Open Jumping Beans from the Messages app drawer.
2. Review the carried-in offer and its provenance.
3. Select one allowable next action: **Compare**, **Adapt presentation**, or
   **Preview handoff**.
4. Review and approve the exact action, offer, provenance, and boundary fields.
5. Create an `MSMessage` with an `MSMessageTemplateLayout` fallback and a
   native `MSMessageLiveLayout` for transcript presentation.
6. Call `MSConversation.insert(_:)` to stage the message in the composer. The
   person still taps Messages' Send button; the extension never auto-sends.

## Important boundary

This is a native iMessage surface, not a WebMCP runtime. The extension does
not call `document.modelContext`, discover partner tools, open a mobile HTTPS
share, use `URLSession`, use `WKWebView`, or claim that WebMCP runs inside
Messages. The sample offer carries explicit web-journey provenance so the
message can say where it came from without implying that Messages verified or
invoked that source.

`MSMessage.url` uses a compact, opaque fragment on the supported HTTPS review
URL (`https://message.jumpingbeans.example/review#…`). On iOS, this extension
does not load that URL: it decodes the fragment locally into an allowlisted
version, action, and ASCII offer identifier. The parser rejects credentials,
ports, queries, non-base64url fragments, unknown fields/actions, and URLs over
Apple’s 5,000-character limit. The payload contains no credentials, profile
data, partner URL, or partner operation.

Apple documents one cross-platform caveat: selecting an `MSMessage` on macOS
can load its URL in a browser. This prototype uses the reserved `.example`
domain and puts its payload in the fragment, so there is no live Jumping Beans
or partner endpoint and the fragment is not part of an HTTP request. Even so,
the no-browser claim is intentionally limited to the iOS extension; this is not
a macOS offline-experience guarantee.

## Xcode project

The Xcode project is now created at
`JumpingBeansMessages/JumpingBeansMessages.xcodeproj`. It contains the
`JumpingBeansMessages` host app and an embedded
`JumpingBeansMessages MessagesExtension` target. The generated controller and
plist have been replaced with the source in this directory, and the extension
deployment target is iOS 16.0.

The host app only exists to install the extension; the extension UI is opened
from Messages. A previous simulator build/run succeeded, while the current
host-level build limitation is recorded above.

The build target uses the controller, model, and plist under
`JumpingBeansMessages/JumpingBeansMessages MessagesExtension/`. The top-level
Swift files are review-friendly mirrors, and `validate.mjs` fails if those
copies drift. The extension deployment target is iOS 16.0; UIKit and Messages
are linked by the Xcode project. The extension loads its Swift principal class
directly; it no longer depends on a storyboard. Select the shared
`JumpingBeansMessages MessagesExtension` scheme and an iOS Simulator or signed
test iPhone to build/run.

## Intended native flow (currently blocked on device)

The following is the intended interaction contract, retained as a design and
reproducibility record. It is not a reliable live-demo procedure until the
physical-device launch issue is resolved.

1. Open **Messages** and enter a conversation on the simulator/device.
2. Tap the app-drawer button beside the composer, then choose **Jumping
   Beans**. This is the native extension entry point.
3. Select each action and confirm that the boundary copy changes. Observe that
   the offer always retains `Petsupply`, `WebMCP offer tool`, its origin,
   observed time, and “not independently verified” status.
4. Turn on all four approval switches. The stage button must remain disabled
   until every exact field is approved.
5. Tap **Stage native message**. Verify that the message appears in the
   Messages composer and that the extension reports that Send remains a human
   action. Do not tap Send if testing the no-send boundary.
6. If you do tap Send, open the native message bubble. The live layout should
   reopen the extension in transcript presentation; if live presentation is
   unavailable, Messages uses the template fallback.
7. On iOS, confirm that no browser opens, no request is made by the extension,
   and no order, payment, account change, partner write, or saved Jumping Beans
   memory is created. The macOS URL-selection caveat is described above.

## Local checks available on this host

From `products/jumping-beans`:

```bash
node experiments/native-imessage-entry/validate.mjs
```

The check validates both plists, enforces source/target Swift parity, parses both
Swift copies, compiles and runs the model tests, and checks the native API and
boundary markers. A direct type-check against the installed iOS Simulator SDK
also passes. Direct type-checks and unsigned device/simulator Xcode builds pass
with a writable temporary DerivedData path. CoreSimulatorService/runtime
availability still controls whether a simulator device can be launched; the
separate physical-device signing/debugger failure is recorded above.
