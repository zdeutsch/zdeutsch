const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_AUDIO_BYTES,
  detectAudioFormat,
  normalizeAudioUpload
} = require("../server/services/horenService");

test("detectAudioFormat identifies supported audio from file signatures", () => {
  assert.equal(detectAudioFormat(Buffer.from("ID3\u0004\u0000\u0000", "binary"))?.extension, "mp3");
  assert.equal(detectAudioFormat(Buffer.from("RIFF0000WAVE", "ascii"))?.extension, "wav");
  assert.equal(detectAudioFormat(Buffer.from("OggS0000", "ascii"))?.extension, "ogg");
  assert.equal(detectAudioFormat(Buffer.from("0000ftypM4A ", "ascii"))?.extension, "m4a");
  assert.equal(detectAudioFormat(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))?.extension, "webm");
});

test("normalizeAudioUpload derives trusted metadata instead of trusting the filename", () => {
  const upload = normalizeAudioUpload(Buffer.from("ID3\u0004\u0000\u0000", "binary"), "lesson.wav");
  assert.equal(upload.extension, "mp3");
  assert.equal(upload.mimeType, "audio/mpeg");
  assert.equal(upload.originalName, "lesson.wav");
});

test("normalizeAudioUpload rejects unknown and oversized files", () => {
  assert.throws(
    () => normalizeAudioUpload(Buffer.from("not audio"), "notes.txt"),
    /Unsupported audio file/
  );
  assert.throws(
    () => normalizeAudioUpload(Buffer.alloc(MAX_AUDIO_BYTES + 1, 0), "huge.mp3"),
    (error) => error.statusCode === 413
  );
});
