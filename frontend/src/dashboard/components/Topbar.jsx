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
  const [notifOpen, setNotifOpen]       = useState(false);
  const [searchValue, setSearchValue]   = useState('');
  const [syncing, setSyncing]           = useState(false);
  const dropdownRef                     = useRef(null);
  const notifRef                        = useRef(null);
  const [notifList, setNotifList]       = useState([]);

  useEffect(() => {
    const loadNotifs = () => {
      try {
        const stored = localStorage.getItem('app_notifications');
        if (stored) {
          setNotifList(JSON.parse(stored));
        } else {
          const storedMeetings = localStorage.getItem('app_meetings');
          if (storedMeetings) {
            const ms = JSON.parse(storedMeetings);
            const pending = ms.filter((m) => m.status === 'Menunggu Approval');
            setNotifList(
              pending.map((m) => ({
                id: m.id,
                meetingId: m.id,
                title: 'Permintaan Booking Ruang Rapat',
                requester: m.requester,
                room: m.room,
                date: m.date,
                time: `${m.start}-${m.end}`,
                status: m.status,
                createdAt: m.createdAt || new Date().toISOString(),
                readBy: [],
              }))
            );
          }
        }
      } catch (e) {}
    };

    loadNotifs();
    window.addEventListener('storage', loadNotifs);
    window.addEventListener('app_notifications_updated', loadNotifs);
    const interval = setInterval(loadNotifs, 3000);
    return () => {
      window.removeEventListener('storage', loadNotifs);
      window.removeEventListener('app_notifications_updated', loadNotifs);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
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

  const otherAccounts = savedAccounts
    .filter(
      (acc) =>
        acc.email !== currentUser?.email &&
        (acc.username || "").toLowerCase() !== (currentUser?.username || "").toLowerCase() &&
        (acc.name || "").toLowerCase() !== "andi pratama",
    )
    .map((acc) => {
      if (acc.role === "Approval 1" || acc.role === "Approval 2") {
        return { ...acc, role: "Approval" };
      }
      return acc;
    });

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
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            title="Notifikasi"
            onClick={() => setNotifOpen((prev) => !prev)}
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
            {notifList.filter((n) => n.status === 'Menunggu Approval').length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  minWidth: '17px',
                  height: '17px',
                  borderRadius: '10px',
                  border: '2px solid #fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {notifList.filter((n) => n.status === 'Menunggu Approval').length > 9
                  ? '9+'
                  : notifList.filter((n) => n.status === 'Menunggu Approval').length}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {notifOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '360px',
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 12px 36px rgba(12, 45, 94, 0.16)',
                border: '1px solid #e2e8f0',
                zIndex: 100,
                overflow: 'hidden',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #edf2f7',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0c2d5e' }}>
                    Notifikasi
                  </span>
                  {notifList.filter((n) => n.status === 'Menunggu Approval').length > 0 && (
                    <span
                      style={{
                        background: '#fff7ed',
                        color: '#c2410c',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        border: '1px solid #ffedd5',
                      }}
                    >
                      {notifList.filter((n) => n.status === 'Menunggu Approval').length} Menunggu
                    </span>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifList.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔔</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0c2d5e' }}>
                      Tidak Ada Notifikasi
                    </div>
                  </div>
                ) : (
                  notifList.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        background: n.status === 'Menunggu Approval' ? '#fbfcfe' : '#fff',
                        borderLeft:
                          n.status === 'Menunggu Approval'
                            ? '3px solid #f97316'
                            : '3px solid transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <strong style={{ fontSize: '12.5px', color: '#0c2d5e' }}>
                          {n.title || 'Request Pemesanan'}
                        </strong>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '8px',
                            background:
                              n.status === 'Menunggu Approval'
                                ? '#fff7ed'
                                : n.status === 'Akan Datang'
                                ? '#f0fdf4'
                                : '#fef2f2',
                            color:
                              n.status === 'Menunggu Approval'
                                ? '#ea580c'
                                : n.status === 'Akan Datang'
                                ? '#16a34a'
                                : '#dc2626',
                          }}
                        >
                          {n.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#475569' }}>
                        {n.message || `Pemohon: ${n.requester} · ${n.room}`}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        🏛️ {n.room} · 📅 {n.date} ({n.time})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
                  Tambah Akun Lain
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
