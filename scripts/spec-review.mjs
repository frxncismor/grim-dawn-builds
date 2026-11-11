import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SPECIALTIES = ['code', 'architecture', 'security', 'best-practices'];
const SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const FEATURE_ARTIFACTS = ['spec.md', 'plan.md', 'tasks.md'];

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function safeRelativePath(root, value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) return null;
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null;
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..'))
    return null;
  const absolute = path.resolve(root, ...segments);
  return inside(root, absolute) ? { absolute, normalized: segments.join('/') } : null;
}

function assertNoSymlinkPath(root, absolute) {
  if (!inside(root, absolute)) throw new Error('path outside repository root');
  const relative = path.relative(root, absolute);
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    try {
      if (lstatSync(cursor).isSymbolicLink())
        throw new Error('symbolic links are not allowed in review paths');
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function excludedFromSnapshot(relative) {
  return relative === '.specify/feature.json' || /^specs\/[^/]+\/reviews(?:\/|$)/.test(relative);
}

function snapshotFor(root) {
  const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const paths = [
    ...new Set(
      listed
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .map((item) => item.replaceAll('\\', '/')),
    ),
  ]
    .filter((item) => !excludedFromSnapshot(item))
    .sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  const hash = createHash('sha256');
  for (const relative of paths) {
    const safe = safeRelativePath(root, relative);
    if (!safe) throw new Error('git returned a path outside repository root');
    assertNoSymlinkPath(root, safe.absolute);
    hash.update(relative, 'utf8');
    hash.update('\0');
    if (!existsSync(safe.absolute)) {
      hash.update('deleted\0');
      continue;
    }
    const bytes = readFileSync(safe.absolute);
    hash.update(String(bytes.byteLength), 'utf8');
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function normalizeTaskId(value) {
  return value.toUpperCase().replace(/^T-?/, 'T-');
}

function explicitDisposition(description) {
  const markers = [
    { kind: 'replaced', pattern: /\[REEMPLAZADA\s+por\s+([^\]]+)\]/i },
    { kind: 'deferred', pattern: /\[DIFERIDA:\s*([^\]]+)\]/i },
    { kind: 'optional', pattern: /\[OPCIONAL\s+NO\s+SELECCIONADA:\s*([^\]]+)\]/i },
  ];
  for (const marker of markers) {
    const match = marker.pattern.exec(description);
    if (!match) continue;
    const explanation = match[1].trim();
    if (!explanation) return null;
    if (marker.kind === 'replaced') {
      const ids = explanation.split(';', 1)[0].trim();
      if (!/^(?:T-?\d+[a-z]*)(?:\s*\/\s*T-?\d+[a-z]*)*$/i.test(ids)) return null;
    } else if (!/\bT-?\d+[a-z]*\b/i.test(explanation)) {
      return null;
    }
    return { kind: marker.kind, reason: explanation };
  }
  return null;
}

function parseTasks(contents) {
  const tasks = [];
  const seen = new Set();
  const lines = contents.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const boldModern = /^\s*-\s+\[([ xX])\]\s+\*\*(T-?\d+[a-z]*)\*\*(?=\s|$)(.*)$/i.exec(line);
    const plainModern = boldModern
      ? null
      : /^\s*-\s+\[([ xX])\]\s+(T-?\d+[a-z]*)(?=\s|$)(.*)$/i.exec(line);
    const legacy =
      boldModern || plainModern ? null : /^\s*-\s+\*\*(T-\d+[a-z]*)\*\*(.*)$/i.exec(line);
    if (!boldModern && !plainModern && !legacy) {
      if (/^\s*-\s+(?:\[[^\]]*\]\s*)*(?:T-?\d+|\*\*T-?\d+)/i.test(line)) {
        throw new Error(`malformed task line ${index + 1}`);
      }
      continue;
    }
    const modern = boldModern ?? plainModern;
    const checked = Boolean(modern && modern[1].toLowerCase() === 'x');
    const id = normalizeTaskId(modern ? modern[2] : legacy[1]);
    const description = modern ? modern[3] : legacy[2];
    if (seen.has(id)) throw new Error(`duplicate task ID ${id}`);
    seen.add(id);
    const disposition = explicitDisposition(description);
    if (/\[(?:REEMPLAZADA\b|DIFERIDA:|OPCIONAL\s+NO\s+SELECCIONADA:)/i.test(description)) {
      if (!disposition) throw new Error(`invalid task disposition for ${id}`);
    }
    tasks.push({ id, checked, line: index + 1, description: description.trim(), disposition });
  }
  if (tasks.length === 0) throw new Error('tasks.md contains no recognized tasks');
  return tasks;
}

function featurePath(root, feature) {
  const safe = safeRelativePath(root, feature);
  if (!safe || !/^specs\/[^/]+(?:\/[^/]+)*$/.test(safe.normalized)) {
    throw new Error('feature must be a repository-relative path under specs/');
  }
  assertNoSymlinkPath(root, safe.absolute);
  return { absolute: safe.absolute, normalized: safe.normalized };
}

function prepare(rootPath, feature) {
  let root;
  try {
    root = realpathSync(rootPath);
    const target = featurePath(root, feature);
    for (const artifact of FEATURE_ARTIFACTS) {
      const file = path.join(target.absolute, artifact);
      assertNoSymlinkPath(root, file);
      if (!existsSync(file)) throw new Error(`missing required artifact: ${artifact}`);
      if (!lstatSync(file).isFile())
        throw new Error(`required artifact is not a file: ${artifact}`);
    }
    const taskText = readFileSync(path.join(target.absolute, 'tasks.md'), 'utf8');
    const tasks = parseTasks(taskText);
    const activeTasks = tasks.filter((task) => !task.disposition);
    const excludedTasks = tasks
      .filter((task) => task.disposition)
      .map((task) => ({
        id: task.id,
        disposition: task.disposition.kind,
        reason: task.disposition.reason,
      }));
    const pendingTasks = activeTasks
      .filter((task) => !task.checked)
      .map(({ id, line }) => ({ id, line }));
    if (pendingTasks.length) {
      return {
        status: 'pending-tasks',
        feature: target.normalized,
        pendingTasks,
        excludedTasks,
        reasons: ['active implementation tasks remain unchecked'],
      };
    }
    return {
      status: 'ready',
      feature: target.normalized,
      snapshot: snapshotFor(root),
      pendingTasks: [],
      excludedTasks,
      reasons: [],
    };
  } catch (error) {
    return {
      status: 'invalid',
      feature,
      pendingTasks: [],
      excludedTasks: [],
      reasons: [safeError(error)],
    };
  }
}

function safeError(error) {
  const message = String(error?.message ?? 'invalid review input');
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 240);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateFinding(finding, root, ids, verifiedTaskIds) {
  if (!finding || typeof finding !== 'object' || Array.isArray(finding))
    return 'finding must be an object';
  if (!nonEmpty(finding.id) || ids.has(finding.id)) return 'finding ID is empty or duplicated';
  ids.add(finding.id);
  if (!SEVERITIES.has(finding.severity)) return 'finding severity is invalid';
  const safe = safeRelativePath(root, finding.path);
  if (!safe) return 'finding path is not repository-relative';
  try {
    assertNoSymlinkPath(root, safe.absolute);
  } catch {
    return 'finding path uses a symbolic link or escapes repository';
  }
  if (!Number.isInteger(finding.line) || finding.line < 1)
    return 'finding line must be a positive integer';
  for (const field of ['evidence', 'impact', 'recommendation']) {
    if (!nonEmpty(finding[field])) return `finding ${field} is empty`;
  }
  if (!['open', 'resolved', 'deferred'].includes(finding.disposition))
    return 'finding disposition is invalid';
  if (finding.disposition === 'resolved') {
    const taskReference =
      nonEmpty(finding.resolution) && /\bT-?\d+[a-z]*\b/i.exec(finding.resolution)?.[0];
    if (!taskReference || !verifiedTaskIds.has(normalizeTaskId(taskReference)))
      return 'resolved finding needs a verified, completed SDD task reference';
  }
  if (finding.disposition === 'deferred') {
    if (['CRITICAL', 'HIGH'].includes(finding.severity))
      return 'CRITICAL/HIGH findings cannot be deferred';
    if (!nonEmpty(finding.deferReason) || !/\bT-?\d+[a-z]*\b/i.test(finding.deferReason))
      return 'deferred finding needs a reason and SDD reference';
  }
  return null;
}

function validateReport(report, root, feature, expectedSnapshot, verifiedTaskIds = new Set()) {
  const reasons = [];
  if (!report || typeof report !== 'object' || Array.isArray(report))
    return ['report must be a JSON object'];
  if (report.schemaVersion !== 1) reasons.push('schemaVersion must be 1');
  if (report.feature !== feature) reasons.push('report feature does not match requested feature');
  if (!/^[a-f0-9]{64}$/.test(report.snapshot ?? ''))
    reasons.push('snapshot must be a SHA-256 hex digest');
  else if (report.snapshot !== expectedSnapshot) reasons.push('report snapshot is stale');
  if (
    !nonEmpty(report.createdAt) ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(report.createdAt) ||
    Number.isNaN(Date.parse(report.createdAt))
  )
    reasons.push('createdAt must be a valid UTC timestamp');
  if (!nonEmpty(report.implementationActor)) reasons.push('implementationActor must be non-empty');
  if (typeof report.delegationAvailable !== 'boolean')
    reasons.push('delegationAvailable must be boolean');
  if (!Array.isArray(report.reviews) || report.reviews.length !== 4) {
    reasons.push('report must contain exactly four reviews');
    return reasons;
  }
  const reviews = new Map();
  for (const review of report.reviews) {
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      reasons.push('review must be an object');
      continue;
    }
    if (!SPECIALTIES.includes(review.specialty) || reviews.has(review.specialty)) {
      reasons.push('review specialties must be unique and complete');
      continue;
    }
    reviews.set(review.specialty, review);
    if (!nonEmpty(review.reviewer)) reasons.push(`${review.specialty} reviewer identity is empty`);
    if (!['independent', 'self-review'].includes(review.mode))
      reasons.push(`${review.specialty} mode is invalid`);
    if (
      report.delegationAvailable === true &&
      (review.mode !== 'independent' || review.reviewer === report.implementationActor)
    )
      reasons.push(`${review.specialty} falsely claims reviewer independence`);
    if (
      report.delegationAvailable === false &&
      (review.mode !== 'self-review' || !nonEmpty(review.capabilityReason))
    )
      reasons.push(`${review.specialty} self-review must state the capability limitation`);
    if (!['completed', 'failed', 'not-run'].includes(review.status))
      reasons.push(`${review.specialty} status is invalid`);
    if (
      !Array.isArray(review.coverage) ||
      review.coverage.length === 0 ||
      review.coverage.some((item) => !nonEmpty(item))
    )
      reasons.push(`${review.specialty} coverage must be non-empty`);
    if (
      !Array.isArray(review.checks) ||
      review.checks.some(
        (item) =>
          !(
            nonEmpty(item) ||
            (item && typeof item === 'object' && nonEmpty(item.name) && nonEmpty(item.result))
          ),
      )
    )
      reasons.push(`${review.specialty} checks are malformed`);
    if (
      Array.isArray(review.checks) &&
      review.checks.length === 0 &&
      (!Array.isArray(review.limitations) || review.limitations.length === 0)
    )
      reasons.push(`${review.specialty} needs a limitation when no checks were run`);
    if (!Array.isArray(review.limitations) || review.limitations.some((item) => !nonEmpty(item)))
      reasons.push(`${review.specialty} limitations are malformed`);
    if (!Array.isArray(review.findings))
      reasons.push(`${review.specialty} findings must be an array`);
  }
  if (reviews.size !== 4 || SPECIALTIES.some((specialty) => !reviews.has(specialty)))
    reasons.push('report is missing a required specialty');
  const findingIds = new Set();
  for (const review of report.reviews) {
    if (!Array.isArray(review?.findings)) continue;
    for (const finding of review.findings) {
      const problem = validateFinding(finding, root, findingIds, verifiedTaskIds);
      if (problem) reasons.push(`${review.specialty}: ${problem}`);
    }
  }
  if (report.reviews.some((review) => review?.status !== 'completed'))
    reasons.push('one or more reviews are not completed');
  return reasons;
}

function check(rootPath, feature) {
  const prepared = prepare(rootPath, feature);
  if (prepared.status === 'invalid')
    return { status: 'invalid', feature, reasons: prepared.reasons };
  if (prepared.status !== 'ready')
    return {
      status: 'pending-review',
      feature: prepared.feature,
      reasons: prepared.reasons,
      pendingTasks: prepared.pendingTasks,
    };
  const root = realpathSync(rootPath);
  const tasksPath = path.join(root, prepared.feature, 'tasks.md');
  const verifiedTaskIds = new Set(
    parseTasks(readFileSync(tasksPath, 'utf8'))
      .filter((task) => task.checked && !task.disposition)
      .map((task) => task.id),
  );
  const reportRelative = `${prepared.feature}/reviews/completion-review.json`;
  const reportSafe = safeRelativePath(root, reportRelative);
  if (!reportSafe)
    return {
      status: 'pending-review',
      feature: prepared.feature,
      reasons: ['review report path is unsafe'],
    };
  try {
    assertNoSymlinkPath(root, reportSafe.absolute);
    if (!existsSync(reportSafe.absolute))
      return {
        status: 'pending-review',
        feature: prepared.feature,
        reasons: ['completion review report is missing'],
      };
    let report;
    try {
      report = JSON.parse(readFileSync(reportSafe.absolute, 'utf8'));
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          status: 'pending-review',
          feature: prepared.feature,
          reasons: ['completion review report is malformed JSON'],
        };
      }
      throw error;
    }
    const reasons = validateReport(
      report,
      root,
      prepared.feature,
      prepared.snapshot,
      verifiedTaskIds,
    );
    if (reasons.length) return { status: 'pending-review', feature: prepared.feature, reasons };
    const openBlockers = report.reviews
      .flatMap((review) => review.findings)
      .filter(
        (finding) =>
          ['CRITICAL', 'HIGH'].includes(finding.severity) && finding.disposition === 'open',
      );
    if (openBlockers.length)
      return {
        status: 'blocked',
        feature: prepared.feature,
        reasons: [`${openBlockers.length} open CRITICAL/HIGH finding(s)`],
      };
    const undisposed = report.reviews
      .flatMap((review) => review.findings)
      .filter((finding) => finding.disposition === 'open');
    if (undisposed.length)
      return {
        status: 'pending-review',
        feature: prepared.feature,
        reasons: [`${undisposed.length} MEDIUM/LOW finding(s) need a disposition`],
      };
    return {
      status: 'passed',
      feature: prepared.feature,
      snapshot: prepared.snapshot,
      reasons: [],
    };
  } catch (error) {
    return { status: 'pending-review', feature: prepared.feature, reasons: [safeError(error)] };
  }
}

function parseArgs(argv) {
  const [command, ...args] = argv;
  if (!['prepare', 'check'].includes(command))
    throw new Error('usage: spec-review.mjs <prepare|check> --feature specs/<feature>');
  let feature;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--feature' && args[index + 1] && !feature) {
      feature = args[index + 1];
      index += 1;
    } else {
      throw new Error('usage: spec-review.mjs <prepare|check> --feature specs/<feature>');
    }
  }
  if (!feature) throw new Error('usage: spec-review.mjs <prepare|check> --feature specs/<feature>');
  return { command, feature };
}

export { check, parseTasks, prepare, snapshotFor, validateReport };

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  let output;
  let exitCode;
  try {
    const { command, feature } = parseArgs(process.argv.slice(2));
    output =
      command === 'prepare' ? prepare(process.cwd(), feature) : check(process.cwd(), feature);
    exitCode =
      output.status === 'ready' || output.status === 'passed'
        ? 0
        : output.status === 'invalid'
          ? 2
          : 1;
  } catch (error) {
    output = { status: 'invalid', reasons: [safeError(error)] };
    exitCode = 2;
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = exitCode;
}
