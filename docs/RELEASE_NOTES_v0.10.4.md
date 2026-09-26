# Jumping Beans v0.10.4

This patch restores the native WebMCP self-serve path across Petsupply,
Coffee Co, and Watch Co.

The partner tools previously copied each complete catalog record into the
native response. The current catalogs include an internal `availability`
field that is useful while selecting inventory but is outside the public
offer contract, so the Engine correctly rejected otherwise valid matches as
an invalid partner envelope.

Each producer now projects only the fields accepted by the Engine's existing
`offers.discover@1.0.0` contract. The projection happens after local matching
and ranking and before the trusted partner identity and provenance are added,
so current and future catalog-only fields cannot cross the WebMCP boundary.

Regression coverage executes all three tools against both synthetic internal
fields and the checked-in production catalogs. The complete product gate and
a headed Chrome Stable local four-origin run pass, including exact three-site
discovery, three JSON-string native executions, schema-valid bounded results,
the green Engine readiness state, and a per-origin journey receipt.

The production native receipt remains a post-deploy gate and will be attached
to the GitHub Release after the exact tagged build passes against all four
public origins.
