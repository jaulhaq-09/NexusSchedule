import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";

const ROLE_LABEL = { admin: "ADMIN", coordinator: "COORDINATOR", faculty: "FACULTY", user: "USER" };

const readUser = () => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } };

const initials = (name, email) => {
    const src = (name || email || "?").trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
};

// Resize a picked image to max 256px JPEG so it stays small in the database.
const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Not a valid image"));
        img.onload = () => {
            const max = 256;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
});

const Avatar = ({ photo, label, size }) => (
    <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size > 40 ? "17px" : "13px", fontWeight: "700", color: "#EAB308", fontFamily: "Sora,sans-serif",
    }}>
        {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : label}
    </div>
);

const labelSt = { display: "block", fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" };
const inputSt = { width: "100%", boxSizing: "border-box", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#F0EDE8", fontSize: "13px", fontFamily: "Sora, sans-serif", outline: "none" };

export default function ProfileMenu({ onLogout }) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [user, setUser] = useState(readUser());
    const [phone, setPhone] = useState("");
    const [photo, setPhoto] = useState("");
    const [deptName, setDeptName] = useState("");
    const [name, setName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editPhoto, setEditPhoto] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const fileRef = useRef(null);

    useEffect(() => {
        API.get("/auth/me/profile").then(r => { setPhone(r.data.phone || ""); setPhoto(r.data.photo || ""); }).catch(() => { });
    }, []);

    useEffect(() => {
        if (user.department_id == null) { setDeptName(""); return; }
        API.get("/departments").then(r => {
            const d = (r.data || []).find(x => x.id === user.department_id);
            setDeptName(d ? d.name : "");
        }).catch(() => { });
    }, [user.department_id]);

    const openEdit = () => {
        setName(user.name || ""); setEditPhone(phone); setEditPhoto(photo); setErr("");
        setOpen(false); setEditing(true);
    };

    const pickPhoto = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!f) return;
        try { setEditPhoto(await resizeImage(f)); setErr(""); }
        catch (ex) { setErr(ex.message || "Could not use that image"); }
    };

    const save = async () => {
        if (!name.trim()) { setErr("Name is required"); return; }
        setSaving(true); setErr("");
        try {
            const body = { name: name.trim(), phone: editPhone.trim() };
            if (!editPhoto && photo) body.remove_photo = true;
            else if (editPhoto && editPhoto !== photo) body.photo = editPhoto;
            const r = await API.put("/auth/me/profile", body);
            const next = { ...readUser(), name: r.data.name };
            localStorage.setItem("user", JSON.stringify(next));
            setUser(next); setPhone(r.data.phone || ""); setPhoto(r.data.photo || "");
            setEditing(false);
        } catch (ex) {
            const d = ex.response?.data?.detail;
            setErr(typeof d === "string" ? d : "Could not save profile");
        } finally { setSaving(false); }
    };

    const email = user.email || localStorage.getItem("userEmail") || "";
    const label = initials(user.name, email);
    const firstName = (user.name || email).split(/\s+/)[0];
    const role = localStorage.getItem("userRole") || user.role || "user";

    const row = { display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "Sora,sans-serif" };
    const iconBox = { width: "34px", height: "34px", borderRadius: "9px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#94A3B8", flexShrink: 0 };

    return (
        <div style={{ position: "relative" }}>
            <button onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Sora,sans-serif" }}>
                <Avatar photo={photo} label={label} size={34} />
            </button>

            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                    <div style={{
                        position: "absolute", top: "46px", right: 0, zIndex: 999, width: "300px", borderRadius: "14px",
                        background: "rgba(20,22,30,0.98)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)", overflow: "hidden", fontFamily: "Sora,sans-serif",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px" }}>
                            <Avatar photo={photo} label={label} size={52} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#F0EDE8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || email}</div>
                                <div style={{ fontSize: "11.5px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }}>{email}</div>
                                <span style={{ fontSize: "9.5px", fontWeight: "700", letterSpacing: "0.8px", padding: "2px 8px", borderRadius: "10px", background: "rgba(234,179,8,0.12)", color: "#EAB308", border: "1px solid rgba(234,179,8,0.25)", fontFamily: "JetBrains Mono, monospace" }}>{ROLE_LABEL[role] || role.toUpperCase()}</span>
                            </div>
                        </div>

                        {(deptName || user.cluster != null) && (
                            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                                {deptName && (<>
                                    <div style={{ fontSize: "10.5px", color: "#64748B", marginBottom: "3px" }}>Department</div>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#F0EDE8", marginBottom: "8px" }}>{deptName}</div>
                                </>)}
                                {user.cluster != null && (
                                    <span style={{ fontSize: "10.5px", fontWeight: "600", padding: "3px 10px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}>CLUSTER-{user.cluster}</span>
                                )}
                            </div>
                        )}

                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                            <button onClick={openEdit} style={row}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                                <span style={iconBox}>✎</span>
                                <span style={{ flex: 1 }}>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#F0EDE8" }}>Edit profile</div>
                                    <div style={{ fontSize: "11px", color: "#64748B" }}>Name, photo and phone</div>
                                </span>
                                <span style={{ color: "#64748B" }}>›</span>
                            </button>
                        </div>
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                            <button onClick={onLogout} style={row}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,0.08)"}
                                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                                <span style={{ ...iconBox, color: "#F43F5E" }}>⏻</span>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: "#F43F5E" }}>Log out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {editing && (
                <div onClick={() => setEditing(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "400px", background: "rgba(20,22,30,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "24px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", fontFamily: "Sora,sans-serif" }}>
                        <h3 style={{ margin: "0 0 18px", fontSize: "16px", fontWeight: "700", color: "#F0EDE8" }}>Edit profile</h3>

                        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
                            <Avatar photo={editPhoto} label={initials(name, email)} size={64} />
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
                                <button onClick={() => fileRef.current.click()} style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", color: "#EAB308", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>Upload photo</button>
                                {editPhoto && <button onClick={() => setEditPhoto("")} style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>Remove</button>}
                            </div>
                        </div>

                        <label style={labelSt}>Name</label>
                        <input style={{ ...inputSt, marginBottom: "14px" }} value={name} onChange={e => setName(e.target.value)} />
                        <label style={labelSt}>Phone</label>
                        <input style={{ ...inputSt, marginBottom: "14px" }} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. 9876543210" />
                        <label style={labelSt}>Email</label>
                        <input style={{ ...inputSt, marginBottom: "6px", opacity: 0.6 }} value={email} disabled />

                        {err && <div style={{ fontSize: "12px", color: "#F87171", marginTop: "10px" }}>{err}</div>}

                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                            <button onClick={() => setEditing(false)} style={{ padding: "10px 18px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", cursor: "pointer", fontSize: "12.5px", fontWeight: "600", fontFamily: "Sora,sans-serif" }}>Cancel</button>
                            <button onClick={save} disabled={saving} style={{ padding: "10px 22px", borderRadius: "8px", background: "#EAB308", border: "none", color: "#0A0C12", cursor: saving ? "wait" : "pointer", fontSize: "12.5px", fontWeight: "700", fontFamily: "Sora,sans-serif" }}>{saving ? "Saving…" : "Save"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}