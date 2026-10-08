import React from 'react';
import { IoMdHome } from 'react-icons/io';
import { LiaUsersSolid } from 'react-icons/lia';
import { BsBuildingFillGear } from 'react-icons/bs';
import { FaUserGroup, FaCalendarAlt } from 'react-icons/fa6';
import { IoSettingsOutline } from 'react-icons/io5';
import { FaTv, FaSignOutAlt } from 'react-icons/fa';

const sidebarStyle = {
  background: 'linear-gradient(175deg, #0a2448 0%, #0d2d5e 40%, #133672 100%)',
  color: '#fff',
  width: '250px',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Poppins, sans-serif',
  position: 'fixed',
  top: 0,
  bottom: 0,
  overflowY: 'auto',
};

const navItemBase = {
  color: 'rgba(255,255,255,0.72)',
  padding: '11px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: '11px',
  cursor: 'pointer',
  borderRadius: '10px',
  fontSize: '13.5px',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background 0.18s, color 0.18s',
  userSelect: 'none',
};

const navItemActive = {
  ...navItemBase,
  background: '#1769aa',
  color: '#fff',
};

const ALL_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard',     icon: IoMdHome },
  { key: 'meetings',  label: 'Rapat',          icon: LiaUsersSolid },
  { key: 'rooms',     label: 'Ruang Rapat',    icon: BsBuildingFillGear },
  { key: 'users',     label: 'Pengguna',       icon: FaUserGroup },
  { key: 'calendar',  label: 'Kalender',       icon: FaCalendarAlt },
  { key: 'settings',  label: 'Pengaturan',     icon: IoSettingsOutline, adminOnly: true },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  currentUser,
  savedAccounts,
  onLogout,
  onSwitchAccount,
  onAddAccount,
}) {
  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.adminOnly || currentUser?.role === 'Administrator'
  );

  return (
    <div style={sidebarStyle}>
      {/* ── Logo ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '22px 18px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          flexShrink: 0,
        }}
      >
        <img
          src="/dashboard-app/assets/kemenaker-white.jpeg"
          alt="Kemenaker Logo"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            objectFit: 'cover',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.25)',
          }}
        />
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: '#fff' }}>
            MEETING DISPLAY ROOM
          </div>
          <div style={{ fontSize: '9.5px', fontWeight: 400, color: 'rgba(255,255,255,0.60)', letterSpacing: '0.04em' }}>
            BIRO KEUANGAN DAN BMN
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = currentPage === key;
          return (
            <div
              key={key}
              style={isActive ? navItemActive : navItemBase}
              onClick={() => onNavigate && onNavigate(key)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.72)';
                }
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span>{label}</span>
              {isActive && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#62b0ff',
                  }}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        style={{
          padding: '14px 12px',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Display TV */}
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1.2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 6px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              textDecoration: 'none',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
            }}
          >
            <span>Display TV</span>
          </a>

          {/* Keluar */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 6px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(220,38,38,0.75)',
              color: '#fff',
              cursor: 'pointer',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
            }}
            onClick={() => onLogout && onLogout()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220,38,38,0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(220,38,38,0.75)';
            }}
          >
            <span>Keluar</span>
          </div>
        </div>

        {/* Current user chip */}
        {currentUser && (
          <div
            style={{
              marginTop: '8px',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.07)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#1769aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentUser.name || 'User'}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.50)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentUser.role || 'Staff'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
