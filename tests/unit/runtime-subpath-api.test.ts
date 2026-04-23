import { describe, expect, it } from "vitest";
import { runAntoraAssembler } from "../../src/runtime.ts";

describe("runtime subpath API", () => {
	it("publishes the lower-level assembler runtime from the dedicated subpath", () => {
		expect(typeof runAntoraAssembler).toBe("function");
	});
});
