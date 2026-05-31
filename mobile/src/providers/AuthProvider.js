import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, SESSION_STORAGE_KEY, ACTIVE_ROOM_STORAGE_KEY } from '../constants/config';
import { getSession, clearSession, getAuthHeader, saveSession } from '../utils/auth';
import { getSocket } from '../utils/socket';
import { showAlert } from '../utils/alertUtils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadStoredAuth = async () => {
      try {
        const { user: parsedSession } = await getSession();

        if (!mounted) return;

        let validatedActiveRoom = null;
        const storedActiveRoom = await AsyncStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
        const parsedActiveRoom = storedActiveRoom ? JSON.parse(storedActiveRoom) : null;

        if (parsedActiveRoom?.roomCode) {
          try {
            const authHeader = await getAuthHeader();
            const verifyRes = await fetch(`${API_BASE_URL}/rooms/${parsedActiveRoom.roomCode}/verify`, {
              headers: { "Content-Type": "application/json", ...authHeader },
            });
            if (verifyRes.status === 404) {
              validatedActiveRoom = null;
              await AsyncStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
            } else if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              validatedActiveRoom = verifyData.room;
              await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(verifyData.room));
            }
          } catch (err) { /* network fail */ }
        }

        if (!validatedActiveRoom && parsedSession?.role !== "teacher" && parsedSession?.joinedRooms?.length > 0) {
          const lastRoom = parsedSession.joinedRooms[parsedSession.joinedRooms.length - 1];
          try {
            const authHeader = await getAuthHeader();
            const verifyRes = await fetch(`${API_BASE_URL}/rooms/${lastRoom.roomCode}/verify`, {
              headers: { "Content-Type": "application/json", ...authHeader },
            });
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              if (verifyData.room && verifyData.room.status === "active") {
                validatedActiveRoom = verifyData.room;
                await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(verifyData.room));
              }
            }
          } catch (err) { /* silent */ }
        }

        setProfile(parsedSession ?? null);

        if (parsedSession) {
          try {
            const authHeader = await getAuthHeader();
            const res = await fetch(`${API_BASE_URL}/users/profile`, {
              headers: { "Content-Type": "application/json", ...authHeader },
            });
            if (!res.ok) {
              await clearSession();
              setProfile(null);
            }
          } catch (_err) { /* offline */ }
        }

        const checkZombieClips = async () => {
          try {
            const pending = await AsyncStorage.getItem('pending-story-cleanup');
            if (pending) {
              const publicIds = JSON.parse(pending);
              if (publicIds.length > 0) {
                const authHeader = await getAuthHeader();
                await fetch(`${API_BASE_URL}/stories/delete-clips`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ publicIds })
                });
              }
              await AsyncStorage.removeItem('pending-story-cleanup');
            }
          } catch (e) { console.error("[CLEANUP] Startup check failed:", e); }
        };
        checkZombieClips();

      } catch (error) {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoadingAuth(false);
      }
    };

    loadStoredAuth();
    return () => { mounted = false; };
  }, []);

  const handleEnter = useCallback(async (nextProfile) => {
    setProfile(nextProfile);
  }, []);

  const handleLogout = useCallback(async () => {
    await clearSession();
    await AsyncStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    setProfile(null);
  }, []);

  const saveUserPreferences = useCallback(async (nextPreferences) => {
    if (!profile?.email) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ preferences: nextPreferences }),
      });
      const data = await response.json();
      if (response.ok && data.user) {
        const nextUser = { ...profile, preferences: data.user.preferences };
        setProfile(nextUser);
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
      }
    } catch (_error) { /* offline */ }
  }, [profile]);

  const handleSaveFeedback = useCallback(async (payload) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) return { ok: false, message: data.message || "Could not save feedback" };
      return { ok: true, message: data.message || "Feedback saved successfully" };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') return { ok: false, message: "Request timed out." };
      return { ok: false, message: "Could not reach the backend." };
    }
  }, []);

  const handleFetchFeedbackHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        headers: await getAuthHeader(),
      });
      const data = await response.json();
      if (!response.ok) return { ok: false, message: data.message || "Could not load feedback history", feedback: [] };
      return { ok: true, feedback: Array.isArray(data) ? data : [] };
    } catch (error) {
      return { ok: false, message: "Could not reach the backend.", feedback: [] };
    }
  }, []);

  const handleDeleteFeedback = useCallback(async (feedbackId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback/${feedbackId}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });
      if (response.ok) return { ok: true };
      const data = await response.json();
      return { ok: false, message: data.message || "Failed to delete feedback" };
    } catch (error) {
      return { ok: false, message: "Connection error." };
    }
  }, []);

  const handleRemoveRoomHistory = useCallback(async (roomCode) => {
    if (!profile?.id) return { ok: false };
    try {
      const response = await fetch(`${API_BASE_URL}/users/students/${profile.id}/history/${roomCode}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });
      if (response.ok) {
        setProfile((prev) => {
          if (!prev) return prev;
          const nextProfile = { ...prev };
          nextProfile.joinedRooms = (nextProfile.joinedRooms || []).filter(r => r.roomCode !== roomCode);
          AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextProfile));
          return nextProfile;
        });
        return { ok: true };
      }
      const data = await response.json();
      return { ok: false, message: data.message || "Failed to remove room" };
    } catch (error) {
      return { ok: false, message: "Connection error" };
    }
  }, [profile]);

  const handleRemoveTeacherRoomHistory = useCallback(async (roomCode) => {
    if (!profile?.id) return { ok: false };
    try {
      const response = await fetch(`${API_BASE_URL}/users/teachers/${profile.id}/history/${roomCode}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });
      if (response.ok) {
        setProfile((prev) => {
          if (!prev) return prev;
          const nextProfile = { ...prev };
          nextProfile.rooms = (nextProfile.rooms || []).filter(r => r.roomCode !== roomCode);
          AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextProfile));
          return nextProfile;
        });
        return { ok: true };
      }
      const data = await response.json();
      return { ok: false, message: data.message || "Failed to remove room" };
    } catch (error) {
      return { ok: false, message: "Connection error" };
    }
  }, [profile]);

  const handleRefreshProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: await getAuthHeader(),
      });
      const data = await response.json();
      if (response.ok) {
        setProfile(data);
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
        return { ok: true, profile: data };
      }
      return { ok: false, message: data.message || "Fetch failed" };
    } catch (error) {
      return { ok: false, message: "Sync error" };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      profile, loadingAuth, setProfile,
      handleEnter, handleLogout,
      saveUserPreferences,
      handleSaveFeedback, handleFetchFeedbackHistory, handleDeleteFeedback,
      handleRemoveRoomHistory, handleRemoveTeacherRoomHistory,
      handleRefreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
