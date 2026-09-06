const { execFile } = require("child_process");
const { promisify } = require("util");
const AppError = require("../utils/appError");
const { SITE_DIR } = require("../config/constants");

const execFileAsync = promisify(execFile);
const MANAGED_PATHS = Object.freeze(["database", "assets/audio/horen"]);
const DEFAULT_COMMIT_MESSAGE = "Update exam data and audio from dashboard";

function cleanOutput(value) {
  return String(value || "").trim();
}

function errorOutput(error) {
  return cleanOutput(error?.stderr || error?.stdout || error?.message);
}

async function runGit(args, options = {}) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: SITE_DIR,
      windowsHide: true,
      timeout: options.timeout || 120000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
      }
    });
    if (options.preserveLeadingWhitespace) {
      return String(result.stdout || "").replace(/\s+$/, "");
    }
    return cleanOutput(result.stdout);
  } catch (error) {
    const details = errorOutput(error);
    if (options.allowFailure) {
      return null;
    }
    throw new AppError("Git command failed", 409, details || "Unknown Git error");
  }
}

function parseStatus(output) {
  if (!output) {
    return [];
  }
  return output.split(/\r?\n/).filter(Boolean).map((line) => ({
    state: line.slice(0, 2),
    path: line.slice(3).trim()
  }));
}

async function ensureRepository() {
  const inside = await runGit(["rev-parse", "--is-inside-work-tree"], { allowFailure: true });
  if (inside !== "true") {
    throw new AppError("The site folder is not a Git repository", 409);
  }
}

async function getRepositoryStatus() {
  await ensureRepository();

  const [branch, remote, statusOutput, lastCommitOutput, upstream] = await Promise.all([
    runGit(["branch", "--show-current"]),
    runGit(["remote", "get-url", "origin"], { allowFailure: true }),
    runGit(["status", "--porcelain=v1", "--untracked-files=all", "--", ...MANAGED_PATHS], { preserveLeadingWhitespace: true }),
    runGit(["log", "-1", "--pretty=format:%h%x09%s%x09%cI"], { allowFailure: true }),
    runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { allowFailure: true })
  ]);

  let ahead = null;
  let behind = null;
  if (upstream) {
    const counts = await runGit(["rev-list", "--left-right", "--count", `HEAD...${upstream}`], { allowFailure: true });
    const match = counts?.match(/^(\d+)\s+(\d+)$/);
    if (match) {
      ahead = Number(match[1]);
      behind = Number(match[2]);
    }
  }

  const lastCommitParts = lastCommitOutput ? lastCommitOutput.split("\t") : [];
  const changes = parseStatus(statusOutput);
  return {
    branch,
    remote: remote || null,
    clean: changes.length === 0,
    changeCount: changes.length,
    changes,
    ahead,
    behind,
    lastCommit: lastCommitOutput ? {
      hash: lastCommitParts[0] || "",
      message: lastCommitParts[1] || "",
      committedAt: lastCommitParts[2] || ""
    } : null
  };
}

async function syncRepositoryData() {
  await ensureRepository();
  const branch = await runGit(["branch", "--show-current"]);
  if (!branch) {
    throw new AppError("Cannot sync a detached Git checkout", 409);
  }

  await runGit(["fetch", "origin", branch], { timeout: 180000 });
  let status = await getRepositoryStatus();
  const hasLocalWork = status.changeCount > 0 || Number(status.ahead || 0) > 0;

  if (Number(status.behind || 0) > 0 && !hasLocalWork) {
    await runGit(["merge", "--ff-only", `origin/${branch}`], { timeout: 180000 });
    status = await getRepositoryStatus();
    return {
      synced: true,
      updated: true,
      message: "Remote exam data and audio changes were downloaded.",
      status
    };
  }

  if (Number(status.behind || 0) > 0 && hasLocalWork) {
    return {
      synced: true,
      updated: false,
      message: "Remote changes were found. Publish the local changes to reconcile them safely.",
      status
    };
  }

  return {
    synced: true,
    updated: false,
    message: hasLocalWork ? "Local exam data or audio changes are ready to publish." : "Repository data is up to date.",
    status
  };
}

function normalizeCommitMessage(value) {
  const message = cleanOutput(value).replace(/[\r\n]+/g, " ").slice(0, 120);
  return message || DEFAULT_COMMIT_MESSAGE;
}

function isManagedPath(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  return MANAGED_PATHS.some((managedPath) => (
    normalized === managedPath || normalized.startsWith(`${managedPath}/`)
  ));
}

function outputPaths(output) {
  return String(output || "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
}

function parseDivergence(output) {
  const match = String(output || "").trim().match(/^(\d+)\s+(\d+)$/);
  return match
    ? { ahead: Number(match[1]), behind: Number(match[2]) }
    : { ahead: 0, behind: 0 };
}

async function prepareBranchForPush(branch, execute = runGit) {
  await execute(["fetch", "origin", branch], { timeout: 180000 });
  const divergence = parseDivergence(await execute([
    "rev-list",
    "--left-right",
    "--count",
    `HEAD...origin/${branch}`
  ]));

  if (divergence.behind > 0) {
    try {
      await execute(["pull", "--rebase", "--autostash", "origin", branch], { timeout: 180000 });
    } catch (error) {
      await execute(["rebase", "--abort"], { allowFailure: true });
      throw error;
    }
  }

  return divergence;
}

async function discardRepositoryData() {
  await ensureRepository();
  const branch = await runGit(["branch", "--show-current"]);
  if (!branch) {
    throw new AppError("Cannot cancel changes from a detached Git checkout", 409);
  }

  await runGit(["fetch", "origin", branch], { timeout: 180000 });
  const upstream = `origin/${branch}`;
  const status = await getRepositoryStatus();
  const hasLocalWork = status.changeCount > 0 || Number(status.ahead || 0) > 0;
  if (!hasLocalWork) {
    return {
      discarded: false,
      message: "There are no local exam data or audio changes to cancel.",
      status
    };
  }

  const aheadPaths = outputPaths(await runGit(["log", "--format=", "--name-only", `${upstream}..HEAD`], { allowFailure: true }));
  const unsafeAheadPaths = aheadPaths.filter((filePath) => !isManagedPath(filePath));
  if (unsafeAheadPaths.length) {
    throw new AppError(
      "Cancel was stopped because local commits also contain unmanaged files",
      409,
      unsafeAheadPaths
    );
  }

  const stagedPaths = outputPaths(await runGit(["diff", "--cached", "--name-only"]));
  const unsafeStagedPaths = stagedPaths.filter((filePath) => !isManagedPath(filePath));
  if (unsafeStagedPaths.length) {
    throw new AppError(
      "Cancel was stopped because unrelated files are staged",
      409,
      unsafeStagedPaths
    );
  }

  if (Number(status.ahead || 0) > 0 || Number(status.behind || 0) > 0) {
    await runGit(["reset", "--mixed", upstream]);
  }
  await runGit(["restore", `--source=${upstream}`, "--staged", "--worktree", "--", "database"]);
  await runGit(["restore", `--source=${upstream}`, "--staged", "--worktree", "--", "assets/audio/horen"], { allowFailure: true });
  await runGit(["clean", "-fd", "--", ...MANAGED_PATHS]);

  return {
    discarded: true,
    message: "Unpushed exam data and audio changes were canceled.",
    status: await getRepositoryStatus()
  };
}

async function ensureCommitIdentity() {
  const name = await runGit(["config", "user.name"], { allowFailure: true });
  const email = await runGit(["config", "user.email"], { allowFailure: true });

  if (!name) {
    await runGit(["config", "user.name", process.env.ZDEUTSCH_GIT_USER_NAME || "ZDeutsch Dashboard"]);
  }
  if (!email) {
    await runGit(["config", "user.email", process.env.ZDEUTSCH_GIT_USER_EMAIL || "dashboard@zdeutsch.local"]);
  }
}

async function publishRepositoryData(commitMessage) {
  await ensureRepository();
  const branch = await runGit(["branch", "--show-current"]);
  if (!branch) {
    throw new AppError("Cannot publish from a detached Git checkout", 409);
  }

  await ensureCommitIdentity();
  await runGit(["add", "--", "database"]);
  await runGit(["add", "-A", "--", "assets/audio/horen"], { allowFailure: true });

  const stagedFiles = await runGit(["diff", "--cached", "--name-only", "--", ...MANAGED_PATHS]);
  let committed = false;
  if (stagedFiles) {
    await runGit(["commit", "-m", normalizeCommitMessage(commitMessage), "--", ...outputPaths(stagedFiles)]);
    committed = true;
  }

  const divergence = await prepareBranchForPush(branch);
  if (!committed && divergence.ahead === 0) {
    return {
      published: false,
      message: "There are no exam data or audio changes to publish.",
      status: await getRepositoryStatus()
    };
  }

  await runGit(["push", "origin", `HEAD:${branch}`], { timeout: 180000 });
  return {
    published: true,
    message: "Database changes were committed and pushed successfully.",
    status: await getRepositoryStatus()
  };
}

module.exports = {
  parseDivergence,
  prepareBranchForPush,
  getRepositoryStatus,
  syncRepositoryData,
  discardRepositoryData,
  publishRepositoryData
};
