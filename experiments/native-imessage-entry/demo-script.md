# Native iMessage feasibility script

Do not use the native iMessage surface as the physical-device live demo right
now. The full panel rendered in the iOS Simulator, but the tested physical
iPhone rejected both this extension and a clean stock Messages extension before
debugger attachment with Xcode Code 85. If the experiment is shown, frame it as
a feasibility spike and use the browser/engine gallery for the reliable flow.

The intended native narrative is:

“The chain can start in the conversation, but the next action is still mine.”

The extension would let the person select **Compare**, **Adapt presentation**,
or **Preview handoff** and review the carried provenance: Petsupply, the WebMCP
offer-tool label, the partner origin, the observed timestamp, and the explicit
“not independently verified” status.

Approval would cover the action, exact offer, provenance, and boundary—not an
implied order or partner permission.

The final native boundary would be staging a message in the composer while
leaving Messages’ own **Send** button as the final human step. It would not run
WebMCP, open an HTTPS share, or perform a partner action inside Messages.

Keep that no-browser statement scoped to iOS. Apple documents that selecting an
`MSMessage` on macOS can open its URL in a browser; this prototype points to a
reserved `.example` domain with no live endpoint.

Close with: “This is the intended native Messages boundary. The live prototype
today is the browser/engine flow; the native surface remains under
investigation.”
