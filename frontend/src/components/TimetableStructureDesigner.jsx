import React, { useState, useEffect } from 'react';
import {
  getInstitutionConfig,
  updateInstitutionConfig,
  applyStructure,
  uploadLogo,
  resetInstitutionConfig  // 🔥 ADD THIS
} from '../services/api';

const TimetableStructureDesigner = ({ onNavigateToConfig }) => {
  const [config, setConfig] = useState(null);
  const [workingDays, setWorkingDays] = useState([]);
  const [slotTemplate, setSlotTemplate] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  // 🔥 NEW: Institution branding fields
  const [institutionName, setInstitutionName] = useState('');
  const [institutionAddress, setInstitutionAddress] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SLOT_TYPES = ['PERIOD', 'BREAK', 'LUNCH'];

  // ✅ Roman numeral converter + renumbering — every PERIOD slot's label is
  // always recalculated from its actual position among periods, so I/II/III
  // etc. stay correct no matter where a change happens (type switch,
  // reorder, delete). BREAK/LUNCH labels are left untouched here.
  const toRoman = (num) => {
    const map = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let n = num, result = '';
    for (const [value, symbol] of map) {
      while (n >= value) { result += symbol; n -= value; }
    }
    return result;
  };

  const renumberPeriods = (slots) => {
    let periodIdx = 0;
    return slots.map(slot => {
      if (slot.slot_type === 'PERIOD') {
        periodIdx++;
        return { ...slot, label: toRoman(periodIdx) };
      }
      return slot;
    });
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await getInstitutionConfig();
      setConfig(response.data);
      setWorkingDays(response.data.working_days || []);
      setSlotTemplate(response.data.slot_template || []);
      // 🔥 Load institution branding
      setInstitutionName(response.data.institution_name || '');
      setInstitutionAddress(response.data.institution_address || '');
      setDepartmentName(response.data.department_name || '');
      if (response.data.logo_url) {
        setLogoPreview(`http://localhost:8000${response.data.logo_url}`);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage('Error loading configuration');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const addSlot = (type = 'PERIOD') => {
    const newSlot = {
      label: type === 'PERIOD' ? '' : type, // will be filled by renumberPeriods below if it's a PERIOD
      start_time: '08:00',
      end_time: '09:00',
      slot_type: type
    };
    setSlotTemplate(renumberPeriods([...slotTemplate, newSlot]));
  };

  const resetTimeSlots = () => {
    setSlotTemplate([]);
    setMessage('✓ Time slots cleared');
  };

  const updateSlot = (index, field, value) => {
    const updated = [...slotTemplate];
    updated[index][field] = value;

    // ✅ Switching TYPE always resyncs the label:
    //  - to BREAK/LUNCH text for those types
    //  - to the correct Roman numeral for PERIOD, recalculated across
    //    ALL period slots (not just this one) so numbering stays
    //    sequential and correct no matter where the change happens.
    if (field === 'slot_type') {
      if (value !== 'PERIOD') {
        updated[index].label = value; // 'BREAK' or 'LUNCH'
      }
      setSlotTemplate(renumberPeriods(updated));
      return;
    }

    setSlotTemplate(updated);
  };

  const deleteSlot = (index) => {
    setSlotTemplate(renumberPeriods(slotTemplate.filter((_, i) => i !== index)));
  };

  const moveSlot = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === slotTemplate.length - 1)
    ) {
      return;
    }
    const updated = [...slotTemplate];
    const target = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSlotTemplate(renumberPeriods(updated));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('❌ Please upload an image file');
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));

    // Upload immediately
    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/institution-config/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setMessage('✓ Logo uploaded successfully!');
        setLogoPreview(`http://localhost:8000${data.logo_url}`);
      } else {
        const errData = await response.json().catch(() => ({}));
        setMessage(`❌ ${errData.detail || 'Failed to upload logo (Admin access required)'}`);
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      setMessage('❌ Error uploading logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveAndApply = async () => {
    setMessage('');
    setSaving(true);

    try {
      // Save config
      await updateInstitutionConfig({
        working_days: workingDays,
        slot_template: slotTemplate,  // 🔥 FIX THIS LINE
        semester_count: 8,
        cluster_enabled: true,
        cluster_count: 4,
        institution_name: institutionName,
        institution_address: institutionAddress,
        department_name: departmentName
      });

      // Apply structure
      await applyStructure();

      setMessage('✓ Structure saved and applied successfully!');
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setMessage('');
    setSaving(true);

    try {
      await resetInstitutionConfig();
      await loadConfig();
      setMessage('✓ Reset to defaults');
    } catch (err) {
      setMessage('Error resetting: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading configuration...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📋 Timetable Structure Designer</h2>
        <p style={styles.subtitle}>Configure your institution's timetable structure</p>
      </div>

      {/* 🔥 NEW: Institution Branding */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🏫 Institution Branding</h3>

        <div style={styles.brandingGrid}>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>Institution Name</label>
            <input
              type="text"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              placeholder="e.g., BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT"
              style={{ ...styles.input, width: '100%' }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Institution Address</label>
            <input
              type="text"
              value={institutionAddress}
              onChange={(e) => setInstitutionAddress(e.target.value)}
              placeholder="e.g., AVALAHALLI, YELAHANKA, BENGALURU-560119"
              style={{ ...styles.input, width: '100%' }}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>Department Name</label>
            <input
              type="text"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g., DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING"
              style={{ ...styles.input, width: '100%' }}
            />
          </div>

          {/* Logo Upload */}
          <div style={styles.field}>
            <label style={styles.fieldLabel}>Institution Logo</label>
            <div style={styles.logoUploadContainer}>
              {logoPreview && (
                <div style={styles.logoPreview}>
                  <img src={logoPreview} alt="Logo Preview" style={styles.logoImage} />
                </div>
              )}
              <label style={styles.uploadButton}>
                {uploadingLogo ? '⏳ Uploading...' : '📤 Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  style={{ display: 'none' }}
                />
              </label>
              <div style={styles.logoHint}>Recommended: Square image, 200x200px or larger</div>
            </div>
          </div>
        </div>
      </div>

      {/* Working Days */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📅 Working Days</h3>
        <div style={styles.daysGrid}>
          {DAYS.map(day => (
            <label key={day} style={styles.dayCheckbox}>
              <input
                type="checkbox"
                checked={workingDays.includes(day)}
                onChange={() => toggleDay(day)}
                style={styles.checkbox}
              />
              <span style={styles.dayLabel}>{day}</span>
            </label>
          ))}
        </div>
      </div>


      {/* Time Slots */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>⏰ Time Slot Template</h3>
          <div style={styles.addButtons}>
            <button
              onClick={resetTimeSlots}
              style={{
                ...styles.addButton,
                backgroundColor: 'rgba(239,68,68,0.15)',
                color: '#F87171',
                border: '1px solid rgba(239,68,68,0.3)'
              }}
            >
              🔄 Reset Slots
            </button>
            <button onClick={() => addSlot('PERIOD')} style={styles.addButton}>
              + Add Period
            </button>
            <button onClick={() => addSlot('BREAK')} style={styles.addButton}>
              + Add Break
            </button>
          </div>
        </div>

        <div style={styles.slotsList}>
          {slotTemplate.length === 0 ? (
            <div style={styles.emptyState}>No slots configured. Click "Add Period" to start.</div>
          ) : (
            slotTemplate.map((slot, index) => (
              <div key={index} style={styles.slotCard}>
                <div style={styles.slotNumber}>{index + 1}</div>

                <div style={styles.slotFields}>
                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>Type</label>
                    <select
                      value={slot.slot_type}
                      onChange={(e) => updateSlot(index, 'slot_type', e.target.value)}
                      style={styles.select}
                    >
                      {SLOT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>Label</label>
                    <input
                      type="text"
                      value={slot.label}
                      onChange={(e) => updateSlot(index, 'label', e.target.value)}
                      placeholder="e.g., I, II, Break"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>Start</label>
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateSlot(index, 'start_time', e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.fieldLabel}>End</label>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateSlot(index, 'end_time', e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.slotActions}>
                  <button
                    onClick={() => moveSlot(index, 'up')}
                    disabled={index === 0}
                    style={styles.iconButton}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveSlot(index, 'down')}
                    disabled={index === slotTemplate.length - 1}
                    style={styles.iconButton}
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => deleteSlot(index)}
                    style={{ ...styles.iconButton, ...styles.deleteButton }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preview */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}></h3>
        {/* 🔥 ADD THIS LIVE HEADER PREVIEW */}
        {(institutionName || institutionAddress || departmentName || logoPreview) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '2px solid #EAB308', paddingBottom: '16px', marginBottom: '16px' }}>
            {logoPreview && (
              <img src={logoPreview} alt="Logo" style={{ width: '90px', height: '90px', borderRadius: '50%', border: '2px solid #EAB308', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, textAlign: 'center' }}>
              {institutionName && <div style={{ fontSize: '15px', fontWeight: '900', color: '#F0EDE8', letterSpacing: '1px', marginBottom: '4px' }}>{institutionName}</div>}
              {institutionAddress && <div style={{ fontSize: '13px', fontWeight: '900', color: '#F0EDE8', marginBottom: '4px' }}>{institutionAddress}</div>}
              {departmentName && <div style={{ fontSize: '12px', fontWeight: '1000', color: '#F0EDE8' }}>{departmentName}</div>}
            </div>
          </div>
        )}
        <div style={styles.preview}>
          <div style={styles.previewTable}>
            <div style={styles.previewRow}>
              <div style={styles.previewCellHeader}>DAY</div>
              {slotTemplate.map((slot, i) => (
                <div key={i} style={styles.previewCellHeader}>
                  <div style={styles.previewLabel}>{slot.label}</div>
                  <div style={styles.previewTime}>{slot.start_time}-{slot.end_time}</div>
                </div>
              ))}
            </div>
            {workingDays
              .sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
              .map(day => (
                <div key={day} style={styles.previewRow}>
                  <div style={styles.previewCellDay}>{day}</div>
                  {slotTemplate.map((_, i) => (
                    <div key={i} style={styles.previewCell}></div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        {message && (
          <div style={message.includes('✓') ? styles.successMessage : styles.errorMessage}>
            {message}
          </div>
        )}

        <div style={styles.buttonGroup}>
          <button
            onClick={handleSaveAndApply}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? '⏳ Applying...' : '💾 Save & Apply Structure'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px 32px 0',
    fontFamily: 'Sora, system-ui, -apple-system, sans-serif',
    color: '#F0EDE8',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #080C14 0%, #0F172A 100%)'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    fontSize: '16px',
    color: '#5C6070'
  },
  header: {
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 4px 0',
    color: '#F0EDE8',
    fontFamily: 'Sora, sans-serif'
  },
  subtitle: {
    fontSize: '13px',
    color: '#94A3B8',
    margin: 0,
    fontFamily: 'Sora, sans-serif'
  },
  section: {
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 16px 0',
    color: '#F0EDE8',
    fontFamily: 'Sora, sans-serif'
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  },
  dayCheckbox: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    userSelect: 'none'
  },
  checkbox: {
    marginRight: '10px',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#EAB308'
  },
  dayLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#F0EDE8',
    fontFamily: 'Sora, sans-serif'
  },
  addButtons: {
    display: 'flex',
    gap: '10px'
  },
  addButton: {
    padding: '8px 14px',
    backgroundColor: '#EAB308',
    color: '#0A0C12',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.2s',
    fontFamily: 'Sora, sans-serif'
  },
  slotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '10px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#5C6070',
    fontStyle: 'italic',
    fontSize: '14px'
  },
  slotCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  slotNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#EAB308',
    color: '#0A0C12',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '12px',
    flexShrink: 0,
    fontFamily: 'JetBrains Mono, monospace'
  },
  slotFields: {
    display: 'flex',
    gap: '12px',
    flex: 1,
    flexWrap: 'wrap'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '140px',
    flex: 1
  },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#5C6070',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: 'Sora, sans-serif'
  },
  input: {
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#F0EDE8',
    fontFamily: 'Sora, sans-serif',
    outline: 'none',
    transition: 'all 0.2s'
  },
  select: {
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#F0EDE8',
    fontFamily: 'Sora, sans-serif',
    outline: 'none',
    cursor: 'pointer'
  },
  slotActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0
  },
  iconButton: {
    width: '28px',
    height: '28px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    color: '#F0EDE8'
  },
  deleteButton: {
    color: '#F43F5E',
    borderColor: 'rgba(244,63,94,0.2)'
  },
  preview: {
    overflowX: 'auto',
    maxHeight: '300px',
    overflowY: 'auto',
    width: '100%'
  },
  previewTable: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%'
  },
  previewRow: {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    width: '100%'
  },
  previewCellHeader: {
    padding: '10px',
    backgroundColor: 'rgba(234,179,8,0.1)',
    color: '#EAB308',
    fontWeight: 'bold',
    fontSize: '10px',
    minWidth: '70px',
    textAlign: 'center',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    fontFamily: 'JetBrains Mono, monospace',
    flex: 1
  },
  previewLabel: {
    marginBottom: '4px',
    fontSize: '12px'
  },
  previewTime: {
    fontSize: '9px',
    opacity: 0.7
  },
  previewCellDay: {
    padding: '10px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#F0EDE8',
    fontWeight: 'bold',
    fontSize: '11px',
    minWidth: '70px',
    textAlign: 'center',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    fontFamily: 'Sora, sans-serif',
    flex: 1
  },
  previewCell: {
    padding: '10px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    minWidth: '70px',
    minHeight: '32px',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    flex: 1
  },
  actions: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  successMessage: {
    padding: '14px 18px',
    backgroundColor: 'rgba(16,185,129,0.15)',
    color: '#10B981',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
    border: '1px solid rgba(16,185,129,0.3)',
    fontFamily: 'Sora, sans-serif'
  },
  errorMessage: {
    padding: '14px 18px',
    backgroundColor: 'rgba(244,63,94,0.15)',
    color: '#F43F5E',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
    border: '1px solid rgba(244,63,94,0.3)',
    fontFamily: 'Sora, sans-serif'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#EAB308',
    color: '#0A0C12',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Sora, sans-serif'
  },
  resetButton: {
    padding: '10px 20px',
    backgroundColor: 'rgba(244,63,94,0.15)',
    color: '#F43F5E',
    border: '1px solid rgba(244,63,94,0.3)',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Sora, sans-serif'
  },
  brandingGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '18px'
  },
  logoUploadContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap'
  },
  logoPreview: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '2px solid #EAB308',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,179,8,0.1)'
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  uploadButton: {
    padding: '12px 24px',
    backgroundColor: '#EAB308',
    color: '#0A0C12',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    display: 'inline-block',
    transition: 'all 0.2s',
    fontFamily: 'Sora, sans-serif'
  },
  logoHint: {
    fontSize: '12px',
    color: '#5C6070',
    fontStyle: 'italic',
    fontFamily: 'Sora, sans-serif'
  }
};

export default TimetableStructureDesigner;