import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useRef } from "react";
import { usePluginAction, usePluginData, } from "@paperclipai/plugin-sdk/ui";
// ─── Styles ─────────────────────────────────────────────────────────────────
const btn = {
    appearance: "none", border: "1px solid var(--border)", borderRadius: "999px",
    background: "transparent", color: "inherit", padding: "6px 14px", fontSize: "12px", cursor: "pointer",
};
const btnPrimary = { ...btn, background: "var(--foreground)", color: "var(--background)", borderColor: "var(--foreground)" };
const btnDanger = { ...btn, color: "var(--destructive, #dc2626)", borderColor: "var(--destructive, #dc2626)" };
const btnSmall = { ...btn, padding: "4px 10px", fontSize: "11px" };
const btnSmallDanger = { ...btnDanger, padding: "4px 10px", fontSize: "11px" };
const inputStyle = {
    flex: 1, border: "1px solid var(--border)", borderRadius: "8px",
    padding: "8px 10px", background: "transparent", color: "inherit", fontSize: "12px", minWidth: 0,
};
const selectStyle = {
    ...inputStyle, cursor: "pointer", minWidth: 160,
};
const section = { marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.25rem" };
const row = { display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" };
const btnGroup = { display: "flex", gap: "0.5rem", marginTop: "0.75rem" };
const muted = { fontSize: "12px", color: "var(--muted-foreground, #888)" };
const dot = (ok) => ({
    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
    background: ok ? "var(--success, #22c55e)" : "var(--destructive, #dc2626)", marginRight: 6,
});
const cardStyle = {
    border: "1px solid var(--border)", borderRadius: "12px", padding: "1rem 1.25rem",
    marginBottom: "1rem", background: "var(--card, transparent)",
};
const cardHeaderStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem",
};
const badgeStyle = (active) => ({
    fontSize: "10px", padding: "2px 8px", borderRadius: "999px",
    background: active ? "var(--success, #22c55e)" : "var(--muted, #666)",
    color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px",
});
const subsectionStyle = {
    marginLeft: "1rem", paddingLeft: "1rem", borderLeft: "2px solid var(--border)", marginBottom: "1rem",
};
const AVAILABLE_SERVICES = [
    { type: "zoho-projects", name: "Zoho Projects", description: "Bidirectional project and task sync", status: "available",
        authType: "oauth", provider: "zoho",
        scopes: "ZohoProjects.tasks.ALL,ZohoProjects.portals.READ,ZohoProjects.projects.ALL,ZohoProjects.users.READ,ZohoProjects.clients.READ" },
    { type: "zoho-desk", name: "Zoho Desk", description: "Ticket and support task sync", status: "coming-soon",
        authType: "oauth", provider: "zoho",
        scopes: "Desk.tickets.ALL,Desk.tasks.ALL,Desk.contacts.READ,Desk.basic.READ,Desk.settings.READ" },
    { type: "zoho-crm", name: "Zoho CRM", description: "Deal, lead, and activity sync", status: "coming-soon",
        authType: "oauth", provider: "zoho",
        scopes: "ZohoCRM.modules.ALL,ZohoCRM.settings.ALL" },
    { type: "github", name: "GitHub Issues", description: "Issue and project sync", status: "coming-soon",
        authType: "oauth", provider: "github" },
    { type: "linear", name: "Linear", description: "Issue and project sync", status: "coming-soon",
        authType: "oauth", provider: "linear" },
    { type: "google-tasks", name: "Google Tasks", description: "Task sync via Google Workspace", status: "coming-soon",
        authType: "oauth", provider: "google" },
    { type: "notion", name: "Notion", description: "Database and checklist sync", status: "coming-soon",
        authType: "oauth", provider: "notion" },
];
function Autocomplete({ options, value, onChange, placeholder, disabled, }) {
    const [query, setQuery] = useState(value ? options.find((o) => o.id === value)?.label ?? "" : "");
    const [open, setOpen] = useState(false);
    const [focusIdx, setFocusIdx] = useState(-1);
    const wrapRef = useRef(null);
    const filtered = (query.length === 0
        ? options
        : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()) ||
            (o.sublabel?.toLowerCase().includes(query.toLowerCase()) ?? false))).filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i);
    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    // Sync external value changes
    useEffect(() => {
        if (value) {
            const match = options.find((o) => o.id === value);
            if (match && match.label !== query)
                setQuery(match.label);
        }
    }, [value, options]);
    const select = (opt) => {
        setQuery(opt.label);
        setOpen(false);
        setFocusIdx(-1);
        onChange(opt.id, opt.label);
    };
    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter")
                setOpen(true);
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusIdx((i) => Math.max(i - 1, 0));
        }
        else if (e.key === "Enter" && focusIdx >= 0 && filtered[focusIdx]) {
            e.preventDefault();
            select(filtered[focusIdx]);
        }
        else if (e.key === "Escape") {
            setOpen(false);
        }
    };
    return (_jsxs("div", { ref: wrapRef, style: { position: "relative", flex: 1, minWidth: 0 }, children: [_jsx("input", { style: inputStyle, placeholder: placeholder, value: query, disabled: disabled, onChange: (e) => { setQuery(e.target.value); setOpen(true); setFocusIdx(-1); }, onFocus: () => setOpen(true), onKeyDown: handleKeyDown }), open && filtered.length > 0 && (_jsx("div", { style: {
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    maxHeight: 200, overflowY: "auto",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    background: "var(--popover, var(--background, #1a1a1a))",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)", marginTop: 2,
                }, children: filtered.map((opt, i) => (_jsxs("div", { style: {
                        padding: "6px 10px", cursor: "pointer", fontSize: "12px",
                        background: i === focusIdx ? "var(--accent, rgba(255,255,255,0.1))" : "transparent",
                    }, onMouseEnter: () => setFocusIdx(i), onMouseDown: (e) => { e.preventDefault(); select(opt); }, children: [opt.label, opt.sublabel && _jsx("span", { style: { ...muted, marginLeft: 6 }, children: opt.sublabel })] }, opt.id))) })), open && filtered.length === 0 && query.length > 0 && (_jsx("div", { style: {
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    padding: "8px 10px", fontSize: "12px",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    background: "var(--popover, var(--background, #1a1a1a))",
                    color: "var(--muted-foreground, #888)", marginTop: 2,
                }, children: "No matches" }))] }));
}
function OAuthSetup({ serviceId, serviceDef }) {
    const { data: status, refresh } = usePluginData("connection-status", { serviceId });
    const { data: connectData, refresh: refreshConnectUrl } = usePluginData("connect-url", { serviceId, scopes: serviceDef.scopes ?? "" });
    const { data: savedConfig } = usePluginData("service-oauth-config", { serviceId });
    const saveOAuthConfig = usePluginAction("save-service-oauth-config");
    const disconnectAction = usePluginAction("disconnect-service");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [callbackUrl, setCallbackUrl] = useState("https://cortex.neoreef.com:8443/oauth/callback");
    const [dataCenter, setDataCenter] = useState("US");
    const [configSaved, setConfigSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    // Load saved config
    const configLoadedRef = useRef(false);
    useEffect(() => {
        if (savedConfig && !configLoadedRef.current) {
            configLoadedRef.current = true;
            if (savedConfig.clientId)
                setClientId(savedConfig.clientId);
            if (savedConfig.clientSecret)
                setClientSecret(savedConfig.clientSecret);
            if (savedConfig.callbackUrl)
                setCallbackUrl(savedConfig.callbackUrl);
            if (savedConfig.dataCenter)
                setDataCenter(savedConfig.dataCenter);
            if (savedConfig.clientId)
                setConfigSaved(true);
        }
    }, [savedConfig]);
    // Poll while disconnected
    const pollRef = useRef(null);
    useEffect(() => {
        if (!status?.connected) {
            pollRef.current = setInterval(() => refresh(), 3000);
        }
        else if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => { if (pollRef.current)
            clearInterval(pollRef.current); };
    }, [status?.connected, refresh]);
    const handleSaveConfig = useCallback(async () => {
        if (!clientId)
            return;
        setSaving(true);
        try {
            await saveOAuthConfig({ serviceId, clientId, clientSecret, callbackUrl, dataCenter });
            setConfigSaved(true);
            // Refresh connect URL after state propagates
            setTimeout(() => { refresh(); refreshConnectUrl(); }, 500);
        }
        catch (e) {
            console.error("Failed to save OAuth config:", e);
        }
        finally {
            setSaving(false);
        }
    }, [serviceId, clientId, clientSecret, callbackUrl, dataCenter, saveOAuthConfig, refresh, refreshConnectUrl]);
    const handleDisconnect = useCallback(async () => {
        if (confirm("Disconnect this service? You will need to re-authenticate.")) {
            await disconnectAction({ serviceId });
            refresh();
        }
    }, [serviceId, disconnectAction, refresh]);
    if (status?.connected) {
        return (_jsxs("div", { style: { ...section, paddingTop: "0.5rem" }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Connection" }), _jsxs("p", { style: { margin: "0.25rem 0" }, children: [_jsx("span", { style: dot(status.tokenValid) }), "Connected (", status.dataCenter, ")", " ", _jsxs("span", { style: muted, children: [status.tokenValid ? "Token valid" : "Token expired", status.tokenExpiresAt && ` — expires ${new Date(status.tokenExpiresAt).toLocaleString()}`] })] }), clientId && (_jsxs("p", { style: { ...muted, margin: "0.25rem 0" }, children: ["Client ID: ", clientId] })), _jsxs("div", { style: btnGroup, children: [connectData?.configured && (_jsx("a", { href: connectData.connectUrl, target: "_blank", rel: "noopener", style: { textDecoration: "none" }, children: _jsx("button", { type: "button", style: btn, children: "Reconnect" }) })), _jsx("button", { type: "button", style: btnDanger, onClick: handleDisconnect, children: "Disconnect" })] })] }));
    }
    return (_jsxs("div", { style: { ...section, paddingTop: "0.5rem" }, children: [_jsx("h4", { style: { marginTop: 0 }, children: "Connection" }), _jsxs("p", { style: muted, children: ["Enter your ", serviceDef.provider === "zoho" ? "Zoho API Console" : serviceDef.name, " OAuth credentials."] }), _jsxs("div", { style: { display: "grid", gap: "0.5rem", marginTop: "0.75rem" }, children: [_jsxs("div", { style: row, children: [_jsx("label", { style: { width: 110, fontSize: "12px", flexShrink: 0 }, children: "Client ID" }), _jsx("input", { style: inputStyle, value: clientId, onChange: (e) => { setClientId(e.target.value); setConfigSaved(false); }, placeholder: "Client ID" })] }), _jsxs("div", { style: row, children: [_jsx("label", { style: { width: 110, fontSize: "12px", flexShrink: 0 }, children: "Client Secret" }), _jsx("input", { style: inputStyle, type: "password", value: clientSecret, onChange: (e) => { setClientSecret(e.target.value); setConfigSaved(false); }, placeholder: "Client secret" })] }), _jsxs("div", { style: row, children: [_jsx("label", { style: { width: 110, fontSize: "12px", flexShrink: 0 }, children: "Callback URL" }), _jsx("input", { style: inputStyle, value: callbackUrl, onChange: (e) => { setCallbackUrl(e.target.value); setConfigSaved(false); } })] }), serviceDef.provider === "zoho" && (_jsxs("div", { style: row, children: [_jsx("label", { style: { width: 110, fontSize: "12px", flexShrink: 0 }, children: "Data Center" }), _jsx("select", { style: { ...selectStyle, flex: 0, minWidth: 80 }, value: dataCenter, onChange: (e) => { setDataCenter(e.target.value); setConfigSaved(false); }, children: ["US", "EU", "IN", "AU", "JP", "CA"].map((dc) => _jsx("option", { value: dc, children: dc }, dc)) })] }))] }), _jsx("div", { style: btnGroup, children: !configSaved ? (_jsx("button", { type: "button", style: btnPrimary, onClick: handleSaveConfig, disabled: !clientId || saving, children: saving ? "Saving..." : "Save & Continue" })) : connectData?.configured ? (_jsx("a", { href: connectData.connectUrl, target: "_blank", rel: "noopener", style: { textDecoration: "none" }, children: _jsxs("button", { type: "button", style: btnPrimary, children: ["Connect to ", serviceDef.name] }) })) : (_jsx("button", { type: "button", style: btnPrimary, onClick: () => refresh(), children: "Loading connect URL... (click to retry)" })) })] }));
}
// ─── Helpers ────────────────────────────────────────────────────────────────
function extractCompanyPrefix(projectName) {
    if (projectName.includes(" - "))
        return projectName.split(" - ")[0].trim();
    return "";
}
function ZohoProjectsConfig({ serviceId }) {
    const serviceDef = AVAILABLE_SERVICES.find((s) => s.type === "zoho-projects");
    const { data: status, refresh: refreshStatus } = usePluginData("connection-status", { serviceId });
    // Poll connection status so mappings appear after OAuth completes
    const parentPollRef = useRef(null);
    useEffect(() => {
        if (!status?.connected) {
            parentPollRef.current = setInterval(() => refreshStatus(), 3000);
        }
        else if (parentPollRef.current) {
            clearInterval(parentPollRef.current);
            parentPollRef.current = null;
        }
        return () => { if (parentPollRef.current)
            clearInterval(parentPollRef.current); };
    }, [status?.connected, refreshStatus]);
    const { data: zohoClientsData, loading: clientsLoading, error: clientsError } = usePluginData("zoho-clients-list", { portalId: "60418044" });
    const { data: zohoProjectsData } = usePluginData("zoho-projects-list", { portalId: "60418044" });
    const { data: paperclipCompaniesData } = usePluginData("paperclip-companies");
    const [orgMappings, setOrgMappings] = useState([]);
    const [agentMappings, setAgentMappings] = useState([]);
    const [projectMappings, setProjectMappings] = useState([]);
    const [addingOrg, setAddingOrg] = useState(false);
    const [newOrgZohoId, setNewOrgZohoId] = useState("");
    const [newOrgZohoName, setNewOrgZohoName] = useState("");
    const [newOrgPaperclipId, setNewOrgPaperclipId] = useState("");
    const [newOrgPaperclipName, setNewOrgPaperclipName] = useState("");
    // Fetch Paperclip agents and projects for all mapped companies
    const mappedCompanyIds = orgMappings.map((m) => m.paperclipCompanyId).join(",");
    const { data: agentsByCompanyData } = usePluginData("paperclip-agents-by-company", { companyIds: mappedCompanyIds || "none" });
    const { data: projectsByCompanyData } = usePluginData("paperclip-projects-by-company", { companyIds: mappedCompanyIds || "none" });
    const [ignoredItems, setIgnoredItems] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [savingAll, setSavingAll] = useState(false);
    // Load saved mappings on mount
    const { data: savedMappingsData } = usePluginData("saved-mappings");
    const loadedRef = useRef(false);
    useEffect(() => {
        if (savedMappingsData && !loadedRef.current) {
            loadedRef.current = true;
            if (savedMappingsData.orgMapping?.length)
                setOrgMappings(savedMappingsData.orgMapping);
            if (savedMappingsData.agentMapping?.length)
                setAgentMappings(savedMappingsData.agentMapping);
            if (savedMappingsData.projectMapping?.length)
                setProjectMappings(savedMappingsData.projectMapping);
            if (savedMappingsData.ignoredItems?.length)
                setIgnoredItems(savedMappingsData.ignoredItems);
        }
    }, [savedMappingsData]);
    const saveAllMappings = usePluginAction("save-all-mappings");
    const requestHireAgent = usePluginAction("request-agent-hire");
    const handleSaveAll = useCallback(async () => {
        setSavingAll(true);
        try {
            await saveAllMappings({ orgMapping: orgMappings, agentMapping: agentMappings, projectMapping: projectMappings, ignoredItems });
            setDirty(false);
        }
        catch (e) {
            console.error("Failed to save mappings:", e);
        }
        finally {
            setSavingAll(false);
        }
    }, [orgMappings, agentMappings, projectMappings, ignoredItems, saveAllMappings]);
    const handleRevert = useCallback(() => {
        if (savedMappingsData) {
            setOrgMappings(savedMappingsData.orgMapping ?? []);
            setAgentMappings(savedMappingsData.agentMapping ?? []);
            setProjectMappings(savedMappingsData.projectMapping ?? []);
            setIgnoredItems(savedMappingsData.ignoredItems ?? []);
        }
        setDirty(false);
    }, [savedMappingsData]);
    // Connection status polling is handled by OAuthSetup
    // Derived data
    const zohoClients = zohoClientsData?.clients ?? [];
    const zohoProjects = zohoProjectsData?.projects ?? [];
    const paperclipCompanies = paperclipCompaniesData?.companies ?? [];
    const mappedZohoClientIds = new Set(orgMappings.map((m) => m.zohoCompanyId));
    const mappedPaperclipCompanyIds = new Set(orgMappings.map((m) => m.paperclipCompanyId));
    // Autocomplete options
    const zohoClientOptions = zohoClients
        .filter((c) => !mappedZohoClientIds.has(c.id))
        .map((c) => ({ id: c.id, label: c.name, sublabel: `${c.users.length} users` }));
    const paperclipCompanyOptions = paperclipCompanies
        .filter((c) => !mappedPaperclipCompanyIds.has(c.id))
        .map((c) => ({ id: c.id, label: c.name }));
    const handleAddOrg = useCallback(() => {
        if (!newOrgZohoId || !newOrgPaperclipId)
            return;
        setOrgMappings((prev) => [...prev, {
                zohoCompanyId: newOrgZohoId, zohoCompany: newOrgZohoName,
                paperclipCompanyId: newOrgPaperclipId, paperclipCompanyName: newOrgPaperclipName,
            }]);
        setAddingOrg(false);
        setNewOrgZohoId("");
        setNewOrgZohoName("");
        setNewOrgPaperclipId("");
        setNewOrgPaperclipName("");
        setDirty(true);
    }, [newOrgZohoId, newOrgZohoName, newOrgPaperclipId, newOrgPaperclipName]);
    const handleRemoveOrg = useCallback((zohoCompanyId) => {
        setOrgMappings((prev) => prev.filter((m) => m.zohoCompanyId !== zohoCompanyId));
        setAgentMappings((prev) => prev.filter((a) => a.org !== zohoCompanyId));
        setProjectMappings((prev) => prev.filter((p) => p.org !== zohoCompanyId));
        setIgnoredItems((prev) => prev.filter((ig) => ig.zohoId !== zohoCompanyId));
        setDirty(true);
    }, []);
    const agentsByCompany = agentsByCompanyData?.agentsByCompany ?? {};
    const projectsByCompany = projectsByCompanyData?.projectsByCompany ?? {};
    // Get Zoho client users for an org
    const getUsersForOrg = (zohoCompanyId) => zohoClients.find((c) => c.id === zohoCompanyId)?.users ?? [];
    // Get Zoho projects for an org (by name prefix matching the company name)
    const getProjectsForOrg = (zohoCompanyName) => zohoProjects.filter((p) => extractCompanyPrefix(p.name) === zohoCompanyName);
    // Get Paperclip agents for a mapped company as autocomplete options
    const getAgentOptionsForCompany = (paperclipCompanyId) => {
        const agents = agentsByCompany[paperclipCompanyId] ?? [];
        const mappedAgentIds = new Set(agentMappings.map((a) => a.paperclipAgentId));
        return agents
            .filter((a) => !mappedAgentIds.has(a.id))
            .map((a) => ({ id: a.id, label: a.name, sublabel: a.role }));
    };
    // Get Paperclip projects for a mapped company as autocomplete options
    const getProjectOptionsForCompany = (paperclipCompanyId) => {
        const projects = projectsByCompany[paperclipCompanyId] ?? [];
        const mappedProjectIds = new Set(projectMappings.map((p) => p.paperclipProjectId));
        return projects
            .filter((p) => !mappedProjectIds.has(p.id))
            .map((p) => ({ id: p.id, label: p.name }));
    };
    return (_jsxs("div", { style: { marginTop: "0.5rem" }, children: [_jsx(OAuthSetup, { serviceId: serviceId, serviceDef: serviceDef }), status?.connected && (_jsxs("div", { style: section, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }, children: [_jsx("h4", { style: { margin: 0 }, children: "Organization Mapping" }), !addingOrg && (_jsx("button", { type: "button", style: btnSmall, onClick: () => setAddingOrg(true), children: "+ Add" }))] }), _jsx("p", { style: muted, children: "Map Zoho client companies to Paperclip organizations. Agent and project mappings appear under each organization." }), orgMappings.map((mapping) => (_jsxs("div", { style: { marginBottom: "1.25rem" }, children: [_jsxs("div", { style: row, children: [_jsx("span", { style: { flex: 1, fontSize: "13px" }, children: _jsx("strong", { children: mapping.zohoCompany }) }), _jsx("span", { style: muted, children: "\u2192" }), _jsx("span", { style: { flex: 1, fontSize: "13px" }, children: _jsx("strong", { children: mapping.paperclipCompanyName }) }), _jsx("button", { type: "button", style: btnSmallDanger, onClick: () => handleRemoveOrg(mapping.zohoCompanyId), title: "Remove mapping", children: "x" })] }), _jsxs("div", { style: subsectionStyle, children: [_jsxs("p", { style: { ...muted, marginBottom: "0.5rem", marginTop: "0.25rem" }, children: [_jsx("strong", { children: "Agents" }), " \u2014 ", getUsersForOrg(mapping.zohoCompanyId).length, " Zoho client users"] }), getUsersForOrg(mapping.zohoCompanyId).map((zu) => {
                                        const existingAgent = agentMappings.find((am) => am.zohoUserId === zu.id);
                                        const isIgnored = ignoredItems.some((ig) => ig.type === "agent" && ig.zohoId === zu.id);
                                        return (_jsxs("div", { style: { ...row, fontSize: "12px", opacity: isIgnored ? 0.5 : 1 }, children: [_jsxs("span", { style: { flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [zu.name, " ", _jsxs("span", { style: muted, children: ["(", zu.email, ")"] })] }), _jsx("span", { style: muted, children: "\u2192" }), isIgnored ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { ...muted, flex: 1, fontStyle: "italic" }, children: "Ignored" }), _jsx("button", { type: "button", style: btnSmallDanger, onClick: () => {
                                                                setIgnoredItems((prev) => prev.filter((ig) => !(ig.type === "agent" && ig.zohoId === zu.id)));
                                                                setDirty(true);
                                                            }, title: "Un-ignore", children: "x" })] })) : existingAgent ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { flex: 1 }, children: existingAgent.paperclipAgentName }), _jsx("button", { type: "button", style: btnSmallDanger, onClick: () => {
                                                                setAgentMappings((prev) => prev.filter((a) => a.zohoUserId !== zu.id));
                                                                setDirty(true);
                                                            }, title: "Remove", children: "x" })] })) : (_jsx(Autocomplete, { options: [
                                                        { id: "__hire__", label: "Hire agent...", sublabel: "Create CEO issue" },
                                                        { id: "__ignore__", label: "Ignore", sublabel: "Skip this user" },
                                                        ...getAgentOptionsForCompany(mapping.paperclipCompanyId),
                                                    ], value: "", onChange: (selectedId, selectedName) => {
                                                        if (selectedId === "__hire__") {
                                                            requestHireAgent({ agentName: zu.name, companyId: mapping.paperclipCompanyId });
                                                            return;
                                                        }
                                                        if (selectedId === "__ignore__") {
                                                            setIgnoredItems((prev) => [...prev, { type: "agent", zohoId: zu.id, zohoName: zu.name }]);
                                                            setDirty(true);
                                                            return;
                                                        }
                                                        if (!selectedId)
                                                            return;
                                                        setAgentMappings((prev) => [...prev, {
                                                                zohoUserId: zu.id, zohoName: zu.name,
                                                                paperclipAgentId: selectedId, paperclipAgentName: selectedName,
                                                                org: mapping.zohoCompanyId,
                                                            }]);
                                                        setDirty(true);
                                                    }, placeholder: "Search agent, hire, or ignore..." }))] }, zu.id));
                                    }), getUsersForOrg(mapping.zohoCompanyId).length === 0 && (_jsx("p", { style: muted, children: "No client users found for this company." }))] }), _jsxs("div", { style: subsectionStyle, children: [_jsxs("p", { style: { ...muted, marginBottom: "0.5rem", marginTop: "0.25rem" }, children: [_jsx("strong", { children: "Projects" }), " \u2014 ", getProjectsForOrg(mapping.zohoCompany).length, " Zoho projects"] }), getProjectsForOrg(mapping.zohoCompany).map((zp) => {
                                        const existing = projectMappings.find((pm) => pm.zohoProjectId === zp.id);
                                        const isIgnored = ignoredItems.some((ig) => ig.type === "project" && ig.zohoId === zp.id);
                                        return (_jsxs("div", { style: { ...row, fontSize: "12px", opacity: isIgnored ? 0.5 : 1 }, children: [_jsx("span", { style: { flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: zp.name }), _jsx("span", { style: muted, children: "\u2192" }), isIgnored ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { ...muted, flex: 1, fontStyle: "italic" }, children: "Ignored" }), _jsx("button", { type: "button", style: btnSmallDanger, onClick: () => {
                                                                setIgnoredItems((prev) => prev.filter((ig) => !(ig.type === "project" && ig.zohoId === zp.id)));
                                                                setDirty(true);
                                                            }, title: "Un-ignore", children: "x" })] })) : existing ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { flex: 1 }, children: existing.paperclipProjectName }), _jsx("button", { type: "button", style: btnSmallDanger, onClick: () => {
                                                                setProjectMappings((prev) => prev.filter((p) => p.zohoProjectId !== zp.id));
                                                                setDirty(true);
                                                            }, title: "Remove", children: "x" })] })) : (_jsx(Autocomplete, { options: [
                                                        { id: "__ignore__", label: "Ignore", sublabel: "Skip this project" },
                                                        ...getProjectOptionsForCompany(mapping.paperclipCompanyId),
                                                    ], value: "", onChange: (selectedId, selectedName) => {
                                                        if (selectedId === "__ignore__") {
                                                            setIgnoredItems((prev) => [...prev, { type: "project", zohoId: zp.id, zohoName: zp.name }]);
                                                            setDirty(true);
                                                            return;
                                                        }
                                                        if (!selectedId)
                                                            return;
                                                        setProjectMappings((prev) => [...prev, {
                                                                zohoProjectId: zp.id, zohoProjectName: zp.name,
                                                                paperclipProjectId: selectedId, paperclipProjectName: selectedName,
                                                                org: mapping.zohoCompany,
                                                            }]);
                                                        setDirty(true);
                                                    }, placeholder: "Search project or ignore..." }))] }, zp.id));
                                    }), getProjectsForOrg(mapping.zohoCompany).length === 0 && (_jsx("p", { style: muted, children: "No projects found for this organization." }))] })] }, mapping.zohoCompanyId))), addingOrg && (_jsxs("div", { style: { ...cardStyle, padding: "0.75rem 1rem" }, children: [_jsxs("div", { style: row, children: [_jsx(Autocomplete, { options: zohoClientOptions, value: newOrgZohoId, onChange: (id, label) => { setNewOrgZohoId(id); setNewOrgZohoName(label); }, placeholder: "Search Zoho client company..." }), _jsx("span", { style: muted, children: "\u2192" }), _jsx(Autocomplete, { options: paperclipCompanyOptions, value: newOrgPaperclipId, onChange: (id, label) => { setNewOrgPaperclipId(id); setNewOrgPaperclipName(label); }, placeholder: "Search Paperclip company..." })] }), _jsxs("div", { style: btnGroup, children: [_jsx("button", { type: "button", style: btnPrimary, onClick: handleAddOrg, disabled: !newOrgZohoId || !newOrgPaperclipId, children: "Add Organization" }), _jsx("button", { type: "button", style: btn, onClick: () => { setAddingOrg(false); setNewOrgZohoId(""); setNewOrgZohoName(""); setNewOrgPaperclipId(""); setNewOrgPaperclipName(""); }, children: "Cancel" })] })] })), orgMappings.length === 0 && !addingOrg && (_jsx("p", { style: muted, children: clientsLoading
                            ? "Loading Zoho client companies..."
                            : clientsError
                                ? `Error loading clients: ${clientsError.message}`
                                : zohoClients.length > 0
                                    ? `${zohoClients.length} Zoho client companies found. Click + Add to map them.`
                                    : "No Zoho client companies found. Check your connection." })), dirty && (_jsxs("div", { style: { ...btnGroup, borderTop: "1px solid var(--border)", paddingTop: "0.75rem", marginTop: "1rem" }, children: [_jsx("button", { type: "button", style: btnPrimary, onClick: handleSaveAll, disabled: savingAll, children: savingAll ? "Saving..." : "Save All Mappings" }), _jsx("button", { type: "button", style: btn, onClick: handleRevert, children: "Revert Changes" })] }))] }))] }));
}
// ─── Coming Soon ────────────────────────────────────────────────────────────
function ComingSoonConfig({ serviceDef }) {
    return (_jsx("div", { style: { padding: "1rem 0" }, children: _jsxs("p", { style: muted, children: [serviceDef.description, " \u2014 coming soon."] }) }));
}
// ─── Main Settings Page ─────────────────────────────────────────────────────
export function ProjectBridgeSettingsPage(_props) {
    const { data: services, refresh: refreshServices } = usePluginData("services");
    // We'll poll all service statuses — for now just check any zoho-projects service
    const { data: status, refresh: refreshStatus } = usePluginData("connection-status", {});
    const addService = usePluginAction("add-service");
    const removeService = usePluginAction("remove-service");
    const [addingService, setAddingService] = useState(false);
    const [selectedType, setSelectedType] = useState("");
    const [expandedService, setExpandedService] = useState(null);
    // Poll connection status so badge updates after connect/disconnect
    const statusPollRef = useRef(null);
    useEffect(() => {
        statusPollRef.current = setInterval(() => refreshStatus(), 3000);
        return () => { if (statusPollRef.current)
            clearInterval(statusPollRef.current); };
    }, [refreshStatus]);
    const handleAddService = useCallback(async () => {
        if (!selectedType)
            return;
        const def = AVAILABLE_SERVICES.find((s) => s.type === selectedType);
        if (!def)
            return;
        await addService({ serviceType: def.type, name: def.name });
        setAddingService(false);
        setSelectedType("");
        refreshServices();
    }, [selectedType, addService, refreshServices]);
    const handleRemoveService = useCallback(async (serviceId) => {
        if (!confirm("Remove this service and its configuration?"))
            return;
        await removeService({ serviceId });
        refreshServices();
    }, [removeService, refreshServices]);
    const serviceList = services ?? [];
    const configuredTypes = new Set(serviceList.map((s) => s.type));
    const getServiceButtonLabel = (svc, isExpanded) => {
        if (isExpanded)
            return "Collapse";
        if (svc.type === "zoho-projects" && status?.connected)
            return "Edit";
        return "Setup";
    };
    return (_jsx("div", { style: { padding: "1.5rem", maxWidth: 850 }, children: _jsxs("div", { style: section, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }, children: [_jsx("h3", { style: { margin: 0 }, children: "Connected Services" }), !addingService && (_jsx("button", { type: "button", style: btnSmall, onClick: () => setAddingService(true), children: "+ Add Service" }))] }), addingService && (_jsxs("div", { style: { ...cardStyle, borderColor: "var(--border)" }, children: [_jsxs("div", { style: row, children: [_jsxs("select", { style: { ...selectStyle, minWidth: 220 }, value: selectedType, onChange: (e) => setSelectedType(e.target.value), children: [_jsx("option", { value: "", children: "Select a service..." }), AVAILABLE_SERVICES.map((s) => (_jsxs("option", { value: s.type, disabled: configuredTypes.has(s.type), children: [s.name, configuredTypes.has(s.type) ? " (already added)" : "", s.status === "coming-soon" ? " (coming soon)" : ""] }, s.type)))] }), _jsx("button", { type: "button", style: btnPrimary, onClick: handleAddService, disabled: !selectedType, children: "Add" }), _jsx("button", { type: "button", style: btn, onClick: () => { setAddingService(false); setSelectedType(""); }, children: "Cancel" })] }), selectedType && (_jsx("p", { style: { ...muted, marginTop: "0.5rem", marginBottom: 0 }, children: AVAILABLE_SERVICES.find((s) => s.type === selectedType)?.description }))] })), serviceList.length === 0 && !addingService && (_jsx("p", { style: muted, children: "No services connected yet. Add a service to start syncing projects and tasks." })), serviceList.map((svc) => {
                    const def = AVAILABLE_SERVICES.find((d) => d.type === svc.type);
                    const isExpanded = expandedService === svc.id;
                    const isConnected = svc.type === "zoho-projects" && status?.connected;
                    return (_jsxs("div", { style: cardStyle, children: [_jsxs("div", { style: cardHeaderStyle, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "0.75rem" }, children: [svc.type === "zoho-projects" && _jsx("span", { style: dot(!!isConnected) }), _jsx("strong", { style: { fontSize: "14px" }, children: svc.name }), _jsx("span", { style: badgeStyle(def?.status !== "coming-soon" && !!isConnected), children: def?.status === "coming-soon" ? "Coming Soon" : isConnected ? "Connected" : "Not Connected" })] }), _jsxs("div", { style: { display: "flex", gap: "0.5rem" }, children: [_jsx("button", { type: "button", style: btnSmall, onClick: () => setExpandedService(isExpanded ? null : svc.id), children: getServiceButtonLabel(svc, isExpanded) }), _jsx("button", { type: "button", style: btnSmallDanger, onClick: () => handleRemoveService(svc.id), children: "Remove" })] })] }), !isExpanded && _jsx("p", { style: { ...muted, margin: 0 }, children: def?.description ?? svc.type }), isExpanded && (def?.status === "coming-soon"
                                ? _jsx(ComingSoonConfig, { serviceDef: def })
                                : svc.type === "zoho-projects"
                                    ? _jsx(ZohoProjectsConfig, { serviceId: svc.id })
                                    : _jsx(ComingSoonConfig, { serviceDef: def ?? { type: svc.type, name: svc.name, description: "Unknown service", status: "coming-soon", authType: "none" } }))] }, svc.id));
                })] }) }));
}
//# sourceMappingURL=index.js.map