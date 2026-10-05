import React, { createContext, useContext, useReducer } from 'react';
import { initialMeetings, initialRooms, initialUsers } from './data/initialData';

// ---------------------------------------------------------------------------
// Helper – read the currently-logged-in user from localStorage
// ---------------------------------------------------------------------------
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
const initialState = {
  meetings: initialMeetings,
  rooms: initialRooms,
  users: initialUsers,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function dashboardReducer(state, action) {
  switch (action.type) {
    // ── Meetings ─────────────────────────────────────────────────────────────
    case 'ADD_MEETING':
      return {
        ...state,
        meetings: [...state.meetings, action.payload],
      };

    case 'UPDATE_MEETING':
      return {
        ...state,
        meetings: state.meetings.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload } : m
        ),
      };

    case 'DELETE_MEETING':
      return {
        ...state,
        meetings: state.meetings.filter((m) => m.id !== action.payload),
      };

    // ── Rooms ─────────────────────────────────────────────────────────────────
    case 'ADD_ROOM':
      return {
        ...state,
        rooms: [...state.rooms, action.payload],
      };

    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };

    case 'DELETE_ROOM':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.payload),
      };

    // ── Users ─────────────────────────────────────────────────────────────────
    case 'ADD_USER':
      return {
        ...state,
        users: [...state.users, action.payload],
      };

    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.payload.id ? { ...u, ...action.payload } : u
        ),
      };

    case 'DELETE_USER':
      return {
        ...state,
        users: state.users.filter((u) => u.id !== action.payload),
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export const DashboardContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function DashboardProvider({ children }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // Convenience action creators exposed via context value
  const value = {
    // State slices
    meetings: state.meetings,
    rooms: state.rooms,
    users: state.users,

    // Current user helper
    getCurrentUser,

    // Meeting actions
    addMeeting: (meeting) => dispatch({ type: 'ADD_MEETING', payload: meeting }),
    updateMeeting: (meeting) => dispatch({ type: 'UPDATE_MEETING', payload: meeting }),
    deleteMeeting: (id) => dispatch({ type: 'DELETE_MEETING', payload: id }),

    // Room actions
    addRoom: (room) => dispatch({ type: 'ADD_ROOM', payload: room }),
    updateRoom: (room) => dispatch({ type: 'UPDATE_ROOM', payload: room }),
    deleteRoom: (id) => dispatch({ type: 'DELETE_ROOM', payload: id }),

    // User actions
    addUser: (user) => dispatch({ type: 'ADD_USER', payload: user }),
    updateUser: (user) => dispatch({ type: 'UPDATE_USER', payload: user }),
    deleteUser: (id) => dispatch({ type: 'DELETE_USER', payload: id }),

    // Raw dispatch for advanced usage
    dispatch,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
