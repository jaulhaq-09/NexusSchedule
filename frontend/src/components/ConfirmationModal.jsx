import React from "react";

export default function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", cancelText = "Cancel", isDangerous = false }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: `1px solid ${isDangerous ? 'rgba(220,38,38,0.3)' : 'rgba(234,179,8,0.3)'}`,
        borderRadius: '16px',
        padding: '28px',
        maxWidth: '460px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        fontFamily: 'Sora, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: isDangerous ? '#F87171' : '#EAB308', margin: 0 }}>
            {isDangerous ? '⚠️' : '❓'} {title}
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        <p style={{
          fontSize: '13px',
          color: '#94A3B8',
          lineHeight: '1.6',
          margin: '0 0 22px 0'
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px',
              background: 'rgba(255,255,255,0.06)',
              color: '#94A3B8',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              fontFamily: 'Sora, sans-serif',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 20px',
              background: isDangerous ? 'linear-gradient(135deg,#DC2626,#B91C1C)' : '#EAB308',
              color: isDangerous ? '#fff' : '#0A0C12',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '13px',
              fontFamily: 'Sora, sans-serif',
              boxShadow: isDangerous ? '0 4px 14px rgba(220,38,38,0.4)' : '0 4px 16px rgba(234,179,8,0.3)'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}