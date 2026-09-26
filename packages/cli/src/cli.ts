#!/usr/bin/env node
/**
 * Atelier MCP CLI
 * 
 * Install, manage, and control Atelier MCP in website projects.
 * Operations: install, uninstall, doctor, update, dry-run
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';

const VERSION = '0.1.0';

// ─── Utilities ──────────────────────────────────────────────────

function log(msg: string) {
  console.error(chalk.dim(`[atelier] ${msg}`));
}

function success(msg: string) {
  console.error(chalk.green(`✓ ${msg}`));
}

function error(msg: string) {
  console.error(chalk.red(`✗ ${msg}`));
}

interface SystemInfo {
  os: string;
  arch: string;
  nodeVersion: string;
  nodeCompatible: boolean;
  platform: NodeJS.Platform;
}

function getSystemInfo(): SystemInfo {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  return {
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    nodeVersion,
    nodeCompatible: major >= 20,
    platform: process.platform,
  };
}

function detectPackageManager(projectDir: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (fs.existsSync(path.join(projectDir, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectFramework(projectDir: string): { framework: string; version: string } {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return { framework: 'unknown', version: '' };

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps['next']) return { framework: 'nextjs', version: deps['next'] };
  if (deps['vite'] && (deps['react'] || deps['react-dom'])) return { framework: 'react-vite', version: deps['vite'] };
  return { framework: 'unknown', version: '' };
}

function resolveCanonicalPath(p: string): string {
  const resolved = path.resolve(p);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function validateProjectPath(projectDir: string): string {
  const canonical = resolveCanonicalPath(projectDir);
  if (!fs.existsSync(canonical)) {
    throw new Error(`Directory does not exist: ${canonical}`);
  }
  const stat = fs.statSync(canonical);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${canonical}`);
  }
  return canonical;
}

// ─── Backup & State Management ──────────────────────────────────

interface InstallManifest {
  version: string;
  atelierSourceDir: string;
  atelierSourceCommit: string;
  projectDir: string;
  framework: string;
  installedAt: string;
  updatedAt: string;
  ownedFiles: string[];
  modifiedFiles: Array<{ file: string; backupPath: string }>;
  mcpConfigured: boolean;
  skillInstalled: boolean;
}

function getAtelierDir(projectDir: string): string {
  return path.join(projectDir, '.atelier');
}

function getManifestPath(projectDir: string): string {
  return path.join(getAtelierDir(projectDir), 'manifest.json');
}

function loadManifest(projectDir: string): InstallManifest | null {
  const mp = getManifestPath(projectDir);
  if (!fs.existsSync(mp)) return null;
  return JSON.parse(fs.readFileSync(mp, 'utf-8'));
}

function saveManifest(manifest: InstallManifest): void {
  const dir = getAtelierDir(manifest.projectDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getManifestPath(manifest.projectDir), JSON.stringify(manifest, null, 2));
}

// ─── Git Operations ─────────────────────────────────────────────

function resolveGitRef(repoUrl: string, ref: string | undefined): { url: string; commit: string; tempDir: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-'));

  try {
    // Clone with depth 1
    const args = ['clone', '--depth', '1'];
    if (ref) args.push('--branch', ref);
    args.push(repoUrl, tempDir);

    execSync(`git ${args.join(' ')}`, { stdio: 'pipe', timeout: 60000 });

    // Get the resolved commit
    const commit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf-8' }).trim();

    return { url: repoUrl, commit, tempDir };
  } catch (e) {
    // Cleanup on failure
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* */ }
    throw new Error(`Failed to clone repository: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── Claude Code Integration ────────────────────────────────────

function configureClaudeCode(projectDir: string, atelierSourceDir: string, dryRun: boolean): { configured: boolean; details: string } {
  // Claude Code uses ~/.claude/settings.json or scoped settings
  // We use the CLI command approach: claude mcp add
  const serverScript = path.join(atelierSourceDir, 'packages', 'server', 'src', 'index.ts');

  if (dryRun) {
    return {
      configured: false,
      details: `Would run: claude mcp add atelier-mcp --scope "${projectDir}" -- npx tsx "${serverScript}"`
    };
  }

  try {
    // Check if claude CLI is available
    execSync('claude --version', { stdio: 'pipe', timeout: 5000 });

    // Add MCP server with project scope
    const cmd = `claude mcp add atelier-mcp --scope "${projectDir}" -- npx tsx "${serverScript}"`;
    log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'pipe', timeout: 15000 });

    return { configured: true, details: 'MCP server registered with Claude Code' };
  } catch {
    // Fallback: create manual config instructions
    const configContent = {
      mcpServers: {
        'atelier-mcp': {
          command: 'npx',
          args: ['tsx', serverScript],
          scope: projectDir
        }
      }
    };

    // Write a helper config file
    const configPath = path.join(getAtelierDir(projectDir), 'claude-mcp-config.json');
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

    return {
      configured: false,
      details: `Claude Code CLI not found. Manual setup needed:\n  claude mcp add atelier-mcp -- npx tsx "${serverScript}"\n  Config saved to: ${configPath}`
    };
  }
}

// ─── Companion Skill/Instruction ────────────────────────────────

function installCompanionSkill(projectDir: string, dryRun: boolean): boolean {
  const skillContent = `# Atelier MCP — Design Assistant

When working on UI, design, or frontend tasks for this project:

1. **Inspect first**: Call \`inspect_project\` to understand the existing stack, components, tokens, and conventions.
2. **Consult Atelier**: Use \`search_recipes\` to find appropriate design patterns and animations.
3. **Plan before changing**: Use \`prepare_design\` to create a structured plan with design tokens and file changes.
4. **Preview and validate**: Use \`preview_changes\` before applying.
5. **Capture results**: After changes, use \`capture_preview\` for screenshots and \`audit_ui\` for accessibility checks.
6. **Iterate**: Fix any audit issues and re-validate.

## Important Notes
- The host (you) controls whether tools are called — Atelier provides capabilities but cannot enforce usage.
- Preserve existing brand conventions and user-authored styles.
- Respect \`prefers-reduced-motion\` in all animation work.
- This instruction file was installed by Atelier MCP and can be safely removed.

## Available Tools
- \`inspect_project\` — Detect stack, routes, components, tokens
- \`search_recipes\` / \`get_recipe\` — Find and retrieve design recipes
- \`prepare_design\` — Create a design plan with tokens and changes
- \`preview_changes\` / \`apply_changes\` — Preview and apply plans
- \`capture_preview\` — Take screenshots at multiple viewports
- \`audit_ui\` — Run accessibility and performance checks
- \`monitor_project\` — View project graph and events
- \`rollback_changes\` — Revert Atelier changes
`;

  if (dryRun) {
    log('Would create CLAUDE.md companion skill');
    return false;
  }

  // Check for existing CLAUDE.md
  const claudePath = path.join(projectDir, 'CLAUDE.md');
  if (fs.existsSync(claudePath)) {
    const existing = fs.readFileSync(claudePath, 'utf-8');
    if (existing.includes('Atelier MCP')) {
      log('CLAUDE.md already contains Atelier instructions');
      return true;
    }
    // Append without overwriting
    const separator = '\n\n---\n\n';
    fs.writeFileSync(claudePath, existing + separator + skillContent);
    log('Appended Atelier instructions to existing CLAUDE.md');
  } else {
    fs.writeFileSync(claudePath, skillContent);
    log('Created CLAUDE.md companion skill');
  }

  return true;
}

// ─── Commands ───────────────────────────────────────────────────

const program = new Command();

program
  .name('atelier')
  .description('Atelier MCP — Design assistant for AI coding clients')
  .version(VERSION);

// ─── install ────────────────────────────────────────────────────

program
  .command('install')
  .description('Install Atelier MCP into a website project')
  .argument('[project-dir]', 'Target project directory', '.')
  .option('--repo <url>', 'Atelier source repository URL')
  .option('--ref <ref>', 'Git reference (branch, tag, or commit)')
  .option('--source <path>', 'Local Atelier source directory (instead of repo)')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--skip-mcp', 'Skip MCP client configuration')
  .option('--skip-skill', 'Skip companion skill installation')
  .action(async (projectDirArg: string, options: {
    repo?: string; ref?: string; source?: string;
    dryRun?: boolean; skipMcp?: boolean; skipSkill?: boolean;
  }) => {
    const spinner = ora('Initializing...').start();

    try {
      // Validate project directory
      const projectDir = validateProjectPath(projectDirArg);
      spinner.text = `Project directory: ${projectDir}`;

      // Check system compatibility
      const sys = getSystemInfo();
      if (!sys.nodeCompatible) {
        spinner.fail(`Node.js ${sys.nodeVersion} is not supported. Requires Node >= 20.`);
        process.exit(1);
      }

      // Check for existing installation
      const existingManifest = loadManifest(projectDir);
      if (existingManifest) {
        spinner.info('Atelier is already installed in this project.');
        log(`Installed version: ${existingManifest.version}`);
        log(`Source: ${existingManifest.atelierSourceDir}`);
        log('Use "atelier update" to update, or "atelier uninstall" first.');
        return;
      }

      // Detect project framework
      const { framework, version } = detectFramework(projectDir);
      if (framework === 'unknown') {
        spinner.fail('Unsupported project. Atelier requires React+Vite or Next.js.');
        error('Detected no supported framework in package.json.');
        error('Supported: React with Vite, Next.js');
        process.exit(1);
      }

      const pm = detectPackageManager(projectDir);
      spinner.succeed(`Detected ${framework} ${version} with ${pm}`);

      // Resolve Atelier source
      let atelierSourceDir: string;
      let atelierCommit = 'local';

      if (options.source) {
        atelierSourceDir = resolveCanonicalPath(options.source);
        if (!fs.existsSync(path.join(atelierSourceDir, 'package.json'))) {
          error(`Not a valid Atelier source directory: ${atelierSourceDir}`);
          process.exit(1);
        }
        success(`Using local Atelier source: ${atelierSourceDir}`);
      } else if (options.repo) {
        spinner.start('Cloning Atelier repository...');
        const result = resolveGitRef(options.repo, options.ref);
        atelierSourceDir = result.tempDir;
        atelierCommit = result.commit;
        spinner.succeed(`Cloned at commit ${atelierCommit.slice(0, 8)}`);
      } else {
        // Default: use the current directory's parent if it looks like the Atelier source
        const possibleSource = path.resolve(__dirname, '..', '..', '..');
        if (fs.existsSync(path.join(possibleSource, 'packages', 'server', 'src', 'index.ts'))) {
          atelierSourceDir = possibleSource;
          success(`Using local Atelier source: ${atelierSourceDir}`);
        } else {
          error('No --source or --repo provided, and cannot find Atelier source automatically.');
          error('Usage: atelier install --source /path/to/atelier-mcp <project-dir>');
          process.exit(1);
        }
      }

      if (options.dryRun) {
        console.log(chalk.cyan('\n── Dry Run ─────────────────────────────'));
        console.log(`Project:      ${projectDir}`);
        console.log(`Framework:    ${framework} ${version}`);
        console.log(`Package Mgr:  ${pm}`);
        console.log(`Atelier Src:  ${atelierSourceDir}`);
        console.log(`Commit:       ${atelierCommit}`);
        console.log(`\nWould create:`);
        console.log(`  .atelier/              — State directory`);
        console.log(`  .atelier/manifest.json — Installation manifest`);
        console.log(`  CLAUDE.md              — Companion skill (unless exists)`);
        console.log(`\nWould configure:`);
        const mcpResult = configureClaudeCode(projectDir, atelierSourceDir, true);
        console.log(`  MCP: ${mcpResult.details}`);
        console.log(chalk.cyan('────────────────────────────────────────\n'));
        return;
      }

      // Create .atelier directory
      spinner.start('Setting up Atelier...');
      const atelierDir = getAtelierDir(projectDir);
      fs.mkdirSync(path.join(atelierDir, 'backups'), { recursive: true });
      fs.mkdirSync(path.join(atelierDir, 'plans'), { recursive: true });
      fs.mkdirSync(path.join(atelierDir, 'changes'), { recursive: true });
      fs.mkdirSync(path.join(atelierDir, 'captures'), { recursive: true });
      spinner.succeed('Created .atelier directory');

      // Install companion skill
      const ownedFiles: string[] = ['.atelier'];
      let skillInstalled = false;
      if (!options.skipSkill) {
        skillInstalled = installCompanionSkill(projectDir, false);
        if (skillInstalled) ownedFiles.push('CLAUDE.md');
      }

      // Configure MCP client
      let mcpConfigured = false;
      if (!options.skipMcp) {
        spinner.start('Configuring MCP client...');
        const mcpResult = configureClaudeCode(projectDir, atelierSourceDir, false);
        mcpConfigured = mcpResult.configured;
        if (mcpConfigured) {
          spinner.succeed('MCP server registered with Claude Code');
        } else {
          spinner.warn(mcpResult.details);
        }
      }

      // Save manifest
      const manifest: InstallManifest = {
        version: VERSION,
        atelierSourceDir,
        atelierSourceCommit: atelierCommit,
        projectDir,
        framework,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownedFiles,
        modifiedFiles: [],
        mcpConfigured,
        skillInstalled,
      };
      saveManifest(manifest);

      // Add .atelier to .gitignore if not present
      const gitignorePath = path.join(projectDir, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        if (!content.includes('.atelier')) {
          fs.appendFileSync(gitignorePath, '\n# Atelier MCP state\n.atelier/\n');
          success('Added .atelier to .gitignore');
        }
      }

      // Final summary
      console.log(chalk.green('\n✓ Atelier MCP installed successfully!\n'));
      console.log(`  Project:    ${projectDir}`);
      console.log(`  Framework:  ${framework} ${version}`);
      console.log(`  Source:     ${atelierSourceDir}`);
      console.log(`  Skill:     ${skillInstalled ? 'CLAUDE.md installed' : 'Skipped'}`);
      console.log(`  MCP:       ${mcpConfigured ? 'Configured' : 'Manual setup needed'}`);

      if (!mcpConfigured) {
        console.log(chalk.yellow('\n  To complete MCP setup, run:'));
        console.log(chalk.dim(`  claude mcp add atelier-mcp -- npx tsx "${path.join(atelierSourceDir, 'packages', 'server', 'src', 'index.ts')}"`));
      }

      console.log(chalk.dim('\n  Run "atelier doctor" to verify the installation.'));

    } catch (e) {
      spinner.fail(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

// ─── uninstall ──────────────────────────────────────────────────

program
  .command('uninstall')
  .description('Remove Atelier MCP from a website project')
  .argument('[project-dir]', 'Target project directory', '.')
  .option('--keep-skill', 'Keep the companion skill (CLAUDE.md additions)')
  .option('--dry-run', 'Show what would be done')
  .action(async (projectDirArg: string, options: { keepSkill?: boolean; dryRun?: boolean }) => {
    const projectDir = validateProjectPath(projectDirArg);
    const manifest = loadManifest(projectDir);

    if (!manifest) {
      error('Atelier is not installed in this project.');
      process.exit(1);
    }

    if (options.dryRun) {
      console.log(chalk.cyan('Dry Run — Would remove:'));
      console.log(`  .atelier/ directory`);
      if (!options.keepSkill) console.log(`  Atelier section from CLAUDE.md`);
      console.log(`  MCP server configuration (if auto-configured)`);
      return;
    }

    const spinner = ora('Uninstalling Atelier...').start();

    // Remove MCP configuration
    try {
      execSync('claude mcp remove atelier-mcp', { stdio: 'pipe', timeout: 5000 });
      success('Removed MCP server from Claude Code');
    } catch {
      log('Could not auto-remove MCP config. Run: claude mcp remove atelier-mcp');
    }

    // Remove companion skill content from CLAUDE.md
    if (!options.keepSkill) {
      const claudePath = path.join(projectDir, 'CLAUDE.md');
      if (fs.existsSync(claudePath)) {
        const content = fs.readFileSync(claudePath, 'utf-8');
        if (content.includes('# Atelier MCP')) {
          // Remove Atelier section
          const parts = content.split('---');
          const filtered = parts.filter(p => !p.includes('Atelier MCP'));
          if (filtered.join('').trim() === '') {
            fs.unlinkSync(claudePath);
            log('Removed CLAUDE.md (was Atelier-only)');
          } else {
            fs.writeFileSync(claudePath, filtered.join('---').trim() + '\n');
            log('Removed Atelier section from CLAUDE.md');
          }
        }
      }
    }

    // Remove .atelier directory
    const atelierDir = getAtelierDir(projectDir);
    if (fs.existsSync(atelierDir)) {
      fs.rmSync(atelierDir, { recursive: true, force: true });
    }

    spinner.succeed('Atelier MCP uninstalled successfully.');
  });

// ─── doctor ─────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Verify the Atelier MCP installation')
  .argument('[project-dir]', 'Target project directory', '.')
  .action(async (projectDirArg: string) => {
    const projectDir = validateProjectPath(projectDirArg);
    console.log(chalk.bold('\n🔍 Atelier MCP Doctor\n'));

    const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; detail: string }> = [];

    // System checks
    const sys = getSystemInfo();
    checks.push({
      name: 'Node.js version',
      status: sys.nodeCompatible ? 'pass' : 'fail',
      detail: `${sys.nodeVersion} (requires >= 20)`
    });

    checks.push({
      name: 'Operating system',
      status: 'pass',
      detail: sys.os
    });

    // Project checks
    const { framework, version } = detectFramework(projectDir);
    checks.push({
      name: 'Framework detected',
      status: framework !== 'unknown' ? 'pass' : 'fail',
      detail: framework !== 'unknown' ? `${framework} ${version}` : 'No supported framework found'
    });

    const pm = detectPackageManager(projectDir);
    checks.push({
      name: 'Package manager',
      status: 'pass',
      detail: pm
    });

    // Installation checks
    const manifest = loadManifest(projectDir);
    checks.push({
      name: 'Atelier installed',
      status: manifest ? 'pass' : 'fail',
      detail: manifest ? `v${manifest.version} (${manifest.installedAt})` : 'Not installed'
    });

    if (manifest) {
      checks.push({
        name: 'Source directory',
        status: fs.existsSync(manifest.atelierSourceDir) ? 'pass' : 'warn',
        detail: manifest.atelierSourceDir
      });

      checks.push({
        name: 'MCP configured',
        status: manifest.mcpConfigured ? 'pass' : 'warn',
        detail: manifest.mcpConfigured ? 'Yes' : 'Manual setup may be needed'
      });

      checks.push({
        name: 'Companion skill',
        status: manifest.skillInstalled ? 'pass' : 'warn',
        detail: manifest.skillInstalled ? 'CLAUDE.md installed' : 'Not installed'
      });

      // Check server can start
      const serverPath = path.join(manifest.atelierSourceDir, 'packages', 'server', 'src', 'index.ts');
      checks.push({
        name: 'Server source',
        status: fs.existsSync(serverPath) ? 'pass' : 'fail',
        detail: fs.existsSync(serverPath) ? 'Found' : `Missing: ${serverPath}`
      });

      // Check tsx availability
      try {
        execSync('npx tsx --version', { stdio: 'pipe', timeout: 10000 });
        checks.push({ name: 'tsx runtime', status: 'pass', detail: 'Available' });
      } catch {
        checks.push({ name: 'tsx runtime', status: 'warn', detail: 'Not found — install: npm install -g tsx' });
      }
    }

    // Print results
    for (const check of checks) {
      const icon = check.status === 'pass' ? chalk.green('✓') : check.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
      console.log(`  ${icon} ${check.name}: ${chalk.dim(check.detail)}`);
    }

    const failures = checks.filter(c => c.status === 'fail');
    if (failures.length > 0) {
      console.log(chalk.red(`\n  ${failures.length} issue(s) found.\n`));
      process.exit(1);
    } else {
      console.log(chalk.green('\n  All checks passed.\n'));
    }
  });

// ─── update ─────────────────────────────────────────────────────

program
  .command('update')
  .description('Update Atelier MCP to the latest version')
  .argument('[project-dir]', 'Target project directory', '.')
  .option('--source <path>', 'Updated Atelier source directory')
  .action(async (projectDirArg: string, options: { source?: string }) => {
    const projectDir = validateProjectPath(projectDirArg);
    const manifest = loadManifest(projectDir);

    if (!manifest) {
      error('Atelier is not installed. Run "atelier install" first.');
      process.exit(1);
    }

    const spinner = ora('Updating Atelier...').start();

    if (options.source) {
      const newSource = resolveCanonicalPath(options.source);
      manifest.atelierSourceDir = newSource;
      manifest.updatedAt = new Date().toISOString();
      saveManifest(manifest);
      spinner.succeed(`Updated source to: ${newSource}`);
    } else {
      spinner.info('No --source provided. Re-run with --source <path> or --repo <url>');
    }
  });

// ─── serve ──────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the MCP server directly (for debugging)')
  .action(async () => {
    const serverPath = path.resolve(__dirname, '..', '..', 'server', 'src', 'index.ts');
    if (!fs.existsSync(serverPath)) {
      error(`Server source not found: ${serverPath}`);
      process.exit(1);
    }

    log(`Starting MCP server from ${serverPath}`);
    const child = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      shell: true
    });

    child.stdout?.pipe(process.stdout);
    process.stdin.pipe(child.stdin!);

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

// ─── Parse ──────────────────────────────────────────────────────

program.parse();
