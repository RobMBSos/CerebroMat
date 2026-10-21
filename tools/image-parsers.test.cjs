const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

function inspect(buffer) {
  const child = spawnSync(
    process.execPath,
    [
      "-e",
      `
    const size = require(process.argv[1]);
    try { console.log(JSON.stringify(size(Buffer.from(process.argv[2], 'base64')))); }
    catch { console.log(JSON.stringify({ rejected: true })); }
  `,
      process.env.IMAGE_SIZE_TEST_MODULE || require.resolve("image-size"),
      buffer.toString("base64"),
    ],
    { timeout: 1500, encoding: "utf8" },
  );
  assert.equal(
    child.error,
    undefined,
    "Image inspection must terminate within its time budget",
  );
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}
function box(type, size, payload = Buffer.alloc(0)) {
  const result = Buffer.alloc(8 + payload.length);
  result.writeUInt32BE(size);
  result.write(type, 4);
  payload.copy(result, 8);
  return result;
}
function icns(entryLength) {
  const result = Buffer.alloc(16);
  result.write("icns");
  result.writeUInt32BE(16, 4);
  result.write("icp5", 8);
  result.writeUInt32BE(entryLength, 12);
  return result;
}
test("normal PNG and ICNS dimensions still work", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZIUAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(inspect(png).width, 1);
  assert.equal(inspect(icns(8)).width, 32);
});
test("ICNS rejects zero-length and out-of-bounds entries without hanging", () => {
  for (const length of [0, 1, 7, 1000]) {
    assert.equal(inspect(icns(length)).rejected, true);
  }
});
test("JXL rejects a zero-length partial codestream without hanging", () => {
  const jxl = Buffer.concat([
    box("JXL ", 12, Buffer.from([13, 10, 135, 10])),
    box("ftyp", 12, Buffer.from("jxl ")),
    box("jxlp", 0, Buffer.alloc(4)),
  ]);
  assert.equal(inspect(jxl).rejected, true);
});
test("HEIF rejects malformed boxes without hanging", () => {
  assert.equal(
    inspect(
      Buffer.concat([box("ftyp", 12, Buffer.from("heic")), box("meta", 0)]),
    ).rejected,
    true,
  );
});
