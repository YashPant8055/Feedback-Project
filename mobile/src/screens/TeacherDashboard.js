import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  BackHandler,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
  Alert,
  Modal,
  Image,
  Animated,
  Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../styles/globalStyles';
import { SCREEN_THEMES, APPEARANCE_OPTIONS } from '../constants/themeConstants';
import { API_BASE_URL } from '../constants/config.js';
import { showAlert } from '../utils/alertUtils';
import { formatTimeRemaining, formatTimePassed } from '../utils/emotionUtils';
import { getAuthHeader } from '../utils/auth';


export default function TeacherDashboard({
  profile,
  onLogout,
  onCreateRoom,
  onOpenRoom,
  themeSettings,
  onThemeSettingsChange,
  onEditRoom,
  onViewClips,
  onRemoveRoomHistory,
  onRefreshProfile,
  theme,
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 768;
  const isCompact = width < 420;
  
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [sideMenuScreen, setSideMenuScreen] = useState("main");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [webCameraActive, setWebCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (updatingProfile) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [updatingProfile]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });


  if (!profile) {
    return (
      <View style={[localStyles.root, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const CACHE_KEY = `@teacher_rooms_${profile.id}`;

  const fetchRooms = async () => {
    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/rooms/teacher/${profile.id}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        }
      });
      const data = await response.json();
      if (response.ok) {
        setRooms(data);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCachedRooms = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setRooms(JSON.parse(cached));
        setLoading(false);
      }
    } catch (_err) {
      // Ignore cache errors
    }
  };

  React.useEffect(() => {
    loadCachedRooms().then(() => fetchRooms());

    // Auto-refresh every 20 seconds to catch new student joins/feedback
    const interval = setInterval(fetchRooms, 20000);
    return () => clearInterval(interval);
  }, []);

  const toggleRoomStatus = async (roomCode, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "closed" : "active";
    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        // Optimistically update local state
        setRooms(prev => prev.map(r => 
          r.roomCode === roomCode ? { ...r, status: nextStatus } : r
        ));
        fetchRooms();
      }
    } catch (err) {
      showAlert("Error", "Failed to update room status");
    }
  };

  const handlePickImage = async (useCamera = false) => {
    try {
      const permissionResult = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        showAlert("Permission Denied", `Permission to access ${useCamera ? 'camera' : 'gallery'} is required!`);
        return;
      }

      if (useCamera && Platform.OS === 'web') {
        setWebCameraActive(true);
        setTimeout(async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play();
            }
          } catch (err) {
            showAlert("Error", "Could not access camera. Please check permissions.");
            setWebCameraActive(false);
          }
        }, 100);
        return;
      }

      const result = await (useCamera 
        ? ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
            cameraType: 'front',
          })
        : ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
          }));

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data = asset.base64;

        if (base64Data && !base64Data.startsWith('data:')) {
          base64Data = `data:${asset.mimeType || 'image/jpeg'};base64,${base64Data}`;
        }

        // On web, sometimes base64 is not returned even if requested.
        // Fetch the URI and convert to base64 as a fallback.
        if (!base64Data && Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }

        if (base64Data) {
          setCapturedImage(base64Data);
          setWebCameraActive(true);
        } else {
          showAlert("Error", "Could not process image data.");
        }
      }
    } catch (err) {
      console.error("Image pick error:", err);
    }
  };

  const uploadProfileImage = async (base64Image) => {
    try {
      setUpdatingProfile(true);
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/users/profile/image`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({ image: base64Image })
      });

      const data = await response.json();
      if (response.ok) {
        showAlert("Success", "Profile image updated successfully!");
        if (onRefreshProfile) onRefreshProfile();
      } else {
        showAlert("Error", data.message || "Failed to update profile image");
      }
    } catch (err) {
      showAlert("Error", "Connection error. Please try again.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handlePasswordAction = () => {
    showAlert(
      "Account Security",
      "Password management is handled by your administrator. Would you like to request a reset link?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Request Reset", 
          onPress: async () => {
            const authHeader = await getAuthHeader();
            await fetch(`${API_BASE_URL}/users/profile/password`, {
              method: 'PATCH',
              headers: authHeader
            });
            showAlert("Request Sent", "Your request has been forwarded to the system administrator.");
          }
        }
      ]
    );
  };


  const handleDeleteRoom = async (roomCode) => {
    showAlert(
      "Delete Room",
      `Are you sure you want to delete room ${roomCode} permanently? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/rooms/${roomCode}`, {
                method: "DELETE",
                headers: await getAuthHeader(),
              });
              if (response.ok) {
                fetchRooms();
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

  const calculateAnalytics = (feedbackEntries = []) => {
    const summary = { good: 0, average: 0, bad: 0, total: 0 };
    feedbackEntries.forEach((f) => {
      if (f.review === "good") summary.good++;
      else if (f.review === "average") summary.average++;
      else if (f.review === "bad") summary.bad++;
      summary.total++;
    });

    return {
      good: summary.total > 0 ? Math.round((summary.good / summary.total) * 100) : 0,
      average: summary.total > 0 ? Math.round((summary.average / summary.total) * 100) : 0,
      bad: summary.total > 0 ? Math.round((summary.bad / summary.total) * 100) : 0,
    };
  };

  const isSideMenuDetail = sideMenuScreen !== "main";

  const closeSideMenu = () => {
    setSideMenuOpen(false);
    setSideMenuScreen("main");
  };

  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sideMenuOpen && isSideMenuDetail) {
        setSideMenuScreen("main");
        return true;
      }
      if (sideMenuOpen) {
        closeSideMenu();
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [sideMenuOpen, isSideMenuDetail]);

  const [timeLeftMap, setTimeLeftMap] = React.useState({});

  React.useEffect(() => {
    if (sideMenuOpen && (sideMenuScreen === "rooms" || sideMenuScreen === "main")) {
      onRefreshProfile?.();
    }
  }, [sideMenuOpen, sideMenuScreen]);

  // Timer effect for rooms with expiry - updates every 5 seconds for live countdown
  React.useEffect(() => {
    const updateTimers = () => {
      const newMap = {};
      rooms.forEach((room) => {
        if (room.status === "active") {
          newMap[room.roomCode] = {
            type: 'elapsed',
            text: formatTimePassed(room.createdAt)
          };
        } else {
          newMap[room.roomCode] = {
            type: 'closed',
            text: "CLOSED"
          };
        }
      });
      setTimeLeftMap(newMap);
    };

    updateTimers(); // Initial update immediately
    const interval = setInterval(updateTimers, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [rooms]);

  const activeRooms = rooms.filter((r) => r.status === "active");
  const closedRooms = rooms.filter((r) => r.status === "closed");

  const EmotionBar = ({ summary, size = "normal" }) => {
    const total = summary.good + summary.average + summary.bad;
    if (total === 0) return null;
    const barHeight = size === "small" ? 6 : 8;

    return (
      <View style={{ marginTop: size === "small" ? 8 : 12 }}>
        <View
          style={{
            flexDirection: "row",
            height: barHeight,
            borderRadius: barHeight / 2,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          <View
            style={{
              flex: summary.good,
              backgroundColor: "#59f0c2",
              borderTopLeftRadius: barHeight / 2,
              borderBottomLeftRadius: barHeight / 2,
            }}
          />
          <View style={{ flex: summary.average, backgroundColor: "#ffd84d" }} />
          <View
            style={{
              flex: summary.bad,
              backgroundColor: "#ff5b7f",
              borderTopRightRadius: barHeight / 2,
              borderBottomRightRadius: barHeight / 2,
            }}
          />
        </View>
        {size !== "small" && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ color: "#59f0c2", fontSize: 11, fontWeight: "800" }}>
              😊 {summary.good}%
            </Text>
            <Text style={{ color: "#ffd84d", fontSize: 11, fontWeight: "800" }}>
              😐 {summary.average}%
            </Text>
            <Text style={{ color: "#ff5b7f", fontSize: 11, fontWeight: "800" }}>
              😞 {summary.bad}%
            </Text>
          </View>
        )}
      </View>
    );
  };

  const RoomCard = ({ room }) => {
    const isActive = room.status === "active";

    return (
      <Pressable
        style={[
          localStyles.roomCard,
          {
            backgroundColor: theme.panel,
            borderColor: isActive ? theme.accent : theme.inputBorder,
          },
        ]}
        onPress={() => onOpenRoom?.(room.roomCode)}
      >
        <View style={localStyles.roomCardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: theme.textPrimary }} numberOfLines={1}>
                {room.roomName}
              </Text>
              <Pressable
                onPress={() => onEditRoom?.(room)}
                style={[localStyles.editBadge, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
              >
                <Text style={{ fontSize: 14 }}>✏️</Text>
              </Pressable>
            </View>
            <View
              style={[
                localStyles.statusBadge,
                {
                  backgroundColor: isActive
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(100, 116, 139, 0.08)",
                  borderColor: isActive
                    ? "rgba(16, 185, 129, 0.25)"
                    : "rgba(100, 116, 139, 0.15)",
                  alignSelf: 'flex-start',
                  marginTop: 4,
                },
              ]}
            >
              <View
                style={[
                  localStyles.statusDot,
                  { 
                    backgroundColor: isActive ? "#10b981" : "#64748b",
                    shadowColor: isActive ? "#10b981" : "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: isActive ? 0.8 : 0,
                    shadowRadius: 4,
                  },
                ]}
              />
              <Text
                style={{
                  fontSize: 9.5,
                  fontWeight: "900",
                  color: isActive ? "#059669" : "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {isActive ? "ACTIVE" : "CLOSED"}
              </Text>
            </View>

            {room.subject ? (
              <Text
                style={{
                  marginTop: 3,
                  fontSize: 13,
                  color: theme.textMuted,
                  fontWeight: "600",
                }}
              >
                {room.subject}
              </Text>
            ) : null}


          </View>

          <View style={[localStyles.roomCodeChip, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={{ fontSize: 12, fontWeight: "900", color: theme.accent, letterSpacing: 0.8 }}>
              {room.roomCode}
            </Text>
          </View>
        </View>

        <View style={localStyles.roomCardStats}>
          <View style={[localStyles.statPill, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: theme.textPrimary }}>
              {room.studentIds?.length || 0}
            </Text>
            <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: "700", marginTop: 1 }}>
              Students
            </Text>
          </View>
          <View style={[localStyles.statPill, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: theme.textPrimary }}>
              {room.feedback?.length || 0}
            </Text>
            <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: "700", marginTop: 1 }}>
              Responses
            </Text>
          </View>
          <View style={[localStyles.statPill, { flex: 1.2, backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {timeLeftMap[room.roomCode]?.type === 'closed' ? "Room Status" : "Active For"}
            </Text>
            <Text style={{ 
              fontSize: 14, 
              fontWeight: '900', 
              color: (timeLeftMap[room.roomCode]?.type === 'closed' ? theme.textMuted : theme.accent),
              marginTop: 2
            }}>
              {timeLeftMap[room.roomCode]?.text || "..."}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable
            style={[
              localStyles.cardAction,
              { flex: 1, backgroundColor: isActive ? "#ff5b7f20" : theme.accentSoft, borderColor: isActive ? "#ff5b7f40" : theme.accent }
            ]}
            onPress={() => {
              const action = isActive ? "Close" : "Re-open";
              showAlert(
                `${action} Room`,
                `Are you sure you want to ${action.toLowerCase()} room ${room.roomCode}?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { 
                    text: action, 
                    onPress: () => toggleRoomStatus(room.roomCode, room.status) 
                  }
                ]
              );
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: isActive ? "#ff5b7f" : theme.accent }}>
              {isActive ? "CLOSE ROOM" : "RE-OPEN ROOM"}
            </Text>
          </Pressable>
          
          <Pressable
            style={[
              localStyles.cardAction,
              { paddingHorizontal: 16, backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.1)" }
            ]}
            onPress={() => handleDeleteRoom(room.roomCode)}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#ff5b7f" }}>
              DELETE
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[localStyles.root, { backgroundColor: theme.background }]}>
      {/* Background glows */}
      <View style={StyleSheet.absoluteFill}>
        <View
          style={[
            localStyles.glowOrb,
            {
              top: -60,
              right: -40,
              width: 200,
              height: 200,
              backgroundColor: theme.glowOne,
            },
          ]}
        />
        <View
          style={[
            localStyles.glowOrb,
            {
              bottom: 80,
              left: -60,
              width: 180,
              height: 180,
              backgroundColor: theme.glowTwo,
            },
          ]}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isWide ? 32 : 20,
          paddingTop: Math.max(insets.top, 20) + 10,
          paddingBottom: Math.max(insets.bottom, 20) + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.dashboardHeader}>
          <Pressable
            style={[
              styles.dashboardIdentity,
              isCompact && styles.dashboardIdentityCompact,
            ]}
            onPress={() => {
              setSideMenuScreen("main");
              setSideMenuOpen(true);
            }}
          >
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.accentSoft, borderColor: theme.accent, overflow: 'hidden' },
                isCompact && styles.avatarCircleCompact,
              ]}
            >
              {profile.profileImage && profile.profileImage.trim() !== "" ? (
                <Image source={{ uri: profile.profileImage }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text
                  style={[
                    styles.avatarText,
                    { color: theme.accent },
                    isCompact && styles.avatarTextCompact,
                  ]}
                >
                  {(profile.name?.[0] || "T").toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.dashboardIdentityText}>
              <Text
                style={[
                  styles.dashboardName,
                  { color: theme.accent },
                  isCompact && styles.dashboardNameCompact,
                ]}
                numberOfLines={1}
              >
                {profile.name}
              </Text>
              <Text
                style={[
                  styles.dashboardTag,
                  { color: theme.textMuted },
                  isCompact && styles.dashboardTagCompact,
                ]}
                numberOfLines={1}
              >
                Teacher Dashboard
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Quick Stats Bar */}
        <View style={[localStyles.quickStatsBar, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
          <View style={localStyles.quickStat}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: theme.accent }}>
              {activeRooms.length}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "700" }}>
              Active Rooms
            </Text>
          </View>
          <View style={[localStyles.quickStatDivider, { backgroundColor: theme.inputBorder }]} />
          <View style={localStyles.quickStat}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: theme.textPrimary }}>
              {rooms.reduce((sum, r) => sum + (r.studentIds?.length || 0), 0)}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "700" }}>
              Total Students
            </Text>
          </View>
          <View style={[localStyles.quickStatDivider, { backgroundColor: theme.inputBorder }]} />
          <View style={localStyles.quickStat}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: theme.textPrimary }}>
              {rooms.reduce((sum, r) => sum + (r.feedback?.length || 0), 0)}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: "700" }}>
              Responses
            </Text>
          </View>
        </View>

        {/* Create Room Button */}
        <Pressable
          style={[localStyles.createButton, { backgroundColor: theme.accent }]}
          onPress={onCreateRoom}
        >
          <Text style={{ fontSize: 22 }}>+</Text>
          <Text style={{ fontSize: 15, fontWeight: "900", color: theme.onAccent }}>
            Create New Room
          </Text>
        </Pressable>

        {/* Active Rooms */}
        {activeRooms.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={[localStyles.sectionTitle, { color: theme.textMuted }]}>
              Active Rooms
            </Text>
            {isWide ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {activeRooms.map((room) => (
                  <View key={room.roomCode} style={{ flex: 1, minWidth: 320 }}>
                    <RoomCard room={room} />
                  </View>
                ))}
              </View>
            ) : (
              activeRooms.map((room) => <RoomCard key={room.roomCode} room={room} />)
            )}
          </View>
        )}

        {/* Closed Rooms */}
        {closedRooms.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={[localStyles.sectionTitle, { color: theme.textMuted }]}>
              Closed Rooms
            </Text>
            {isWide ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {closedRooms.map((room) => (
                  <View key={room.roomCode} style={{ flex: 1, minWidth: 320 }}>
                    <RoomCard room={room} />
                  </View>
                ))}
              </View>
            ) : (
              closedRooms.map((room) => <RoomCard key={room.roomCode} room={room} />)
            )}
          </View>
        )}

        {/* Empty State */}
        {!loading && rooms.length === 0 && (
          <View style={[localStyles.emptyState, { borderColor: theme.inputBorder }]}>
            <Text style={{ fontSize: 48 }}>📚</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: theme.textPrimary, marginTop: 12, textAlign: "center" }}>
              No Rooms Yet
            </Text>
            <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 8, textAlign: "center", lineHeight: 22, maxWidth: 280 }}>
              Create your first room to start collecting feedback from your students.
            </Text>
          </View>
        )}

        {/* Footer Branding */}
        <View style={localStyles.footerBranding}>
          <Text style={[localStyles.builtBy, { color: theme.textMuted }]}>Built by</Text>
          <View style={localStyles.brandingContainer}>
             <LinearGradient 
               colors={['#4F46E5', '#9333EA']}
               start={{ x: 0, y: 0 }}
               end={{ x: 1, y: 1 }}
               style={localStyles.logoWrapper}
             >
               <Image 
                 source={require('../../assets/logo.png')} 
                 style={localStyles.companyLogo}
               />
             </LinearGradient>
             <Text style={[localStyles.companyName, { color: theme.textPrimary }]}>CodroidHub</Text>
          </View>
        </View>
      </ScrollView>

      {/* Side Menu */}
      {sideMenuOpen && (
        <>
          <Pressable
            style={styles.sideMenuBackdrop}
            onPress={closeSideMenu}
          />
          <View style={[
            styles.sideMenuPanel,
            { backgroundColor: theme.background, borderRightColor: theme.inputBorder },
            isSideMenuDetail && styles.sideMenuPanelExpanded,
            isSideMenuDetail && { width },
            { paddingTop: Math.max(insets.top, 20) + 12 },
          ]}>
            <View style={[styles.sideMenuGlowTop, { backgroundColor: theme.glowOne }]} />
            <View style={[styles.sideMenuGlowBottom, { backgroundColor: theme.glowTwo }]} />

                {sideMenuScreen === "main" && (
                  <Pressable 
                    style={[styles.sideMenuHeader, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
                    onPress={() => setSideMenuScreen("profile")}
                  >
                    <View style={[styles.sideMenuAvatarShell, { backgroundColor: theme.accentSoft }]}>
                      <View style={[styles.sideMenuAvatar, { backgroundColor: theme.accent }]}>
                        {profile.profileImage ? (
                          <Image source={{ uri: profile.profileImage }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                        ) : (
                          <Text style={[styles.sideMenuAvatarText, { color: theme.onAccent }]}>
                            {(profile.name?.[0] || "T").toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.sideMenuUserInfo}>
                      <View style={{ backgroundColor: theme.accentSoft, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 }}>
                        <Text style={{ color: theme.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>PROFILE ACCESS</Text>
                      </View>
                      <Text style={[styles.sideMenuName, { color: theme.textPrimary }]}>{profile.name}</Text>
                      <Text style={[styles.sideMenuEmail, { color: theme.textMuted }]}>{profile.email}</Text>
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: 18, marginRight: 8, fontWeight: '200' }}>›</Text>
                  </Pressable>
                )}

            <ScrollView
              style={styles.sideMenuBody}
              contentContainerStyle={styles.sideMenuBodyContent}
              showsVerticalScrollIndicator={false}
            >
                {sideMenuScreen === "main" ? (
                  <>
                    <Text style={[styles.sideMenuSectionTitle, { color: theme.textSecondary }]}>Account</Text>
                    


                    <Pressable
                      style={[styles.sideMenuItem, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
                      onPress={() => {
                        setSideMenuScreen("rooms");
                      }}
                    >
                      <View style={styles.sideMenuItemBody}>
                        <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>
                          Room History
                        </Text>
                        <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                          View your created rooms and saved records
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[styles.sideMenuItem, { backgroundColor: theme.panel, borderColor: theme.inputBorder, marginTop: 12 }]}
                      onPress={() => {
                        closeSideMenu();
                        onViewClips?.();
                      }}
                    >
                      <View style={styles.sideMenuItemBody}>
                        <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>
                          My Clips (Story Vault)
                        </Text>
                        <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                          Manage and upload immersive media stories
                        </Text>
                      </View>
                    </Pressable>

                    <Text style={[styles.sideMenuSectionTitle, { color: theme.textSecondary, marginTop: 15 }]}>Account & Security</Text>

                    <Pressable
                      style={[styles.sideMenuItem, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
                      onPress={() => {
                        setSideMenuScreen("settings");
                      }}
                    >
                      <View style={styles.sideMenuItemBody}>
                        <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>
                          Settings
                        </Text>
                        <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                          Customize app theme and appearance
                        </Text>
                      </View>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.sideMenuSettingsHeader}>
                      <Pressable
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => setSideMenuScreen("main")}
                      >
                        <Text style={{ color: theme.textPrimary, fontSize: 26, fontWeight: '300', marginTop: -3, marginLeft: -2 }}>‹</Text>
                      </Pressable>
                      <Text style={[styles.sideMenuSettingsTitle, { color: theme.textPrimary }]}>
                        {sideMenuScreen === "settings"
                          ? "Settings"
                          : sideMenuScreen === "rooms"
                            ? "Room History"
                            : sideMenuScreen === "profile"
                              ? "Profile Settings"
                              : "Room History"}
                      </Text>
                    </View>

                    {sideMenuScreen === "settings" ? (
                      <View style={{ marginTop: 10 }}>
                        <View style={[styles.themeSettingsCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                          <Text style={[styles.themeSettingsTitle, { color: theme.textPrimary }]}>Themes</Text>
                          <Text style={[styles.themeSettingsSubtitle, { color: theme.textMuted }]}>
                            Choose a fixed theme, or keep automatic random changes on.
                          </Text>

                          <View style={styles.themeToggleRow}>
                            <View style={styles.themeToggleTextWrap}>
                              <Text style={[styles.themeToggleLabel, { color: theme.textPrimary }]}>Automatic Change</Text>
                              <Text style={[styles.themeToggleHint, { color: theme.textMuted }]}>
                                Random color changes when you enter login or dashboard
                              </Text>
                            </View>
                            <Pressable
                              style={[
                                styles.themeToggle,
                                themeSettings.autoRotate && styles.themeToggleActive,
                              ]}
                              onPress={() =>
                                onThemeSettingsChange({
                                  ...themeSettings,
                                  autoRotate: !themeSettings.autoRotate,
                                })
                              }
                            >
                              <View
                                style={[
                                  styles.themeToggleKnob,
                                  themeSettings.autoRotate && styles.themeToggleKnobActive,
                                ]}
                              />
                            </Pressable>
                          </View>

                          <View style={styles.appearanceSection}>
                            <Text style={styles.appearanceSectionTitle}>Appearance</Text>
                            <Text style={styles.appearanceSectionHint}>
                              Choose dark mode, light mode, or follow the device setting.
                            </Text>
                            <View style={styles.appearanceChipWrap}>
                              {APPEARANCE_OPTIONS.map((option) => {
                                const isSelected = themeSettings.appearanceMode === option.id;
                                return (
                                  <Pressable
                                    key={option.id}
                                    style={[
                                      styles.appearanceChip,
                                      { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                                      isSelected && { backgroundColor: theme.accent, borderColor: theme.accent },
                                    ]}
                                    onPress={() =>
                                      onThemeSettingsChange({
                                        ...themeSettings,
                                        appearanceMode: option.id,
                                      })
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.appearanceChipText,
                                        { color: theme.textSecondary },
                                        isSelected && { color: theme.onAccent },
                                      ]}
                                    >
                                      {option.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>

                          <View style={styles.themeChipWrap}>
                            {SCREEN_THEMES.map((themeOption) => {
                              const isSelected = !themeSettings.autoRotate && themeSettings.selectedThemeName === themeOption.name;
                              return (
                                <Pressable
                                  key={themeOption.name}
                                  style={[
                                    styles.themeChip,
                                    { borderColor: themeOption.accent },
                                    isSelected && { backgroundColor: themeOption.accentSoft },
                                  ]}
                                  onPress={() =>
                                    onThemeSettingsChange({
                                      ...themeSettings,
                                      autoRotate: false,
                                      selectedThemeName: themeOption.name,
                                    })
                                  }
                                >
                                  <View style={[styles.themeChipDot, { backgroundColor: themeOption.accent }]} />
                                  <Text style={[styles.themeChipText, { color: theme.textPrimary }]}>
                                    {themeOption.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    ) : sideMenuScreen === "profile" ? (
                      <View style={{ paddingBottom: 20 }}>
                        <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 15 }}>
                          <View style={{ position: 'relative' }}>
                            {/* Avatar Glow */}
                            <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: theme.accent, opacity: 0.15, top: -20, left: -20 }} />
                            
                            <Pressable 
                              onPress={() => setShowSourcePicker(true)}
                            >
                              <View style={{ width: 104, height: 104, justifyContent: 'center', alignItems: 'center' }}>
                                {updatingProfile && (
                                  <Animated.View 
                                    style={{ 
                                      position: 'absolute', 
                                      width: 104, 
                                      height: 104, 
                                      borderRadius: 52, 
                                      borderWidth: 3, 
                                      borderColor: 'transparent',
                                      borderTopColor: theme.accent,
                                      borderRightColor: theme.accent,
                                      transform: [{ rotate: spin }]
                                    }} 
                                  />
                                )}
                                
                                <View style={[styles.sideMenuAvatarShell, { backgroundColor: theme.panel, width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: updatingProfile ? 'transparent' : theme.accent }]}>
                                  <View style={[styles.sideMenuAvatar, { backgroundColor: theme.accentSoft, width: 88, height: 88, borderRadius: 44, overflow: 'hidden' }]}>
                                    {profile.profileImage && profile.profileImage.trim() !== "" ? (
                                      <Image source={{ uri: profile.profileImage }} style={{ width: '100%', height: '100%' }} />
                                    ) : (
                                      <Text style={[styles.sideMenuAvatarText, { color: theme.accent, fontSize: 36, fontWeight: '800' }]}>
                                        {(profile.name?.[0] || "T").toUpperCase()}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              </View>
                              
                              <LinearGradient
                                colors={[theme.accent, theme.secondary || '#9333EA']}
                                style={{ position: 'absolute', bottom: 0, right: 0, borderRadius: 16, width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.background }}
                              >
                                {updatingProfile ? (
                                  <ActivityIndicator size={10} color="#fff" />
                                ) : (
                                  <Text style={{ fontSize: 14 }}>📸</Text>
                                )}
                              </LinearGradient>
                            </Pressable>
                          </View>
                          
                          <View style={{ marginTop: 16, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                               <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>{profile.name}</Text>
                               <View style={{ backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>VERIFIED TEACHER</Text>
                               </View>
                            </View>
                            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2, fontWeight: '500' }}>Employee ID: #{profile.id?.slice(-6).toUpperCase()}</Text>
                          </View>
                        </View>

                        <View style={{ gap: 12 }}>
                          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginLeft: 4, marginBottom: 4 }}>ADMINISTRATOR INFORMATION</Text>
                          
                          <View style={{ backgroundColor: theme.panel, borderRadius: 20, padding: 1, overflow: 'hidden' }}>
                            <View style={{ backgroundColor: theme.panel, padding: 16, borderRadius: 19 }}>
                               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                 <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.accentSoft, justifyContent: 'center', alignItems: 'center' }}>
                                   <Text style={{ fontSize: 18 }}>👤</Text>
                                 </View>
                                 <View>
                                   <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Full Name</Text>
                                   <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{profile.name}</Text>
                                 </View>
                               </View>
                            </View>
                          </View>

                          <View style={{ backgroundColor: theme.panel, borderRadius: 20, padding: 1, overflow: 'hidden' }}>
                            <View style={{ backgroundColor: theme.panel, padding: 16, borderRadius: 19 }}>
                               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                 <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                   <Text style={{ fontSize: 18 }}>✉️</Text>
                                 </View>
                                 <View>
                                   <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Official Email</Text>
                                   <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 }}>{profile.email}</Text>
                                 </View>
                               </View>
                            </View>
                          </View>

                          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginLeft: 4, marginBottom: 4, marginTop: 12 }}>PRIVACY & SECURITY</Text>

                          <Pressable 
                            onPress={handlePasswordAction}
                            style={({ pressed }) => [
                              { backgroundColor: theme.panel, borderRadius: 20, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: pressed ? 0.7 : 1 }
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                               <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(244, 63, 94, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                                 <Text style={{ fontSize: 18 }}>🔐</Text>
                               </View>
                               <View>
                                 <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '700' }}>Change Password</Text>
                                 <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>Update your account security</Text>
                               </View>
                            </View>
                            <Text style={{ color: theme.textMuted, fontSize: 18 }}>›</Text>
                          </Pressable>
                        </View>

                        <LinearGradient
                          colors={[theme.accentSoft, 'transparent']}
                          style={{ marginTop: 40, padding: 20, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.inputBorder }}
                        >
                          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>SECURE ADMIN PANEL</Text>
                          <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
                            Your administrator account is protected by hardware-level encryption and secure session tokens.
                          </Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <View style={[styles.sideMenuInfoCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                        <Text style={[styles.sideMenuInfoTitle, { color: theme.textPrimary }]}>Room History</Text>
                        <Text style={[styles.sideMenuInfoText, { color: theme.textMuted }]}>
                          Your created rooms and their records are shown here.
                        </Text>
                        {!profile.rooms || profile.rooms.length === 0 ? (
                          <View style={[styles.historyStateCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                            <Text style={[styles.historyStateText, { color: theme.textMuted }]}>
                              You haven't created any rooms yet.
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.historyList}>
                            {profile.rooms
                              .slice()
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                              .map((room) => (
                                <View
                                  key={room.roomCode}
                                  style={[styles.historyItem, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}
                                >
                                  <View style={styles.historyItemTop}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[styles.historyItemType, { color: theme.textPrimary }]}>
                                        {room.roomName}
                                      </Text>
                                      <Text style={[styles.historyItemMeta, { color: theme.textMuted, marginTop: 4 }]}>
                                        Code: {room.roomCode}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                      <Pressable
                                        onPress={() => {
                                          closeSideMenu();
                                          onOpenRoom?.(room.roomCode);
                                        }}
                                        style={{ padding: 8, paddingHorizontal: 12, backgroundColor: theme.accentSoft, borderRadius: 8 }}
                                      >
                                        <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 12 }}>View</Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() => {
                                          showAlert(
                                            "Remove History",
                                            "Are you sure you want to remove this room from your history? This will not delete the actual room or its feedback data.",
                                            [
                                              { text: "Cancel", style: "cancel" },
                                              { 
                                                text: "Remove", 
                                                style: "destructive", 
                                                onPress: async () => {
                                                  const result = await onRemoveRoomHistory(room.roomCode);
                                                  if (!result.ok) {
                                                    showAlert("Error", result.message);
                                                  }
                                                } 
                                              },
                                            ]
                                          );
                                        }}
                                        style={{ padding: 10, paddingHorizontal: 14, backgroundColor: "rgba(255, 91, 127, 0.12)", borderRadius: 10 }}
                                      >
                                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>
                              ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

            </ScrollView>

            {sideMenuScreen === "main" && (
              <View style={localStyles.sideMenuGapBranding}>
                <Text style={[localStyles.builtBy, { color: theme.textMuted }]}>Built by</Text>
                <View style={localStyles.brandingContainer}>
                  <LinearGradient 
                    colors={['#4F46E5', '#9333EA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={localStyles.logoWrapper}
                  >
                    <Image 
                      source={require('../../assets/logo.png')} 
                      style={localStyles.companyLogo}
                    />
                  </LinearGradient>
                  <Text style={[localStyles.companyName, { color: theme.textPrimary }]}>CodroidHub</Text>
                </View>
              </View>
            )}

            {sideMenuScreen === "main" && (
              <View style={styles.sideMenuFooter}>
                <Pressable
                  style={[styles.sideMenuLogoutButton, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
                  onPress={onLogout}
                >
                  <Text style={[styles.sideMenuLogoutText, { color: theme.textPrimary }]}>
                    Log out
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}

      <Modal
        visible={showSourcePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setShowSourcePicker(false)}
        >
          <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 }}>
             <View style={{ width: 40, height: 4, backgroundColor: theme.inputBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />
             <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 8 }}>Update Profile Photo</Text>
             <Text style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>Choose how you would like to select your new photo.</Text>
             
             <View style={{ gap: 12 }}>
               <Pressable 
                 onPress={() => {
                   setShowSourcePicker(false);
                   handlePickImage(true);
                 }}
                 style={({ pressed }) => [
                   { backgroundColor: theme.panel, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderSize: 1, borderColor: theme.inputBorder, opacity: pressed ? 0.7 : 1 }
                 ]}
               >
                 <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: theme.accentSoft, justifyContent: 'center', alignItems: 'center' }}>
                   <Text style={{ fontSize: 24 }}>📸</Text>
                 </View>
                 <View>
                   <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '800' }}>Take a Selfie</Text>
                   <Text style={{ color: theme.textMuted, fontSize: 12 }}>Use your camera to snap a new photo</Text>
                 </View>
               </Pressable>

               <Pressable 
                 onPress={() => {
                   setShowSourcePicker(false);
                   handlePickImage(false);
                 }}
                 style={({ pressed }) => [
                   { backgroundColor: theme.panel, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderSize: 1, borderColor: theme.inputBorder, opacity: pressed ? 0.7 : 1 }
                 ]}
               >
                 <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                   <Text style={{ fontSize: 24 }}>🖼️</Text>
                 </View>
                 <View>
                   <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '800' }}>Choose from Gallery</Text>
                   <Text style={{ color: theme.textMuted, fontSize: 12 }}>Select an existing photo from your device</Text>
                 </View>
               </Pressable>

               {!!profile.profileImage && profile.profileImage.trim() !== "" && (
                 <Pressable 
                   onPress={() => {
                     setShowSourcePicker(false);
                     showAlert(
                       "Remove Photo",
                       "Are you sure you want to remove your profile photo?",
                       [
                         { text: "Cancel", style: "cancel" },
                         { text: "Remove", style: "destructive", onPress: () => uploadProfileImage("") }
                       ]
                     );
                   }}
                   style={({ pressed }) => [
                     { backgroundColor: theme.panel, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderSize: 1, borderColor: theme.inputBorder, opacity: pressed ? 0.7 : 1 }
                   ]}
                 >
                   <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(244, 63, 94, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                     <Text style={{ fontSize: 24 }}>🗑️</Text>
                   </View>
                   <View>
                     <Text style={{ color: '#F43F5E', fontSize: 16, fontWeight: '800' }}>Remove Current Photo</Text>
                     <Text style={{ color: theme.textMuted, fontSize: 12 }}>Go back to default avatar</Text>
                   </View>
                 </Pressable>
               )}

               <Pressable 
                 onPress={() => setShowSourcePicker(false)}
                 style={{ marginTop: 8, padding: 16, alignItems: 'center' }}
               >
                 <Text style={{ color: theme.textMuted, fontWeight: '800' }}>Cancel</Text>
               </Pressable>
             </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={webCameraActive}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
          }
          setWebCameraActive(false);
          setCapturedImage(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 500, backgroundColor: theme.panel, borderRadius: 32, padding: 24, alignItems: 'center', overflow: 'hidden' }}>
            <Text style={{ color: theme.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 20 }}>
              {capturedImage ? "Confirm Photo" : "Take a Selfie"}
            </Text>
            <View style={{ width: 300, height: 300, borderRadius: 150, overflow: 'hidden', backgroundColor: '#000', borderWidth: 4, borderColor: theme.accent }}>
               {Platform.OS === 'web' && !capturedImage && (
                 <video 
                   ref={videoRef}
                   style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                   playsInline
                   autoPlay
                 />
               )}
               {capturedImage && (
                 <Image 
                   source={{ uri: capturedImage }} 
                   style={{ width: '100%', height: '100%', transform: 'scaleX(-1)' }}
                   resizeMode="cover"
                 />
               )}
               {Platform.OS === 'web' && (
                 <canvas ref={canvasRef} style={{ display: 'none' }} width={500} height={500} />
               )}
             </View>

             <View style={{ flexDirection: 'row', gap: 16, marginTop: 32 }}>
               {!capturedImage ? (
                 <>
                   <Pressable 
                     onPress={() => {
                       if (videoRef.current && videoRef.current.srcObject) {
                         videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                       }
                       setWebCameraActive(false);
                       setCapturedImage(null);
                     }}
                     style={{ paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, backgroundColor: theme.input }}
                   >
                     <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancel</Text>
                   </Pressable>

                   <Pressable 
                     onPress={() => {
                       if (videoRef.current && canvasRef.current) {
                         try {
                           const context = canvasRef.current.getContext('2d');
                           context.drawImage(videoRef.current, 0, 0, 500, 500);
                           const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
                           setCapturedImage(dataUrl);
                           
                           // Stop stream
                           if (videoRef.current.srcObject) {
                             videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                           }
                         } catch (e) {
                           console.error("Capture error:", e);
                           showAlert("Error", "Failed to capture image. Please try again.");
                         }
                       }
                     }}
                     style={{ paddingVertical: 12, paddingHorizontal: 32, borderRadius: 16, backgroundColor: theme.accent }}
                   >
                     <Text style={{ color: '#fff', fontWeight: '800' }}>Capture 📸</Text>
                   </Pressable>
                 </>
               ) : (
                 <>
                   <Pressable 
                     onPress={() => {
                       setCapturedImage(null);
                       if (Platform.OS === 'web') {
                         // Restart camera for web
                         setTimeout(async () => {
                           try {
                             const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                             if (videoRef.current) {
                               videoRef.current.srcObject = stream;
                               videoRef.current.play();
                             }
                           } catch (err) {
                             showAlert("Error", "Could not restart camera.");
                             setWebCameraActive(false);
                           }
                         }, 100);
                       } else {
                         // For mobile, just close modal and let them pick again
                         setWebCameraActive(false);
                       }
                     }}
                     style={{ paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, backgroundColor: theme.input }}
                   >
                     <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{Platform.OS === 'web' ? 'Retake' : 'Cancel'}</Text>
                   </Pressable>

                   <Pressable 
                     onPress={() => {
                       if (!capturedImage) return;
                       const base64 = capturedImage.split(',')[1];
                       setWebCameraActive(false);
                       setCapturedImage(null);
                       uploadProfileImage(`data:image/jpeg;base64,${base64}`);
                     }}
                     style={{ paddingVertical: 12, paddingHorizontal: 32, borderRadius: 16, backgroundColor: '#22C55E' }}
                   >
                     <Text style={{ color: '#fff', fontWeight: '800' }}>Use Photo ✅</Text>
                   </Pressable>
                 </>
               )}
             </View>
          </View>
        </View>
      </Modal>

      <StatusBar hidden />
    </View>
  );
}

const localStyles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  glowOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  quickStatsBar: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  quickStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  quickStatDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 8,
  },
  createButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  roomCard: {
    padding: 20,
    borderRadius: 28,
    borderWidth: 1.2,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  roomCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roomCodeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  roomCardStats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 0,
  },
  statPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.2,
  },
  emptyState: {
    marginTop: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  cardAction: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: 'center',
  },
  editBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sideMenuGapBranding: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  companyLogo: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  companyName: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  footerBranding: {
    marginTop: 80,
    marginBottom: 0,
    alignItems: 'center',
  },
  builtBy: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 0,
    opacity: 0.5,
  },
  timerBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  }
});
