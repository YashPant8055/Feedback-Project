import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, useColorScheme } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL, SESSION_STORAGE_KEY, ACTIVE_ROOM_STORAGE_KEY } from "../constants/config";
import { DEFAULT_THEME_SETTINGS, THEME_SETTINGS_STORAGE_KEY, STORY_MODE_STORAGE_KEY } from "../constants/themeConstants";
import { getRandomTheme, getThemeByName, hexToRgba, getResolvedAppearanceMode, getDisplayTheme } from "../utils/themeUtils";
import { getSession, clearSession, getAuthHeader } from '../utils/auth';
import DashboardScreen from '../screens/DashboardScreen';
import SelfieFeedbackScreen from '../screens/SelfieFeedbackScreen';
import StoryExperience from '../screens/StoryExperience';
import AuthScreen from '../screens/AuthScreen';
import FeedbackAnimationScreen from '../screens/FeedbackAnimationScreen';
import TeacherDashboard from '../screens/TeacherDashboard';
import MyClipsScreen from '../screens/MyClipsScreen';
import UploadStoryScreen from '../screens/UploadStoryScreen';
import RoomFormScreen from '../screens/RoomFormScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';
import StudentRoomDetailScreen from '../screens/StudentRoomDetailScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import WelcomeAnimation from './WelcomeAnimation';
import styles from "../styles/globalStyles";
import { getSocket } from '../utils/socket';
import { showAlert } from '../utils/alertUtils';
import { Asset } from 'expo-asset';

export default function AppContent() {
  const systemColorScheme = useColorScheme();
  const [profile, setProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [screen, setScreen] = useState("dashboard");
  const [storyLaunch, setStoryLaunch] = useState({
    storyId: "",
    autoStartToken: 0,
  });
  const [storyModePreference, setStoryModePreference] = useState("random");
  const [theme, setTheme] = useState(() => getRandomTheme());
  const [themeSettings, setThemeSettings] = useState(DEFAULT_THEME_SETTINGS);
  const [animationReview, setAnimationReview] = useState(null);
  const [selectedRoomCode, setSelectedRoomCode] = useState(null);
  const [editingRoomData, setEditingRoomData] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [selectedRoomForDetail, setSelectedRoomForDetail] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadStoredAuth = async () => {
      try {
        const { user: parsedSession } = await getSession();
        
        const [storedThemeSettings, storedStoryMode, storedActiveRoom] = await Promise.all([
          AsyncStorage.getItem(THEME_SETTINGS_STORAGE_KEY),
          AsyncStorage.getItem(STORY_MODE_STORAGE_KEY),
          AsyncStorage.getItem(ACTIVE_ROOM_STORAGE_KEY),
        ]);
        
        const parsedThemeSettings = storedThemeSettings ? JSON.parse(storedThemeSettings) : null;
        const parsedActiveRoom = storedActiveRoom ? JSON.parse(storedActiveRoom) : null;
        const storedPreferences = parsedSession?.preferences || {};
        const nextThemeSettings = {
          ...DEFAULT_THEME_SETTINGS,
          ...(parsedThemeSettings || {}),
          ...(storedPreferences.themeSettings || {}),
        };
        const nextStoryModePreference =
          storedPreferences.storyModePreference || storedStoryMode || "random";

        if (!mounted) {
          return;
        }

        let validatedActiveRoom = parsedActiveRoom;
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
          } catch (err) {
            // Silently fail verification if network is down
          }
        }

        // Auto-rejoin last active room if no active session is cached
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
          } catch (err) {
            // Silently ignore auto-join failures
          }
        }

        setThemeSettings(nextThemeSettings);
        setStoryModePreference(nextStoryModePreference);
        setProfile(parsedSession ?? null);
        setActiveRoom(validatedActiveRoom);
        
        // Decide initial screen based on role
        if (!parsedSession) {
          setScreen("auth");
        } else if (parsedSession.role === "admin") {
          setScreen("admin");
        } else if (parsedSession.role === "teacher") {
          setScreen("teacher");
        } else {
          setScreen("dashboard");
        }
        setTheme((current) =>
          nextThemeSettings.autoRotate
            ? getRandomTheme(current?.name)
            : getThemeByName(nextThemeSettings.selectedThemeName)
        );
        // Perform Zombie Cleanup for abandoned uploads
        const checkZombieClips = async () => {
          try {
            const pending = await AsyncStorage.getItem('pending-story-cleanup');
            if (pending) {
              const publicIds = JSON.parse(pending);
              if (publicIds.length > 0) {
                console.log(`[CLEANUP] Found ${publicIds.length} abandoned clips. Deleting...`);
                const authHeader = await getAuthHeader();
                await fetch(`${API_BASE_URL}/stories/delete-clips`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ publicIds })
                });
              }
              await AsyncStorage.removeItem('pending-story-cleanup');
            }
          } catch (e) {
            console.error("[CLEANUP] Startup check failed:", e);
          }
        };
        checkZombieClips();

      } catch (error) {
        if (mounted) {
          setProfile(null);
          setScreen("auth");
          setTheme((current) => getRandomTheme(current?.name));
        }
      } finally {
        if (mounted) {
          setLoadingAuth(false);
        }
      }
    };

    loadStoredAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Socket Listener for Room Closure
  useEffect(() => {
    const socket = getSocket();
    
    if (activeRoom) {
      socket.emit("join-room", activeRoom.roomCode);
    }

    const handleRoomClosed = (data) => {
      if (activeRoom && data.roomCode === activeRoom.roomCode) {
        showAlert(
          "Session Ended", 
          "This room has been closed by the teacher or its time limit has expired.",
          [{ text: "OK", onPress: () => {
            setActiveRoom(null);
            AsyncStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
            setScreen("dashboard");
          }}]
        );
      }
    };

    socket.on("room-closed", handleRoomClosed);
    return () => {
      socket.off("room-closed", handleRoomClosed);
    };
  }, [activeRoom?.roomCode]);

  const handleEnter = useCallback(async (nextProfile) => {
    const nextThemeSettings = {
      ...DEFAULT_THEME_SETTINGS,
      ...(nextProfile?.preferences?.themeSettings || {}),
    };
    const nextStoryModePreference =
      nextProfile?.preferences?.storyModePreference || "random";

    setProfile(nextProfile);
    setThemeSettings(nextThemeSettings);
    setStoryModePreference(nextStoryModePreference);
    
    if (nextProfile?.role === "admin") {
      setScreen("admin");
    } else if (nextProfile?.role === "teacher") {
      setScreen("teacher");
    } else {
      setScreen("dashboard");
    }
    setTheme((current) =>
      nextThemeSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(nextThemeSettings.selectedThemeName)
    );

    // Auto-rejoin if a student just logged in and has past joined rooms
    if (nextProfile?.role !== "teacher" && nextProfile?.joinedRooms?.length > 0) {
      const lastRoom = nextProfile.joinedRooms[nextProfile.joinedRooms.length - 1];
      try {
        const authHeader = await getAuthHeader();
        const verifyRes = await fetch(`${API_BASE_URL}/rooms/${lastRoom.roomCode}/verify`, {
          headers: { "Content-Type": "application/json", ...authHeader },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.room && verifyData.room.status === "active") {
            setActiveRoom(verifyData.room);
            await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(verifyData.room));
          }
        }
      } catch (err) {
        // Silently ignore network failures on auto-join
      }
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await clearSession();
    await AsyncStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    setProfile(null);
    setActiveRoom(null);
    setScreen("auth");
    setTheme((current) =>
      themeSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(themeSettings.selectedThemeName)
    );
  }, [themeSettings.autoRotate, themeSettings.selectedThemeName]);

  const saveUserPreferences = async (nextPreferences) => {
    if (!profile?.email) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          preferences: nextPreferences,
        }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        // Sync local profile state with server-saved preferences
        const nextUser = {
          ...profile,
          preferences: data.user.preferences
        };
        setProfile(nextUser);
        await AsyncStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(nextUser)
        );
      }
    } catch (_error) {
      // Keep local settings working even if the backend is temporarily offline.
    }
  };

  const handleThemeSettingsChange = async (nextSettings) => {
    setThemeSettings(nextSettings);
    await AsyncStorage.setItem(
      THEME_SETTINGS_STORAGE_KEY,
      JSON.stringify(nextSettings)
    );

    setTheme((current) =>
      nextSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(nextSettings.selectedThemeName)
    );

    await saveUserPreferences({
      themeSettings: nextSettings,
      storyModePreference,
    });
  };

  const handleOpenStoryMode = (storyId = "story1", autoStart = false) => {
    setStoryLaunch((current) => ({
      storyId,
      autoStartToken: autoStart ? current.autoStartToken + 1 : 0,
    }));
    setScreen("story");
  };

  const handleStoryModePreferenceChange = async (nextPreference) => {
    setStoryModePreference(nextPreference);
    await AsyncStorage.setItem(STORY_MODE_STORAGE_KEY, nextPreference);
    await saveUserPreferences({
      themeSettings,
      storyModePreference: nextPreference,
    });
  };

  const resolvedAppearanceMode = showIntro 
    ? "dark" 
    : getResolvedAppearanceMode(
        themeSettings.appearanceMode,
        systemColorScheme
      );

  const displayTheme = { ...getDisplayTheme(theme, resolvedAppearanceMode), mode: resolvedAppearanceMode };

  const handleJoinRoom = useCallback(async (roomCode) => {
    if (!profile?.id) return { ok: false, message: "Please log in first" };
    setJoiningRoom(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/rooms/join`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          roomCode: roomCode,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        // Update profile with joined rooms history locally
        setProfile((prev) => {
          if (!prev) return prev;
          const nextProfile = { ...prev };
          if (!nextProfile.joinedRooms) nextProfile.joinedRooms = [];
          
          const alreadyJoined = nextProfile.joinedRooms.some(r => r.roomCode === data.room.roomCode);
          if (!alreadyJoined) {
            nextProfile.joinedRooms.push({
              roomCode: data.room.roomCode,
              roomName: data.room.roomName,
              joinedAt: new Date().toISOString()
            });
            AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextProfile));
          }
          return nextProfile;
        });

        setActiveRoom(data.room);
        await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(data.room));
        return { ok: true, message: `Joined ${data.room.roomName}` };
      } else {
        return { ok: false, message: data.message || "Failed to join room" };
      }
    } catch (error) {
      return { ok: false, message: "Connection error. Please try again." };
    } finally {
      setJoiningRoom(false);
    }
  }, [profile?.id]);

  const handleLeaveRoom = useCallback(async () => {
    setActiveRoom(null);
    await AsyncStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  }, []);

  const handleSaveFeedback = useCallback(async (payload) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          ...payload,
          roomCode: activeRoom?.roomCode || "",
          roomName: activeRoom?.roomName || "",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          message: data.message || "Could not save feedback",
        };
      }

      return {
        ok: true,
        message: data.message || "Feedback saved successfully",
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        return {
          ok: false,
          message: "Request timed out. Please try again.",
        };
      }
      return {
        ok: false,
        message:
          "Could not reach the backend. Make sure the server is running on port 4000.",
      };
    }
  }, [profile?.email, activeRoom?.roomCode, activeRoom?.roomName]);

  const handleFetchFeedbackHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        headers: await getAuthHeader(),
      });
      const data = await response.json();

      if (!response.ok) {
        return {
          ok: false,
          message: data.message || "Could not load feedback history",
          feedback: [],
        };
      }

      return {
        ok: true,
        feedback: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      return {
        ok: false,
        message: "Could not reach the backend to load feedback history.",
        feedback: [],
      };
    }
  }, [profile?.email]);

  const handleDeleteFeedback = useCallback(async (feedbackId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback/${feedbackId}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });

      if (response.ok) {
        return { ok: true };
      } else {
        const data = await response.json();
        return { ok: false, message: data.message || "Failed to delete feedback" };
      }
    } catch (error) {
      return { ok: false, message: "Connection error. Please try again." };
    }
  }, [profile?.email]);

  const handleRemoveRoomHistory = useCallback(async (roomCode) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/students/${profile.id}/history/${roomCode}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });

      if (response.ok) {
        // Update local state and storage
        setProfile((prev) => {
          if (!prev) return prev;
          const nextProfile = { ...prev };
          nextProfile.joinedRooms = (nextProfile.joinedRooms || []).filter(r => r.roomCode !== roomCode);
          AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextProfile));
          return nextProfile;
        });
        return { ok: true };
      } else {
        const data = await response.json();
        return { ok: false, message: data.message || "Failed to remove room" };
      }
    } catch (error) {
      return { ok: false, message: "Connection error" };
    }
  }, [profile?.id]);

  const handleRemoveTeacherRoomHistory = useCallback(async (roomCode) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/teachers/${profile.id}/history/${roomCode}`, {
        method: "DELETE",
        headers: await getAuthHeader(),
      });

      if (response.ok) {
        // Update local state and storage
        setProfile((prev) => {
          if (!prev) return prev;
          const nextProfile = { ...prev };
          nextProfile.rooms = (nextProfile.rooms || []).filter(r => r.roomCode !== roomCode);
          AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextProfile));
          return nextProfile;
        });
        return { ok: true };
      } else {
        const data = await response.json();
        return { ok: false, message: data.message || "Failed to remove room" };
      }
    } catch (error) {
      return { ok: false, message: "Connection error" };
    }
  }, [profile?.id]);

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
  }, [profile?.email]);

  if (showIntro || loadingAuth) {
    return (
      <WelcomeAnimation 
        theme={displayTheme} 
        onComplete={() => setShowIntro(false)} 
      />
    );
  }

  if (!profile) {
    return (
      <AuthScreen
        onEnter={handleEnter}
        loading={loadingAuth}
        theme={displayTheme}
      />
    );
  }

  if (screen === "story") {
    return (
      <StoryExperience
        profile={profile}
        activeRoom={activeRoom}
        onLogout={handleLogout}
        onBack={() => setScreen("dashboard")}
        onSaveFeedback={handleSaveFeedback}
        themeSettings={themeSettings}
        onThemeSettingsChange={handleThemeSettingsChange}
        theme={displayTheme}
        initialStoryId={storyLaunch.storyId}
        autoStartToken={storyLaunch.autoStartToken}
      />
    );
  }

  if (screen === "selfie") {
    return (
      <SelfieFeedbackScreen
        onBack={() => setScreen("dashboard")}
        onSaveFeedback={handleSaveFeedback}
        onNavigateToAnimation={(review) => {
          setAnimationReview(review);
          setScreen("animation");
        }}
        theme={displayTheme}
      />
    );
  }

  if (screen === "animation" && animationReview) {
    return (
      <FeedbackAnimationScreen
        review={animationReview}
        onDone={() => {
          setAnimationReview(null);
          setScreen(profile?.role === "teacher" ? "teacher" : "dashboard");
        }}
        theme={displayTheme}
      />
    );
  }

  // ── Admin Screens ──
  if (profile?.role === "admin" || screen === "admin") {
    if (screen === "myClips") {
      return (
        <MyClipsScreen
          profile={profile}
          theme={displayTheme}
          onBack={() => setScreen("admin")}
          onGoToUpload={() => setScreen("uploadStory")}
        />
      );
    }

    if (screen === "uploadStory") {
      return (
        <UploadStoryScreen
          profile={profile}
          theme={displayTheme}
          onBack={() => setScreen("myClips")}
          onUploadSuccess={() => {}}
        />
      );
    }

    return (
      <AdminDashboardScreen
        profile={profile}
        theme={displayTheme}
        onLogout={handleLogout}
        onViewClips={() => setScreen("myClips")}
        onGoToUpload={() => setScreen("uploadStory")}
        themeSettings={themeSettings}
        onThemeSettingsChange={handleThemeSettingsChange}
      />
    );
  }

  // ── Teacher Screens ──
  if (profile?.role === "teacher") {
    if (screen === "myClips") {
      return (
        <MyClipsScreen
          profile={profile}
          theme={displayTheme}
          onBack={() => setScreen("teacher")}
          onGoToUpload={() => setScreen("uploadStory")}
        />
      );
    }

    if (screen === "uploadStory") {
      return (
        <UploadStoryScreen
          profile={profile}
          theme={displayTheme}
          onBack={() => setScreen("myClips")}
          onUploadSuccess={() => {
            // Success handled by Aler in screen
          }}
        />
      );
    }

    if (screen === "createRoom") {
      return (
        <RoomFormScreen
          onBack={() => setScreen("teacher")}
          theme={displayTheme}
          onSave={async (formData) => {
            try {
              const res = await fetch(`${API_BASE_URL}/rooms`, {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  ...(await getAuthHeader()),
                },
                body: JSON.stringify(formData),
              });
              if (res.ok) setScreen("teacher");
              else alert("Failed to create room");
            } catch (err) { alert("Network error"); }
          }}
        />
      );
    }

    if (screen === "editRoom" && editingRoomData) {
      return (
        <RoomFormScreen
          onBack={() => {
            setEditingRoomData(null);
            setScreen(selectedRoomCode ? "roomDetail" : "teacher");
          }}
          theme={displayTheme}
          initialData={editingRoomData}
          onSave={async (formData) => {
            try {
              const res = await fetch(`${API_BASE_URL}/rooms/${editingRoomData.roomCode}`, {
                method: "PATCH",
                headers: { 
                  "Content-Type": "application/json",
                  ...(await getAuthHeader()),
                },
                body: JSON.stringify(formData),
              });
              if (res.ok) {
                setScreen(selectedRoomCode ? "roomDetail" : "teacher");
                setEditingRoomData(null);
              } else alert("Failed to update room");
            } catch (err) { alert("Network error"); }
          }}
        />
      );
    }

    if (screen === "roomDetail" && selectedRoomCode) {
      return (
        <RoomDetailScreen
          room={{ roomCode: selectedRoomCode }}
          onBack={() => {
            setSelectedRoomCode(null);
            setScreen("teacher");
          }}
          theme={displayTheme}
        />
      );
    }

    return (
      <TeacherDashboard
        profile={profile}
        onLogout={handleLogout}
        onCreateRoom={() => {
          setEditingRoomData(null);
          setScreen("createRoom");
        }}
        onOpenRoom={(roomCode) => {
          setSelectedRoomCode(roomCode);
          setScreen("roomDetail");
        }}
        onEditRoom={(room) => {
          setEditingRoomData(room);
          setScreen("editRoom");
        }}
        onViewClips={() => setScreen("myClips")}
        onRemoveRoomHistory={handleRemoveTeacherRoomHistory}
        onRefreshProfile={handleRefreshProfile}
        themeSettings={themeSettings}
        onThemeSettingsChange={handleThemeSettingsChange}
        theme={displayTheme}
      />
    );
  }

  // ── Student Screens ──
  if (screen === "studentRoomDetail" && selectedRoomForDetail) {
    return (
      <StudentRoomDetailScreen
        roomCode={selectedRoomForDetail}
        profileEmail={profile?.email}
        theme={displayTheme}
        isActiveSession={activeRoom?.roomCode === selectedRoomForDetail}
        onJoinRoom={handleJoinRoom}
        onBack={() => setScreen("dashboard")}
      />
    );
  }

  return (
    <DashboardScreen
      profile={profile}
      activeRoom={activeRoom}
      onJoinRoom={handleJoinRoom}
      onLeaveRoom={handleLeaveRoom}
      joiningRoom={joiningRoom}
      onLogout={handleLogout}
      onOpenStoryMode={handleOpenStoryMode}
      onOpenSelfieFeedback={() => setScreen("selfie")}
      onSaveFeedback={handleSaveFeedback}
      onFetchFeedbackHistory={handleFetchFeedbackHistory}
      onDeleteFeedback={handleDeleteFeedback}
      onRemoveRoomHistory={handleRemoveRoomHistory}
      onOpenRoomDetail={(code) => {
        setSelectedRoomForDetail(code);
        setScreen("studentRoomDetail");
      }}
      onRefreshProfile={handleRefreshProfile}
      onNavigateToAnimation={(review) => {
        setAnimationReview(review);
        setScreen("animation");
      }}
      storyModePreference={storyModePreference}
      onStoryModePreferenceChange={handleStoryModePreferenceChange}
      themeSettings={themeSettings}
      onThemeSettingsChange={handleThemeSettingsChange}
      theme={displayTheme}
    />
  );
}
