import React, { useState, useRef, useEffect } from 'react';
import { FiBell, FiRefreshCw, FiSearch, FiChevronDown, FiLogOut, FiPlusCircle } from 'react-icons/fi';
import { FaUserCircle } from 'react-icons/fa';

const topbarStyle = {
  background: '#fff',
  borderBottom: '1px solid #e3eaf3',
  height: '68px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 28px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  fontFamily: 'Poppins, sans-serif',
  gap: '16px',
};

const CALENDAR_STATUS_CONFIG = {
  connected: { label: 'Kalender Terhubung', bg: '#e6f7ee', color: '#1a7a45', dot: '#22c55e' },
  syncing:   { label: 'Menyinkronkan…',     bg: '#fffbe6', color: '#92660a', dot: '#f59e0b' },
  error:     { label: 'Gagal Terhubung',    bg: '#fff1f0', color: '#c0392b', dot: '#ef4444' },
  default:   { label: 'Kalender',           bg: '#f0f4fa', color: '#5a7399', dot: '#94a3b8' },
};

export default function Topbar({
  currentUser,
  savedAccounts = [],
  onSearch,
  onLogout,
  onSwitchAccount,
  onAddAccount,
  calendarStatus = 'default',
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchValue, setSearchValue]   = useState('');
  const [syncing, setSyncing]           = useState(false);
  const dropdownRef                     = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
    onSearch && onSearch(e.target.value);
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1800);
  };

  const statusCfg = CALENDAR_STATUS_CONFIG[calendarStatus] || CALENDAR_STATUS_CONFIG.default;

  const otherAccounts = savedAccounts.filter(
    (acc) => acc.email !== currentUser?.email
  );

  return (
    <div style={topbarStyle}>
      {/* ── Left: Search ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f4f7fb',
          borderRadius: '10px',
          padding: '0 14px',
          gap: '8px',
          flex: '0 1 360px',
          height: '40px',
          border: '1px solid #e3eaf3',
        }}
      >
        <FiSearch size={16} color="#94a3b8" />
        <input
          type="text"
          placeholder="Cari rapat, ruangan…"
          value={searchValue}
          onChange={handleSearchChange}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '13.5px',
            fontFamily: 'Poppins, sans-serif',
            color: '#1e3a5f',
            width: '100%',
          }}
        />
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Calendar status badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: statusCfg.bg,
            color: statusCfg.color,
            borderRadius: '20px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusCfg.dot,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          {statusCfg.label}
        </div>

        {/* Sync button */}
        <button
          onClick={handleSync}
          title="Sinkronisasi"
          style={{
            width: '38px',
            height: '38px',
            border: '1px solid #e3eaf3',
            borderRadius: '10px',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
            color: '#5a7399',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f4f7fb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <FiRefreshCw
            size={16}
            style={{
              transition: 'transform 0.5s',
              transform: syncing ? 'rotate(360deg)' : 'rotate(0deg)',
              animation: syncing ? 'spin 0.6s linear infinite' : 'none',
            }}
          />
        </button>

        {/* Bell / notifications */}
        <button
          title="Notifikasi"
          style={{
            width: '38px',
            height: '38px',
            border: '1px solid #e3eaf3',
            borderRadius: '10px',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            color: '#5a7399',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f4f7fb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <FiBell size={17} />
          {/* unread dot — optionally driven by a prop */}
          <span
            style={{
              position: 'absolute',
              top: '8px',
              right: '9px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#ef4444',
              border: '2px solid #fff',
            }}
          />
        </button>

        {/* ── Profile dropdown ── */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: dropdownOpen ? '#f0f4fa' : '#fff',
              border: '1px solid #e3eaf3',
              borderRadius: '12px',
              padding: '6px 12px 6px 6px',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fa')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = dropdownOpen ? '#f0f4fa' : '#fff')
            }
          >
            {/* Avatar */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1769aa, #0d2d5e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <FaUserCircle size={20} />}
            </div>

            <div style={{ textAlign: 'left', lineHeight: 1.3 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e3a5f', whiteSpace: 'nowrap' }}>
                {currentUser?.name || 'Pengguna'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {currentUser?.role || 'Staff'}
              </div>
            </div>

            <FiChevronDown
              size={15}
              color="#94a3b8"
              style={{
                transition: 'transform 0.2s',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                marginLeft: '2px',
              }}
            />
          </button>

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: '#fff',
                border: '1px solid #e3eaf3',
                borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(13,45,94,0.13)',
                minWidth: '240px',
                zIndex: 100,
                overflow: 'hidden',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '12px 16px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#94a3b8',
                  borderBottom: '1px solid #f0f4fa',
                }}
              >
                GANTI AKUN CEPAT
              </div>

              {/* Other saved accounts */}
              {otherAccounts.length > 0 ? (
                <div style={{ padding: '6px 8px' }}>
                  {otherAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      onClick={() => {
                        onSwitchAccount && onSwitchAccount(acc);
                        setDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'Poppins, sans-serif',
                        transition: 'background 0.13s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f4f7fb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          background: '#e3eaf3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#0d2d5e',
                          flexShrink: 0,
                        }}
                      >
                        {acc.name ? acc.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e3a5f' }}>
                          {acc.name || acc.email}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{acc.role || 'Staff'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '10px 16px', fontSize: '12px', color: '#b0bec5' }}>
                  Tidak ada akun lain tersimpan.
                </div>
              )}

              {/* Add account */}
              <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f4fa' }}>
                <button
                  onClick={() => {
                    onAddAccount && onAddAccount();
                    setDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '9px',
                    cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#1769aa',
                    transition: 'background 0.13s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FiPlusCircle size={15} />
                  + Tambah Akun Lain
                </button>
              </div>

              {/* Log out */}
              <div style={{ padding: '4px 8px 8px', borderTop: '1px solid #f0f4fa' }}>
                <button
                  onClick={() => {
                    onLogout && onLogout();
                    setDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 10px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '9px',
                    cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#e53935',
                    transition: 'background 0.13s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fff5f5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FiLogOut size={15} />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spin keyframe (injected once) */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
