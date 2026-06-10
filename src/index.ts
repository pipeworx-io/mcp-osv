interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * OSV.dev (Open Source Vulnerabilities) MCP.
 *
 * Google's keyless database of vulnerabilities across open-source ecosystems
 * (npm, PyPI, Go, Maven, crates.io, RubyGems, NuGet, and more). Query known
 * vulnerabilities for a package (optionally at a specific version), fetch full
 * detail for a single advisory ID, or find vulnerabilities affecting a source
 * commit. Keyless.
 */


const BASE = 'https://api.osv.dev';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'query_package_vulns',
    description:
      'Find all known vulnerabilities for an open-source package, optionally at a specific version, via the OSV.dev database. Omit version to get every vuln known for the package. Returns a compact summary array (id, summary, aliases, severity, references). Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Package name, e.g. "lodash", "django", "log4j-core", "serde".',
        },
        ecosystem: {
          type: 'string',
          description:
            'Package ecosystem. Examples: "npm", "PyPI", "Go", "Maven", "crates.io", "RubyGems", "NuGet".',
        },
        version: {
          type: 'string',
          description:
            'Optional package version, e.g. "4.17.20". If given, only vulns affecting that version are returned; if omitted, all vulns for the package are returned.',
        },
      },
      required: ['name', 'ecosystem'],
    },
  },
  {
    name: 'get_vulnerability',
    description:
      'Get full detail for a single vulnerability by its OSV ID — e.g. "GHSA-jf85-cpcp-j695", "CVE-2021-23337", "PYSEC-2021-XXX". Returns summary, details, aliases, severity, affected packages/ranges, and references. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'A vulnerability ID, e.g. "GHSA-jf85-cpcp-j695", "CVE-2021-23337", "PYSEC-2021-1".',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'query_by_commit',
    description:
      'Find vulnerabilities affecting a specific source-repository git commit via OSV.dev. Useful when you have a pinned commit hash rather than a released version. Returns the same compact vuln summary array. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        commit: {
          type: 'string',
          description: 'A git commit hash, e.g. "6879efc2c1596d11a6a6ad296f80063b558d5e0f".',
        },
      },
      required: ['commit'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'query_package_vulns':
        return queryPackageVulns(args);
      case 'get_vulnerability':
        return getVulnerability(args);
      case 'query_by_commit':
        return queryByCommit(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

type OsvVuln = Record<string, unknown>;

/** Extract a compact severity view from an OSV vuln's `severity` array + `database_specific`. */
function extractSeverity(vuln: OsvVuln): unknown {
  const out: Record<string, unknown> = {};
  const sev = vuln.severity;
  if (Array.isArray(sev) && sev.length > 0) {
    const scores = (sev as Array<Record<string, unknown>>)
      .filter((s) => s && typeof s.score === 'string')
      .map((s) => ({ type: s.type, score: s.score }));
    if (scores.length > 0) out.cvss = scores;
  }
  const dbSpec = vuln.database_specific as Record<string, unknown> | undefined;
  if (dbSpec && dbSpec.severity != null) out.database_specific_severity = dbSpec.severity;
  return Object.keys(out).length > 0 ? out : null;
}

/** Map a raw OSV vuln object → compact summary shape (DRY across query tools). */
function summarizeVuln(vuln: OsvVuln): Record<string, unknown> {
  const affected = Array.isArray(vuln.affected) ? (vuln.affected as Array<Record<string, unknown>>) : [];
  const refs = Array.isArray(vuln.references) ? (vuln.references as Array<Record<string, unknown>>) : [];
  return {
    id: vuln.id,
    summary: vuln.summary,
    aliases: Array.isArray(vuln.aliases) ? vuln.aliases : [],
    severity: extractSeverity(vuln),
    affected_ranges_count: affected.reduce((acc, a) => {
      const ranges = Array.isArray(a.ranges) ? a.ranges.length : 0;
      return acc + ranges;
    }, 0),
    published: vuln.published,
    modified: vuln.modified,
    references: refs
      .map((r) => (typeof r.url === 'string' ? r.url : null))
      .filter((u): u is string => !!u)
      .slice(0, 5),
  };
}

async function postQuery(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}/v1/query`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
  });
}

function summarizeVulnsResponse(data: Record<string, unknown>): unknown {
  const vulns = Array.isArray(data.vulns) ? (data.vulns as OsvVuln[]) : [];
  return {
    count: vulns.length,
    vulns: vulns.slice(0, 50).map(summarizeVuln),
  };
}

async function queryPackageVulns(args: Record<string, unknown>): Promise<unknown> {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  const ecosystem = typeof args.ecosystem === 'string' ? args.ecosystem.trim() : '';
  if (!name) return { error: 'provide a package name', name: args.name ?? null };
  if (!ecosystem) return { error: 'provide an ecosystem (e.g. "npm", "PyPI", "Go")' };
  const version = typeof args.version === 'string' && args.version.trim() ? args.version.trim() : undefined;

  const body: Record<string, unknown> = { package: { name, ecosystem } };
  if (version) body.version = version;

  const res = await postQuery(body);
  if (!res.ok) return { error: `OSV: ${res.status} ${(await res.text()).slice(0, 200)}` };
  const data = (await res.json()) as Record<string, unknown>;
  return summarizeVulnsResponse(data);
}

async function queryByCommit(args: Record<string, unknown>): Promise<unknown> {
  const commit = typeof args.commit === 'string' ? args.commit.trim() : '';
  if (!commit) return { error: 'provide a git commit hash', commit: args.commit ?? null };

  const res = await postQuery({ commit });
  if (!res.ok) return { error: `OSV: ${res.status} ${(await res.text()).slice(0, 200)}` };
  const data = (await res.json()) as Record<string, unknown>;
  return summarizeVulnsResponse(data);
}

async function getVulnerability(args: Record<string, unknown>): Promise<unknown> {
  const id = typeof args.id === 'string' ? args.id.trim() : '';
  if (!id) return { error: 'provide a vulnerability id', id: args.id ?? null };

  const res = await fetch(`${BASE}/v1/vulns/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: 'vulnerability not found', id };
  if (!res.ok) return { error: `OSV: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const v = (await res.json()) as OsvVuln;
  const details = typeof v.details === 'string' ? v.details : undefined;
  const affected = Array.isArray(v.affected) ? (v.affected as Array<Record<string, unknown>>) : [];
  const refs = Array.isArray(v.references) ? (v.references as Array<Record<string, unknown>>) : [];

  return {
    id: v.id,
    summary: v.summary,
    details: details ? (details.length > 800 ? `${details.slice(0, 800)}…` : details) : undefined,
    aliases: Array.isArray(v.aliases) ? v.aliases : [],
    severity: extractSeverity(v),
    affected: affected.map((a) => {
      const pkg = a.package as Record<string, unknown> | undefined;
      const ranges = Array.isArray(a.ranges) ? (a.ranges as Array<Record<string, unknown>>) : [];
      const versions = Array.isArray(a.versions) ? a.versions : [];
      return {
        package: pkg ? { name: pkg.name, ecosystem: pkg.ecosystem } : null,
        ranges: ranges.map((r) => {
          const events = Array.isArray(r.events) ? (r.events as Array<Record<string, unknown>>) : [];
          return {
            type: r.type,
            events: events.map((ev) => {
              const out: Record<string, unknown> = {};
              if (ev.introduced != null) out.introduced = ev.introduced;
              if (ev.fixed != null) out.fixed = ev.fixed;
              if (ev.last_affected != null) out.last_affected = ev.last_affected;
              if (ev.limit != null) out.limit = ev.limit;
              return out;
            }),
          };
        }),
        versions_count: versions.length,
      };
    }),
    published: v.published,
    modified: v.modified,
    references: refs
      .map((r) => (typeof r.url === 'string' ? { type: r.type, url: r.url } : null))
      .filter((r): r is { type: unknown; url: string } => !!r),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
