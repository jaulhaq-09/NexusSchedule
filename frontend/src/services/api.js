import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || "";
      if (!url.includes("/auth/login") && !url.includes("/auth/signup")) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const signup = (data) => API.post("/auth/signup", data);
export const login = (data) => API.post("/auth/login", data);
export const getMe = () => API.get("/auth/me");
export const getUsers = () => API.get("/auth/users");
export const createUser = (data) => API.post("/auth/users", data);
export const updateUserRole = (id, role, facultyId, departmentId, cluster) => API.patch(`/auth/users/${id}/role`, { role, faculty_id: facultyId ?? null, department_id: departmentId ?? null, cluster: cluster ?? null });
export const createFacultyLogin = (facultyId, password) => API.post("/auth/users/from-faculty", { faculty_id: facultyId, password });
export const getDepartments = () => API.get("/departments");
export const resetUserPassword = (id, password) => API.post(`/auth/users/${id}/reset-password`, { password });
export const updateUserStatus = (id, isActive) => API.patch(`/auth/users/${id}/status`, { is_active: isActive });
export const deleteUser = (id) => API.delete(`/auth/users/${id}`);
export const updateUserProfile = (id, name) => API.patch(`/auth/users/${id}/profile`, { name });

// ── FACULTY ───────────────────────────────────────────────────────────────────
export const getFaculty = () => API.get("/faculty");
export const addFaculty = (data) => API.post("/faculty", data);
export const updateFaculty = (id, d) => API.put(`/faculty/${id}`, d);
export const deleteFaculty = (id) => API.delete(`/faculty/${id}`);

// ── SUBJECTS ──────────────────────────────────────────────────────────────────
export const getSubjects = () => API.get("/subjects");
export const addSubject = (data) => API.post("/subjects", data);
export const updateSubject = (id, d) => API.put(`/subjects/${id}`, d);
export const deleteSubject = (id) => API.delete(`/subjects/${id}`);

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiSuggestCoordinator = (subjectId) =>
  API.post("/ai/suggest-coordinator", { subject_id: subjectId });
export const aiAssignCoordinator = (subjectId, facultyName) =>
  API.post("/ai/assign-coordinator", null, { params: { subject_id: subjectId, faculty_id: facultyName } });
export const aiIdentifyCoreSubjects = () =>
  API.get("/ai/identify-core-subjects");
export const aiTodayWorkload = () =>
  API.get("/timetable/today-workload");
export const aiLabUtilization = () =>
  API.get("/labs/utilization");
export const aiSuggestCoordinatorsBulk = () =>
  API.get("/ai/suggest-coordinators-bulk");

// ── ROOMS ─────────────────────────────────────────────────────────────────────
export const getRooms = () => API.get("/rooms");
export const addRoom = (data) => API.post("/rooms", data);
export const updateRoom = (id, d) => API.put(`/rooms/${id}`, d);
export const deleteRoom = (id) => API.delete(`/rooms/${id}`);

// ── LABS ──────────────────────────────────────────────────────────────────────
export const getLabs = () => API.get("/labs/");
export const addLab = (data) => API.post("/labs/", data);
export const updateLab = (id, d) => API.put(`/labs/${id}`, d);
export const deleteLab = (id) => API.delete(`/labs/${id}`);

// ── SECTIONS ──────────────────────────────────────────────────────────────────
export const getSections = () => API.get("/sections");
export const addSection = (data) => API.post("/sections", data);
export const updateSection = (id, d) => API.put(`/sections/${id}`, d);
export const deleteSection = (id) => API.delete(`/sections/${id}`);

// ── TIMETABLE ─────────────────────────────────────────────────────────────────
export const getTimetable = (day) => API.get("/timetable/view", { params: day ? { day } : {} });

// ── OCR TABLE EXTRACTION ──────────────────────────────────────────────────────
export const ocrExtractTable = async (file, target = "faculty") => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await API.post(`/ocr/extract-table?target=${target}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return res.data;
};

// ── BULK IMPORTS ──────────────────────────────────────────────────────────────
export const bulkImportFaculty = async (records) => {
  const res = await API.post("/faculty/bulk", { records });
  return { data: res.data };
};

export const bulkImportSubjects = async (records) => {
  const res = await API.post("/subjects/bulk", { records });
  return { data: res.data };
};

export const bulkImportRooms = async (records) => {
  const res = await API.post("/rooms/bulk", records);
  return { data: res.data };
};

export const bulkImportSections = async (records) => {
  const res = await API.post("/sections/bulk", records);
  return { data: res.data };
};

export const bulkImportLabs = async (records) => {
  const res = await API.post("/labs/bulk", { records });
  return { data: res.data };
};

// ── SAVED TIMETABLES ──────────────────────────────────────────────────────────
export const savedTimetablesAPI = {
  async getAll() {
    try {
      const res = await API.get("/saved-timetables/");
      return res.data || [];
    } catch (err) {
      console.error("Failed to fetch saved timetables:", err);
      return [];
    }
  },

  async save(entry) {
    try {
      const res = await API.post("/saved-timetables/", entry);
      return res.data;
    } catch (err) {
      console.error("Failed to save timetable:", err);
      throw err;
    }
  },

  async getOne(id) {
    try {
      const res = await API.get(`/saved-timetables/${id}`);
      return res.data;
    } catch (err) {
      console.error(`Failed to fetch timetable ${id}:`, err);
      throw err;
    }
  },

  async delete(id) {
    try {
      await API.delete(`/saved-timetables/${id}`);
    } catch (err) {
      console.error(`Failed to delete timetable ${id}:`, err);
      throw err;
    }
  },

  async archive(id, isArchived = true) {
    try {
      const res = await API.patch(`/saved-timetables/${id}`, { is_archived: isArchived });
      return res.data;
    } catch (err) {
      console.error(`❌ Failed to archive timetable ${id}:`, err);
      throw err;
    }
  },

  async search(filters = {}) {
    try {
      const params = new URLSearchParams();

      if (filters.academic_year) {
        console.log("📤 Sending filter: academic_year =", filters.academic_year);
        params.append("academic_year", filters.academic_year);
      }
      if (filters.semester !== undefined && filters.semester !== "") {
        console.log("📤 Sending filter: semester =", filters.semester);
        params.append("semester", filters.semester);
      }
      if (filters.department_id !== undefined && filters.department_id !== "") {
        console.log("📤 Sending filter: department_id =", filters.department_id);
        params.append("department_id", filters.department_id);
      }
      if (filters.cluster !== undefined && filters.cluster !== "") {
        console.log("📤 Sending filter: cluster =", filters.cluster);
        params.append("cluster", filters.cluster);
      }
      if (filters.section_id) {
        console.log("📤 Sending filter: section_id =", filters.section_id);
        params.append("section_id", filters.section_id);
      }
      if (filters.is_archived !== undefined) {
        console.log("📤 Sending filter: is_archived =", filters.is_archived);
        params.append("is_archived", filters.is_archived);
      }

      const queryString = params.toString();
      const url = `/saved-timetables/search${queryString ? '?' + queryString : ''}`;
      console.log("🌐 Search URL:", url);

      const res = await API.get(url);
      console.log("📥 Backend returned:", res.data?.length || 0, "results");
      return res.data || [];
    } catch (err) {
      console.error("❌ Failed to search timetables:", err);
      return [];
    }
  },

  async loadFromLocalStorage() {
    try {
      const local = JSON.parse(localStorage.getItem("saved_timetables") || "[]");
      return local;
    } catch {
      return [];
    }
  },

  async syncFromLocalStorage() {
    try {
      const localTimetables = await this.loadFromLocalStorage();
      let synced = 0;

      for (const tt of localTimetables) {
        try {
          await this.save(tt);
          synced++;
        } catch (err) {
          console.warn(`Failed to sync timetable ${tt.label}:`, err);
        }
      }

      console.log(`✅ Synced ${synced}/${localTimetables.length} timetables to database`);
      return synced;
    } catch (err) {
      console.error("Failed to sync from localStorage:", err);
      return 0;
    }
  },
};

// ── ADMIN ─────────────────────────────────────────────────────────────────────
// ── ADMIN ─────────────────────────────────────────────────────────────────────
export const clearAll = () => API.delete("/clear-all");
export const getAuditLogs = (limit = 10) => API.get("/audit-logs", { params: { limit } });

// ── INSTITUTION CONFIG ────────────────────────────────────────────────────────
export const getInstitutionConfig = () => API.get('/institution-config');
export const updateInstitutionConfig = (data) => API.put('/institution-config', data);
export const applyStructure = () => API.post('/institution-config/apply-structure');
export const getStructureInfo = () => API.get('/institution-config/structure-info');
export const resetInstitutionConfig = () => API.post('/institution-config/reset');
export const toggleSubjectCore = (id, isCore) =>
  API.patch(`/subjects/${id}/core`, { is_core: isCore });

export const uploadLogo = (formData) => API.post('/institution-config/upload-logo', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// ── FACULTY TIMETABLE ✅ FIXED ────────────────────────────────────────────────
export const facultyTimetableAPI = {
  save(data) {
    return API.post("/saved-faculty-tt/", data)
      .then(res => res.data)
      .catch(err => { console.error("Save faculty TT error:", err); return null; });
  },

  getAll() {
    return API.get("/saved-faculty-tt/")
      .then(res => res.data)
      .catch(err => { console.error("Fetch faculty TT error:", err); return []; });
  },

  getById(id) {
    return API.get(`/saved-faculty-tt/${id}`)
      .then(res => res.data)
      .catch(err => { console.error("Fetch error:", err); return null; });
  },

  update(id, data) {
    return API.put(`/saved-faculty-tt/${id}`, data)
      .then(res => res.data)
      .catch(err => { console.error("Update error:", err); return null; });
  },

  delete(id) {
    return API.delete(`/saved-faculty-tt/${id}`)
      .then(res => res.data)
      .catch(err => { console.error("Delete error:", err); return null; });
  },

  archive(id, isArchived) {
    return API.patch(`/saved-faculty-tt/${id}`, { is_archived: isArchived })
      .then(res => res.data)
      .catch(err => { console.error("Archive error:", err); return null; });
  },
  search(filters) {
    const params = new URLSearchParams();
    if (filters.academic_year) params.append("academic_year", filters.academic_year);
    if (filters.faculty_id) params.append("faculty_id", filters.faculty_id);
    if (filters.faculty_name) params.append("faculty_name", filters.faculty_name);
    if (filters.semester) params.append("semester", filters.semester);
    if (filters.is_archived !== undefined) params.append("is_archived", filters.is_archived);

    return API.get(`/saved-faculty-tt/search?${params}`)
      .then(res => res.data)
      .catch(err => { console.error("Search error:", err); return []; });
  }
};

export default API;