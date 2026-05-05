import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  View, 
  Text, 
  Pressable, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  BackHandler, 
  Platform, 
  useWindowDimensions, 
  StyleSheet,
  Alert,
  Modal,
  Image,
  Animated,
  Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../constants/config.js';
import { getAuthHeader } from '../utils/auth';
import { addNotificationListeners } from '../utils/notifications';
import { showAlert } from '../utils/alertUtils';
import { getSentimentVibe } from '../utils/emotionUtils';
import { formatDate } from '../utils/dateUtils';
import { SCREEN_THEMES, APPEARANCE_OPTIONS } from '../constants/themeConstants';
import * as ImagePicker from 'expo-image-picker';
import styles from '../styles/globalStyles';

export default function DashboardScreen({
  profile,
  onLogout,
  onOpenStoryMode,
  onOpenSelfieFeedback,
  onSaveFeedback,
  onFetchFeedbackHistory,
  onDeleteFeedback,
  storyModePreference,
  onStoryModePreferenceChange,
  themeSettings,
  onThemeSettingsChange,
  activeRoom,
  onJoinRoom,
  onLeaveRoom,
  joiningRoom,
  onOpenRoomDetail,
  onRemoveRoomHistory,
  onRefreshProfile,
  onNavigateToAnimation,
  theme,
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 980;
  const isCompact = width < 420;
  const [selectedMood, setSelectedMood] = useState(null);
  const [writtenFeedback, setWrittenFeedback] = useState("");
  const [savingType, setSavingType] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sideMenuScreen, setSideMenuScreen] = useState("main");
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [activeTab, setActiveTab] = useState("standard"); // "standard" or "story"
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

  const isSideMenuDetail = sideMenuScreen !== "main";

  // CUSTOM ALERT MODAL STATE
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    onConfirm: null,
    confirmText: "Submit",
    cancelText: "Cancel"
  });

  const showBrandedAlert = (title, message, onConfirm, confirmText = "Submit", cancelText = "Cancel") => {
    setCustomAlert({
      visible: true,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText
    });
  };

  const hideBrandedAlert = () => {
    setCustomAlert({ ...customAlert, visible: false });
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

        // Ensure prefix
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

  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoadingStories(true);
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/stories`, { headers });
        if (response.ok) {
          const data = await response.json();
          setStories(data);
        }
      } catch (error) {
        // Handle story fetch error silently
      } finally {
        setLoadingStories(false);
      }
    };
    fetchStories();

    // Notification Listeners (Native Only)
    let removeListeners = () => {};
    if (Platform.OS !== 'web') {
      removeListeners = addNotificationListeners(
        (notification) => {
          // Handle received notification while app is foregrounded
          const { title, body } = notification.request.content;
        },
        (response) => {
          // Handle notification interaction (tap)
          const roomCode = response.notification.request.content.data?.roomCode;
          if (roomCode) {
            onJoinRoom(roomCode);
          }
        }
      );
    }

    return () => removeListeners();
  }, []);

  const openProfileMenu = () => {
    setSideMenuScreen("main");
    setProfileMenuOpen(true);
  };

  const closeProfileMenu = () => {
    setProfileMenuOpen(false);
    setSideMenuScreen("main");
  };

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (profileMenuOpen && sideMenuScreen !== "main") {
          setSideMenuScreen("main");
          return true;
        }

        if (profileMenuOpen) {
          closeProfileMenu();
          return true;
        }

        return false;
      }
    );

    return () => subscription.remove();
  }, [profileMenuOpen, sideMenuScreen]);

  const moodOptions = [
    { id: "sad", emoji: "😞", label: "Low" },
    { id: "neutral", emoji: "😐", label: "Okay" },
    { id: "happy", emoji: "😊", label: "Great" },
  ];

  const handleEmojiFeedback = async (mood) => {
    if (!activeRoom) {
      showAlert("No Active Session", "Please join a room using a code before submitting feedback.");
      return;
    }

    showBrandedAlert(
      "Confirm Submission",
      `Are you sure you want to submit your "${mood.label}" feedback?`,
      async () => {
        hideBrandedAlert();
        setSelectedMood(mood.id);
        setSavingType("emoji");

        const moodToReview = {
          happy: "good",
          neutral: "average",
          sad: "bad"
        };

        const result = await onSaveFeedback({
          type: "emoji",
          emoji: mood.emoji,
          review: moodToReview[mood.id] || "average",
          message: `Mood selected: ${mood.label}`,
          metadata: { label: mood.label },
        });

        setSavingType(null);
        if (result.ok) {
          onNavigateToAnimation(moodToReview[mood.id] || "average");
        } else {
          showAlert("Submission Failed", result.message);
        }
      },
      "Yes, Submit"
    );
  };

  const handleWrittenFeedback = async () => {
    if (!activeRoom) {
      showAlert("No Active Session", "Please join a room using a code before submitting feedback.");
      return;
    }

    if (!writtenFeedback.trim()) {
      showAlert("Missing text", "Write something before submitting.");
      return;
    }

    showBrandedAlert(
      "Submit Feedback",
      "Are you sure you want to send your written comments?",
      async () => {
        hideBrandedAlert();
        setSavingType("written");
        const vibe = getSentimentVibe(writtenFeedback);
        
        const result = await onSaveFeedback({
          type: "written",
          message: writtenFeedback.trim(),
          review: vibe,
        });
        setSavingType(null);

        if (result.ok) {
          setWrittenFeedback("");
          onNavigateToAnimation(vibe);
        } else {
          showAlert("Submission Failed", result.message);
        }
      },
      "Submit Now"
    );
  };

  const handleJoinPress = async () => {
    if (!roomCodeInput.trim()) {
      showAlert("Missing Code", "Enter the 6-digit room code.");
      return;
    }

    const result = await onJoinRoom(roomCodeInput.trim());
    if (result.ok) {
      setRoomCodeInput("");
    } else {
      showAlert("Error", result.message);
    }
  };

  const handleSelfieFeedback = () => {
    if (!activeRoom) {
      showAlert("No Active Session", "Please join a room using a code before submitting feedback.");
      return;
    }

    showBrandedAlert(
      "Open Camera",
      "Are you sure you want to open the camera for Selfie Feedback?",
      () => {
        hideBrandedAlert();
        onOpenSelfieFeedback();
      },
      "Open Camera"
    );
  };

  const handleDeleteFeedbackPress = (feedbackId) => {
    showAlert(
      "Delete Feedback",
      "Are you sure you want to remove this feedback from your history?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            const result = await onDeleteFeedback(feedbackId);
            if (result.ok) {
              // Refresh history list
              const refreshed = await onFetchFeedbackHistory();
              if (refreshed.ok) {
                setFeedbackHistory(refreshed.feedback);
              }
            } else {
              showAlert("Error", result.message);
            }
          } 
        },
      ]
    );
  };

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!profileMenuOpen || sideMenuScreen !== "feedback") {
        return;
      }

      setHistoryLoading(true);
      setHistoryError("");

      try {
        const result = await onFetchFeedbackHistory();

        if (!active) {
          return;
        }

        if (result.ok) {
          setFeedbackHistory(result.feedback);
        } else {
          setHistoryError(result.message);
        }
      } catch (err) {
        if (active) setHistoryError("Failed to load feedback history");
      } finally {
        if (active) setHistoryLoading(false);
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, [onFetchFeedbackHistory, profileMenuOpen, sideMenuScreen]);

  // AUTO-SYNC: Sync profile when opening history or rooms to ensure cross-device consistency
  // Runs only when the specific side menu screens are entered to avoid feedback loops
  useEffect(() => {
    if (profileMenuOpen && (sideMenuScreen === "rooms" || sideMenuScreen === "feedback")) {
      onRefreshProfile();
    }
  }, [profileMenuOpen, sideMenuScreen]); // Removed onRefreshProfile to prevent unnecessary re-runs

  const feedbackTypeLabel = {
    emoji: "Emoji Feedback",
    selfie: "Selfie Feedback",
    written: "Written Feedback",
    story: "Story Mode",
  };
  
  const storyOptions = stories.map(s => ({
    id: s._id,
    title: s.title,
    subtitle: `By ${s.teacherName || 'Teacher'}`,
  }));

  const storyPreferenceOptions = [
    ...storyOptions,
    {
      id: "random",
      title: "Random Story",
      subtitle: "Choose a random story when Open Story Mode is pressed",
    },
  ];

  const handleDashboardOpenStory = () => {
    if (!activeRoom) {
      showAlert("No Active Session", "Please join a room using a code before submitting feedback.");
      return;
    }

    if (stories.length === 0) {
      showAlert("No Stories Available", "Please wait for your teacher to upload a story experience.");
      return;
    }

    let chosenStoryId = storyModePreference;

    if (storyModePreference === "random") {
      const randomIndex = Math.floor(Math.random() * stories.length);
      chosenStoryId = stories[randomIndex]._id;
    }

    // If preference is set to a story that no longer exists, fallback to latest
    const storyExists = stories.some(s => s._id === chosenStoryId);
    if (!storyExists && stories.length > 0) {
      chosenStoryId = stories[0]._id;
    }

    onOpenStoryMode(chosenStoryId, true);
  };

  return (
    <View style={[styles.dashboardRoot, { backgroundColor: theme.background }]}>
      <View
        pointerEvents="none"
        style={[styles.dashboardBackdrop, { backgroundColor: theme.background }]}
      >
        <View style={[styles.dashboardGlowOne, { backgroundColor: theme.glowOne }]} />
        <View style={[styles.dashboardGlowTwo, { backgroundColor: theme.glowTwo }]} />
      </View>
      <ScrollView
        style={styles.dashboardScroll}
        contentContainerStyle={[
          styles.dashboardContent,
          { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.dashboardHeaderWrap}>
          <View style={styles.dashboardHeader}>
            <Pressable
              style={[
                styles.dashboardIdentity,
                isCompact && styles.dashboardIdentityCompact,
              ]}
              onPress={openProfileMenu}
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
                      {(profile.name?.[0] || "S").toUpperCase()}
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
                  {profile.role === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
        <View style={{ marginTop: 12, marginBottom: 28 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
            {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 17 ? "Good Afternoon" : "Good Evening"}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
              Welcome back,
            </Text>
            <Text style={{ color: theme.accent, fontSize: 32, fontWeight: '900', letterSpacing: -1 }}>
              {profile.name.split(' ')[0]}!
            </Text>
          </View>
          <Text style={{ color: theme.textMuted, fontSize: 15, marginTop: 4, fontWeight: '500', maxWidth: '90%' }}>
            Ready to share your experience? Choose a mode below to get started.
          </Text>
        </View>
        {activeRoom ? (
          <Pressable 
            style={[
              styles.dashboardCard,
              {
                backgroundColor: theme.panel,
                borderColor: theme.accent,
                borderWidth: 1.5,
                marginBottom: 24,
                padding: 18,
                shadowColor: theme.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 4,
              },
            ]}
            onPress={() => onOpenRoomDetail(activeRoom.roomCode)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.accentSoft, width: 44, height: 44, borderColor: theme.accent }]}>
                <Text style={{ fontSize: 20 }}>🏫</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Current Session</Text>
                <Text style={{ color: theme.textPrimary, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 }}>{activeRoom.roomName}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>Led by {activeRoom.teacherName || "Teacher"}</Text>
              </View>
              <View style={[localStyles.enterBadge, { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Text style={{ color: theme.onAccent, fontWeight: '900', fontSize: 11 }}>VIEW</Text>
                <Text style={{ color: theme.onAccent, fontSize: 10 }}>➜</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable 
            style={[
              styles.dashboardCard,
              {
                backgroundColor: theme.panel,
                borderColor: theme.accentSoft,
                borderWidth: 1.5,
                marginBottom: 24,
                padding: 18,
                opacity: 0.9,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3,
              },
            ]}
            onPress={openProfileMenu}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.accentSoft, width: 44, height: 44, borderColor: theme.accent }]}>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Status: Offline</Text>
                <Text style={{ color: theme.textPrimary, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 }}>No active session joined</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>Join a room in your profile menu to send feedback.</Text>
              </View>
              <View style={[localStyles.enterBadge, { backgroundColor: theme.accentSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.accent }]}>
                <Text style={{ color: theme.accent, fontWeight: '900', fontSize: 11 }}>Join</Text>
              </View>
            </View>
          </Pressable>
        )}

        <View style={[localStyles.tabWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, borderWidth: 1, borderRadius: 20, padding: 6, marginBottom: 28 }]}>
          <Pressable 
            style={[
              localStyles.tabItem,
              activeTab === "standard" && {
                backgroundColor: theme.accent,
                shadowColor: theme.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              },
              { borderRadius: 14 },
            ]} 
            onPress={() => setActiveTab("standard")}
          >
            <Text style={[localStyles.tabText, { color: activeTab === "standard" ? theme.onAccent : theme.textSecondary, fontWeight: '800' }]}>One-Tap</Text>
          </Pressable>
          <Pressable 
            style={[
              localStyles.tabItem,
              activeTab === "story" && {
                backgroundColor: theme.accent,
                shadowColor: theme.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              },
              { borderRadius: 14 },
            ]} 
            onPress={() => setActiveTab("story")}
          >
            <Text style={[localStyles.tabText, { color: activeTab === "story" ? theme.onAccent : theme.textSecondary, fontWeight: '800' }]}>Story Mode</Text>
          </Pressable>
        </View>

        <View style={{ marginBottom: 18, marginTop: 10 }}>
          <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
            Choose your response mode
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
            Select one of the options below to share your feedback.
          </Text>
        </View>

        <View style={[styles.dashboardGrid, isWide && styles.dashboardGridWide]}>
          {activeTab === "standard" ? (
            <>
              {/* RESTORED PROMINENT COMMON QUESTION */}
              {activeRoom && (
                <View style={[localStyles.questionContainer, { backgroundColor: theme.panel, borderColor: theme.accent, width: '100%', marginBottom: 20 }]}>
                  <View style={[localStyles.questionIndicator, { backgroundColor: theme.accent }]}>
                      <Text style={{ color: theme.onAccent, fontSize: 10, fontWeight: '900' }}>SESSION PROMPT</Text>
                  </View>
                  <Text style={[localStyles.questionText, { color: theme.textPrimary }]}>
                      "{activeRoom.question || "How was your experience today?"}"
                  </Text>
                  <View style={localStyles.questionBubbleTail} />
                </View>
              )}

              {(!activeRoom || activeRoom.enabledFeedbackModes?.includes("emoji")) && (
                <View style={[styles.dashboardCard, { backgroundColor: theme.panel }]}>
                  <Text style={[styles.dashboardCardLabel, { color: theme.accent }]}>
                    Emoji Feedback
                  </Text>
                  <Text style={[styles.dashboardCardTitle, { color: theme.textPrimary }]}>
                    Quick Mood Rating
                  </Text>
                  <View style={styles.moodRow}>
                    {moodOptions.map((mood) => (
                      <Pressable
                        key={mood.id}
                        style={[
                          styles.moodButton,
                          { backgroundColor: `${theme.background}CC` },
                          selectedMood === mood.id && styles.moodButtonActive,
                          selectedMood === mood.id && {
                            backgroundColor: theme.accent,
                            borderColor: theme.secondary,
                          },
                        ]}
                        onPress={() => handleEmojiFeedback(mood)}
                      >
                        <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                        <Text
                          style={[
                            styles.moodLabel,
                            { color: theme.textSecondary },
                            selectedMood === mood.id && styles.moodLabelActive,
                          ]}
                        >
                          {mood.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {(!activeRoom || activeRoom.enabledFeedbackModes?.includes("selfie")) && (
                <View
                  style={[styles.dashboardCard, styles.selfieCard, { backgroundColor: theme.panel }]}
                >
                  <View
                    style={[styles.selfieFrame, { backgroundColor: `${theme.background}D9` }]}
                  >
                    <View style={styles.selfieBadge}>
                      <Text style={styles.selfieBadgeText}>Emotion Detection Ready</Text>
                    </View>
                    <Text style={styles.selfieFace}>🙂</Text>
                  </View>
                  <Text style={[styles.dashboardCardTitle, { color: theme.textPrimary }]}>
                    Selfie Feedback
                  </Text>
                  <Text style={[styles.dashboardCardText, { color: theme.textMuted }]}>
                    Capture a quick selfie later and we can analyze expression-based
                    response patterns.
                  </Text>
                  <Pressable
                    style={[
                      styles.secondaryAction,
                      {
                        backgroundColor: theme.accentSoft,
                        borderColor: theme.accent,
                      },
                    ]}
                    onPress={handleSelfieFeedback}
                  >
                    <Text style={[styles.secondaryActionText, { color: theme.textPrimary }]}>
                      {savingType === "selfie" ? "Saving..." : "Open Selfie Mode"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {(!activeRoom || activeRoom.enabledFeedbackModes?.includes("written")) && (
                <View style={[styles.dashboardCard, { backgroundColor: theme.panel }]}>
                  <Text style={[styles.dashboardCardLabel, { color: theme.accent }]}>
                    Written Feedback
                  </Text>
                  <Text style={[styles.dashboardCardTitle, { color: theme.textPrimary }]}>
                    Share your thoughts
                  </Text>
                  <TextInput
                    value={writtenFeedback}
                    onChangeText={setWrittenFeedback}
                    placeholder="Type your feedback here..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    maxLength={500}
                    style={[
                      styles.feedbackInput,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.inputText,
                      },
                    ]}
                  />
                  <Text style={[styles.feedbackCount, { color: theme.textMuted }]}>
                    {writtenFeedback.length}/500
                  </Text>
                  <Pressable
                    style={[styles.primaryDashboardAction, { backgroundColor: theme.accent }]}
                    onPress={handleWrittenFeedback}
                  >
                    <Text
                      style={[styles.primaryDashboardActionText, { color: theme.onAccent }]}
                    >
                      {savingType === "written" ? "Saving..." : "Submit Entry"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <>
              {(!activeRoom || activeRoom.enabledFeedbackModes?.includes("story")) && (
                <View
                  style={[styles.dashboardCard, styles.storyCard, { backgroundColor: theme.panel, flex: 1, minHeight: 300 }]}
                >
                  <Text style={[styles.dashboardCardLabel, { color: theme.accent }]}>
                    Story Mode
                  </Text>
                  <Text style={[styles.dashboardCardTitle, { color: theme.textPrimary }]}>
                    Interactive Animation Feedback
                  </Text>
                  <Text style={[styles.dashboardCardText, { color: theme.textMuted }]}>
                    Launch your immersive story scenes, answer live questions, and
                    reveal the animated result.
                  </Text>
                  <Pressable
                    style={[styles.storyAction, { backgroundColor: theme.secondary }]}
                    onPress={handleDashboardOpenStory}
                  >
                    <Text style={[styles.storyActionText, { color: theme.onSecondary }]}>
                      Open Story Mode
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

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

      {profileMenuOpen && (
        <>
          <Pressable
            style={styles.sideMenuBackdrop}
            onPress={closeProfileMenu}
          />
          <View
            style={[
              styles.sideMenuPanel,
              { backgroundColor: theme.background, borderRightColor: theme.inputBorder },
              isSideMenuDetail && styles.sideMenuPanelExpanded,
              isSideMenuDetail && { width },
            ]}
          >
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
                            {(profile.name?.[0] || "S").toUpperCase()}
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
                    onPress={() => setSideMenuScreen("feedback")}
                  >
                    <View style={styles.sideMenuItemBody}>
                      <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>My Feedback</Text>
                      <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                        Check your saved feedback activity
                      </Text>
                    </View>
                  </Pressable>
                  

                  
                  <Pressable
                    style={[styles.sideMenuItem, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
                    onPress={() => setSideMenuScreen("story")}
                  >
                    <View style={styles.sideMenuItemBody}>
                      <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>Story Mode</Text>
                      <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                        Choose which story you want to play
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.sideMenuItem, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
                    onPress={() => setSideMenuScreen("rooms")}
                  >
                    <View style={styles.sideMenuItemBody}>
                      <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>My Rooms</Text>
                      <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                        View sessions you have participated in
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.sideMenuItem, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
                    onPress={() => setSideMenuScreen("settings")}
                  >
                    <View style={styles.sideMenuItemBody}>
                      <Text style={[styles.sideMenuItemText, { color: theme.textPrimary }]}>Settings</Text>
                      <Text style={[styles.sideMenuItemSubtext, { color: theme.textMuted }]}>
                        Tune themes and feedback preferences
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
                        : sideMenuScreen === "feedback"
                          ? "My Feedback"
                          : sideMenuScreen === "rooms"
                            ? "My Rooms"
                            : sideMenuScreen === "profile"
                              ? "Profile Settings"
                              : "Story Mode"}
                    </Text>
                  </View>

                  {sideMenuScreen === "settings" ? (
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
                            appearanceMode: themeSettings.appearanceMode,
                            autoRotate: !themeSettings.autoRotate,
                            selectedThemeName: themeSettings.selectedThemeName,
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
                          const isSelected =
                            themeSettings.appearanceMode === option.id;

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
                          const isSelected =
                            !themeSettings.autoRotate &&
                            themeSettings.selectedThemeName === themeOption.name;

                          return (
                            <Pressable
                              key={themeOption.name}
                              style={[
                                styles.themeChip,
                                { borderColor: themeOption.accent },
                                isSelected && {
                                  backgroundColor: themeOption.accentSoft,
                                },
                              ]}
                              onPress={() =>
                              onThemeSettingsChange({
                                appearanceMode: themeSettings.appearanceMode,
                                autoRotate: false,
                                selectedThemeName: themeOption.name,
                              })
                              }
                            >
                              <View
                                style={[
                                  styles.themeChipDot,
                                  { backgroundColor: themeOption.accent },
                                ]}
                              />
                              <Text style={styles.themeChipText}>{themeOption.name}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : sideMenuScreen === "feedback" ? (
                    <View style={[styles.sideMenuInfoCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                      <Text style={[styles.sideMenuInfoTitle, { color: theme.textPrimary }]}>Feedback History</Text>
                      <Text style={[styles.sideMenuInfoText, { color: theme.textMuted }]}>
                        Your saved emoji, written, selfie, and story responses are shown here.
                      </Text>

                      {historyLoading ? (
                        <View style={[styles.historyStateCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                          <ActivityIndicator size="small" color={theme.accent} />
                          <Text style={[styles.historyStateText, { color: theme.textMuted }]}>Loading your feedback...</Text>
                        </View>
                      ) : historyError ? (
                        <View style={[styles.historyStateCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                          <Text style={[styles.historyStateText, { color: theme.accent }]}>{historyError}</Text>
                        </View>
                      ) : feedbackHistory.length === 0 ? (
                        <View style={[styles.historyStateCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                          <Text style={[styles.historyStateText, { color: theme.textMuted }]}>
                            No feedback saved yet. Submit your first response from the dashboard.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.historyList}>
                          {feedbackHistory.map((item) => (
                            <View
                              key={item._id || `${item.type}-${item.createdAt}`}
                              style={[styles.historyItem, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}
                            >
                              <View style={styles.historyItemTop}>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.historyItemType, { color: theme.textPrimary }]}>
                                    {feedbackTypeLabel[item.type] || item.type}
                                  </Text>
                                  <Text style={[styles.historyItemDate, { color: theme.textMuted }]}>
                                    {item.createdAt
                                      ? formatDate(item.createdAt)
                                      : "Saved"}
                                  </Text>
                                </View>
                                <Pressable
                                  onPress={() => handleDeleteFeedbackPress(item._id)}
                                  style={{ padding: 10, paddingHorizontal: 14, backgroundColor: "rgba(255, 91, 127, 0.12)", borderRadius: 10 }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                                </Pressable>
                              </View>
                              {!!item.message && (
                                <Text style={[styles.historyItemMessage, { color: theme.textSecondary }]}>{item.message}</Text>
                              )}
                              <Text style={[styles.historyItemMeta, { color: theme.textMuted }]}>
                                {item.type === "emoji" && item.emoji
                                  ? `Mood: ${item.emoji}`
                                  : item.type === "story" && item.metadata?.outcome
                                    ? `Outcome: ${item.metadata.outcome}`
                                    : item.type === "selfie"
                                      ? "Selfie feedback entry"
                                      : "Saved in your feedback history"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
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
                                      {(profile.name?.[0] || "S").toUpperCase()}
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
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>VERIFIED</Text>
                             </View>
                          </View>
                          <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2, fontWeight: '500' }}>Student ID: #{profile.id?.slice(-6).toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={{ gap: 12 }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginLeft: 4, marginBottom: 4 }}>PERSONAL INFORMATION</Text>
                        
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
                                 <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Email Address</Text>
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
                        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>SECURE ACCOUNT</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
                          Your account is protected by end-to-end encryption and cloud security protocols.
                        </Text>
                      </LinearGradient>
                    </View>
                  ) : sideMenuScreen === "rooms" ? (
                    <View style={[styles.sideMenuInfoCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                      <Text style={[styles.sideMenuInfoTitle, { color: theme.textPrimary }]}>My Rooms</Text>
                      
                      {/* Current Active or Join Input */}
                      {!activeRoom ? (
                        <View style={{ marginBottom: 24 }}>
                          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                            Join a Session
                          </Text>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  flex: 1,
                                  backgroundColor: theme.inputBackground,
                                  borderColor: theme.inputBorder,
                                  height: 48,
                                  borderRadius: 12,
                                  fontSize: 16,
                                  fontWeight: "900",
                                  letterSpacing: 1,
                                  textAlign: "center",
                                },
                              ]}
                              value={roomCodeInput}
                              onChangeText={setRoomCodeInput}
                              placeholder="XXX-XXX"
                              placeholderTextColor="rgba(255,255,255,0.2)"
                              autoCapitalize="characters"
                              maxLength={7}
                            />
                            <Pressable
                              style={[
                                styles.primaryDashboardAction,
                                { paddingVertical: 0, paddingHorizontal: 20, height: 48, borderRadius: 12, backgroundColor: theme.accent },
                                joiningRoom && { opacity: 0.6 },
                              ]}
                              onPress={handleJoinPress}
                              disabled={joiningRoom}
                            >
                              {joiningRoom ? (
                                <ActivityIndicator color={theme.onAccent} />
                              ) : (
                                <Text style={{ color: theme.onAccent, fontWeight: "900", fontSize: 13 }}>Join</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={{ marginBottom: 20 }}>
                          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                            Active Session
                          </Text>
                          <View
                            style={[
                              styles.historyItem,
                              { backgroundColor: "rgba(89, 240, 194, 0.08)", borderColor: "rgba(89, 240, 194, 0.3)" }
                            ]}
                          >
                            <View style={styles.historyItemTop}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.historyItemType, { color: "#59f0c2" }]}>
                                  {activeRoom.roomName}
                                </Text>
                                <Text style={[styles.historyItemMeta, { color: theme.textMuted, marginTop: 4 }]}>
                                   Code: {activeRoom.roomCode}
                               </Text>
                             </View>
                             <Pressable
                                onPress={() => onOpenRoomDetail(activeRoom.roomCode)}
                                 style={{ padding: 8, paddingHorizontal: 12, backgroundColor: theme.accentSoft, borderRadius: 8, marginRight: 8 }}
                               >
                                 <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 12 }}>View</Text>
                               </Pressable>
                               <Pressable
                                 onPress={() => {
                                   showAlert(
                                     "Leave Room",
                                     "Are you sure you want to stop participating in this session?",
                                     [
                                       { text: "Cancel", style: "cancel" },
                                     { text: "Leave", style: "destructive", onPress: onLeaveRoom },
                                    ]
                                  );
                                }}
                                 style={{ padding: 8, backgroundColor: "rgba(255, 91, 127, 0.15)", borderRadius: 8 }}
                               >
                                 <Text style={{ color: "#ff5b7f", fontWeight: "800", fontSize: 12 }}>Leave</Text>
                               </Pressable>
                             </View>
                           </View>
                         </View>
                       )}

                      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                        Room History
                      </Text>

                      {!profile.joinedRooms || profile.joinedRooms.length === 0 ? (
                        <View style={[styles.historyStateCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                          <Text style={[styles.historyStateText, { color: theme.textMuted }]}>
                            You haven&apos;t joined any rooms yet.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.historyList}>
                          {profile.joinedRooms
                            .slice()
                            .map((room) => {
                              const isCurrentlyActive = activeRoom?.roomCode === room.roomCode;
                              return (
                                <View
                                  key={room.roomCode}
                                  style={[
                                    styles.historyItem, 
                                    { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                                    isCurrentlyActive && { borderColor: theme.accent }
                                  ]}
                                >
                                  <View style={styles.historyItemTop}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[styles.historyItemType, { color: theme.textPrimary }]}>
                                        {room.roomName}
                                      </Text>
                                      <Text style={[styles.historyItemMeta, { color: theme.textMuted, marginTop: 4 }]}>
                                        Code: {room.roomCode}
                                      </Text>
                                      {isCurrentlyActive && (
                                        <Text style={{ color: theme.accent, fontSize: 10, fontWeight: "900", marginTop: 2 }}>ACTIVE SESSION</Text>
                                      )}
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                      <Pressable
                                        onPress={() => onOpenRoomDetail(room.roomCode)}
                                        style={{ padding: 8, paddingHorizontal: 12, backgroundColor: theme.accentSoft, borderRadius: 8 }}
                                      >
                                        <Text style={{ color: theme.accent, fontWeight: "800", fontSize: 12 }}>View</Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() => {
                                          const deleteMsg = "Are you sure you want to remove this room from your history? This will not affect your feedback responses.";
                                          
                                          showAlert(
                                            "Remove History",
                                            deleteMsg,
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
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                      >
                                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={[styles.sideMenuInfoCard, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
                      <Text style={[styles.sideMenuInfoTitle, { color: theme.textPrimary }]}>Story Mode Preference</Text>
                      <Text style={[styles.sideMenuInfoText, { color: theme.textMuted }]}>
                        Choose what should happen when you press Open Story Mode on the dashboard.
                      </Text>
                      <View style={styles.storyLaunchList}>
                        {storyPreferenceOptions.map((storyOption) => {
                          const isSelected = storyModePreference === storyOption.id;

                          return (
                          <Pressable
                            key={storyOption.id}
                            style={[
                              styles.storyLaunchCard,
                              { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                              isSelected && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                            ]}
                            onPress={() => {
                              onStoryModePreferenceChange(storyOption.id);
                            }}
                          >
                            <View style={styles.storyLaunchTextWrap}>
                              <Text style={[styles.storyLaunchTitle, { color: theme.textPrimary }]}>{storyOption.title}</Text>
                              <Text style={[styles.storyLaunchSubtitle, { color: theme.textMuted }]}>
                                {storyOption.subtitle}
                              </Text>
                            </View>
                            <Text style={[styles.storyLaunchAction, { color: theme.accent }]}>
                              {isSelected ? "Selected" : "Choose"}
                            </Text>
                          </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.storyModePreferenceNote, { color: theme.textMuted }]}>
                        The video will not play from here. Go back to the dashboard and press
                        Open Story Mode to start.
                      </Text>
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
                  <Text style={[styles.sideMenuLogoutText, { color: theme.textPrimary }]}>Log out</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
      {/* CUSTOM BRANDED ALERT MODAL */}
      <Modal
        visible={customAlert.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideBrandedAlert}
      >
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.alertPanel, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
            <View style={[localStyles.alertIconCircle, { backgroundColor: theme.accentSoft }]}>
              <Text style={{ fontSize: 24 }}>🔔</Text>
            </View>
            
            <Text style={[localStyles.alertTitle, { color: theme.textPrimary }]}>{customAlert.title}</Text>
            <Text style={[localStyles.alertMessage, { color: theme.textSecondary }]}>{customAlert.message}</Text>
            
            <View style={localStyles.alertActionRow}>
              <Pressable 
                style={[localStyles.alertBtn, { backgroundColor: theme.background, borderColor: theme.inputBorder, borderWidth: 1 }]} 
                onPress={hideBrandedAlert}
              >
                <Text style={[localStyles.alertBtnText, { color: theme.textPrimary }]}>{customAlert.cancelText}</Text>
              </Pressable>
              
              <Pressable 
                style={[localStyles.alertBtn, { backgroundColor: theme.accent }]} 
                onPress={customAlert.onConfirm}
              >
                <Text style={[localStyles.alertBtnText, { color: theme.onAccent }]}>{customAlert.confirmText}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
                  style={{ width: '100%', height: '100%', transform: Platform.OS === 'web' ? 'scaleX(-1)' : 'none' }}
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
                        const context = canvasRef.current.getContext('2d');
                        context.drawImage(videoRef.current, 0, 0, 500, 500);
                        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
                        setCapturedImage(dataUrl);
                        
                        // Stop stream
                        if (videoRef.current.srcObject) {
                          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
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
                        // For mobile, just close modal
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
  enterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  questionContainer: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  questionIndicator: {
    position: 'absolute',
    top: -10,
    left: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
  },
  questionBubbleTail: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent', 
  },
  questionListCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    width: '100%',
  },
  questionListText: {
    fontSize: 16,
    fontWeight: '800',
  },
  tabWrapper: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 20,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertPanel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  alertIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  alertActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  alertBtn: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
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
  sideMenuGapBranding: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
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
  }
});
