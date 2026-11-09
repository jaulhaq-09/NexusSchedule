import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API, { savedTimetablesAPI } from '../services/api';
import { additionalClassAPI } from '../services/additionalClassApi';
import ConfirmationModal from '../components/ConfirmationModal';
import AdditionalClassForm from '../components/AdditionalClassForm';
import AvailabilityGrid from '../components/AvailabilityGrid';
import FacultyAdditionalView from '../components/FacultyAdditionalView';
import SavedAdditionalClassesList from '../components/SavedAdditionalClassesList';
import { IconList, IconCheck, IconLayers, IconCalendar, IconUser, IconInbox } from '../components/icons';
import jsPDF from 'jspdf';  // ← ADD THIS LINE
import { useLocation } from "react-router-dom";

// ✅ ADD THIS HOOK (Auto scroll to top)
const useScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIOD_SLOTS = [
  "08:30 - 09:25", "09:25 - 10:20",
  "10:40 - 11:35", "11:35 - 12:30",
  "01:25 - 02:20", "02:20 - 03:15", "03:15 - 04:10"
];

const BREAKS = {
  "10:20 - 10:40": "break",
  "12:30 - 01:25": "lunch"
};

export default function AdditionalTimetable() {
  
  useScrollToTop();  // ✅ ADD THIS LINE
  const [sections, setSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [additionalClasses, setAdditionalClasses] = useState([]);
  const [savedTimetables, setSavedTimetables] = useState([]);
  
  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [duration, setDuration] = useState(1);
  const [availability, setAvailability] = useState({});
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [showGrid, setShowGrid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [filterSection, setFilterSection] = useState('');  // ← ADD THIS
  const [exporting, setExporting] = useState(false);  // ← ADD THIS LINE
  const [viewMode, setViewMode] = useState('list');                              // ← ADD THIS
  const [selectedFacultyView, setSelectedFacultyView] = useState('');            // ← ADD THIS
  const [savedFacultyTimetables, setSavedFacultyTimetables] = useState([]);  
  
  
  const [formData, setFormData] = useState({
    title: '',
    reason: 'remedial',
    student_group_name: '',
    failed_students_count: 0,
    remarks: ''
  });
 
  // ✅ ADD THIS STATE HERE
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    isDangerous: false
  });
 
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      const [secRes, facRes, roomRes, subjRes] = await Promise.all([
        API.get('/sections'),
        API.get('/faculty'),
        API.get('/rooms'),
        API.get('/subjects')
      ]);
      
      setSections(secRes.data || []);
      setFaculty(facRes.data || []);
      setRooms(roomRes.data || []);
      setSubjects(subjRes.data || []);
      
      // Load saved timetables
      // ✅ FIXED:
      const saved = await savedTimetablesAPI.getAll();
      const sectionTimetables = (saved || []).filter(tt => tt.type !== "faculty" && tt.section_id);
      setSavedTimetables(sectionTimetables);
      
      // Load additional classes
      try {
        const acRes = await additionalClassAPI.getAll();
        setAdditionalClasses(acRes.data?.data || []);
      } catch (acError) {
        if (acError.response?.status === 404) {
          console.warn('Additional classes API not implemented yet');
          setAdditionalClasses([]);
        } else {
          throw acError;
        }
      }
    } catch (error) {
      console.error('Load error:', error);
      showToast('Failed to load data', 'error');
    }
  }, []);
  // ✅ FIXED:
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ✅ NEW: which specific saved timetable to use per section, when a
  // section has more than one save. Defaults to the most recent save
  // for that section until the user picks a different one from the
  // per-chip dropdown in AdditionalClassForm.
  const [selectedSaveBySection, setSelectedSaveBySection] = useState({});

  // ✅ Central lookup — every place that used to do
  // `savedTimetables.find(tt => tt.section_id === secId)` (which always
  // grabbed whichever save happened to appear first, silently ignoring
  // the rest) now goes through here instead, respecting whichever save
  // the user picked for that section.
  const getSavedTTForSection = useCallback((secId) => {
    const key = String(secId);
    const saves = savedTimetables.filter(tt => String(tt.section_id) === key);
    if (saves.length === 0) return null;
    const chosenId = selectedSaveBySection[key];
    if (chosenId) {
      const found = saves.find(tt => String(tt.id) === String(chosenId));
      if (found) return found;
    }
    return [...saves].sort((a, b) => {
      const at = new Date(a.created_at || a.updated_at || a.saved_at || 0).getTime();
      const bt = new Date(b.created_at || b.updated_at || b.saved_at || 0).getTime();
      return bt - at;
    })[0];
  }, [savedTimetables, selectedSaveBySection]);

  useEffect(() => {
    if (selectedSections.length === 1) {
      const savedTT = getSavedTTForSection(selectedSections[0]);
      if (savedTT?.room_id) {
        setSelectedRoom(String(savedTT.room_id));
      }
    }
  }, [selectedSections, getSavedTTForSection]);

  // ✅ FIXED: this list now comes FROM the saved timetables, not from a
  // join against the live Sections table. Previously, if a section was
  // deleted or renamed after its timetable was saved, that timetable
  // became permanently unselectable here — even though it still exists
  // and is visible in "Saved Timetables". Now: if the section still
  // exists, use its real record (name/cluster/semester stay accurate and
  // live-updated). If it doesn't, reconstruct a stand-in directly from
  // the saved timetable's own cluster/semester/label so it's still usable.
  // ✅ Now also sorted newest-first by the most recent saved timetable
  // per section, and carries __savedAt so the UI can display it.
  // Checks created_at / updated_at / saved_at in that order since I
  // haven't confirmed which field your SavedTimetable model actually
  // uses — tell me the real one if none of these match and this
  // becomes a one-line fix.
  // ✅ CHANGED: each section chip now carries __saves — every saved
  // timetable for that section, sorted newest-first — instead of
  // silently discarding all but the most recent one. AdditionalClassForm
  // renders a small dropdown when a section has more than one save.
  const sectionsWithTimetables = useMemo(() => {
    const bySection = new Map();

    savedTimetables.forEach(tt => {
      if (!tt.section_id) return;
      const key = String(tt.section_id);
      const savedAt = tt.created_at || tt.updated_at || tt.saved_at || null;
      const saveEntry = { id: tt.id, savedAt, room_name: tt.room_name || null };

      if (!bySection.has(key)) {
        const liveSection = sections.find(s => String(s.id) === key);
        const base = liveSection
          ? { ...liveSection }
          : (() => {
              let derivedName = `Section ${tt.section_id}`;
              if (tt.label) {
                const afterSecondDot = tt.label.split("·")[2];
                if (afterSecondDot) {
                  const beforeSlash = afterSecondDot.split("/")[0];
                  if (beforeSlash && beforeSlash.trim()) derivedName = beforeSlash.trim();
                }
              }
              return {
                id: tt.section_id,
                cluster: tt.cluster ?? 1,
                semester: tt.semester ?? null,
                section_name: derivedName,
                __orphaned: true,
              };
            })();
        bySection.set(key, { ...base, __saves: [saveEntry] });
      } else {
        bySection.get(key).__saves.push(saveEntry);
      }
    });

    const result = Array.from(bySection.values()).map(entry => {
      const sortedSaves = [...entry.__saves].sort((a, b) => {
        const at = a.savedAt ? new Date(a.savedAt).getTime() : -Infinity;
        const bt = b.savedAt ? new Date(b.savedAt).getTime() : -Infinity;
        return bt - at;
      });
      return { ...entry, __saves: sortedSaves, __savedAt: sortedSaves[0]?.savedAt || null };
    });

    return result.sort((a, b) => {
      const at = a.__savedAt ? new Date(a.__savedAt).getTime() : -Infinity;
      const bt = b.__savedAt ? new Date(b.__savedAt).getTime() : -Infinity;
      return bt - at;
    });
  }, [sections, savedTimetables]);
  // Filter additional classes by section
  const filteredAdditionalClasses = useMemo(() => {
    if (!filterSection) return additionalClasses;
    return additionalClasses.filter(ac => 
      ac.section_ids && ac.section_ids.includes(parseInt(filterSection))
    );
  }, [additionalClasses, filterSection]);
   // Calculate faculty workload from additional classes
  const facultyWorkload = useMemo(() => {
    const workload = {};
    
    additionalClasses.forEach(ac => {
      if (ac.faculty_id && ac.status === 'scheduled') {
        if (!workload[ac.faculty_id]) {
          workload[ac.faculty_id] = {
            faculty_id: ac.faculty_id,
            faculty_name: ac.faculty_name,
            total_classes: 0,
            total_hours: 0,
            subjects: new Set(),
            sections: new Set()
          };
        }
        
        workload[ac.faculty_id].total_classes += 1;
        workload[ac.faculty_id].total_hours += ac.duration_slots || 1;
        workload[ac.faculty_id].subjects.add(ac.subject_name);
        
        if (ac.section_ids) {
          ac.section_ids.forEach(sid => workload[ac.faculty_id].sections.add(sid));
        }
      }
    });
    
    return Object.values(workload).map(w => ({
      ...w,
      subjects: Array.from(w.subjects),
      sections: Array.from(w.sections)
    }));
  }, [additionalClasses]);

  // Get additional classes for selected faculty
  const facultyAdditionalClasses = useMemo(() => {
    if (!selectedFacultyView) return [];
    return additionalClasses.filter(ac => 
      String(ac.faculty_id) === String(selectedFacultyView) && ac.status === 'scheduled'
    );
  }, [additionalClasses, selectedFacultyView]);

  // Get subjects and faculty from selected sections' timetables
  // ✅ FIXED: same pattern as sectionsWithTimetables — build the option
  // list FROM the saved timetable's own data, not by filtering the live
  // Subjects table. Previously, deleting a subject from the Subjects
  // page made it silently disappear from this dropdown even though the
  // saved timetable still references it by name.
  const availableSubjectsForSelection = useMemo(() => {
    if (selectedSections.length === 0) return subjects;

    const subjectsSet = new Set();
    selectedSections.forEach(secId => {
      const savedTT = getSavedTTForSection(secId);
      if (savedTT && savedTT.subject_config) {
        savedTT.subject_config.forEach(sc => subjectsSet.add(sc.subject));
      }
      if (savedTT && savedTT.timetable_data) {
        savedTT.timetable_data.forEach(entry => {
          if (entry.subject) subjectsSet.add(entry.subject);
        });
      }
    });

    return Array.from(subjectsSet).map(name => {
      const live = subjects.find(s => s.subject_name === name);
      return live || { id: `orphan_${name}`, subject_name: name, __orphaned: true };
    });
  }, [selectedSections, getSavedTTForSection, subjects]);

  // ✅ FIXED: same pattern as subjects — build the option list FROM the
  // saved timetable's own facultyName data, not by filtering the live
  // Faculty table. Confirmed safe: backend's AdditionalClass model stores
  // faculty_id/faculty_name as plain denormalized columns (no ForeignKey,
  // no existence check on create) — so a deleted faculty member's name
  // can still be submitted and saved without error. Previously, deleting
  // a faculty member made them silently disappear from this dropdown
  // even though the saved timetable still references them by name.
  const availableFacultyForSelection = useMemo(() => {
    if (selectedSections.length === 0) return faculty;

    const namesSet = new Set();
    selectedSections.forEach(secId => {
      const savedTT = getSavedTTForSection(secId);
      if (savedTT && savedTT.timetable_data) {
        savedTT.timetable_data.forEach(entry => {
          if (entry.facultyName && entry.facultyName !== "—") {
            entry.facultyName.split("/").map(n => n.trim()).forEach(n => namesSet.add(n));
          }
        });
      }
    });

    return Array.from(namesSet).map(name => {
      const live = faculty.find(f => f.name === name);
      return live || { id: `orphan_${name}`, name, __orphaned: true };
    });
  }, [selectedSections, getSavedTTForSection, faculty]);

  const suggestedRoom = useMemo(() => {
    if (selectedSections.length === 1) {
      const savedTT = getSavedTTForSection(selectedSections[0]);
      return savedTT?.room_id ? String(savedTT.room_id) : '';
    }
    return '';
  }, [selectedSections, getSavedTTForSection]);

  const checkAvailability = async () => {
  const effectiveRoom = selectedRoom || suggestedRoom;

    if (selectedSections.length === 0 || !selectedFaculty || !effectiveRoom) {
      showToast('Please select sections, faculty, and room', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const selectedFacultyName = faculty.find(f => String(f.id) === selectedFaculty)?.name;
      
      const availabilityGrid = {};
      
      DAYS.forEach(day => {
        availabilityGrid[day] = {};
        
        PERIOD_SLOTS.forEach(time => {
          const reasons = [];
          
          // 1. Check if it's break/lunch
          if (BREAKS[time]) {
            reasons.push('break_lunch');
            availabilityGrid[day][time] = { available: false, reasons };
            return;
          }
          
          // 2. Check selected sections' timetables for conflicts
          selectedSections.forEach(sectionId => {
            const savedTT = getSavedTTForSection(sectionId);
            
            if (savedTT && savedTT.timetable_data) {
              savedTT.timetable_data.forEach(entry => {
                if (entry.day === day && entry.time === time) {
                  if (!reasons.includes(`section_${sectionId}_busy`)) {
                    reasons.push(`section_${sectionId}_busy`);
                  }
                  if (entry.facultyName) {
                    const entryFacultyNames = entry.facultyName.split('/').map(n => n.trim());
                    if (entryFacultyNames.includes(selectedFacultyName)) {
                      if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
                    }
                  }
                }
                
                // Check for multi-slot classes (span > 1)
                if (entry.day === day && entry.span && entry.span > 1) {
                  const entryTimeIndex = PERIOD_SLOTS.indexOf(entry.time);
                  const currentTimeIndex = PERIOD_SLOTS.indexOf(time);
                  if (entryTimeIndex !== -1 && currentTimeIndex !== -1) {
                    if (currentTimeIndex >= entryTimeIndex && currentTimeIndex < entryTimeIndex + entry.span) {
                      if (!reasons.includes(`section_${sectionId}_busy`)) {
                        reasons.push(`section_${sectionId}_busy`);
                      }
                      if (entry.facultyName) {
                        const entryFacultyNames = entry.facultyName.split('/').map(n => n.trim());
                        if (entryFacultyNames.includes(selectedFacultyName)) {
                          if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
                        }
                      }
                    }
                  }
                }

                // ✅ ADDED: Block next consecutive slot for labs
                if (entry.isLab && entry.day === day) {
                  const entryTimeIndex = PERIOD_SLOTS.indexOf(entry.time);
                  const currentTimeIndex = PERIOD_SLOTS.indexOf(time);
                  if (entryTimeIndex !== -1 && currentTimeIndex !== -1 && currentTimeIndex === entryTimeIndex + 1) {
                    if (!reasons.includes(`section_${sectionId}_busy`)) {
                      reasons.push(`section_${sectionId}_busy`);
                    }
                    if (entry.facultyName) {
                      const entryFacultyNames = entry.facultyName.split('/').map(n => n.trim());
                      if (entryFacultyNames.includes(selectedFacultyName)) {
                        if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
                      }
                    }
                  }
                }

              }); // closes timetable_data.forEach
            }
          }); // closes selectedSections.forEach
          
          // 3. Check ALL timetables for faculty conflicts
          savedTimetables.forEach(tt => {
            if (tt.timetable_data) {
              tt.timetable_data.forEach(entry => {
                if (entry.day === day && entry.time === time && entry.facultyName) {
                  const entryFacultyNames = entry.facultyName.split('/').map(n => n.trim());
                  if (entryFacultyNames.includes(selectedFacultyName)) {
                    if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
                  }
                }
                
                // Check spanned slots for faculty
                if (entry.day === day && entry.span && entry.span > 1 && entry.facultyName) {
                  const entryTimeIndex = PERIOD_SLOTS.indexOf(entry.time);
                  const currentTimeIndex = PERIOD_SLOTS.indexOf(time);
                  if (entryTimeIndex !== -1 && currentTimeIndex !== -1) {
                    if (currentTimeIndex >= entryTimeIndex && currentTimeIndex < entryTimeIndex + entry.span) {
                      const entryFacultyNames = entry.facultyName.split('/').map(n => n.trim());
                      if (entryFacultyNames.includes(selectedFacultyName)) {
                        if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
                      }
                    }
                  }
                }

                // ✅ ADDED: Block next consecutive slot for lab faculty
                if (entry.isLab && entry.day === day && entry.facultyName) {
                  const entryTimeIndex = PERIOD_SLOTS.indexOf(entry.time);
                  const currentTimeIndex = PERIOD_SLOTS.indexOf(time);
                  if (entryTimeIndex !== -1 && currentTimeIndex !== -1 && currentTimeIndex === entryTimeIndex + 1) {
                    const entryFacultyNames = entry.facultyName.split('/').map(n => n.trim());
                    if (entryFacultyNames.includes(selectedFacultyName)) {
                      if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
                    }
                  }
                }

              }); // closes timetable_data.forEach
            }
          }); // closes savedTimetables.forEach
          
          // 4. Check existing additional classes
          additionalClasses.forEach(ac => {
            if (ac.day === day && ac.time === time && ac.status !== 'cancelled') {
              if (ac.section_ids && ac.section_ids.some(sid => selectedSections.includes(String(sid)))) {
                if (!reasons.some(r => r.includes('section_') && r.includes('_busy'))) {
                  reasons.push(`section_${ac.section_ids[0]}_busy`);
                }
              }
              if (ac.faculty_name === selectedFacultyName) {
                if (!reasons.includes('teacher_busy')) reasons.push('teacher_busy');
              }
              if (String(ac.room_id) === String(effectiveRoom)) {
                if (!reasons.includes('room_busy')) reasons.push('room_busy');
              }
            }
          });
          
          availabilityGrid[day][time] = {
            available: reasons.length === 0,
            reasons
          };
        });
      });
      
      setAvailability(availabilityGrid);
      setShowGrid(true);
      showToast('Availability checked successfully!');
    } catch (error) {
      console.error('Availability check error:', error);
      showToast('Failed to check availability', 'error');
    } finally {
      setLoading(false);
    }
  };
  const toggleSlot = (day, time) => {
    const slot = `${day}|${time}`;
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter(s => s !== slot));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const saveAdditionalClass = async () => {
    if (selectedSlots.length === 0) {
      showToast('Select at least one slot', 'error');
      return;
    }
    
    if (!selectedSubject) {
      showToast('Please select a subject', 'error');
      return;
    }
    
    setLoading(true);
    const selectedFac = faculty.find(f => String(f.id) === selectedFaculty);
    const selectedRm = rooms.find(r => String(r.id) === selectedRoom);
    
    let successCount = 0;
    
    for (const slot of selectedSlots) {
      const [day, time] = slot.split('|');
      
      try {
        await additionalClassAPI.create({
          title: formData.title || `${selectedSubject} - ${formData.reason}`,
          reason: formData.reason,
          subject_name: selectedSubject,
          faculty_id: parseInt(selectedFaculty),
          faculty_name: selectedFac?.name,
          room_id: parseInt(selectedRoom),
          room_name: selectedRm?.room_name,
          day,
          time,
          duration_slots: duration,
          section_ids: selectedSections.map(s => parseInt(s)),
          student_group_name: formData.student_group_name,
          failed_students_count: parseInt(formData.failed_students_count) || 0,
          remarks: formData.remarks
        });
        successCount++;
      } catch (error) {
        console.error('Save error:', error);
        showToast(`Failed to save ${day} ${time}`, 'error');
      }
    }
    
    if (successCount > 0) {
      showToast(`✓ Saved ${successCount} additional class${successCount > 1 ? 'es' : ''}!`);
      await loadData();
      setSelectedSlots([]);
      setShowGrid(false);
      setAvailability({});
    }
    
    setLoading(false);
  };

   const deleteClass = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Class',
      message: 'Are you sure you want to delete this additional class? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDangerous: true,
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await additionalClassAPI.delete(id);
          showToast('✓ Class deleted successfully');
          loadData();
        } catch (error) {
          console.error('Delete error:', error);
          showToast('Failed to delete class', 'error');
        }
      }
    });
  };

  const getSlotStatus = (day, time) => {
    const avail = availability[day]?.[time];
    if (!avail) return 'unknown';
    if (avail.available) return 'available';
    if (avail.reasons.includes('break_lunch')) return 'break';
    if (avail.reasons.some(r => r.includes('section'))) return 'section_busy';
    if (avail.reasons.includes('teacher_busy')) return 'teacher_busy';
    if (avail.reasons.includes('room_busy')) return 'room_busy';
    return 'blocked';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#34D399';
      case 'section_busy': return '#F87171';
      case 'teacher_busy': return '#F59E0B';
      case 'room_busy': return '#818CF8';
      case 'break': return '#64748B';
      default: return '#475569';
    }
  };

  const resetForm = () => {
    setSelectedSections([]);
    setSelectedFaculty('');
    setSelectedRoom('');
    setSelectedSubject('');
    setDuration(1);
    setSelectedSlots([]);
    setShowGrid(false);
    setAvailability({});
    setFormData({
      title: '',
      reason: 'remedial',
      student_group_name: '',
      failed_students_count: 0,
      remarks: ''
    });
  };

    // Save faculty additional timetable
    const saveFacultyAdditionalTT = (facultyId, classes) => {
      const facultyInfo = faculty.find(f => String(f.id) === String(facultyId));
      if (!facultyInfo) {
        showToast('Faculty not found', 'error');
        return;
      }
      
      if (classes.length === 0) {
        showToast('No classes to save', 'error');
        return;
      }
      
      const saved = {
        id: `fac_additional_${facultyId}_${Date.now()}`,
        faculty_id: parseInt(facultyId),
        faculty_name: facultyInfo.name,
        type: 'faculty_additional',
        classes: classes,
        saved_at: new Date().toISOString()
      };
      
      // Remove old save for this faculty (replace mode)
      const existing = savedFacultyTimetables.filter(tt => 
        String(tt.faculty_id) !== String(facultyId)
      );
      
      const updated = [...existing, saved];
      
      // Save to state AND localStorage
      setSavedFacultyTimetables(updated);
      localStorage.setItem('savedFacultyAdditionalTimetables', JSON.stringify(updated));
      
      console.log('✓ Saved faculty timetable:', saved);
      console.log('✓ Total saved timetables:', updated.length);
      
      showToast(`✓ Saved additional timetable for ${facultyInfo.name}!`);
    };

    const deleteFacultyAdditionalTT = (facultyId) => {
      const facultyInfo = faculty.find(f => String(f.id) === String(facultyId));
      
      setConfirmModal({
        isOpen: true,
        title: 'Delete Faculty Timetable',
        message: `Are you sure you want to delete the saved additional timetable for ${facultyInfo?.name || 'this faculty'}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        isDangerous: true,
        onConfirm: () => {
          const updated = savedFacultyTimetables.filter(tt => 
            String(tt.faculty_id) !== String(facultyId)
          );
          
          setSavedFacultyTimetables(updated);
          localStorage.setItem('savedFacultyAdditionalTimetables', JSON.stringify(updated));
          
          console.log('✓ Deleted faculty timetable for faculty:', facultyId);
          console.log('✓ Remaining timetables:', updated.length);
          
          showToast(`✓ Deleted timetable for ${facultyInfo?.name || 'faculty'}!`);
          setConfirmModal({ ...confirmModal, isOpen: false });
        }
      });
    };
      
    // Load saved faculty timetables from localStorage
    useEffect(() => {
    // Load saved faculty additional timetables from localStorage
    const loadSavedTimetables = () => {
      try {
        const saved = localStorage.getItem('savedFacultyAdditionalTimetables');
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('📂 Loaded saved timetables from localStorage:', parsed.length);
          setSavedFacultyTimetables(parsed);
        } else {
          console.log('📂 No saved timetables in localStorage');
          setSavedFacultyTimetables([]);
        }
      } catch (error) {
        console.error('❌ Failed to load saved faculty timetables:', error);
        setSavedFacultyTimetables([]);
      }
    };
    
    loadSavedTimetables();
  }, []); // Only run on mount

    // Export faculty additional timetable PDF
    const exportFacultyAdditionalPDF = async (facultyId) => {
      const facultyInfo = faculty.find(f => String(f.id) === String(facultyId));
      const classes = additionalClasses.filter(ac => String(ac.faculty_id) === String(facultyId));
      
      if (!facultyInfo || classes.length === 0) return;
      
      setExporting(true);
      showToast("Generating faculty PDF...", "success");
      
      try {
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = 297;
        const margin = 15;
        let yPosition = 20;
        
        // Header
        pdf.setFontSize(18);
        pdf.setFont(undefined, 'bold');
        pdf.text('BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
        
        pdf.setFontSize(14);
        pdf.text('ADDITIONAL CLASSES SCHEDULE', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
        
        pdf.setFontSize(12);
        pdf.text(`Faculty: ${facultyInfo.name}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Workload summary
        const workloadData = facultyWorkload.find(w => String(w.faculty_id) === String(facultyId));
        if (workloadData) {
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'bold');
          pdf.text(`Total Classes: ${workloadData.total_classes} | Total Hours: ${workloadData.total_hours} | Sections: ${workloadData.sections.length}`, margin, yPosition);
          yPosition += 10;
        }
        
        // Table headers
        const headers = ['Subject', 'Sections', 'Day', 'Time', 'Room', 'Reason', 'Status'];
        const columnWidths = [45, 35, 25, 30, 25, 30, 30];
        const startX = margin;
        
        pdf.setFillColor(0, 0, 0);
        pdf.rect(startX, yPosition, pageWidth - (2 * margin), 10, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        
        let xPosition = startX + 2;
        headers.forEach((header, i) => {
          pdf.text(header, xPosition, yPosition + 7);
          xPosition += columnWidths[i];
        });
        
        yPosition += 10;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        
        // Table rows
        classes.forEach((ac, index) => {
          if (yPosition > 180) {
            pdf.addPage();
            yPosition = 20;
          }
          
          if (index % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(startX, yPosition, pageWidth - (2 * margin), 10, 'F');
          }
          
          xPosition = startX + 2;
          
          const sectionNames = ac.section_ids?.map(sid => {
            const sec = sections.find(s => String(s.id) === String(sid));
            return sec ? `C${sec.cluster}·S${sec.semester}·${sec.section_name}` : `Sec${sid}`;
          }).join(', ') || '-';
          
          const rowData = [
            ac.subject_name || '-',
            sectionNames.substring(0, 15),
            ac.day || '-',
            ac.time || '-',
            ac.room_name || '-',
            ac.reason || '-',
            ac.status || 'scheduled'
          ];
          
          rowData.forEach((data, i) => {
            pdf.text(String(data).substring(0, 20), xPosition, yPosition + 7);
            xPosition += columnWidths[i];
          });
          
          yPosition += 10;
        });
        
        pdf.save(`Additional_TT_${facultyInfo.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast("✓ Faculty PDF exported successfully!");
        
      } catch (error) {
        console.error('Export error:', error);
        showToast("Export failed", "error");
      } finally {
        setExporting(false);
      }
    };
  const exportAdditionalClassesPDF = async () => {
    if (additionalClasses.length === 0) return;
    
    setExporting(true);
    showToast("Generating PDF...", "success");
    
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');  // ← CHANGED THIS LINE
      
      const pageWidth = 297;
      const margin = 15;
      let yPosition = 20;
      
      // Header
      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.text('BMS INSTITUTE OF TECHNOLOGY & MANAGEMENT', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      
      pdf.setFontSize(12);
      pdf.text('ADDITIONAL CLASSES SCHEDULE', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Table headers
      const headers = ['Subject', 'Faculty', 'Sections', 'Day', 'Time', 'Room', 'Reason', 'Status'];
      const columnWidths = [40, 35, 30, 25, 30, 25, 25, 25];
      const startX = margin;
      
      pdf.setFillColor(0, 0, 0);
      pdf.rect(startX, yPosition, pageWidth - (2 * margin), 10, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'bold');
      
      let xPosition = startX + 2;
      headers.forEach((header, i) => {
        pdf.text(header, xPosition, yPosition + 7);
        xPosition += columnWidths[i];
      });
      
      yPosition += 10;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, 'normal');
      
      // Table rows
      additionalClasses.forEach((ac, index) => {
        if (yPosition > 180) {
          pdf.addPage();
          yPosition = 20;
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(startX, yPosition, pageWidth - (2 * margin), 10, 'F');
        }
        
        xPosition = startX + 2;
        const rowData = [
          ac.subject_name || '-',
          ac.faculty_name || '-',
          `${ac.section_ids?.length || 0} sections`,
          ac.day || '-',
          ac.time || '-',
          ac.room_name || '-',
          ac.reason || '-',
          ac.status || 'scheduled'
        ];
        
        rowData.forEach((data, i) => {
          pdf.text(String(data).substring(0, 20), xPosition, yPosition + 7);
          xPosition += columnWidths[i];
        });
        
        yPosition += 10;
      });
      
      // Footer
      yPosition += 10;
      pdf.setFontSize(8);
      pdf.text(`Total Additional Classes: ${additionalClasses.length}`, margin, yPosition);
      
      // Save
      pdf.save(`Additional_Classes_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast("✓ PDF exported successfully!");
      
    } catch (error) {
      console.error('Export error:', error);
      showToast("Export failed - please try again", "error");
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <div style={{ fontFamily:"'Sora',sans-serif", padding:"28px 32px", background:"linear-gradient(135deg, #080C14 0%, #0F172A 100%)", minHeight:"100vh", color:"#F0EDE8" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`}</style>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{ position:"fixed", top:"20px", right:"20px", zIndex:9999, padding:"12px 22px", borderRadius:"10px", fontWeight:"600", fontSize:"13px", background: toast.type === "error" ? "#DC2626" : "#059669", color:"#fff", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", animation:"slideDown 0.3s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#EAB308", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "900", color: "#0A0C12" }}>+</div>
          <div>
            <h1 style={{ fontSize:"20px", fontWeight:"700", color:"#EAB308", fontFamily:"'Sora',sans-serif", margin: 0 }}>Additional Timetable</h1>
            <p style={{ fontSize:"11px", color:"#64748B", letterSpacing: "1.5px", textTransform: "uppercase", margin: "2px 0 0" }}>Remedial &amp; Makeup Classes</p>
          </div>
        </div>
        <button onClick={resetForm} style={{ padding:"9px 18px", background:"rgba(255,255,255,0.05)", color:"#94A3B8", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"12px", fontFamily: "'Sora',sans-serif" }}>
          Reset Form
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"12px", marginBottom:"24px" }}>
        {[
          { label:"Total Classes", value:additionalClasses.length, Icon: IconList },
          { label:"Selected Slots", value:selectedSlots.length, Icon: IconCheck },
          { label:"Sections Selected", value:selectedSections.length, Icon: IconLayers },
          { label:"Saved Timetables", value:savedTimetables.length, Icon: IconCalendar }
        ].map(stat => (
          <div key={stat.label} style={{ background:"rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"12px", padding:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
              <stat.Icon style={{ width: 14, height: 14, color: "#64748B" }} />
              <span style={{ fontSize:"10px", color:"#64748B", textTransform:"uppercase", letterSpacing:"1px", fontFamily: "'JetBrains Mono',monospace" }}>{stat.label}</span>
            </div>
            <div style={{ fontSize:"26px", fontWeight:"700", color:"#EAB308", fontFamily:"'JetBrains Mono',monospace" }}>{stat.value}</div>
          </div>
        ))}
      </div>
      
      {/* Warning if no saved timetables */}
      {sectionsWithTimetables.length === 0 && (
        <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:"12px", padding:"16px 20px", marginBottom:"24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>⚠</span>
          <div>
            <div style={{ fontSize:"13px", fontWeight:"700", color:"#F87171", marginBottom:"3px" }}>No Saved Timetables Found</div>
            <div style={{ fontSize:"12px", color:"#94A3B8" }}>Generate and save timetables first before creating additional classes. Go to Timetable → Generate → Save.</div>
          </div>
        </div>
      )}
      
      <AdditionalClassForm
        sectionsWithTimetables={sectionsWithTimetables}
        selectedSections={selectedSections}
        setSelectedSections={setSelectedSections}
        selectedSaveBySection={selectedSaveBySection}
        setSelectedSaveBySection={setSelectedSaveBySection}
        availableSubjectsForSelection={availableSubjectsForSelection}
        subjects={subjects}
        selectedSubject={selectedSubject}
        setSelectedSubject={setSelectedSubject}
        formData={formData}
        setFormData={setFormData}
        availableFacultyForSelection={availableFacultyForSelection}
        faculty={faculty}
        selectedFaculty={selectedFaculty}
        setSelectedFaculty={setSelectedFaculty}
        rooms={rooms}
        selectedRoom={selectedRoom}
        setSelectedRoom={setSelectedRoom}
        suggestedRoom={suggestedRoom}
        duration={duration}
        setDuration={setDuration}
        loading={loading}
        checkAvailability={checkAvailability}
        saveAdditionalClass={saveAdditionalClass}
        selectedSlots={selectedSlots}
      />

      {/* Availability Grid */}
      {showGrid && Object.keys(availability).length > 0 && (
        <AvailabilityGrid
          DAYS={DAYS}
          PERIOD_SLOTS={PERIOD_SLOTS}
          availability={availability}
          selectedSlots={selectedSlots}
          toggleSlot={toggleSlot}
        />
      )}

      {/* View Mode Toggle */}
      <div style={{ display:"inline-flex", padding: "4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius:"10px", marginBottom:"24px", gap: "2px" }}>
        {[
          { key: "list", label: "List View", Icon: IconList },
          { key: "faculty", label: "Faculty View", Icon: IconUser },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key)}
            style={{
              padding:"9px 18px",
              background: viewMode === v.key ? "rgba(234,179,8,0.15)" : "transparent",
              color: viewMode === v.key ? "#EAB308" : "#64748B",
              border: "none",
              borderRadius:"7px",
              cursor:"pointer",
              fontWeight:"600",
              fontSize:"12.5px",
              display: "flex", alignItems: "center", gap: "7px",
              transition: "all 0.15s",
              fontFamily: "'Sora',sans-serif",
            }}
          >
            <v.Icon style={{ width: 13, height: 13 }} />
            {v.label}
          </button>
        ))}
      </div>

      {/* Faculty View */}
      {viewMode === 'faculty' && (
        <FacultyAdditionalView
          faculty={faculty}
          facultyWorkload={facultyWorkload}
          savedFacultyTimetables={savedFacultyTimetables}
          selectedFacultyView={selectedFacultyView}
          setSelectedFacultyView={setSelectedFacultyView}
          facultyAdditionalClasses={facultyAdditionalClasses}
          sections={sections}
          saveFacultyAdditionalTT={saveFacultyAdditionalTT}
          deleteFacultyAdditionalTT={deleteFacultyAdditionalTT}
          exportFacultyAdditionalPDF={exportFacultyAdditionalPDF}
          exporting={exporting}
        />
      )}
      
      <SavedAdditionalClassesList
        additionalClasses={additionalClasses}
        filteredAdditionalClasses={filteredAdditionalClasses}
        sectionsWithTimetables={sectionsWithTimetables}
        filterSection={filterSection}
        setFilterSection={setFilterSection}
        exportAdditionalClassesPDF={exportAdditionalClassesPDF}
        exporting={exporting}
        deleteClass={deleteClass}
      />

       {/* Navigation Buttons — corner arrows, matches Faculty/Sections/Timetable */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '20px 0 24px',
        gap: '20px'
      }}>
        <button
          onClick={() => window.location.href = '/timetable'}
          title="Previous: Timetable"
          style={{
            width: '38px',
            height: '38px',
            backgroundColor: 'rgba(92,96,112,0.1)',
            color: '#94A3B8',
            border: '1px solid rgba(92,96,112,0.25)',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Sora, sans-serif',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ←
        </button>
        <button
          onClick={() => window.location.href = '/faculty-timetable'}
          title="Next: Faculty Timetable"
          style={{
            width: '38px',
            height: '38px',
            backgroundColor: '#EAB308',
            color: '#0A0C12',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: 'Sora, sans-serif',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          →
        </button>
      </div>
 
      {/* ✅ ADD THIS MODAL HERE */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        isDangerous={confirmModal.isDangerous}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
 
    </div>
  );
}