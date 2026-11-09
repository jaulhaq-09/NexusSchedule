import React from 'react';
import TimetableStructureDesigner from '../components/TimetableStructureDesigner';
import { useNavigate } from 'react-router-dom';

const Structure = () => {
  const navigate = useNavigate();

  const handleNavigateToConfig = () => {
    navigate('/timetable');
  };

  return (
    <div style={styles.container}>
      <TimetableStructureDesigner onNavigateToConfig={handleNavigateToConfig} />
      
      {/* Navigation Buttons */}
      <div style={styles.navigation}>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={styles.prevButton}
          title="Previous: Dashboard"
        >
          ←
        </button>
        <button 
          onClick={() => navigate('/faculty')} 
          style={styles.nextButton}
          title="Next: Faculty"
        >
          →
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #080C14 0%, #0F172A 100%)',
    padding: '0'
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '20px 40px 40px',
    gap: '20px'
  },
  prevButton: {
    width: '38px',
    height: '38px',
    backgroundColor: 'rgba(92,96,112,0.1)',
    color: '#94A3B8',
    border: '1px solid rgba(92,96,112,0.25)',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Sora, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  nextButton: {
    width: '38px',
    height: '38px',
    backgroundColor: '#EAB308',
    color: '#0A0C12',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'Sora, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

export default Structure;