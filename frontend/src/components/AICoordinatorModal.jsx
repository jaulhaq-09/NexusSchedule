import { useEffect, useState } from "react";
import { aiSuggestCoordinator, aiAssignCoordinator } from "../services/api";

export default function AICoordinatorModal({ subject, onClose, onAssigned }) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    if (!subject) return;
    if (subject._preloaded) {
      setSuggestions(subject._preloaded);
      setLoading(false);
      return;
    }
    aiSuggestCoordinator(subject.id)
      .then((res) => setSuggestions(res.data.suggestions || []))
      .catch((err) => setError(err.response?.data?.detail || "AI suggestion failed"))
      .finally(() => setLoading(false));
  }, [subject]);

  const assign = async (suggestion) => {
    if (!suggestion.faculty_id) {
      setError(`Could not match "${suggestion.faculty_name}" to a faculty record — try re-running AI Analyze All`);
      return;
    }
    setAssigning(suggestion.faculty_name);
    try {
      await aiAssignCoordinator(subject.id, suggestion.faculty_id);
      onAssigned?.(suggestion.faculty_name);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Assignment failed");
      setAssigning(null);
    }
  };

  return (
    <div className="mo" onClick={onClose}>
      <div
        className="mb"
        style={{ maxWidth: 460, textAlign: "left" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mi">🤖</div>
        <div className="mt">AI Suggested Coordinators</div>
        <div className="md" style={{ marginBottom: 18 }}>
          For <span className="mn">"{subject?.subject_name}"</span>
        </div>

        {loading && (
          <div style={{ textAlign: "center", color: "#64748B", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: "16px 0" }}>
            Thinking…
          </div>
        )}

        {error && (
          <div style={{ color: "#F87171", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", marginBottom: 12 }}>
            ⚠ {error}
          </div>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <div style={{ color: "#64748B", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
            No suggestions available.
          </div>
        )}

        {suggestions.map((s) => (
          <div
            key={s.rank}
            style={{
              padding: "12px 14px",
              marginBottom: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: "#EAB308", fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                #{s.rank} — {s.faculty_name}
              </span>
              <button
                className="bs"
                disabled={assigning === s.faculty_name}
                onClick={() => assign(s)}
              >
                {assigning === s.faculty_name ? "…" : "Assign"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>{s.reasoning}</div>
          </div>
        ))}

        <div className="ma" style={{ marginTop: 8 }}>
          <button className="bca" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}