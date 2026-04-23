export type AssemblyStructureSpecSection = {
	body: string[];
	heading: string;
};

export type AssemblyStructureSpecification = {
	scope: string[];
	title: string;
	invariants: AssemblyStructureSpecSection[];
	reviewRules: string[];
};

export const assemblyStructureSpecification: AssemblyStructureSpecification = {
	title: "Assembly Structure Contract Specification",
	scope: [
		"The adapter contract sits between assembled AsciiDoc input and Markdown IR lowering.",
		"It is intentionally narrower than upstream Asciidoctor runtime objects, richer than raw assembled source text, and distinct from downstream Markdown IR.",
	],
	invariants: [
		{
			heading: "Repository-Owned Boundary",
			body: [
				"Extractors may use upstream Asciidoctor objects internally, but those objects must not cross the adapter boundary.",
				"Lowering and rendering code must consume AssemblyDocument and related adapter nodes, not reparse assembled source text.",
				"New semantic coverage must be added as explicit adapter structure instead of renderer-local string behavior.",
			],
		},
		{
			heading: "Explicit Loss Rules",
			body: [
				"Semantic loss at the adapter boundary must be visible and reviewable.",
				"Unsupported structure must become unsupported nodes or deterministic fallback behavior rather than silent degradation.",
				"Inline fallback may preserve undecoded fragments as plain text or htmlInline only when richer semantics are unavailable.",
			],
		},
		{
			heading: "Source Location Expectations",
			body: [
				"Source locations are best-effort provenance metadata.",
				"When present, they describe the assembled source position observed by the extractor, not guessed pre-assembly include origins.",
				"Lowering and normalization should preserve equivalent source locations when semantic identity is retained.",
			],
		},
		{
			heading: "Unsupported Node Semantics",
			body: [
				"Unsupported nodes are first-class contract markers for semantic gaps.",
				"Reasons should identify the unsupported family clearly enough for tests, docs, and operators to review.",
				"Unsupported structure should be removed by adding explicit semantic support, not by hiding it in renderer-local fallback.",
			],
		},
		{
			heading: "Inline Fallback Semantics",
			body: [
				"Malformed inline HTML-like fragments fall back deterministically rather than being reparsed by ad-hoc heuristics.",
				"Visible xref labels come from assembled Asciidoctor output; canonical target metadata remains the semantic source of truth.",
				"Mixed inline semantics should preserve supported nested meaning where parsing is unambiguous and preserve raw text where it is not.",
			],
		},
	],
	reviewRules: [
		"Changes to adapter semantics should update this specification, assembly-structure.ts, and the matching proof surface together.",
		"If prose elsewhere sounds stronger than the published support matrix, the support matrix wins until evidence is updated.",
	],
};
