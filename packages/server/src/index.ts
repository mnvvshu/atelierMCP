#!/usr/bin/env node
/**
 * Atelier MCP Server
 * 
 * MCP server exposing design assistant tools over stdio.
 * Uses @modelcontextprotocol/server v2 with zod schema validation.
 * 
 * IMPORTANT: stdout is reserved for JSON-RPC. All logs go to stderr.
 */

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod/v4';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ─── Logging (stderr only) ───────────────────────────────────────

function log(level: string, msg: string, data?: unknown) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(data ? { data } : {}) };
  process.stderr.write(JSON.stringify(entry) + '\n');
}

// ─── Event Emitter for Monitor ───────────────────────────────────

interface AtelierEvent {
  id: string;
  type: 'tool_call' | 'change_applied' | 'audit_result' | 'error' | 'info';
  tool?: string;
  data: unknown;
  timestamp: string;
  projectDir?: string;
}

const eventHistory: AtelierEvent[] = [];
const MAX_EVENTS = 500;

function emitEvent(event: Omit<AtelierEvent, 'id' | 'timestamp'>) {
  const dataProjectDir = event.data && typeof event.data === 'object' && 'projectDir' in event.data
    ? event.data.projectDir : undefined;
  const projectDir = event.projectDir || (typeof dataProjectDir === 'string' ? dataProjectDir : undefined);
  const full: AtelierEvent = {
    ...event,
    ...(projectDir ? { projectDir } : {}),
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
  eventHistory.push(full);
  if (eventHistory.length > MAX_EVENTS) eventHistory.shift();
  if (projectDir) {
    try {
      const canonical = validateProjectPath(projectDir);
      full.projectDir = canonical;
      const eventsDir = path.join(getAtelierDir(canonical), 'events');
      fs.mkdirSync(eventsDir, { recursive: true });
      fs.writeFileSync(path.join(eventsDir, `${full.id}.json`), JSON.stringify(full));
    } catch (error) {
      log('warn', 'Could not persist monitor event', { message: String(error) });
    }
  }
  log('event', `${event.type}: ${event.tool || ''}`, event.data);
}

// ─── State Management ────────────────────────────────────────────

interface DesignPlan {
  id: string;
  projectDir: string;
  brief: string;
  direction: {
    name: string;
    description: string;
    typography: string;
    colors: string;
    composition: string;
    motion: string;
    signature: string;
  };
  tokens: Record<string, string>;
  selectedRecipes: string[];
  changes: PlannedChange[];
  status: 'draft' | 'previewed' | 'applied' | 'rolled_back';
  createdAt: string;
  updatedAt: string;
}

interface PlannedChange {
  file: string;
  action: 'create' | 'modify' | 'delete';
  content?: string;
  patch?: string;
  dependencies?: string[];
  description: string;
}

interface ChangeRecord {
  id: string;
  planId: string;
  projectDir: string;
  changes: AppliedChange[];
  timestamp: string;
  status: 'applied' | 'rolled_back' | 'partial';
}

interface AppliedChange {
  file: string;
  action: 'create' | 'modify' | 'delete';
  backupPath?: string;
  originalContent?: string;
  appliedContent?: string;
  reverted?: boolean;
}

function getAtelierDir(projectDir: string): string {
  return path.join(projectDir, '.atelier');
}

function ensureAtelierDir(projectDir: string): string {
  const dir = getAtelierDir(projectDir);
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'plans'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'changes'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'captures'), { recursive: true });
  return dir;
}

function savePlan(plan: DesignPlan): void {
  const dir = ensureAtelierDir(plan.projectDir);
  fs.writeFileSync(
    path.join(dir, 'plans', `${plan.id}.json`),
    JSON.stringify(plan, null, 2)
  );
}

function loadPlan(projectDir: string, planId: string): DesignPlan | null {
  if (!/^[\w-]+$/.test(planId)) throw new Error('Invalid plan ID');
  const fp = path.join(getAtelierDir(projectDir), 'plans', `${planId}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function saveChangeRecord(record: ChangeRecord): void {
  const dir = ensureAtelierDir(record.projectDir);
  fs.writeFileSync(
    path.join(dir, 'changes', `${record.id}.json`),
    JSON.stringify(record, null, 2)
  );
}

function loadChangeRecord(projectDir: string, recordId: string): ChangeRecord | null {
  if (!/^[\w-]+$/.test(recordId)) throw new Error('Invalid change record ID');
  const fp = path.join(getAtelierDir(projectDir), 'changes', `${recordId}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

// ─── Path Validation ─────────────────────────────────────────────

function validateProjectPath(projectDir: string): string {
  const resolved = path.resolve(projectDir);
  // Resolve symlinks
  let canonical: string;
  try {
    canonical = fs.realpathSync(resolved);
  } catch {
    throw new Error(`Project directory does not exist: ${resolved}`);
  }

  // Check it's a directory
  const stat = fs.statSync(canonical);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${canonical}`);
  }

  return canonical;
}

function validateFilePath(projectDir: string, filePath: string): string {
  const canonical = path.resolve(projectDir, filePath);
  const isInside = (target: string) => {
    const relative = path.relative(projectDir, target);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (!isInside(canonical)) {
    throw new Error(`Path escapes project directory: ${filePath}`);
  }
  // Check the closest existing ancestor so symlinked directories cannot escape.
  let ancestor = canonical;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== projectDir && !isInside(realAncestor)) {
    throw new Error(`Path escapes project directory through a symlink: ${filePath}`);
  }
  return canonical;
}

// ─── Server Setup ────────────────────────────────────────────────

const server = new McpServer({
  name: 'atelier-mcp',
  version: '0.1.0',
});

// ─── Tool: inspect_project ──────────────────────────────────────

server.registerTool(
  'inspect_project',
  {
    description: 'Detect the project stack, routes, components, design tokens, assets, and existing conventions. Run this first before any design work.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project directory'),
    },
  },
  async ({ projectDir }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'inspect_project', data: { projectDir: canonical } });

    // Import adapters dynamically to avoid startup cost
    const pkgPath = path.join(canonical, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'No package.json found. This may not be a Node.js project.',
            projectDir: canonical,
            suggestion: 'Initialize a project with npm init or create a React+Vite/Next.js project first.'
          }, null, 2)
        }]
      };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect framework
    let framework = 'unknown';
    let frameworkVersion = '';
    if (deps['next']) { framework = 'nextjs'; frameworkVersion = deps['next']; }
    else if (deps['vite'] && (deps['react'] || deps['react-dom'])) { framework = 'react-vite'; frameworkVersion = deps['vite']; }

    // Detect package manager
    let packageManager = 'npm';
    let hasLockfile = false;
    const lockfiles: Array<[string, string]> = [
      ['package-lock.json', 'npm'], ['yarn.lock', 'yarn'],
      ['pnpm-lock.yaml', 'pnpm'], ['bun.lockb', 'bun']
    ];
    for (const [file, pm] of lockfiles) {
      if (fs.existsSync(path.join(canonical, file))) {
        packageManager = pm;
        hasLockfile = true;
        break;
      }
    }

    // Detect TypeScript
    const typescript = fs.existsSync(path.join(canonical, 'tsconfig.json'));

    // Detect src dir
    let srcDir = canonical;
    if (fs.existsSync(path.join(canonical, 'src'))) srcDir = path.join(canonical, 'src');
    else if (fs.existsSync(path.join(canonical, 'app'))) srcDir = path.join(canonical, 'app');

    // Scan components
    const components: Array<{ name: string; file: string }> = [];
    function walkComponents(dir: string) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fp = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walkComponents(fp);
          } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
            const content = fs.readFileSync(fp, 'utf-8');
            const matches = content.matchAll(/export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w*)/g);
            for (const m of matches) {
              components.push({ name: m[1], file: path.relative(canonical, fp).replace(/\\/g, '/') });
            }
          }
        }
      } catch { /* skip */ }
    }
    walkComponents(srcDir);

    // Scan config files
    const configFiles: string[] = [];
    const configPatterns = [
      'vite.config.ts', 'vite.config.js', 'next.config.ts', 'next.config.js', 'next.config.mjs',
      'tailwind.config.ts', 'tailwind.config.js', 'tsconfig.json', 'eslint.config.js'
    ];
    for (const p of configPatterns) {
      if (fs.existsSync(path.join(canonical, p))) configFiles.push(p);
    }

    // Scan tokens from CSS
    const tokens: Record<string, string> = {};
    const cssFiles = ['globals.css', 'index.css', 'app.css', 'styles.css'];
    for (const dir of [srcDir, path.join(canonical, 'styles'), path.join(canonical, 'app')]) {
      for (const cssFile of cssFiles) {
        const fp = path.join(dir, cssFile);
        if (fs.existsSync(fp)) {
          const content = fs.readFileSync(fp, 'utf-8');
          const regex = /--([\w-]+)\s*:\s*([^;]+);/g;
          let match;
          while ((match = regex.exec(content)) !== null) {
            tokens[`--${match[1]}`] = match[2].trim();
          }
        }
      }
    }

    const result = {
      projectDir: canonical,
      framework,
      frameworkVersion,
      packageManager,
      nodeVersion: process.version,
      typescript,
      hasLockfile,
      srcDir: path.relative(canonical, srcDir) || '.',
      configFiles,
      components: components.slice(0, 50), // Bounded output
      tokens,
      conventions: [] as string[],
      supported: framework !== 'unknown'
    };

    if (!result.supported) {
      result.conventions.push('Unsupported framework. Atelier currently supports React+Vite and Next.js.');
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
    };
  }
);

// ─── Tool: search_recipes ───────────────────────────────────────

server.registerTool(
  'search_recipes',
  {
    description: 'Search the design and motion recipe catalog by purpose, aesthetic, framework, accessibility needs, or performance cost.',
    inputSchema: {
      purpose: z.string().optional().describe('What the recipe is for (e.g., "text animation", "hero section", "button feedback")'),
      aesthetic: z.string().optional().describe('Visual style (e.g., "editorial", "premium", "minimal")'),
      framework: z.string().optional().describe('Target framework ("react-vite" or "nextjs")'),
      category: z.string().optional().describe('Recipe category'),
      maxCost: z.enum(['low', 'medium', 'high']).optional().describe('Maximum resource cost'),
    },
  },
  async (query) => {
    emitEvent({ type: 'tool_call', tool: 'search_recipes', data: query });

    // Inline recipe search to avoid import issues with workspace references
    const recipeSummaries = getBuiltinRecipeSummaries();
    let results = recipeSummaries;

    if (query.purpose) {
      const p = query.purpose.toLowerCase();
      results = results.filter(r => r.purpose.toLowerCase().includes(p) || r.suitableContexts.some((c: string) => c.toLowerCase().includes(p)));
    }
    if (query.aesthetic) {
      const a = query.aesthetic.toLowerCase();
      results = results.filter(r => r.aesthetic.some((ae: string) => ae.toLowerCase().includes(a)));
    }
    if (query.category) {
      results = results.filter(r => r.category === query.category);
    }
    if (query.framework) {
      const fw = query.framework.toLowerCase();
      results = results.filter(r => r.frameworks.some((f: { name: string }) => f.name.toLowerCase().includes(fw)));
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          total: results.length,
          recipes: results.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            purpose: r.purpose,
            aesthetic: r.aesthetic,
            resourceCost: r.resourceCost
          }))
        }, null, 2)
      }]
    };
  }
);

// ─── Tool: get_recipe ───────────────────────────────────────────

server.registerTool(
  'get_recipe',
  {
    description: 'Get full implementation details for a specific recipe including code, dependencies, preview, license, and accessibility info.',
    inputSchema: {
      id: z.string().describe('Recipe ID from search_recipes results'),
    },
  },
  async ({ id }) => {
    emitEvent({ type: 'tool_call', tool: 'get_recipe', data: { id } });

    const recipe = getBuiltinRecipe(id);
    if (!recipe) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Recipe not found: ${id}` }) }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(recipe, null, 2) }]
    };
  }
);

// ─── Tool: prepare_design ───────────────────────────────────────

server.registerTool(
  'prepare_design',
  {
    description: 'Assemble project context and a structured design plan. The connected model should interpret the brief and make creative decisions. Persist the selected design direction.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project'),
      brief: z.string().describe('Design brief describing the desired outcome'),
      direction: z.object({
        name: z.string().describe('Name for this design direction'),
        description: z.string().describe('Overall description of the direction'),
        typography: z.string().describe('Typography choices and rationale'),
        colors: z.string().describe('Color palette and rationale'),
        composition: z.string().describe('Layout and composition approach'),
        motion: z.string().describe('Motion and animation strategy'),
        signature: z.string().describe('Signature interaction or memorable detail'),
      }).describe('The selected design direction'),
      tokens: z.record(z.string(), z.string()).describe('Design tokens as CSS custom properties'),
      selectedRecipes: z.array(z.string()).describe('Recipe IDs to use'),
      changes: z.array(z.object({
        file: z.string().describe('Relative file path'),
        action: z.enum(['create', 'modify', 'delete']),
        content: z.string().optional().describe('File content for create/modify'),
        description: z.string().describe('What this change does'),
        dependencies: z.array(z.string()).optional().describe('npm packages to install'),
      })).describe('Planned file changes'),
    },
  },
  async ({ projectDir, brief, direction, tokens, selectedRecipes, changes }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'prepare_design', data: { projectDir: canonical, brief } });
    for (const change of changes) {
      validateFilePath(canonical, change.file);
      if (change.action !== 'delete' && change.content === undefined) {
        throw new Error(`File content is required for ${change.action}: ${change.file}`);
      }
    }

    const plan: DesignPlan = {
      id: crypto.randomUUID(),
      projectDir: canonical,
      brief,
      direction,
      tokens,
      selectedRecipes,
      changes,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savePlan(plan);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          planId: plan.id,
          status: 'draft',
          direction: plan.direction.name,
          tokenCount: Object.keys(tokens).length,
          recipeCount: selectedRecipes.length,
          changeCount: changes.length,
          files: changes.map(c => ({ file: c.file, action: c.action, description: c.description })),
          message: 'Design plan saved. Use preview_changes to see exact effects, then apply_changes to implement.'
        }, null, 2)
      }]
    };
  }
);

// ─── Tool: preview_changes ──────────────────────────────────────

server.registerTool(
  'preview_changes',
  {
    description: 'Show exact file and dependency changes, compatibility findings, and expected effects before applying a design plan.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project'),
      planId: z.string().describe('Design plan ID from prepare_design'),
    },
  },
  async ({ projectDir, planId }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'preview_changes', data: { projectDir: canonical, planId } });

    const plan = loadPlan(canonical, planId);
    if (!plan) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Plan not found: ${planId}` }) }],
        isError: true
      };
    }

    const preview = {
      planId,
      status: plan.status,
      direction: plan.direction.name,
      changes: plan.changes.map(c => {
        const fullPath = validateFilePath(canonical, c.file);
        const exists = fs.existsSync(fullPath);
        const conflict = c.action === 'modify' && !exists;
        return {
          file: c.file,
          action: c.action,
          description: c.description,
          exists,
          conflict,
          contentPreview: c.content ? c.content.slice(0, 200) + (c.content.length > 200 ? '...' : '') : undefined,
          dependencies: c.dependencies || []
        };
      }),
      allDependencies: [...new Set(plan.changes.flatMap(c => c.dependencies || []))],
      compatibility: {
        framework: 'compatible',
        notes: [] as string[]
      }
    };

    // Check for conflicts
    const conflicts = preview.changes.filter(c => c.conflict);
    if (conflicts.length > 0) {
      preview.compatibility.notes.push(`${conflicts.length} file(s) to modify don't exist yet — will be created instead.`);
    }

    plan.status = 'previewed';
    plan.updatedAt = new Date().toISOString();
    savePlan(plan);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(preview, null, 2) }]
    };
  }
);

// ─── Tool: apply_changes ────────────────────────────────────────

server.registerTool(
  'apply_changes',
  {
    description: 'Apply a validated, previewed design plan with a recoverable change record. Creates backups of modified files.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project'),
      planId: z.string().describe('Design plan ID that has been previewed'),
    },
  },
  async ({ projectDir, planId }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'apply_changes', data: { projectDir: canonical, planId } });

    const plan = loadPlan(canonical, planId);
    if (!plan) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Plan not found: ${planId}` }) }],
        isError: true
      };
    }

    const atelierDir = ensureAtelierDir(canonical);
    const recordId = crypto.randomUUID();
    const appliedChanges: AppliedChange[] = [];

    try {
      for (const change of plan.changes) {
        const filePath = validateFilePath(canonical, change.file);
        const relativePath = path.relative(canonical, filePath);

        if (change.action === 'create' || change.action === 'modify') {
          // Backup existing file
          let backupPath: string | undefined;
          let originalContent: string | undefined;
          if (fs.existsSync(filePath)) {
            originalContent = fs.readFileSync(filePath, 'utf-8');
            backupPath = path.join(atelierDir, 'backups', `${recordId}_${relativePath.replace(/[/\\]/g, '_')}`);
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.writeFileSync(backupPath, originalContent);
          }

          // Write new content
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          if (change.content !== undefined) {
            fs.writeFileSync(filePath, change.content, 'utf-8');
          }

          appliedChanges.push({
            file: relativePath,
            action: originalContent === undefined ? 'create' : 'modify',
            backupPath,
            originalContent,
            appliedContent: change.content
          });
        } else if (change.action === 'delete') {
          if (fs.existsSync(filePath)) {
            const originalContent = fs.readFileSync(filePath, 'utf-8');
            const backupPath = path.join(atelierDir, 'backups', `${recordId}_${relativePath.replace(/[/\\]/g, '_')}`);
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.writeFileSync(backupPath, originalContent);
            fs.unlinkSync(filePath);

            appliedChanges.push({
              file: relativePath,
              action: 'delete',
              backupPath,
              originalContent
            });
          }
        }
      }

      const record: ChangeRecord = {
        id: recordId,
        planId,
        projectDir: canonical,
        changes: appliedChanges,
        timestamp: new Date().toISOString(),
        status: 'applied'
      };

      saveChangeRecord(record);

      plan.status = 'applied';
      plan.updatedAt = new Date().toISOString();
      savePlan(plan);

      emitEvent({
        type: 'change_applied',
        tool: 'apply_changes',
        data: { recordId, planId, changesApplied: appliedChanges.length },
        projectDir: canonical
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            recordId,
            planId,
            status: 'applied',
            changesApplied: appliedChanges.length,
            files: appliedChanges.map(c => ({ file: c.file, action: c.action, backedUp: !!c.backupPath })),
            message: 'Changes applied successfully. Use rollback_changes with the recordId to revert.',
            dependenciesToInstall: [...new Set(plan.changes.flatMap(c => c.dependencies || []))]
          }, null, 2)
        }]
      };
    } catch (error) {
      // Partial rollback on failure
      for (const applied of appliedChanges.reverse()) {
        try {
          if (applied.backupPath && fs.existsSync(applied.backupPath)) {
            fs.writeFileSync(path.join(canonical, applied.file), fs.readFileSync(applied.backupPath));
          } else if (applied.action === 'create') {
            const fp = path.join(canonical, applied.file);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          }
        } catch { /* best effort rollback */ }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Apply failed: ${error instanceof Error ? error.message : String(error)}`,
            rolledBack: appliedChanges.length,
            message: 'All partial changes have been rolled back.'
          })
        }],
        isError: true
      };
    }
  }
);

// ─── Tool: rollback_changes ─────────────────────────────────────

server.registerTool(
  'rollback_changes',
  {
    description: 'Revert Atelier-owned changes while detecting conflicts with later user edits. Preserves user modifications made after installation.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project'),
      recordId: z.string().describe('Change record ID from apply_changes'),
      force: z.boolean().optional().describe('Force rollback even if user edits detected'),
    },
  },
  async ({ projectDir, recordId, force }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'rollback_changes', data: { projectDir: canonical, recordId } });

    const record = loadChangeRecord(canonical, recordId);
    if (!record) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Change record not found: ${recordId}` }) }],
        isError: true
      };
    }

    if (record.status === 'rolled_back') {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'These changes have already been rolled back.' }) }],
        isError: true
      };
    }

    const conflicts: Array<{ file: string; reason: string }> = [];
    const reverted: string[] = [];

    for (const change of [...record.changes].reverse()) {
      if (change.reverted) continue;
      const filePath = validateFilePath(canonical, change.file);
      const exists = fs.existsSync(filePath);
      const edited = change.action === 'delete'
        ? exists
        : exists
          ? change.appliedContent === undefined || fs.readFileSync(filePath, 'utf-8') !== change.appliedContent
          : change.action === 'modify';
      if (!force && edited) {
        conflicts.push({ file: change.file, reason: 'File changed after Atelier applied this plan; preserving user edits.' });
        continue;
      }
      if (change.action === 'create') {
        if (exists) fs.unlinkSync(filePath);
      } else if (change.originalContent !== undefined) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, change.originalContent);
      } else if (change.backupPath && fs.existsSync(change.backupPath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, fs.readFileSync(validateFilePath(canonical, change.backupPath)));
      } else {
        conflicts.push({ file: change.file, reason: 'Backup unavailable; file was not reverted.' });
        continue;
      }
      change.reverted = true;
      reverted.push(change.file);
    }

    record.status = conflicts.length > 0 ? 'partial' : 'rolled_back';
    saveChangeRecord(record);

    // Update plan status
    const plan = loadPlan(canonical, record.planId);
    if (plan && record.status === 'rolled_back') {
      plan.status = 'rolled_back';
      plan.updatedAt = new Date().toISOString();
      savePlan(plan);
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          recordId,
          status: record.status,
          reverted,
          conflicts,
          message: conflicts.length > 0
            ? `Rolled back ${reverted.length} files. ${conflicts.length} conflicts detected — use force: true to override.`
            : `Successfully rolled back ${reverted.length} files.`
        }, null, 2)
      }]
    };
  }
);

// ─── Tool: capture_preview ──────────────────────────────────────

server.registerTool(
  'capture_preview',
  {
    description: 'Capture screenshots of real pages at requested viewports. Returns capture file paths. Requires Playwright to be installed.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project'),
      url: z.string().describe('URL to capture (e.g., http://localhost:5173)'),
      viewports: z.array(z.object({
        width: z.number(),
        height: z.number(),
        label: z.string().optional()
      })).optional().describe('Viewports to capture (defaults to mobile/tablet/desktop)'),
      waitFor: z.string().optional().describe('CSS selector to wait for before capturing'),
    },
  },
  async ({ projectDir, url, viewports, waitFor }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'capture_preview', data: { projectDir: canonical, url } });

    const defaultViewports = [
      { width: 360, height: 800, label: 'mobile' },
      { width: 768, height: 1024, label: 'tablet' },
      { width: 1440, height: 900, label: 'desktop' }
    ];

    const vps = viewports || defaultViewports;
    const captureDir = path.join(ensureAtelierDir(canonical), 'captures');
    const timestamp = Date.now();

    // Check if Playwright is available
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });

      const captures: Array<{ viewport: string; file: string; width: number; height: number }> = [];

      try {
        for (const vp of vps) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            reducedMotion: 'no-preference'
          });

          const page = await context.newPage();

          try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            if (waitFor) {
              await page.waitForSelector(waitFor, { timeout: 10000 });
            }
            // Wait for fonts and images
            await page.waitForTimeout(1000);

            const label = vp.label || `${vp.width}x${vp.height}`;
            const fileName = `capture_${timestamp}_${label}.png`;
            const filePath = path.join(captureDir, fileName);

            await page.screenshot({ path: filePath, fullPage: true });
            captures.push({
              viewport: label,
              file: path.relative(canonical, filePath).replace(/\\/g, '/'),
              width: vp.width,
              height: vp.height
            });
          } finally {
            await context.close();
          }
        }
      } finally {
        await browser.close();
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            url,
            captures,
            timestamp: new Date(timestamp).toISOString(),
            message: `Captured ${captures.length} screenshots.`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'Playwright not available or capture failed.',
            details: error instanceof Error ? error.message : String(error),
            suggestion: 'Install Playwright: npx playwright install chromium',
            manualCapture: `Open ${url} in a browser to see the result.`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// ─── Tool: audit_ui ─────────────────────────────────────────────

server.registerTool(
  'audit_ui',
  {
    description: 'Run accessibility, visual, and performance checks on a live page. Uses axe-core for a11y when available.',
    inputSchema: {
      url: z.string().describe('URL to audit'),
      checks: z.array(z.enum(['accessibility', 'performance', 'visual', 'seo'])).optional().describe('Which checks to run'),
      projectDir: z.string().optional().describe('Project dir for storing results'),
    },
  },
  async ({ url, checks, projectDir }) => {
    const activeChecks = checks || ['accessibility', 'performance', 'visual'];
    emitEvent({ type: 'tool_call', tool: 'audit_ui', data: { url, checks: activeChecks }, projectDir });

    const results: Record<string, unknown> = { url, timestamp: new Date().toISOString(), checks: {} };

    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        if (activeChecks.includes('accessibility')) {
          try {
            // Try axe-core
            const { AxeBuilder } = await import('@axe-core/playwright');
            const axeResults = await new AxeBuilder({ page }).analyze();
            (results.checks as Record<string, unknown>)['accessibility'] = {
              violations: axeResults.violations.map(v => ({
                id: v.id,
                impact: v.impact,
                description: v.description,
                nodes: v.nodes.length,
                help: v.helpUrl
              })),
              passes: axeResults.passes.length,
              violationCount: axeResults.violations.length
            };
          } catch {
            (results.checks as Record<string, unknown>)['accessibility'] = {
              error: 'axe-core not available. Install: npm install -D @axe-core/playwright',
              basicChecks: {
                hasLang: await page.evaluate(() => !!document.documentElement.lang),
                hasTitle: await page.evaluate(() => !!document.title),
                imagesWithAlt: await page.evaluate(() => {
                  const imgs = document.querySelectorAll('img');
                  return { total: imgs.length, withAlt: Array.from(imgs).filter(i => i.alt).length };
                })
              }
            };
          }
        }

        if (activeChecks.includes('performance')) {
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');
            const lcp = performance.getEntriesByType('largest-contentful-paint');
            return {
              domContentLoaded: nav?.domContentLoadedEventEnd - nav?.startTime,
              load: nav?.loadEventEnd - nav?.startTime,
              firstPaint: paint.find(e => e.name === 'first-paint')?.startTime,
              firstContentfulPaint: paint.find(e => e.name === 'first-contentful-paint')?.startTime,
              lcpTime: lcp.length > 0 ? lcp[lcp.length - 1].startTime : undefined,
              transferSize: nav?.transferSize,
              note: 'Lab measurement — not indicative of field performance'
            };
          });
          (results.checks as Record<string, unknown>)['performance'] = metrics;
        }

        if (activeChecks.includes('visual')) {
          const visualChecks = await page.evaluate(() => {
            const body = document.body;
            const computed = getComputedStyle(body);
            return {
              hasFontFamily: computed.fontFamily !== '' && !computed.fontFamily.includes('Times'),
              bodyFontSize: computed.fontSize,
              backgroundColor: computed.backgroundColor,
              h1Count: document.querySelectorAll('h1').length,
              linkCount: document.querySelectorAll('a').length,
              buttonCount: document.querySelectorAll('button').length,
              imageCount: document.querySelectorAll('img').length,
              viewportMeta: !!document.querySelector('meta[name="viewport"]'),
            };
          });
          (results.checks as Record<string, unknown>)['visual'] = visualChecks;
        }
      } finally {
        await browser.close();
      }
    } catch (error) {
      results.error = `Audit failed: ${error instanceof Error ? error.message : String(error)}`;
      results.suggestion = 'Ensure the URL is accessible and Playwright is installed.';
    }

    // Store results if projectDir provided
    if (projectDir) {
      try {
        const canonical = validateProjectPath(projectDir);
        const auditDir = path.join(ensureAtelierDir(canonical), 'audits');
        fs.mkdirSync(auditDir, { recursive: true });
        fs.writeFileSync(
          path.join(auditDir, `audit_${Date.now()}.json`),
          JSON.stringify(results, null, 2)
        );
      } catch { /* non-fatal */ }
    }

    emitEvent({ type: 'audit_result', tool: 'audit_ui', data: results, projectDir });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
    };
  }
);

// ─── Tool: monitor_project ──────────────────────────────────────

server.registerTool(
  'monitor_project',
  {
    description: 'Start or inspect a monitoring session. Returns recent events and project graph data for the Neural Monitor application.',
    inputSchema: {
      projectDir: z.string().describe('Absolute path to the website project'),
      action: z.enum(['status', 'events', 'graph']).describe('"status" for session info, "events" for recent events, "graph" for project relationship graph'),
      limit: z.number().optional().describe('Max events to return (default 50)'),
    },
  },
  async ({ projectDir, action, limit }) => {
    const canonical = validateProjectPath(projectDir);
    emitEvent({ type: 'tool_call', tool: 'monitor_project', data: { projectDir: canonical, action } });

    if (action === 'status') {
      const atelierDir = getAtelierDir(canonical);
      const hasAtelier = fs.existsSync(atelierDir);
      const plans = hasAtelier ? (fs.existsSync(path.join(atelierDir, 'plans'))
        ? fs.readdirSync(path.join(atelierDir, 'plans')).length
        : 0) : 0;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            projectDir: canonical,
            atelierInstalled: hasAtelier,
            totalPlans: plans,
            totalEvents: eventHistory.filter(e => e.projectDir === canonical || !e.projectDir).length,
            serverUptime: process.uptime(),
            monitorUrl: 'http://localhost:5174 (start with: npm run dev:monitor)'
          }, null, 2)
        }]
      };
    }

    if (action === 'events') {
      const maxEvents = Math.min(limit || 50, MAX_EVENTS);
      const events = eventHistory
        .filter(e => e.projectDir === canonical || !e.projectDir)
        .slice(-maxEvents);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ events, total: events.length }, null, 2)
        }]
      };
    }

    if (action === 'graph') {
      // Build project relationship graph
      const nodes: Array<{ id: string; type: string; label: string; data: unknown }> = [];
      const edges: Array<{ source: string; target: string; label: string }> = [];

      // Add route nodes
      const pkgPath = path.join(canonical, 'package.json');
      if (fs.existsSync(pkgPath)) {
        nodes.push({ id: 'project', type: 'project', label: path.basename(canonical), data: {} });

        // Scan for components
        const srcDir = fs.existsSync(path.join(canonical, 'src'))
          ? path.join(canonical, 'src')
          : canonical;

        function walkForGraph(dir: string) {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.atelier') {
                walkForGraph(fp);
              } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
                const relPath = path.relative(canonical, fp).replace(/\\/g, '/');
                const content = fs.readFileSync(fp, 'utf-8');
                const componentMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|const)\s+([A-Z]\w*)/g);

                for (const m of componentMatches) {
                  const nodeId = `component:${m[1]}`;
                  nodes.push({
                    id: nodeId,
                    type: 'component',
                    label: m[1],
                    data: { file: relPath }
                  });
                  edges.push({ source: 'project', target: nodeId, label: 'contains' });

                  // Check for token usage
                  const tokenRefs = content.match(/var\(--[\w-]+\)/g);
                  if (tokenRefs) {
                    for (const ref of [...new Set(tokenRefs)]) {
                      const tokenName = ref.match(/var\((--[\w-]+)\)/)?.[1];
                      if (tokenName) {
                        const tokenId = `token:${tokenName}`;
                        if (!nodes.find(n => n.id === tokenId)) {
                          nodes.push({ id: tokenId, type: 'token', label: tokenName, data: {} });
                        }
                        edges.push({ source: nodeId, target: tokenId, label: 'uses token' });
                      }
                    }
                  }

                  // Check for asset usage
                  const assetRefs = content.match(/(?:src|href)=["']([^"']+\.(?:png|jpg|jpeg|svg|webp))/g);
                  if (assetRefs) {
                    for (const ref of [...new Set(assetRefs)]) {
                      const assetPath = ref.replace(/(?:src|href)=["']/, '');
                      const assetId = `asset:${assetPath}`;
                      if (!nodes.find(n => n.id === assetId)) {
                        nodes.push({ id: assetId, type: 'asset', label: path.basename(assetPath), data: { path: assetPath } });
                      }
                      edges.push({ source: nodeId, target: assetId, label: 'loads asset' });
                    }
                  }
                }
              }
            }
          } catch { /* skip */ }
        }

        walkForGraph(srcDir);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            nodes: nodes.slice(0, 200), // Bounded
            edges: edges.slice(0, 500),
            meta: {
              nodeCount: nodes.length,
              edgeCount: edges.length,
              source: 'static analysis',
              limitations: 'Dynamic imports, conditional rendering, and runtime-only relationships are not captured.'
            }
          }, null, 2)
        }]
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Unknown action' }) }],
      isError: true
    };
  }
);

// ─── Built-in Recipe Data (inline to avoid workspace import issues) ──

function getBuiltinRecipeSummaries() {
  return [
    { id: 'text-reveal-split', name: 'Split Text Reveal', category: 'text-reveal', purpose: 'Reveal headings and body text with per-character or per-word stagger', suitableContexts: ['hero sections', 'article headings', 'portfolio titles'], aesthetic: ['editorial', 'expressive', 'cinematic'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~3KB', gpuRequired: false } },
    { id: 'staggered-grid-entrance', name: 'Staggered Grid Entrance', category: 'entrance', purpose: 'Animate grid items into view with cascading delay', suitableContexts: ['card grids', 'portfolios', 'product listings'], aesthetic: ['clean', 'professional', 'modern'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~2KB', gpuRequired: false } },
    { id: 'button-press-feedback', name: 'Button Press Feedback', category: 'button', purpose: 'Tactile press feedback with scale and ripple', suitableContexts: ['primary CTAs', 'form submissions'], aesthetic: ['material', 'tactile', 'responsive'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~0.5KB', gpuRequired: false } },
    { id: 'hover-tilt-card', name: 'Perspective Tilt Card', category: 'hover', purpose: '3D perspective tilt on hover', suitableContexts: ['feature cards', 'portfolio items'], aesthetic: ['premium', 'interactive', 'dimensional'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~2KB', gpuRequired: false } },
    { id: 'accessible-dialog-transition', name: 'Accessible Dialog Transition', category: 'menu-dialog', purpose: 'Smooth entry/exit transitions for dialogs', suitableContexts: ['modal dialogs', 'side panels'], aesthetic: ['polished', 'professional'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~3KB', gpuRequired: false } },
    { id: 'layout-route-transition', name: 'Layout Route Transition', category: 'layout-transition', purpose: 'Smooth cross-fade between routes', suitableContexts: ['page transitions', 'tab switches'], aesthetic: ['fluid', 'app-like', 'premium'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~2KB', gpuRequired: false } },
    { id: 'scroll-progress-indicator', name: 'Scroll Progress Indicator', category: 'scroll-progress', purpose: 'Visual indicator of scroll progress', suitableContexts: ['articles', 'documentation'], aesthetic: ['editorial', 'informational', 'minimal'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~1KB', gpuRequired: false } },
    { id: 'restrained-parallax', name: 'Restrained Parallax Layer', category: 'parallax', purpose: 'Subtle depth parallax on scroll', suitableContexts: ['hero sections', 'feature showcases'], aesthetic: ['cinematic', 'layered', 'immersive'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~1.5KB', gpuRequired: false } },
    { id: 'sticky-storytelling', name: 'Sticky Scroll Story', category: 'sticky-story', purpose: 'Pin visual while content scrolls past', suitableContexts: ['case studies', 'product features'], aesthetic: ['editorial', 'narrative', 'engaging'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~3KB', gpuRequired: false } },
    { id: 'interactive-3d-object', name: 'Interactive 3D Product Viewer', category: '3d-object', purpose: 'Rotating 3D object with orbit controls', suitableContexts: ['product pages', 'hero sections'], aesthetic: ['premium', 'immersive', 'modern'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~150KB', gpuRequired: true } },
    { id: 'scroll-3d-camera', name: 'Scroll-Linked 3D Camera', category: '3d-scene', purpose: 'Camera driven by scroll for cinematic 3D', suitableContexts: ['product launches', 'immersive landing pages'], aesthetic: ['cinematic', 'immersive', 'premium'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~155KB', gpuRequired: true } },
    { id: 'particle-field', name: 'Interactive Particle Field', category: 'shader-particle', purpose: 'GPU particle system reacting to cursor', suitableContexts: ['hero backgrounds', 'creative portfolios'], aesthetic: ['atmospheric', 'creative', 'immersive'], frameworks: [{ name: 'react-vite' }, { name: 'nextjs' }], resourceCost: { jsSize: '~152KB', gpuRequired: true } },
  ];
}

function getBuiltinRecipe(id: string) {
  // Return full recipe data - in production this would come from the recipes package
  const summaries = getBuiltinRecipeSummaries();
  const summary = summaries.find(r => r.id === id);
  if (!summary) return null;

  // Read from the recipes package data file
  const recipesDir = path.resolve(import.meta.dirname || __dirname, '..', '..', 'recipes', 'src');
  try {
    // Try to read the full recipe from the registry
    const content = fs.readFileSync(path.join(recipesDir, 'index.ts'), 'utf-8');
    // Find the recipe block in the source
    const recipeStart = content.indexOf(`id: '${id}'`);
    if (recipeStart !== -1) {
      // Return the summary with a note to read the full source
      return {
        ...summary,
        sourceFile: 'packages/recipes/src/index.ts',
        message: 'Full recipe with code, parameters, and documentation available in the recipes package.',
        preview: {
          description: `See packages/recipes/src/index.ts for the complete ${summary.name} recipe code.`
        }
      };
    }
  } catch {
    // Fallback to summary
  }

  return summary;
}

// ─── MCP Resources ──────────────────────────────────────────────

server.registerResource(
  'recipe-catalog',
  'atelier://recipes/catalog',
  {
    description: 'Complete design and motion recipe catalog with categories and metadata',
  },
  async () => ({
    contents: [{
      uri: 'atelier://recipes/catalog',
      text: JSON.stringify(getBuiltinRecipeSummaries(), null, 2),
      mimeType: 'application/json'
    }]
  })
);

server.registerResource(
  'design-tokens',
  'atelier://design/tokens',
  {
    description: 'Default Atelier design tokens for typography, spacing, colors, and motion',
  },
  async () => ({
    contents: [{
      uri: 'atelier://design/tokens',
      text: JSON.stringify({
        typography: {
          '--atl-font-display': "'Inter', system-ui, sans-serif",
          '--atl-font-body': "'Inter', system-ui, sans-serif",
          '--atl-font-mono': "'JetBrains Mono', monospace",
          '--atl-text-xs': '0.75rem', '--atl-text-sm': '0.875rem',
          '--atl-text-base': '1rem', '--atl-text-lg': '1.125rem',
          '--atl-text-xl': '1.25rem', '--atl-text-2xl': '1.5rem',
          '--atl-text-3xl': '1.875rem', '--atl-text-4xl': '2.25rem',
          '--atl-text-5xl': '3rem',
          '--atl-leading-tight': '1.25', '--atl-leading-normal': '1.5',
          '--atl-leading-relaxed': '1.75',
          '--atl-tracking-tight': '-0.02em', '--atl-tracking-normal': '0',
        },
        spacing: {
          '--atl-space-1': '0.25rem', '--atl-space-2': '0.5rem',
          '--atl-space-3': '0.75rem', '--atl-space-4': '1rem',
          '--atl-space-5': '1.25rem', '--atl-space-6': '1.5rem',
          '--atl-space-8': '2rem', '--atl-space-10': '2.5rem',
          '--atl-space-12': '3rem', '--atl-space-16': '4rem',
          '--atl-space-20': '5rem', '--atl-space-24': '6rem',
        },
        colors: {
          '--atl-accent': '#6366f1',
          '--atl-accent-hover': '#4f46e5',
          '--atl-surface': '#ffffff',
          '--atl-surface-2': '#f8fafc',
          '--atl-surface-3': '#f1f5f9',
          '--atl-text': '#0f172a',
          '--atl-text-muted': '#64748b',
          '--atl-text-subtle': '#94a3b8',
          '--atl-border': '#e2e8f0',
          '--atl-success': '#10b981',
          '--atl-warning': '#f59e0b',
          '--atl-error': '#ef4444',
        },
        radii: {
          '--atl-radius-sm': '4px', '--atl-radius-md': '8px',
          '--atl-radius-lg': '16px', '--atl-radius-xl': '24px',
          '--atl-radius-full': '9999px',
        },
        elevation: {
          '--atl-shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
          '--atl-shadow-md': '0 4px 6px -1px rgba(0,0,0,0.1)',
          '--atl-shadow-lg': '0 10px 15px -3px rgba(0,0,0,0.1)',
          '--atl-shadow-xl': '0 20px 25px -5px rgba(0,0,0,0.1)',
        },
        motion: {
          '--atl-duration-fast': '150ms',
          '--atl-duration-normal': '250ms',
          '--atl-duration-slow': '400ms',
          '--atl-duration-slower': '600ms',
          '--atl-ease-default': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          '--atl-ease-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          '--atl-ease-in': 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
          '--atl-ease-out': 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        }
      }, null, 2),
      mimeType: 'application/json'
    }]
  })
);

// ─── MCP Prompt ─────────────────────────────────────────────────

server.registerPrompt(
  'ui_design_workflow',
  {
    description: 'Guide through the Atelier design workflow: inspect → brief → direction → tokens → plan → preview → apply → capture → audit → iterate',
  },
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `You are working with Atelier MCP, a design assistant. Follow this workflow:

## Design Workflow

### 1. Inspect the Project
Call \`inspect_project\` to understand the stack, existing components, tokens, and conventions.

### 2. Understand the Brief
Before changing any UI, identify:
- **Audience**: Who uses this website?
- **Main user task**: What's the primary action?
- **Brand character**: What feeling should it evoke?
- **Content hierarchy**: What's most important?
- **Device constraints**: Mobile-first? Desktop-focused?
- **Existing conventions**: What patterns already exist?

### 3. Develop Directions
Create 2-3 meaningfully different visual directions. For each, briefly explain:
- Typography choices
- Color palette
- Composition approach
- Motion strategy
- Signature interaction

### 4. Select & Create Tokens
Choose the direction that best fits the brief. Create design tokens using \`prepare_design\`.

### 5. Search for Recipes
Use \`search_recipes\` to find appropriate animation and interaction patterns.
Get full details with \`get_recipe\`.

### 6. Plan & Preview
Use \`prepare_design\` to create a structured plan, then \`preview_changes\` to verify.

### 7. Apply & Capture
Use \`apply_changes\` to implement, then \`capture_preview\` for screenshots.

### 8. Audit & Iterate
Run \`audit_ui\` for accessibility, performance, and visual checks.
Fix issues and re-audit.

### Design Principles
- Make design intentional: hierarchy, readable content, consistent interaction states
- Choose a memorable signature interaction where it serves the product
- Respect prefers-reduced-motion
- A dashboard and a portfolio should produce different results
- Avoid defaulting to the same gradient hero on every project
- Preserve existing brand conventions`
      }
    }]
  })
);

// ─── Start Server ───────────────────────────────────────────────

log('info', 'Starting Atelier MCP server', { version: '0.1.0', transport: 'stdio' });
serveStdio(() => server);
