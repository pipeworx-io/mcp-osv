# mcp-osv

OSV.dev (Open Source Vulnerabilities) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Osv data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
