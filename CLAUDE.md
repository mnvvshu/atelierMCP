# Atelier MCP — Design Assistant

When working on UI, design, or frontend tasks for this project:

1. **Inspect first**: Call `inspect_project` to understand the existing stack, components, tokens, and conventions before making changes.
2. **Consult Atelier**: Use `search_recipes` to find appropriate design patterns, animations, and interactions from the curated catalog.
3. **Plan before changing**: Use `prepare_design` to create a structured plan with design tokens, selected recipes, and file changes.
4. **Preview and validate**: Use `preview_changes` to see exact file changes before applying.
5. **Capture results**: After changes, use `capture_preview` for screenshots and `audit_ui` for accessibility/performance checks.
6. **Iterate**: Fix any audit issues and re-validate.

## Important Notes
- The host ultimately controls whether tools are called — Atelier provides capabilities but cannot enforce tool usage or bypass host permissions.
- Preserve existing brand conventions, user-authored styles, and project-specific patterns.
- Respect `prefers-reduced-motion` in all animation and motion work.
- Do not force every project into the same visual style — a dashboard and a portfolio should produce different results.
- This instruction file was installed by Atelier MCP and can be safely removed.
- Atelier tooling is installed separately from the website's runtime dependencies.

## Available MCP Tools
| Tool | Purpose |
|---|---|
| `inspect_project` | Detect stack, routes, components, tokens, assets, conventions |
| `search_recipes` | Search catalog by purpose, aesthetic, framework, cost |
| `get_recipe` | Get full recipe with code, dependencies, license, accessibility |
| `prepare_design` | Create structured design plan with tokens and changes |
| `preview_changes` | Show exact file/dependency changes before applying |
| `apply_changes` | Apply a validated plan with backup and rollback support |
| `capture_preview` | Take screenshots at mobile, tablet, and desktop viewports |
| `audit_ui` | Run accessibility, performance, and visual checks |
| `monitor_project` | View project graph, events, and session status |
| `rollback_changes` | Revert Atelier changes while preserving user edits |

## Resources
- `atelier://recipes/catalog` — Full recipe catalog metadata
- `atelier://design/tokens` — Default design token system

## Prompt
- `ui_design_workflow` — Step-by-step design workflow guide
