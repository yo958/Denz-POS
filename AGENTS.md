<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Denz MCP

A local MCP server (`denz-mcp`) is available and connected. Use it to read and write live Firestore data instead of hardcoding values or guessing.

**Available tool groups:**

- `mcp__denz__menu_*` — menu items (food, drinks, etc.)
- `mcp__denz__rooms_*` — hotel rooms and seasonal pricing
- `mcp__denz__spaces_*` — coworking desks and private offices
- `mcp__denz__blog_*` — blog posts, categories, and tags

**When to use it:**
- Seeding UI with real data (prices, names, descriptions)
- Verifying what's actually stored before making changes
- Creating or updating content as part of a feature

**Source:** `/Users/00jdsimpson/Documents/CoDicts/Code/Denz MCP`
