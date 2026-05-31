import React, { createContext, useContext, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, ACTIVE_ROOM_STORAGE_KEY, SESSION_STORAGE_KEY } from '../constants/config';
import { getAuthHeader } from '../utils/auth';

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const [activeRoom, setActiveRoom] = useState(null);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [selectedRoomCode, setSelectedRoomCode] = useState(null);
  const [selectedRoomForDetail, setSelectedRoomForDetail] = useState(null);
  const [editingRoomData, setEditingRoomData] = useState(null);

  const [storyLaunch, setStoryLaunch] = useState({ storyId: "", autoStartToken: 0 });
  const [animationReview, setAnimationReview] = useState(null);

  const handleJoinRoom = useCallback(async (roomCode) => {
    setJoiningRoom(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ roomCode }),
      });
      const data = await response.json();
      if (response.ok) {
        setActiveRoom(data.room);
        await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(data.room));
        return { ok: true, message: `Joined ${data.room.roomName}` };
      } else {
        return { ok: false, message: data.message || "Failed to join room" };
      }
    } catch (error) {
      return { ok: false, message: "Connection error." };
    } finally {
      setJoiningRoom(false);
    }
  }, []);

  const handleLeaveRoom = useCallback(async () => {
    setActiveRoom(null);
    await AsyncStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  }, []);

  const handleOpenStoryMode = useCallback((storyId = "story1", autoStart = false) => {
    setStoryLaunch((current) => ({
      storyId,
      autoStartToken: autoStart ? current.autoStartToken + 1 : 0,
    }));
  }, []);

  return (
    <RoomContext.Provider value={{
      activeRoom, setActiveRoom,
      joiningRoom, setJoiningRoom,
      selectedRoomCode, setSelectedRoomCode,
      selectedRoomForDetail, setSelectedRoomForDetail,
      editingRoomData, setEditingRoomData,
      storyLaunch, setStoryLaunch,
      animationReview, setAnimationReview,
      handleJoinRoom, handleLeaveRoom, handleOpenStoryMode,
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}
