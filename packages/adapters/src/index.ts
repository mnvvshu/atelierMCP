/**
 * Atelier MCP — Framework Adapters
 * Detect and interact with React+Vite and Next.js projects
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ProjectInfo {
  framework: 'react-vite' | 'nextjs' | 'unknown';
  frameworkVersion: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  nodeVersion: string;
  typescript: boolean;
  srcDir: string;
  routes: RouteInfo[];
  components: ComponentInfo[];
  tokens: TokenInfo[];
  assets: AssetInfo[];
  conventions: ConventionInfo[];
  hasLockfile: boolean;
  lockfilePath: string;
  configFiles: string[];
}

export interface RouteInfo {
  path: string;
  file: string;
  dynamic: boolean;
}

export interface ComponentInfo {
  name: string;
  file: string;
  exported: boolean;
}

export interface TokenInfo {
  file: string;
  type: 'css-custom-properties' | 'tailwind-config' | 'js-tokens' | 'scss-variables';
  tokens: Record<string, string>;
}

export interface AssetInfo {
  file: string;
  type: 'image' | 'font' | 'video' | 'icon' | 'other';
  size: number;
}

export interface ConventionInfo {
  type: string;
  description: string;
  files: string[];
}

/**
 * Detect the project framework and basic info
 */
export function detectFramework(projectDir: string): Pick<ProjectInfo, 'framework' | 'frameworkVersion' | 'packageManager' | 'nodeVersion' | 'typescript' | 'hasLockfile' | 'lockfilePath' | 'srcDir' | 'configFiles'> {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {
      framework: 'unknown',
      frameworkVersion: '',
      packageManager: 'unknown',
      nodeVersion: process.version,
      typescript: false,
      hasLockfile: false,
      lockfilePath: '',
      srcDir: projectDir,
      configFiles: []
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Detect framework
  let framework: ProjectInfo['framework'] = 'unknown';
  let frameworkVersion = '';

  if (deps['next']) {
    framework = 'nextjs';
    frameworkVersion = deps['next'];
  } else if (deps['vite'] && (deps['react'] || deps['react-dom'])) {
    framework = 'react-vite';
    frameworkVersion = deps['vite'];
  }

  // Detect package manager
  let packageManager: ProjectInfo['packageManager'] = 'npm';
  let hasLockfile = false;
  let lockfilePath = '';

  const lockfiles: Array<[string, ProjectInfo['packageManager']]> = [
    ['package-lock.json', 'npm'],
    ['yarn.lock', 'yarn'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['bun.lockb', 'bun']
  ];

  for (const [file, pm] of lockfiles) {
    const fp = path.join(projectDir, file);
    if (fs.existsSync(fp)) {
      packageManager = pm;
      hasLockfile = true;
      lockfilePath = fp;
      break;
    }
  }

  // Detect TypeScript
  const typescript = fs.existsSync(path.join(projectDir, 'tsconfig.json'));

  // Detect src dir
  let srcDir = projectDir;
  if (fs.existsSync(path.join(projectDir, 'src'))) {
    srcDir = path.join(projectDir, 'src');
  } else if (fs.existsSync(path.join(projectDir, 'app'))) {
    srcDir = path.join(projectDir, 'app');
  }

  // Detect config files
  const configFiles: string[] = [];
  const configPatterns = [
    'vite.config.ts', 'vite.config.js', 'next.config.ts', 'next.config.js', 'next.config.mjs',
    'tailwind.config.ts', 'tailwind.config.js', 'postcss.config.js', 'postcss.config.mjs',
    'tsconfig.json', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js'
  ];

  for (const pattern of configPatterns) {
    const fp = path.join(projectDir, pattern);
    if (fs.existsSync(fp)) {
      configFiles.push(pattern);
    }
  }

  return {
    framework,
    frameworkVersion,
    packageManager,
    nodeVersion: process.version,
    typescript,
    hasLockfile,
    lockfilePath,
    srcDir,
    configFiles
  };
}

/**
 * Scan project for components
 */
export function scanComponents(srcDir: string): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  if (!fs.existsSync(srcDir)) return components;

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Simple component detection: exported function/const returning JSX
          const exportMatch = content.match(/export\s+(?:default\s+)?(?:function|const)\s+(\w+)/g);
          if (exportMatch) {
            for (const match of exportMatch) {
              const nameMatch = match.match(/(?:function|const)\s+(\w+)/);
              if (nameMatch && /^[A-Z]/.test(nameMatch[1])) {
                components.push({
                  name: nameMatch[1],
                  file: path.relative(srcDir, fullPath).replace(/\\/g, '/'),
                  exported: true
                });
              }
            }
          }
        }
      }
    } catch {
      // Permission or access errors — skip
    }
  }

  walk(srcDir);
  return components;
}

/**
 * Scan project for routes
 */
export function scanRoutes(projectDir: string, framework: ProjectInfo['framework']): RouteInfo[] {
  const routes: RouteInfo[] = [];

  if (framework === 'nextjs') {
    // Next.js App Router
    const appDir = path.join(projectDir, 'app');
    if (fs.existsSync(appDir)) {
      scanNextRoutes(appDir, '', routes);
    }
    // Pages Router fallback
    const pagesDir = path.join(projectDir, 'pages');
    if (fs.existsSync(pagesDir)) {
      scanNextPages(pagesDir, '', routes);
    }
  } else if (framework === 'react-vite') {
    // Look for react-router config or common patterns
    const srcDir = path.join(projectDir, 'src');
    if (fs.existsSync(srcDir)) {
      // Scan for route definitions in common files
      const routeFiles = ['App.tsx', 'App.jsx', 'router.tsx', 'router.jsx', 'routes.tsx', 'routes.jsx'];
      for (const rf of routeFiles) {
        const fp = path.join(srcDir, rf);
        if (fs.existsSync(fp)) {
          routes.push({ path: '/', file: rf, dynamic: false });
          break;
        }
      }
    }
  }

  return routes;
}

function scanNextRoutes(dir: string, routePrefix: string, routes: RouteInfo[]) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        const segment = entry.name.startsWith('[') ? `:${entry.name.slice(1, -1)}` : entry.name;
        scanNextRoutes(path.join(dir, entry.name), `${routePrefix}/${segment}`, routes);
      } else if (entry.isFile() && /^page\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        routes.push({
          path: routePrefix || '/',
          file: path.relative(dir, path.join(dir, entry.name)).replace(/\\/g, '/'),
          dynamic: routePrefix.includes(':')
        });
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

function scanNextPages(dir: string, routePrefix: string, routes: RouteInfo[]) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        scanNextPages(path.join(dir, entry.name), `${routePrefix}/${entry.name}`, routes);
      } else if (entry.isFile() && /\.(tsx|jsx|ts|js)$/.test(entry.name) && !entry.name.startsWith('_')) {
        const name = entry.name.replace(/\.(tsx|jsx|ts|js)$/, '');
        const routePath = name === 'index' ? (routePrefix || '/') : `${routePrefix}/${name}`;
        routes.push({
          path: routePath,
          file: path.relative(dir, path.join(dir, entry.name)).replace(/\\/g, '/'),
          dynamic: routePath.includes('[')
        });
      }
    }
  } catch {
    // Skip
  }
}

/**
 * Scan for design tokens
 */
export function scanTokens(projectDir: string, srcDir: string): TokenInfo[] {
  const tokens: TokenInfo[] = [];

  // CSS custom properties in global CSS files
  const cssFiles = ['globals.css', 'index.css', 'app.css', 'styles.css', 'global.css'];
  const searchDirs = [srcDir, path.join(projectDir, 'styles'), path.join(projectDir, 'app')];

  for (const dir of searchDirs) {
    for (const cssFile of cssFiles) {
      const fp = path.join(dir, cssFile);
      if (fs.existsSync(fp)) {
        const content = fs.readFileSync(fp, 'utf-8');
        const customProps: Record<string, string> = {};
        const regex = /--([\w-]+)\s*:\s*([^;]+);/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          customProps[`--${match[1]}`] = match[2].trim();
        }
        if (Object.keys(customProps).length > 0) {
          tokens.push({
            file: path.relative(projectDir, fp).replace(/\\/g, '/'),
            type: 'css-custom-properties',
            tokens: customProps
          });
        }
      }
    }
  }

  return tokens;
}

/**
 * Scan for assets
 */
export function scanAssets(projectDir: string): AssetInfo[] {
  const assets: AssetInfo[] = [];
  const assetDirs = ['public', 'src/assets', 'assets', 'static'];
  const typeMap: Record<string, AssetInfo['type']> = {
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.svg': 'icon',
    '.gif': 'image', '.avif': 'image',
    '.woff': 'font', '.woff2': 'font', '.ttf': 'font', '.otf': 'font',
    '.mp4': 'video', '.webm': 'video',
    '.ico': 'icon'
  };

  for (const assetDir of assetDirs) {
    const dir = path.join(projectDir, assetDir);
    if (!fs.existsSync(dir)) continue;

    function walk(d: string) {
      try {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          const fp = path.join(d, entry.name);
          if (entry.isDirectory()) {
            walk(fp);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext in typeMap) {
              const stat = fs.statSync(fp);
              assets.push({
                file: path.relative(projectDir, fp).replace(/\\/g, '/'),
                type: typeMap[ext],
                size: stat.size
              });
            }
          }
        }
      } catch {
        // Skip
      }
    }

    walk(dir);
  }

  return assets;
}

/**
 * Full project inspection
 */
export function inspectProject(projectDir: string): ProjectInfo {
  const canonicalDir = fs.realpathSync(projectDir);
  const base = detectFramework(canonicalDir);

  return {
    ...base,
    routes: scanRoutes(canonicalDir, base.framework),
    components: scanComponents(base.srcDir),
    tokens: scanTokens(canonicalDir, base.srcDir),
    assets: scanAssets(canonicalDir),
    conventions: detectConventions(canonicalDir, base)
  };
}

function detectConventions(projectDir: string, base: Pick<ProjectInfo, 'framework' | 'configFiles'>): ConventionInfo[] {
  const conventions: ConventionInfo[] = [];

  if (base.configFiles.includes('tailwind.config.ts') || base.configFiles.includes('tailwind.config.js')) {
    conventions.push({
      type: 'styling',
      description: 'Tailwind CSS is configured — preserve existing utility-first patterns',
      files: base.configFiles.filter(f => f.includes('tailwind'))
    });
  }

  if (base.framework === 'nextjs') {
    conventions.push({
      type: 'framework',
      description: 'Next.js project — use App Router conventions, server/client component boundaries',
      files: base.configFiles.filter(f => f.includes('next'))
    });
  }

  return conventions;
}
