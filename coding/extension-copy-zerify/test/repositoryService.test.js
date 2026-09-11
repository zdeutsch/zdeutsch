const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseDivergence,
  prepareBranchForPush,
  gitEnvironment
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

test("Windows SSH key configuration is translated into GIT_SSH_COMMAND", () => {
  const previousKey = process.env.ZDEUTSCH_GIT_SSH_KEY;
  const previousCommand = process.env.ZDEUTSCH_GIT_SSH_COMMAND;
  process.env.ZDEUTSCH_GIT_SSH_KEY = "C:\\Users\\Hp\\.ssh\\zdeutsch_dashboard_ed25519";
  delete process.env.ZDEUTSCH_GIT_SSH_COMMAND;

  try {
    const environment = gitEnvironment();
    assert.match(environment.GIT_SSH_COMMAND, /ssh -i/);
    assert.match(environment.GIT_SSH_COMMAND, /zdeutsch_dashboard_ed25519/);
    assert.match(environment.GIT_SSH_COMMAND, /IdentitiesOnly=yes/);
    assert.equal(environment.GIT_TERMINAL_PROMPT, "0");
  } finally {
    if (previousKey === undefined) delete process.env.ZDEUTSCH_GIT_SSH_KEY;
    else process.env.ZDEUTSCH_GIT_SSH_KEY = previousKey;
    if (previousCommand === undefined) delete process.env.ZDEUTSCH_GIT_SSH_COMMAND;
    else process.env.ZDEUTSCH_GIT_SSH_COMMAND = previousCommand;
  }
});
