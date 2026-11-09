import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const additionalClassAPI = {
  // Get all additional classes
  getAll: async () => {
    try {
      const response = await api.get('/additional-classes');
      return response;
    } catch (error) {
      console.error('Get all additional classes error:', error);
      throw error;
    }
  },

  // Get a single additional class by ID
  getById: async (id) => {
    try {
      const response = await api.get(`/additional-classes/${id}`);
      return response;
    } catch (error) {
      console.error('Get additional class error:', error);
      throw error;
    }
  },

  // Create a new additional class
  create: async (data) => {
    try {
      const response = await api.post('/additional-classes', data);
      return response;
    } catch (error) {
      console.error('Create additional class error:', error);
      throw error;
    }
  },

  // Update an additional class
  update: async (id, data) => {
    try {
      const response = await api.put(`/additional-classes/${id}`, data);
      return response;
    } catch (error) {
      console.error('Update additional class error:', error);
      throw error;
    }
  },

  // Delete an additional class
  delete: async (id) => {
    try {
      const response = await api.delete(`/additional-classes/${id}`);
      return response;
    } catch (error) {
      console.error('Delete additional class error:', error);
      throw error;
    }
  },

  // Check availability for scheduling
  checkAvailability: async (params) => {
    try {
      const response = await api.post('/additional-classes/check-availability', params);
      return response;
    } catch (error) {
      console.error('Check availability error:', error);
      throw error;
    }
  },

  // Get additional classes by section
  getBySection: async (sectionId) => {
    try {
      const response = await api.get(`/additional-classes/section/${sectionId}`);
      return response;
    } catch (error) {
      console.error('Get by section error:', error);
      throw error;
    }
  },

  // Get additional classes by faculty
  getByFaculty: async (facultyId) => {
    try {
      const response = await api.get(`/additional-classes/faculty/${facultyId}`);
      return response;
    } catch (error) {
      console.error('Get by faculty error:', error);
      throw error;
    }
  },

  // Update status (scheduled, completed, cancelled)
  updateStatus: async (id, status) => {
    try {
      const response = await api.patch(`/additional-classes/${id}/status`, { status });
      return response;
    } catch (error) {
      console.error('Update status error:', error);
      throw error;
    }
  },
};

export default additionalClassAPI;