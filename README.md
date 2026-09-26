# mcp-osv

OSV.dev (Open Source Vulnerabilities) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1683+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `query_package_vulns` | Find all known vulnerabilities for an open-source package, optionally at a specific version, via the OSV.dev database. Omit version to get every vuln known for the package. Returns a compact summary array (id, summary, aliases, severity, references). Keyless. |
| `get_vulnerability` | Get full detail for a single vulnerability by its OSV ID — e.g. "GHSA-jf85-cpcp-j695", "CVE-2021-23337", "PYSEC-2021-XXX". Returns summary, details, aliases, severity, affected packages/ranges, and references. Keyless. |
| `query_by_commit` | Find vulnerabilities affecting a specific source-repository git commit via OSV.dev. Useful when you have a pinned commit hash rather than a released version. Returns the same compact vuln summary array. Keyless. |
| `query_batch` | Batch vulnerability query against OSV.dev (up to 1000 entries per call) — for SBOM-style "scan every dependency in this lockfile" workflows. Pass an array of {package:{name,ecosystem}, version?} or {commit} entries. Returns the vuln IDs matched per query (use get_vulnerability for full detail per ID). Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "osv": {
      "url": "https://gateway.pipeworx.io/osv/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/osv/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1683+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/query_package_vulns \
  -H 'Content-Type: application/json' \
  -d '{"name":"lodash","ecosystem":"npm"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/query_package_vulns`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "osv": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-osv"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-osv
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Osv data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
