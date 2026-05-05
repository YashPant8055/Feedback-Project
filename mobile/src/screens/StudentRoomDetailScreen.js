import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config.js';
import styles from '../styles/globalStyles';
import { showAlert } from '../utils/alertUtils';
import { formatTimeRemaining, formatTimePassed } from '../utils/emotionUtils';
import { getAuthHeader } from '../utils/auth';
import { formatDate } from '../utils/dateUtils';

export default function StudentRoomDetailScreen({ 
  roomCode, 
  onBack, 
  theme, 
  onJoinRoom, 
  isActiveSession,
  profileEmail
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [loading, setLoading] = useState(true);
  const [roomData, setRoomData] = useState(null);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    const updateTimer = () => {
      if (roomData?.status === 'active') {
        setTimeLeft(formatTimePassed(roomData.createdAt));
      } else {
        setTimeLeft("CLOSED");
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 5000);

    return () => clearInterval(timerId);
  }, [roomData?.status, roomData?.createdAt]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch Room Details
        const roomRes = await fetch(`${API_BASE_URL}/rooms/${roomCode}/verify`);
        const roomResult = await roomRes.json();

        if (!mounted) return;

        if (roomRes.ok && roomResult.exists) {
          setRoomData(roomResult.room);
        } else {
          setError(roomResult.message || "Failed to load room details");
          setLoading(false);
          return;
        }

        // Fetch student's feedback for this room
        const feedbackRes = await fetch(`${API_BASE_URL}/feedback`, {
          headers: await getAuthHeader(),
        });
        const feedbackResult = await feedbackRes.json();

        if (!mounted) return;

        if (feedbackRes.ok) {
          const roomFeedback = Array.isArray(feedbackResult) 
            ? feedbackResult.filter(f => f.roomCode === roomCode)
            : [];
          setFeedbackHistory(roomFeedback);
        }

      } catch (err) {
        if (mounted) setError("Connection error. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [roomCode, profileEmail]);

  const handleJoin = async () => {
    const result = await onJoinRoom(roomCode);
    if (!result.ok) {
      showAlert("Error", result.message);
    } else {
      showAlert("Success", `You are now in ${roomData.roomName}`);
    }
  };
  const isRoomActive = roomData?.status === 'active';

  return (
    <View style={[localStyles.root, { backgroundColor: theme.background }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[localStyles.glowOrb, { top: -100, right: -100, width: 350, height: 350, backgroundColor: theme.glowOne }]} />
        <View style={[localStyles.glowOrb, { bottom: -80, left: -120, width: 320, height: 320, backgroundColor: theme.glowTwo }]} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 20) + 12,
          paddingBottom: Math.max(insets.bottom, 20) + 30,
          paddingHorizontal: 20,
          maxWidth: isWide ? 800 : undefined,
          alignSelf: isWide ? 'center' : 'stretch',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={localStyles.headerRow}>
          <Pressable
            style={[localStyles.backButton, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
            onPress={onBack}
          >
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '800' }}>Back</Text>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>
              {roomData?.roomName || "Session Detail"}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>{roomCode}</Text>
                {roomData && (
                  <>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textMuted, opacity: 0.5 }} />
                    <Text style={{ color: theme.accent, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>
                        STUDENT VIEW
                    </Text>
                  </>
                )}
            </View>
          </View>
        </View>

        {loading ? (
          <View style={{ marginTop: 100, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={{ color: theme.textMuted, marginTop: 16, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>FETCHING SESSION DATA...</Text>
          </View>
        ) : error || !roomData ? (
          <View style={{ marginTop: 80, alignItems: 'center', padding: 32, backgroundColor: theme.panel, borderRadius: 24, borderWidth: 1.5, borderColor: theme.inputBorder }}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>{error || "Session not found"}</Text>
            <Pressable 
              onPress={onBack}
              style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.accent, borderRadius: 12 }}
            >
              <Text style={{ color: theme.onAccent, fontWeight: '900' }}>Back</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[localStyles.heroStats, { backgroundColor: theme.panel, borderColor: theme.accent, shadowColor: theme.accent }]}>
                <View style={localStyles.statBox}>
                    <Text style={[localStyles.statVal, { color: theme.textPrimary }]}>{feedbackHistory.length}</Text>
                    <Text style={[localStyles.statLabel, { color: theme.textMuted }]}>YOUR ENTRIES</Text>
                </View>
                <View style={[localStyles.statDivider, { backgroundColor: theme.inputBorder }]} />
                <View style={localStyles.statBox}>
                    <Text style={[localStyles.statVal, { color: roomData.status === 'active' ? (roomData.expiresAt ? '#ff5b7f' : theme.accent) : theme.textMuted }]}>
                      {timeLeft || "..."}
                    </Text>
                    <Text style={[localStyles.statLabel, { color: theme.textMuted }]}>
                      ACTIVE FOR
                    </Text>
                </View>
                <View style={[localStyles.statDivider, { backgroundColor: theme.inputBorder }]} />
                <View style={localStyles.statBox}>
                    <View style={[localStyles.liveBadge, { backgroundColor: isRoomActive ? theme.accentSoft : 'rgba(255,255,255,0.05)' }]}>
                        <View style={[localStyles.liveDot, { backgroundColor: isRoomActive ? theme.accent : theme.textMuted }]} />
                        <Text style={[localStyles.liveText, { color: isRoomActive ? theme.accent : theme.textMuted }]}>{isRoomActive ? "ACTIVE" : "ENDED"}</Text>
                    </View>
                </View>
            </View>

            <View style={[localStyles.sectionContainer, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
              <Text style={localStyles.sectionTitle}>Session Information</Text>
              <View style={{ gap: 12 }}>
                <View style={localStyles.infoRow}>
                  <Text style={[localStyles.infoLabel, { color: theme.textMuted }]}>Instructor</Text>
                  <Text style={[localStyles.infoValue, { color: theme.textPrimary }]}>{roomData.teacherName || "Professor"}</Text>
                </View>
                <View style={localStyles.infoRow}>
                  <Text style={[localStyles.infoLabel, { color: theme.textMuted }]}>Started At</Text>
                  <Text style={[localStyles.infoValue, { color: theme.textPrimary }]}>{formatDate(roomData.createdAt)}</Text>
                </View>
                <View style={localStyles.infoRow}>
                  <Text style={[localStyles.infoLabel, { color: theme.textMuted }]}>Capacity</Text>
                  <Text style={[localStyles.infoValue, { color: theme.textPrimary }]}>{roomData.maxStudents || "Unlimited"}</Text>
                </View>
                {roomData.subject ? (
                  <View style={localStyles.infoRow}>
                    <Text style={[localStyles.infoLabel, { color: theme.textMuted }]}>Subject</Text>
                    <Text style={[localStyles.infoValue, { color: theme.textPrimary }]}>{roomData.subject}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {isRoomActive && !isActiveSession ? (
              <Pressable
                style={[localStyles.joinButton, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
                onPress={handleJoin}
              >
                <Text style={{ color: theme.onAccent, fontWeight: '900', fontSize: 16 }}>JOIN LIVE SESSION</Text>
              </Pressable>
            ) : isActiveSession ? (
              <View style={[localStyles.activeStatus, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
                <Text style={{ color: theme.accent, fontWeight: '900', fontSize: 13 }}>YOU ARE CURRENTLY IN THIS ROOM</Text>
              </View>
            ) : null}

            <View style={{ marginTop: 10 }}>
              <Text style={[localStyles.sectionTitle, { marginLeft: 4 }]}>Your Activity</Text>
              {feedbackHistory.length === 0 ? (
                <View style={[localStyles.emptyHistory, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                  <Text style={{ color: theme.textMuted, textAlign: 'center', fontWeight: '600' }}>No feedback entries yet.</Text>
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  {feedbackHistory.map((item, idx) => (
                    <View key={idx} style={[localStyles.feedbackCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                      <View style={localStyles.cardHeader}>
                        <View style={localStyles.cardUser}>
                            <View style={[localStyles.userIcon, { backgroundColor: theme.accentSoft }]}>
                                <Text style={{ fontSize: 12 }}>{item.type === 'emoji' ? '😊' : item.type === 'written' ? '✍️' : '📽️'}</Text>
                            </View>
                            <View>
                                <Text style={{ fontSize: 15, fontWeight: "900", color: theme.textPrimary }}>
                                  {item.type.toUpperCase()} ENTRY
                                </Text>
                                <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '700' }}>
                                  {item.createdAt ? formatDate(item.createdAt) : 'Today'}
                                </Text>
                            </View>
                        </View>
                      </View>
                      {item.message ? (
                        <View style={[localStyles.messageBox, { backgroundColor: theme.inputBackground }]}>
                            <Text style={{ fontSize: 14, lineHeight: 22, color: theme.textSecondary, fontWeight: '500' }}>{item.message}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  root: { flex: 1, overflow: "hidden" },
  glowOrb: { position: "absolute", borderRadius: 999, opacity: 0.45 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center' },
  heroStats: { flexDirection: 'row', alignItems: 'center', padding: 22, borderRadius: 24, borderWidth: 1.5, marginBottom: 20, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 5 },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 9, fontWeight: '900', marginTop: 2, letterSpacing: 1 },
  statDivider: { width: 1.5, height: 36, opacity: 0.3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontWeight: '900' },
  sectionContainer: { padding: 20, borderRadius: 24, borderWidth: 1.2, marginBottom: 20 },
  sectionTitle: { color: "#9ba9c3", fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '800' },
  joinButton: { paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginBottom: 32, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  activeStatus: { paddingVertical: 14, alignItems: 'center', borderRadius: 18, borderWidth: 1.5, marginBottom: 32 },
  emptyHistory: { padding: 32, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center' },
  feedbackCard: { padding: 18, borderRadius: 22, borderWidth: 1.2, borderLeftWidth: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardUser: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  messageBox: { padding: 14, borderRadius: 16, marginTop: 4 },
});
