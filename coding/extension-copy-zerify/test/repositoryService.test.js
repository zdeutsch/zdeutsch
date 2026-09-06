const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseDivergence,
  prepareBranchForPush
} = require("../server/services/repositoryService");

test("parseDivergence separates local and remote commits", () => {
  assert.deepEqual(parseDivergence("3\t2"), { ahead: 3, behind: 2 });
  assert.deepEqual(parseDivergence(""), { ahead: 0, behind: 0 });
});

test("publish preparation skips rebase when the local branch is only ahead", async () => {
  const commands = [];
  const execute = async (args) => {
    commands.push(args);
    return args[0] === "rev-list" ? "1\t0" : "";
  };

  const divergence = await prepareBranchForPush("main", execute);

  assert.deepEqual(divergence, { ahead: 1, behind: 0 });
  assert.deepEqual(commands.map((args) => args[0]), ["fetch", "rev-list"]);
});

test("publish preparation rebases with autostash only when the remote is ahead", async () => {
  const commands = [];
  const execute = async (args) => {
    commands.push(args);
    return args[0] === "rev-list" ? "1\t2" : "";
  };

  await prepareBranchForPush("main", execute);

  assert.deepEqual(commands[2], ["pull", "--rebase", "--autostash", "origin", "main"]);
});
