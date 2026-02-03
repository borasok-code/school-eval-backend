import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
const DRIVE_FOLDER_URL = import.meta.env.VITE_DRIVE_FOLDER_URL || "";

console.log("Using API base URL:", API);

const STATUS_TONES = {
  NOT_STARTED: { bg: "#f1f3f5", border: "#ced4da", text: "#495057" },
  IN_PROGRESS: { bg: "#fff3bf", border: "#f08c00", text: "#a65b00" },
  COMPLETED: { bg: "#d3f9d8", border: "#37b24d", text: "#1b4332" }
};

const getStatusTone = (status) => STATUS_TONES[status] || STATUS_TONES.NOT_STARTED;

function Badge({ children, style }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      border: "1px solid #ddd",
      fontSize: 12,
      marginLeft: 8,
      ...style
    }}>{children}</span>
  );
}

function StatusPill({ status }) {
  const label = status ?? "NOT_STARTED";
  const tone = getStatusTone(label);
  return (
    <Badge style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}>
      {label}
    </Badge>
  );
}

function SchoolBanner() {
  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 18,
        border: "1px solid #1b4965",
        backgroundImage: "linear-gradient(135deg, #0b132b 0%, #1c2541 45%, #3a506b 100%)",
        color: "#f8f9fa",
        boxShadow: "0 12px 30px rgba(11,19,43,0.25)"
      }}
    >
      <div
        style={{
          marginTop: 6,
          fontSize: 24,
          fontWeight: 800,
          fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
          letterSpacing: 0.4
        }}
      >
        Chea Sim Samaki High School
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "#d0ebff" }}>
        Excellence • Character • Community
      </div>
    </div>
  );
}

export default function App() {
  const [standards, setStandards] = useState([]);
  const [selected, setSelected] = useState(null);
  const [standardDetail, setStandardDetail] = useState(null);
  const [indicatorDetail, setIndicatorDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherRole, setNewTeacherRole] = useState("TEACHER");
  const [savingTeacher, setSavingTeacher] = useState(false);

  useEffect(() => {
    console.log("Fetching standards from", API + "/api/standards");
    fetch(`${API}/api/standards`)
      .then(async (r) => {
        console.log("/api/standards status", r.status);
        if (!r.ok) {
          const errorBody = await r.text().catch(() => "");
          console.error("/api/standards error body", errorBody);
          throw new Error(`Standards request failed: ${r.status}`);
        }
        return r.json();
      })
      .then(data => { console.log("standards payload length", (data || []).length); setStandards(data); })
      .catch(err => { console.error("Failed to fetch standards:", err); });

    fetch(`${API}/api/users`)
      .then(r => r.json())
      .then(setUsers)
      .catch(err => { console.error("Failed to fetch users:", err); });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setIndicatorDetail(null);
    fetch(`${API}/api/standards/${selected}`).then(r => r.json()).then(setStandardDetail);
  }, [selected]);

  const headerStyle = { display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #eee" };
  const layout = { display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" };
  const selectStyle = { padding: "6px 8px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontSize: 12 };
  const inputStyle = { padding: "6px 8px", borderRadius: 10, border: "1px solid #ddd", fontSize: 12, width: "100%" };

  const refreshStandards = async () => {
    const data = await fetch(`${API}/api/standards`).then(r => r.json());
    setStandards(data);
  };

  const refreshStandardDetail = async (id) => {
    if (!id) return;
    const data = await fetch(`${API}/api/standards/${id}`).then(r => r.json());
    setStandardDetail(data);
  };

  const refreshIndicatorDetail = async (id) => {
    if (!id) return;
    const data = await fetch(`${API}/api/indicators/${id}`).then(r => r.json());
    setIndicatorDetail(data);
  };

  const createTeacher = async () => {
    const name = newTeacherName.trim();
    if (!name) return;
    setSavingTeacher(true);
    await fetch(`${API}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: newTeacherRole })
    });
    setNewTeacherName("");
    setNewTeacherRole("TEACHER");
    const data = await fetch(`${API}/api/users`).then(r => r.json());
    setUsers(data);
    setSavingTeacher(false);
  };

  const updateStandardOwner = async (ownerId) => {
    if (!standardDetail?.id) return;
    await fetch(`${API}/api/standards/${standardDetail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId })
    });
    await refreshStandardDetail(standardDetail.id);
  };

  const updateIndicatorManager = async (indicatorId, managerId) => {
    await fetch(`${API}/api/indicators/${indicatorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId })
    });
    await refreshStandardDetail(standardDetail?.id);
    if (indicatorDetail?.id === indicatorId) {
      await refreshIndicatorDetail(indicatorId);
    }
  };

  return (
    <div style={layout}>
      <aside style={{ borderRight: "1px solid #eee", overflow: "auto" }}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontWeight: 700 }}>School Evaluation</div>
            <div style={{ fontSize: 12, color: "#666" }}>Standards dashboard</div>
          </div>
        </div>

        <div style={{ padding: 12 }}>
          {standards.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 12,
                marginBottom: 10,
                borderRadius: 12,
                border: selected === s.id ? "2px solid #111" : "1px solid #ddd",
                background: "white",
                cursor: "pointer"
              }}
            >
              <div style={{ fontWeight: 700 }}>Standard {s.standardNo}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Indicators: {s.stats?.completed}/{s.stats?.total} • Avg progress: {s.stats?.avgProgress}%
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid #eee" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Teachers</div>
          <div style={{ display: "grid", gap: 6 }}>
            {users.map(u => (
              <div key={u.id} style={{ fontSize: 12, color: "#555" }}>
                {u.name} <span style={{ color: "#888" }}>({u.role})</span>
              </div>
            ))}
            {users.length === 0 ? (
              <div style={{ fontSize: 12, color: "#888" }}>No teachers yet.</div>
            ) : null}
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <input
              placeholder="Teacher name"
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              style={inputStyle}
            />
            <select
              value={newTeacherRole}
              onChange={(e) => setNewTeacherRole(e.target.value)}
              style={selectStyle}
            >
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              onClick={createTeacher}
              style={{ ...btnStyle, width: "100%" }}
              disabled={savingTeacher || !newTeacherName.trim()}
            >
              {savingTeacher ? "Saving…" : "Add teacher"}
            </button>
          </div>
        </div>
      </aside>

      <main style={{ overflow: "auto" }}>
        <div style={{ padding: 16 }}>
          <SchoolBanner />
        </div>
        {!standardDetail ? (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: 0 }}>Choose a standard</h2>
            <p style={{ color: "#555" }}>
              Click a Standard on the left. Then you can open indicators and update checklist status.
            </p>
          </div>
        ) : (
          <div>
            <div style={headerStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  Standard {standardDetail.standardNo}
                </div>
                <div style={{ color: "#555", marginTop: 4 }}>{standardDetail.title}</div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#666" }}>Owner</span>
                  <select
                    value={standardDetail.ownerId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateStandardOwner(value ? Number(value) : null);
                    }}
                    style={selectStyle}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                Indicators: {standardDetail.indicators?.length ?? 0}
              </div>
            </div>

            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Indicators</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {standardDetail.indicators.map(ind => {
                    const tone = getStatusTone(ind.status);
                    return (
                      <div
                        key={ind.id}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${tone.border}`,
                          background: tone.bg
                        }}
                      >
                      <button
                        onClick={() => {
                          fetch(`${API}/api/indicators/${ind.id}`).then(r => r.json()).then(setIndicatorDetail);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{ind.code} — {ind.name}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                          <StatusPill status={ind.status} />
                          <Badge>{ind.progress ?? 0}%</Badge>
                        </div>
                      </button>
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#666" }}>Manager</span>
                        <select
                          value={ind.managerId ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateIndicatorManager(ind.id, value ? Number(value) : null);
                          }}
                          style={selectStyle}
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>

              <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 14 }}>
                {!indicatorDetail ? (
                  <div style={{ color: "#666" }}>
                    Open an indicator to view its checklist requirements.
                  </div>
                ) : (
                  <IndicatorView
                    api={API}
                    driveFolderUrl={DRIVE_FOLDER_URL}
                    indicator={indicatorDetail}
                    onRefresh={async () => {
                      await refreshIndicatorDetail(indicatorDetail.id);
                      await refreshStandards();
                      await refreshStandardDetail(standardDetail.id);
                    }}
                  />
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function IndicatorView({ api, driveFolderUrl, indicator, onRefresh }) {
  const [saving, setSaving] = useState(false);
  const [deleteStates, setDeleteStates] = useState({});
  const [linkStates, setLinkStates] = useState({});
  const [linkInputs, setLinkInputs] = useState({});

  const progress = useMemo(() => {
    const list = indicator.checklist ?? [];
    if (!list.length) return 0;
    const done = list.filter(i => i.status === "COMPLETED").length;
    return Math.round((done / list.length) * 100);
  }, [indicator]);

  useEffect(() => {
    setDeleteStates({});
    setLinkStates({});
    setLinkInputs({});
  }, [indicator.id]);

  const setDeleteState = (evidenceId, next) => {
    setDeleteStates(prev => ({ ...prev, [evidenceId]: { ...(prev[evidenceId] || {}), ...next } }));
  };

  const setLinkState = (itemId, next) => {
    setLinkStates(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), ...next } }));
  };

  const setLinkInput = (itemId, next) => {
    setLinkInputs(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), ...next } }));
  };

  async function setChecklistStatus(itemId, status) {
    setSaving(true);
    await fetch(`${api}/api/checklist-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    // Update indicator progress & status (simple rule)
    const nextStatus = progress === 100 ? "COMPLETED" : "IN_PROGRESS";
    await fetch(`${api}/api/indicators/${indicator.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress, status: nextStatus })
    });
    setSaving(false);
    onRefresh();
  }

  async function addEvidenceLink(itemId) {
    const url = String(linkInputs[itemId]?.url || "").trim();
    const filename = String(linkInputs[itemId]?.name || "").trim();
    if (!url) {
      setLinkState(itemId, { status: "error", message: "Drive link required" });
      return;
    }

    setLinkState(itemId, { status: "saving", message: "Saving..." });
    try {
      const response = await fetch(`${api}/api/checklist-items/${itemId}/evidence-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          filename: filename || undefined,
          uploadedBy: "Teacher"
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Save failed");
      }

      setLinkState(itemId, { status: "success", message: "Link saved" });
      setLinkInput(itemId, { url: "", name: "" });
      await onRefresh();
    } catch (error) {
      setLinkState(itemId, { status: "error", message: error?.message || "Save failed" });
    }
  }

  async function deleteEvidence(evidenceId) {
    if (!evidenceId) return;
    const confirmed = window.confirm("Delete this uploaded file?");
    if (!confirmed) return;

    setDeleteState(evidenceId, { status: "deleting", message: "Deleting..." });
    try {
      const response = await fetch(`${api}/api/evidence/${evidenceId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Delete failed");
      }

      setDeleteState(evidenceId, { status: "success", message: "Deleted" });
      await onRefresh();
    } catch (error) {
      setDeleteState(evidenceId, { status: "error", message: error?.message || "Delete failed" });
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{indicator.code} — {indicator.name}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            <StatusPill status={indicator.status} />
            <Badge>{progress}% checklist done</Badge>
            {saving ? <Badge>Saving…</Badge> : null}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {(indicator.checklist ?? []).map(item => {
          const tone = getStatusTone(item.status);
          return (
            <div key={item.id} style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 13 }}>{item.text}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setChecklistStatus(item.id, "NOT_STARTED")} style={btnStyle}>Not started</button>
                <button onClick={() => setChecklistStatus(item.id, "IN_PROGRESS")} style={btnStyle}>In progress</button>
                <button onClick={() => setChecklistStatus(item.id, "COMPLETED")} style={btnStyle}>Completed</button>
                <StatusPill status={item.status} />
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      if (driveFolderUrl) {
                        window.open(driveFolderUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                    style={btnStyle}
                    disabled={!driveFolderUrl}
                    title={driveFolderUrl ? "Open Drive folder" : "Set VITE_DRIVE_FOLDER_URL to enable"}
                  >
                    Upload via Drive
                  </button>
                  {!driveFolderUrl ? (
                    <span style={{ fontSize: 12, color: "#b00020" }}>
                      Drive folder URL not set.
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Paste Drive file link"
                    value={linkInputs[item.id]?.url || ""}
                    onChange={(event) => setLinkInput(item.id, { url: event.target.value })}
                    style={evidenceInputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Display name (optional)"
                    value={linkInputs[item.id]?.name || ""}
                    onChange={(event) => setLinkInput(item.id, { name: event.target.value })}
                    style={evidenceInputStyle}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => addEvidenceLink(item.id)}
                      style={btnStyle}
                      disabled={linkStates[item.id]?.status === "saving"}
                    >
                      Save link
                    </button>
                    {linkStates[item.id]?.status === "saving" ? <Badge>Saving...</Badge> : null}
                    {linkStates[item.id]?.status === "success" ? <Badge>Saved</Badge> : null}
                    {linkStates[item.id]?.status === "error" ? (
                      <span style={{ fontSize: 12, color: "#b00020" }}>
                        {linkStates[item.id]?.message || "Save failed"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {(item.evidence ?? []).length ? (
                  (item.evidence ?? []).map(e => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={e.webViewLink || e.path}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#1a73e8", textDecoration: "none" }}
                      >
                        {e.filename || "Evidence link"}
                      </a>
                      <button
                        onClick={() => deleteEvidence(e.id)}
                        style={{ ...btnStyle, padding: "4px 8px" }}
                        disabled={deleteStates[e.id]?.status === "deleting"}
                      >
                        Delete
                      </button>
                      {deleteStates[e.id]?.status === "deleting" ? <Badge>Deleting...</Badge> : null}
                      {deleteStates[e.id]?.status === "error" ? (
                        <span style={{ fontSize: 12, color: "#b00020" }}>
                          {deleteStates[e.id]?.message || "Delete failed"}
                        </span>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: "#666" }}>No evidence uploaded yet.</span>
                )}
              </div>
            </div>
          );
        })}
        {(!indicator.checklist || indicator.checklist.length === 0) ? (
          <div style={{ color: "#666" }}>No checklist items found for this indicator.</div>
        ) : null}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
  fontSize: 12
};

const evidenceInputStyle = {
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid #ddd",
  fontSize: 12,
  width: "100%"
};
