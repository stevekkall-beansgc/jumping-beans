# Jumping Beans v0.10.6

This patch makes the native WebMCP journey receipt internally consistent with
the discovery that produced it.

The v0.10.5 production proof completed all three allowlisted partner calls and
showed the visible green readiness state. Its final `capability.decision` event,
however, reported zero connected origins because that derived state was
refreshed after the event was created. The decision receipt itself already
listed the correct three origins.

Partner discovery now refreshes the unique connected-origin list before it
creates either the decision receipt or decision event. A regression executes
that ordering directly and verifies the decision sees the current, deduplicated
origin set. The exact production native-browser receipt remains the release
gate for the final GO verdict and public evidence bundle.
