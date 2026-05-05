import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../constants/config.js';
import { showAlert } from '../utils/alertUtils';
import { getAuthHeader, getAuthToken } from '../utils/auth';
import { getSocket } from '../utils/socket';
import { formatDate } from '../utils/dateUtils';
import { formatTimeRemaining, formatTimePassed } from '../utils/emotionUtils';

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "emoji", label: "Emoji" },
  { id: "written", label: "Written" },
  { id: "selfie", label: "Selfie" },
  { id: "story", label: "Story" },
];

const TYPE_ICON = {
  emoji: "😊",
  written: "✍️",
  selfie: "📸",
  story: "🎬",
};

const REVIEW_LABEL = {
  good: "Good",
  average: "Okay",
  bad: "Low",
};

export default function RoomDetailScreen({ room, onBack, theme }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState([]);
  const [emotionSummary, setEmotionSummary] = useState({ good: 0, average: 0, bad: 0 });
  const [totalResponses, setTotalResponses] = useState(0);
  const [connectedStudents, setConnectedStudents] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [timerText, setTimerText] = useState("");
  const [timerType, setTimerType] = useState("");

  const roomData = room || { roomCode: "UNK-OWN", roomName: "Unknown Room" };

  const REVIEW_COLOR = {
    good: theme.accent,
    average: theme.secondary,
    bad: "#ff5b7f",
  };

  const handleExport = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        showAlert("Download Error", "Please log in again before exporting the Excel sheet.");
        return;
      }
      const exportUrl = `${API_BASE_URL}/rooms/${roomData.roomCode}/export?token=${encodeURIComponent(token)}`;
      if (Platform.OS === 'web') {
        window.open(exportUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      await Linking.openURL(exportUrl);
    } catch (err) {
      showAlert("Download Error", "Failed to start the Excel download. Please try again.");
    }
  };

  React.useEffect(() => {
    let mounted = true;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const authHeader = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/rooms/${roomData.roomCode}/analytics`, { 
          headers: { "Content-Type": "application/json", ...authHeader }
        });
        const data = await response.json();
        if (!mounted) return;
        if (response.ok) {
          setFeedback(data.feedback || []);
          setEmotionSummary(data.emotionSummary || { good: 0, average: 0, bad: 0 });
          setTotalResponses(data.feedbackCount || 0);
          setConnectedStudents(data.connectedStudents || []);
          setIsAnonymous(!!data.isAnonymous);
        } else {
          setError(data.message || "Failed to load analytics");
        }
      } catch (err) {
        if (mounted) setError("Connection error. Check your server.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAnalytics();
    const socket = getSocket();
    socket.emit("join-room", roomData.roomCode);
    const handleNewFeedback = (feedbackItem) => {
      setFeedback((prev) => [feedbackItem, ...prev]);
      setTotalResponses((prev) => prev + 1);
      setFeedback((currentFeedback) => {
        const summary = { good: 0, average: 0, bad: 0, total: currentFeedback.length };
        currentFeedback.forEach((f) => {
          if (f.review === "good") summary.good++;
          else if (f.review === "average") summary.average++;
          else if (f.review === "bad") summary.bad++;
        });
        if (summary.total > 0) {
          setEmotionSummary({
            good: Math.round((summary.good / summary.total) * 100),
            average: Math.round((summary.average / summary.total) * 100),
            bad: Math.round((summary.bad / summary.total) * 100),
          });
        }
        return currentFeedback;
      });
    };
    socket.on("new-feedback", handleNewFeedback);

    const updateTimer = () => {
      if (roomData.status === "active") {
        setTimerType("elapsed");
        setTimerText(formatTimePassed(roomData.createdAt));
      }
    };

    updateTimer();
    const tInterval = setInterval(updateTimer, 5000);

    return () => {
      mounted = false;
      socket.emit("leave-room", roomData.roomCode);
      socket.off("new-feedback", handleNewFeedback);
      clearInterval(tInterval);
    };
  }, [roomData.roomCode, roomData.status, roomData.expiresAt, roomData.createdAt]);

  const handleDeleteRoom = async () => {
    showAlert(
      "Delete Room",
      `Are you sure you want to delete room ${roomData.roomCode} permanently?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/rooms/${roomData.roomCode}`, {
                method: "DELETE",
                headers: await getAuthHeader(),
              });
              if (response.ok) {
                onBack();
              } else {
                showAlert("Error", "Failed to delete room");
              }
            } catch (err) {
              showAlert("Error", "Failed to delete room");
            }
          }
        },
      ]
    );
  };

  const filteredFeedback =
    activeFilter === "all"
      ? feedback
      : feedback.filter((f) => f.type === activeFilter);

  const isActive = roomData.status === "active";

  return (
    <View style={[localStyles.root, { backgroundColor: theme.background }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[localStyles.glowOrb, { top: -100, right: -100, width: 350, height: 350, backgroundColor: theme.glowOne }]} />
        <View style={[localStyles.glowOrb, { bottom: -80, left: -120, width: 320, height: 320, backgroundColor: theme.glowTwo }]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isWide ? 32 : 20,
          paddingTop: Math.max(insets.top, 20) + 12,
          paddingBottom: Math.max(insets.bottom, 20) + 30,
          maxWidth: isWide ? 800 : undefined,
          alignSelf: isWide ? "center" : undefined,
          width: isWide ? "100%" : undefined,
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
              {roomData.roomName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>{roomData.roomCode}</Text>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textMuted, opacity: 0.5 }} />
                <Text style={{ color: isAnonymous ? "#ff5b7f" : theme.accent, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>
                    {isAnonymous ? "🔒 ANONYMOUS" : "👤 IDENTIFIED"}
                </Text>
            </View>
          </View>
          <Pressable
            style={[localStyles.downloadButton, { backgroundColor: theme.accent, borderColor: theme.accent }]}
            onPress={handleExport}
          >
            <Text style={{ fontSize: 16 }}>📥</Text>
          </Pressable>
        </View>

        <View style={[localStyles.heroStats, { backgroundColor: theme.panel, borderColor: theme.accent, shadowColor: theme.accent }]}>
            <View style={localStyles.statBox}>
                <Text style={[localStyles.statVal, { color: theme.textPrimary }]}>{totalResponses}</Text>
                <Text style={[localStyles.statLabel, { color: theme.textMuted }]}>TOTAL FEEDBACK</Text>
            </View>
            <View style={[localStyles.statDivider, { backgroundColor: theme.inputBorder }]} />
            <View style={localStyles.statBox}>
                <Text style={[localStyles.statVal, { color: theme.textPrimary }]}>{connectedStudents.length}</Text>
                <Text style={[localStyles.statLabel, { color: theme.textMuted }]}>ACTIVE NOW</Text>
            </View>
            <View style={[localStyles.statDivider, { backgroundColor: theme.inputBorder }]} />
            <View style={localStyles.statBox}>
                <View style={[localStyles.liveBadge, { backgroundColor: isActive ? theme.accentSoft : 'rgba(255,255,255,0.05)' }]}>
                    <View style={[localStyles.liveDot, { backgroundColor: isActive ? theme.accent : theme.textMuted }]} />
                    <Text style={[localStyles.liveText, { color: isActive ? theme.accent : theme.textMuted }]}>{isActive ? "LIVE" : "END"}</Text>
                </View>
            </View>
        </View>

        <View style={[localStyles.sectionContainer, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
          <Text style={localStyles.sectionTitle}>Emotion Summary</Text>
          <View style={localStyles.emotionBars}>
            {["good", "average", "bad"].map((key) => (
              <View key={key} style={localStyles.emotionRow}>
                <View style={{ width: 70 }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: REVIEW_COLOR[key] }}>
                    {key === "good" ? "Happy" : key === "average" ? "Okay" : "Bad"}
                    </Text>
                </View>
                <View style={[localStyles.barTrack, { backgroundColor: theme.inputBackground }]}>
                  <View style={[localStyles.barFill, { backgroundColor: REVIEW_COLOR[key], width: `${emotionSummary[key]}%` }]} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: "900", color: theme.textPrimary, width: 40, textAlign: "right" }}>
                  {emotionSummary[key]}%
                </Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.filterScroll} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {FILTER_TABS.map((tab) => {
            const isSelected = activeFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[localStyles.filterTab, { backgroundColor: isSelected ? theme.accent : theme.panel, borderColor: isSelected ? theme.accent : theme.inputBorder }]}
                onPress={() => setActiveFilter(tab.id)}
              >
                <Text style={{ fontSize: 13, fontWeight: "900", color: isSelected ? theme.onAccent : theme.textPrimary }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ gap: 14 }}>
          {filteredFeedback.map((item) => (
            <View key={item._id} style={[localStyles.feedbackCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder, borderLeftColor: REVIEW_COLOR[item.review] || theme.inputBorder }]}>
              <View style={localStyles.cardHeader}>
                <View style={localStyles.cardUser}>
                    <View style={[localStyles.userIcon, { backgroundColor: theme.accentSoft }]}>
                        <Text style={{ fontSize: 12 }}>{TYPE_ICON[item.type] || "📝"}</Text>
                    </View>
                    <View>
                        <Text style={{ fontSize: 15, fontWeight: "900", color: theme.textPrimary }}>
                        {isAnonymous ? "Student Feedback" : (item.studentName || "Student")}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '700' }}>{item.type.toUpperCase()}</Text>
                    </View>
                </View>
                <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "800" }}>
                  {item.createdAt ? `${formatDate(item.createdAt)} ${new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                </Text>
              </View>

              {item.message ? (
                <View style={[localStyles.messageBox, { backgroundColor: theme.inputBackground }]}>
                    <Text style={{ fontSize: 14, lineHeight: 22, color: theme.textSecondary, fontWeight: '500' }}>{item.message}</Text>
                </View>
              ) : null}

              {item.review ? (
                <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[localStyles.reviewDot, { backgroundColor: REVIEW_COLOR[item.review] }]} />
                  <Text style={{ fontSize: 12, fontWeight: "900", color: REVIEW_COLOR[item.review], textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {REVIEW_LABEL[item.review]}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {loading && totalResponses === 0 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={{ color: theme.textMuted, marginTop: 16, fontWeight: '700', fontSize: 13, letterSpacing: 1 }}>FETCHING ANALYTICS...</Text>
          </View>
        )}

        {filteredFeedback.length === 0 && !loading && (
          <View style={localStyles.emptyState}>
            <View style={[localStyles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <Text style={{ fontSize: 40 }}>📭</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: "900", color: theme.textPrimary, marginTop: 16 }}>No responses yet</Text>
            <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 6, textAlign: "center", maxWidth: 240 }}>
              Students in {roomData.roomCode} haven't sent any feedback for this filter.
            </Text>
          </View>
        )}

        {/* Room Management Actions */}
        <View style={{ marginTop: 32, marginBottom: 20 }}>
            <Text style={localStyles.sectionTitle}>Room Management</Text>
            
            {/* Timer Box */}
            {isActive && (
              <View style={[
                localStyles.timerBox, 
                { 
                  backgroundColor: theme.panel, 
                  borderColor: (timerType === 'countdown') ? "#ff5b7f44" : theme.accent + "44",
                  marginBottom: 16
                }
              ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>{timerType === 'countdown' ? "⏱️" : "🕒"}</Text>
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                        Room Active For
                      </Text>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '900', 
                        color: theme.accent,
                        marginTop: 2
                      }}>
                        {timerText || "Calculating..."}
                      </Text>
                    </View>
                </View>
              </View>
            )}

            <Pressable
              style={[localStyles.deleteButton, { backgroundColor: "rgba(255, 91, 127, 0.1)", borderColor: "rgba(255, 91, 127, 0.2)" }]}
              onPress={handleDeleteRoom}
            >
              <Text style={{ color: "#ff5b7f", fontSize: 14, fontWeight: "900", letterSpacing: 1 }}>
                DELETE ROOM PERMANENTLY
              </Text>
            </Pressable>
        </View>
      </ScrollView>
      <StatusBar hidden />
    </View>
  );
}

const localStyles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  glowOrb: { position: "absolute", borderRadius: 999, opacity: 0.45 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center' },
  downloadButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  heroStats: { flexDirection: 'row', alignItems: 'center', padding: 24, borderRadius: 28, borderWidth: 1.5, marginBottom: 24, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 6 },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '900', marginTop: 4, letterSpacing: 1.2 },
  statDivider: { width: 1.5, height: 40, opacity: 0.2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 12, fontWeight: '900' },
  sectionContainer: { padding: 24, borderRadius: 32, borderWidth: 1.5, marginBottom: 24 },
  sectionTitle: { color: "#9ba9c3", fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 20 },
  emotionBars: { gap: 16 },
  emotionRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  barTrack: { flex: 1, height: 14, borderRadius: 7, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 7 },
  filterScroll: { marginBottom: 24 },
  filterTab: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 18, borderWidth: 1.5 },
  feedbackCard: { padding: 20, borderRadius: 28, borderWidth: 1.5, borderLeftWidth: 8, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardUser: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  userIcon: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  messageBox: { padding: 16, borderRadius: 20, marginTop: 6 },
  reviewDot: { width: 10, height: 10, borderRadius: 5 },
  emptyState: { alignItems: "center", paddingVertical: 80 },
  emptyIcon: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  timerBox: { padding: 20, borderRadius: 28, borderWidth: 1.5 },
  deleteButton: { paddingVertical: 18, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }
});
