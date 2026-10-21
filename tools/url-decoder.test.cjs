const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const decode = require("decode-uri-component");
const queryString = require("query-string");

test("query-string retains Unicode and malformed-input compatibility", () => {
  assert.equal(decode("%C3%A9"), "é");
  assert.equal(decode("%C2"), "\uFFFD");
  assert.equal(decode("%FE%FF"), "\uFFFD\uFFFD");
  assert.equal(decode("foo%ZZbar"), "foo%ZZbar");
  assert.equal(
    queryString.parse("name=Jos%C3%A9&album=Liga+Este").name,
    "José",
  );
});

test("long malformed URL input finishes within a bounded time", () => {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const decode = require(process.argv[1]);
    const input = '%E0%A4'.repeat(5000);
    const result = decode(input);
    if (typeof result !== 'string' || result.length === 0) process.exit(2);
  `,
      process.env.DECODER_TEST_MODULE ||
        require.resolve("decode-uri-component"),
    ],
    {
      timeout: 1500,
      encoding: "utf8",
    },
  );
  assert.equal(
    child.error,
    undefined,
    "Malformed URL decoding must terminate within its time budget",
  );
  assert.equal(child.status, 0, child.stderr);
});
