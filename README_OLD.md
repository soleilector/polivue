# PoliVue
A personal project using Amazon S3, Microsoft's MCP, and LLM engines to create reports aligning organizational policies to code and their dependencies, websites, and other documents for review and sharing by human auditors and GRC governance workers. Targets the cost-savings and time-savings factors of work in finance and technology industries.

# How to Use

## Upload Policy Documents, Report Structure Guildelines and Examples, Analysis Items, etc...
1. Navigate to **Policies** Page
2. Select File to upload (Choose unique file name to prevent overwriting)
3. Confirm via provided file preview
4. Select upload

## Connecting MCP Servers
### IntelliJ Idea
1. Follow directions [here](https://www.jetbrains.com/help/idea/mcp-server.html#external-client-setup) to configure your IntelliJ installation as a Microsoft MCP server
2. Use Copy SSE Config to find <MACHINE LAN IP> and <PORT> values under the ***url*** parameter
3. Navigate to **Connections** Page
4. Create new MCP Connection as *IDE-IntelliJ* with following configurations as guide
```
type: 'url',
url: '<MACHINE LAN IP / IPv4 ADDRESS HERE>:<PORT>/api/mcp/sse',
name: 'intellij'
```
5. Add MCP Connection to query when using Hadi to begin using as context to inquiries
