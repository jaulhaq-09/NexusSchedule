import React, { useEffect, useState } from 'react';

const MonitoringDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [endpoints, setEndpoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch metrics every 5 seconds
    const fetchMetrics = async () => {
      try {
        const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
        const metricsResponse = await fetch('http://localhost:8000/api/metrics', authHeaders);
        const endpointsResponse = await fetch('http://localhost:8000/api/metrics/endpoints', authHeaders);
        
        if (!metricsResponse.ok || !endpointsResponse.ok) {
          throw new Error('Failed to fetch metrics');
        }
        
        const metricsData = await metricsResponse.json();
        const endpointsData = await endpointsResponse.json();
        
        setMetrics(metricsData);
        setEndpoints(endpointsData);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
        setError('Failed to load metrics. Make sure backend is running.');
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchMetrics();

    // Then fetch every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px", padding: "40px", textAlign: "center",
        color: "#F0EDE8", fontSize: "14px", fontFamily: "Sora, sans-serif"
      }}>
        ⏳ Loading metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: "16px", padding: "40px", textAlign: "center",
        color: "#F87171", fontSize: "14px", fontFamily: "Sora, sans-serif"
      }}>
        ❌ {error}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px", padding: "40px", textAlign: "center",
        color: "#94A3B8", fontSize: "14px", fontFamily: "Sora, sans-serif"
      }}>
        No metrics available
      </div>
    );
  }

  // ✅ Derived, not fake — computed live from real request_count/error_count
  const successRate = metrics.request_count > 0
    ? (((metrics.request_count - metrics.error_count) / metrics.request_count) * 100).toFixed(1)
    : 100;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "24px",
      animation: "fadeInUp 0.5s ease",
      fontFamily: "Sora, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* Metrics Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "16px"
      }}>
        {/* Total Requests */}
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(129,140,248,0.3)",
          borderRadius: "16px", padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "10px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Total Requests
          </div>
          <div style={{ fontSize: "30px", fontWeight: "800", color: "#818CF8", marginBottom: "4px", fontFamily: "JetBrains Mono, monospace" }}>
            {metrics.request_count}
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8" }}>
            API calls received
          </div>
        </div>

        {/* Success Rate — derived live from real counts */}
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
          border: `1px solid ${successRate >= 99 ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"}`,
          borderRadius: "16px", padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "10px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Success Rate
          </div>
          <div style={{
            fontSize: "30px", fontWeight: "800",
            color: successRate >= 99 ? "#34D399" : "#F59E0B",
            marginBottom: "4px", fontFamily: "JetBrains Mono, monospace"
          }}>
            {successRate}%
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8" }}>
            {metrics.request_count - metrics.error_count} of {metrics.request_count} succeeded
          </div>
        </div>

        {/* Errors */}
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
          border: metrics.error_count > 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(52,211,153,0.3)",
          borderRadius: "16px", padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "10px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Errors
          </div>
          <div style={{
            fontSize: "30px",
            fontWeight: "800",
            color: metrics.error_count > 0 ? "#F87171" : "#34D399",
            marginBottom: "4px",
            fontFamily: "JetBrains Mono, monospace"
          }}>
            {metrics.error_count}
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8" }}>
            {metrics.error_count === 0 ? "All systems operational" : "Errors detected"}
          </div>
        </div>

        {/* Avg Response Time */}
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: "16px", padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "10px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Avg Response Time
          </div>
          <div style={{ fontSize: "30px", fontWeight: "800", color: "#EAB308", marginBottom: "4px", fontFamily: "JetBrains Mono, monospace" }}>
            {metrics.avg_response_time_ms.toFixed(2)}ms
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8" }}>
            Average API latency
          </div>
        </div>

        {/* Uptime */}
        <div style={{
          background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(168,85,247,0.3)",
          borderRadius: "16px", padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "10px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "1.2px", textTransform: "uppercase" }}>
            Uptime
          </div>
          <div style={{ fontSize: "30px", fontWeight: "800", color: "#A855F7", marginBottom: "4px", fontFamily: "JetBrains Mono, monospace" }}>
            {Math.floor(metrics.uptime_seconds / 60)}m
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8" }}>
            {Math.floor(metrics.uptime_seconds)}s elapsed
          </div>
        </div>
      </div>

      {/* Endpoints Table */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#F0EDE8" }}>
            🔍 Endpoint Activity
          </h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px"
          }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "12px 24px", textAlign: "left", color: "#64748B", fontWeight: "700", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" }}>
                  Endpoint
                </th>
                <th style={{ padding: "12px 24px", textAlign: "center", color: "#64748B", fontWeight: "700", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" }}>
                  Requests
                </th>
                <th style={{ padding: "12px 24px", textAlign: "center", color: "#64748B", fontWeight: "700", fontSize: "10px", letterSpacing: "1.2px", textTransform: "uppercase" }}>
                  Errors
                </th>
              </tr>
            </thead>
            <tbody>
              {endpoints && Object.entries(endpoints.endpoints).length > 0 ? (
                Object.entries(endpoints.endpoints)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([path, stats], idx) => (
                    <tr 
                      key={path} 
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}
                    >
                      <td style={{ padding: "13px 24px", color: "#F0EDE8" }}>
                        {path}
                      </td>
                      <td style={{ padding: "13px 24px", textAlign: "center", color: "#818CF8", fontWeight: "600" }}>
                        {stats.count}
                      </td>
                      <td style={{
                        padding: "13px 24px",
                        textAlign: "center",
                        color: stats.errors > 0 ? "#F87171" : "#34D399",
                        fontWeight: stats.errors > 0 ? "700" : "600"
                      }}>
                        {stats.errors}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: "40px 24px", textAlign: "center", color: "#64748B" }}>
                    No endpoint data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "11px",
        color: "#34D399",
        fontFamily: "JetBrains Mono, monospace",
        justifyContent: "center"
      }}>
        <div style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "#34D399",
          animation: "pulse 2s infinite"
        }}></div>
        Live updates (refreshing every 5 seconds)
      </div>
    </div>
  );
};

export default MonitoringDashboard;