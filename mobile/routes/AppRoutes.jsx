import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, ACTIVE_ROOM_STORAGE_KEY } from '../src/constants/config';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { ThemeProvider, useTheme } from '../src/providers/ThemeProvider';
import { RoomProvider, useRoom } from '../src/providers/RoomProvider';
import { getRandomTheme, getThemeByName } from '../src/utils/themeUtils';
import { getAuthHeader } from '../src/utils/auth';
import WelcomeAnimation from '../src/components/WelcomeAnimation';
import AuthScreen from '../src/screens/AuthScreen';
import DashboardScreen from '../src/screens/DashboardScreen';
import SelfieFeedbackScreen from '../src/screens/SelfieFeedbackScreen';
import StoryExperience from '../src/screens/StoryExperience';
import FeedbackAnimationScreen from '../src/screens/FeedbackAnimationScreen';
import TeacherDashboard from '../src/screens/TeacherDashboard';
import MyClipsScreen from '../src/screens/MyClipsScreen';
import UploadStoryScreen from '../src/screens/UploadStoryScreen';
import RoomFormScreen from '../src/screens/RoomFormScreen';
import RoomDetailScreen from '../src/screens/RoomDetailScreen';
import StudentRoomDetailScreen from '../src/screens/StudentRoomDetailScreen';
import AdminDashboardScreen from '../src/screens/AdminDashboardScreen';
import PrivacyPolicyScreen from '../src/screens/PrivacyPolicyScreen';

const Stack = createNativeStackNavigator();

const screensConfig = {
  Login: 'login',
  Signup: 'signup',
  Auth: 'auth',
  Dashboard: 'dashboard/:panel?',
  Privacy: 'dashboard/privacy',
  Selfie: 'dashboard/selfie-feedback',
  Story: 'dashboard/story',
  Animation: 'dashboard/animation',
  StudentRoomDetail: 'dashboard/rooms/:code',
  TeacherDashboard: 'teacher',
  TeacherPrivacy: 'teacher/privacy',
  CreateRoom: 'teacher/rooms/create',
  TeacherRoomDetail: 'teacher/rooms/:code',
  EditRoom: 'teacher/rooms/:code/edit',
  Clips: 'teacher/clips',
  Upload: 'teacher/upload-story',
  AdminDashboard: 'admin',
  AdminPrivacy: 'admin/privacy',
  AdminClips: 'admin/clips',
  AdminUpload: 'admin/upload-story',
};

function LoadingScreen({ theme }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme?.background || '#07111f' }}>
      <ActivityIndicator size="large" color={theme?.accent || '#4f46e5'} />
    </View>
  );
}

/* ───────── Auth Routes ───────── */
function LoginRoute({ navigation }) {
  const { displayTheme, setThemeSettings, setTheme, setStoryModePreference } = useTheme();
  const { setActiveRoom } = useRoom();
  const { profile, loadingAuth, handleEnter: authEnter } = useAuth();
  const navigated = useRef(false);

  useEffect(() => {
    if (loadingAuth || navigated.current) return;
    if (profile) {
      navigated.current = true;
      const target = profile.role === "admin" ? "AdminDashboard"
        : profile.role === "teacher" ? "TeacherDashboard"
        : "Dashboard";
      navigation.replace(target);
    }
  }, [profile, loadingAuth, navigation]);

  const handleEnter = useCallback(async (nextProfile) => {
    await authEnter(nextProfile);
    const nextThemeSettings = {
      ...{ appearanceMode: "system", autoRotate: true, selectedThemeName: "" },
      ...(nextProfile?.preferences?.themeSettings || {}),
    };
    setThemeSettings(nextThemeSettings);
    setTheme((current) =>
      nextThemeSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(nextThemeSettings.selectedThemeName)
    );
    setStoryModePreference(nextProfile?.preferences?.storyModePreference || "random");

    const target = nextProfile?.role === "admin" ? "AdminDashboard"
      : nextProfile?.role === "teacher" ? "TeacherDashboard"
      : "Dashboard";
    if (!navigated.current) { navigated.current = true; navigation.replace(target); }

    if (nextProfile?.role !== "teacher" && nextProfile?.joinedRooms?.length > 0) {
      const lastRoom = nextProfile.joinedRooms[nextProfile.joinedRooms.length - 1];
      try {
        const authHeader = await getAuthHeader();
        const verifyRes = await fetch(`${API_BASE_URL}/rooms/${lastRoom.roomCode}/verify`, {
          headers: { "Content-Type": "application/json", ...authHeader },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData.room?.status === "active") {
            setActiveRoom(verifyData.room);
            await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(verifyData.room));
          }
        }
      } catch (err) { /* silent */ }
    }
  }, [authEnter, setThemeSettings, setTheme, setStoryModePreference, setActiveRoom, navigation]);

  if (loadingAuth) return <LoadingScreen theme={displayTheme} />;
  return <AuthScreen onEnter={handleEnter} loading={loadingAuth} theme={displayTheme} initialMode="login" />;
}

function SignupRoute({ navigation }) {
  const { displayTheme, setThemeSettings, setTheme, setStoryModePreference } = useTheme();
  const { setActiveRoom } = useRoom();
  const { profile, loadingAuth, handleEnter: authEnter } = useAuth();
  const navigated = useRef(false);

  useEffect(() => {
    if (loadingAuth || navigated.current) return;
    if (profile) {
      navigated.current = true;
      const target = profile.role === "admin" ? "AdminDashboard"
        : profile.role === "teacher" ? "TeacherDashboard"
        : "Dashboard";
      navigation.replace(target);
    }
  }, [profile, loadingAuth, navigation]);

  const handleEnter = useCallback(async (nextProfile) => {
    await authEnter(nextProfile);
    const nextThemeSettings = {
      ...{ appearanceMode: "system", autoRotate: true, selectedThemeName: "" },
      ...(nextProfile?.preferences?.themeSettings || {}),
    };
    setThemeSettings(nextThemeSettings);
    setTheme((current) =>
      nextThemeSettings.autoRotate
        ? getRandomTheme(current?.name)
        : getThemeByName(nextThemeSettings.selectedThemeName)
    );
    setStoryModePreference(nextProfile?.preferences?.storyModePreference || "random");

    const target = nextProfile?.role === "admin" ? "AdminDashboard"
      : nextProfile?.role === "teacher" ? "TeacherDashboard"
      : "Dashboard";
    if (!navigated.current) { navigated.current = true; navigation.replace(target); }
  }, [authEnter, setThemeSettings, setTheme, setStoryModePreference, navigation]);

  if (loadingAuth) return <LoadingScreen theme={displayTheme} />;
  return <AuthScreen onEnter={handleEnter} loading={loadingAuth} theme={displayTheme} initialMode="signup" />;
}

function AuthRoute({ navigation }) {
  const { displayTheme } = useTheme();
  const { loadingAuth } = useAuth();
  return <LoginRoute navigation={navigation} />;
}

/* ───────── Student Routes ───────── */
function DashboardRoute({ navigation, route }) {
  const { profile, loadingAuth, handleLogout: authLogout, setProfile, handleSaveFeedback, handleFetchFeedbackHistory, handleDeleteFeedback, handleRemoveRoomHistory, handleRefreshProfile } = useAuth();
  const { displayTheme, themeSettings, handleThemeSettingsChange, storyModePreference, handleStoryModePreferenceChange } = useTheme();
  const { activeRoom, setActiveRoom, joiningRoom, setJoiningRoom, handleLeaveRoom, handleOpenStoryMode, setAnimationReview, setSelectedRoomForDetail } = useRoom();

  useEffect(() => {
    if (loadingAuth) return;
    if (!profile) navigation.replace('Login');
    else if (profile.role !== 'student') {
      if (profile.role === 'admin') navigation.replace('AdminDashboard');
      else if (profile.role === 'teacher') navigation.replace('TeacherDashboard');
    }
  }, [profile, loadingAuth]);
  if (!profile || profile.role !== 'student') return null;

  const handleLogout = useCallback(async () => {
    await authLogout(); setActiveRoom(null); navigation.replace('Login');
  }, [authLogout, setActiveRoom, navigation]);

  const handleJoinRoom = useCallback(async (roomCode) => {
    if (!profile?.id) return { ok: false, message: "Please log in first" };
    setJoiningRoom(true);
    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/users/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ roomCode }),
      });
      const data = await response.json();
      if (response.ok) {
        setProfile((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          if (!next.joinedRooms) next.joinedRooms = [];
          if (!next.joinedRooms.some(r => r.roomCode === data.room.roomCode)) {
            next.joinedRooms.push({ roomCode: data.room.roomCode, roomName: data.room.roomName, joinedAt: new Date().toISOString() });
            AsyncStorage.setItem("storyverse-session", JSON.stringify(next));
          }
          return next;
        });
        setActiveRoom(data.room);
        await AsyncStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(data.room));
        return { ok: true, message: `Joined ${data.room.roomName}` };
      } else return { ok: false, message: data.message || "Failed to join room" };
    } catch (error) { return { ok: false, message: "Connection error." }; }
    finally { setJoiningRoom(false); }
  }, [profile?.id, setJoiningRoom, setProfile, setActiveRoom]);

  const handleSaveFeedbackWrap = useCallback(async (payload) => {
    return await handleSaveFeedback({ ...payload, roomCode: activeRoom?.roomCode || "", roomName: activeRoom?.roomName || "" });
  }, [handleSaveFeedback, activeRoom?.roomCode, activeRoom?.roomName]);

  return (
    <DashboardScreen
      profile={profile} activeRoom={activeRoom}
      onJoinRoom={handleJoinRoom} onLeaveRoom={handleLeaveRoom}
      onViewPrivacy={() => navigation.navigate('Privacy')}
      joiningRoom={joiningRoom} onLogout={handleLogout}
      onOpenStoryMode={(storyId, autoStart) => { handleOpenStoryMode(storyId, autoStart); navigation.navigate('Story'); }}
      onOpenSelfieFeedback={() => navigation.navigate('Selfie')}
      onSaveFeedback={handleSaveFeedbackWrap}
      onFetchFeedbackHistory={handleFetchFeedbackHistory}
      onDeleteFeedback={handleDeleteFeedback}
      onRemoveRoomHistory={handleRemoveRoomHistory}
      onOpenRoomDetail={(code) => { setSelectedRoomForDetail(code); navigation.navigate('StudentRoomDetail', { code }); }}
      onRefreshProfile={handleRefreshProfile}
      onNavigateToAnimation={(review) => { setAnimationReview(review); navigation.navigate('Animation'); }}
      storyModePreference={storyModePreference}
      onStoryModePreferenceChange={handleStoryModePreferenceChange}
      theme={displayTheme} themeSettings={themeSettings}
      onThemeSettingsChange={handleThemeSettingsChange}
      initialSideMenuScreen={route.params?.panel}
      onSideMenuScreenChange={useCallback((screen) => {
        if (screen && screen !== 'main') {
          navigation.setParams({ panel: screen });
        } else {
          navigation.setParams({ panel: undefined });
        }
      }, [navigation])}
    />
  );
}

function SelfieRoute({ navigation }) {
  const { handleSaveFeedback } = useAuth();
  const { displayTheme } = useTheme();
  const { activeRoom, setAnimationReview } = useRoom();
  const handleSaveFeedbackWrap = useCallback(async (payload) => {
    return await handleSaveFeedback({ ...payload, roomCode: activeRoom?.roomCode || "", roomName: activeRoom?.roomName || "" });
  }, [handleSaveFeedback, activeRoom?.roomCode, activeRoom?.roomName]);

  return (
    <SelfieFeedbackScreen
      onBack={() => navigation.goBack()}
      onSaveFeedback={handleSaveFeedbackWrap}
      onNavigateToAnimation={(review) => { setAnimationReview(review); navigation.replace('Animation'); }}
      theme={displayTheme}
    />
  );
}

function StoryRoute({ navigation }) {
  const { profile, handleSaveFeedback } = useAuth();
  const { displayTheme, themeSettings, handleThemeSettingsChange } = useTheme();
  const { activeRoom, storyLaunch } = useRoom();
  const handleSaveFeedbackWrap = useCallback(async (payload) => {
    return await handleSaveFeedback({ ...payload, roomCode: activeRoom?.roomCode || "", roomName: activeRoom?.roomName || "" });
  }, [handleSaveFeedback, activeRoom?.roomCode, activeRoom?.roomName]);

  return (
    <StoryExperience
      profile={profile} activeRoom={activeRoom}
      onBack={() => navigation.goBack()}
      onSaveFeedback={handleSaveFeedbackWrap}
      theme={displayTheme} themeSettings={themeSettings}
      onThemeSettingsChange={handleThemeSettingsChange}
      initialStoryId={storyLaunch.storyId}
      autoStartToken={storyLaunch.autoStartToken}
    />
  );
}

function AnimationRoute({ navigation }) {
  const { displayTheme } = useTheme();
  const { animationReview, setAnimationReview } = useRoom();
  const { profile } = useAuth();
  useEffect(() => { if (!animationReview) navigation.replace('Dashboard'); }, []);

  if (!animationReview) return null;

  return (
    <FeedbackAnimationScreen
      review={animationReview}
      onDone={() => { setAnimationReview(null); navigation.replace('Dashboard'); }}
      theme={displayTheme}
    />
  );
}

function StudentRoomDetailRoute({ navigation, route }) {
  const { profile } = useAuth();
  const { displayTheme } = useTheme();
  const { activeRoom, selectedRoomForDetail, handleJoinRoom } = useRoom();
  const code = route.params?.code;

  return (
    <StudentRoomDetailScreen
      roomCode={selectedRoomForDetail || code}
      profileEmail={profile?.email}
      theme={displayTheme}
      isActiveSession={activeRoom?.roomCode === (selectedRoomForDetail || code)}
      onJoinRoom={handleJoinRoom}
      onBack={() => navigation.goBack()}
    />
  );
}

/* ───────── Teacher Routes ───────── */
function TeacherDashboardRoute({ navigation }) {
  const { profile, loadingAuth, handleLogout: authLogout, handleRemoveTeacherRoomHistory, handleRefreshProfile } = useAuth();
  const { displayTheme, themeSettings, handleThemeSettingsChange } = useTheme();
  const { setSelectedRoomCode, setEditingRoomData, setActiveRoom } = useRoom();

  useEffect(() => {
    if (loadingAuth) return;
    if (!profile) navigation.replace('Login');
    else if (profile.role !== 'teacher') {
      if (profile.role === 'admin') navigation.replace('AdminDashboard');
      else navigation.replace('Dashboard');
    }
  }, [profile, loadingAuth]);
  if (!profile || profile.role !== 'teacher') return null;

  const handleLogout = useCallback(async () => {
    await authLogout(); setActiveRoom(null); navigation.replace('Login');
  }, [authLogout, setActiveRoom, navigation]);

  return (
    <TeacherDashboard
      profile={profile} onLogout={handleLogout}
      onCreateRoom={() => { setEditingRoomData(null); navigation.navigate('CreateRoom'); }}
      onOpenRoom={(roomCode) => { setSelectedRoomCode(roomCode); navigation.navigate('TeacherRoomDetail', { code: roomCode }); }}
      onEditRoom={(room) => { setEditingRoomData(room); navigation.navigate('EditRoom', { code: room.roomCode }); }}
      onViewClips={() => navigation.navigate('Clips')}
      onViewPrivacy={() => navigation.navigate('TeacherPrivacy')}
      onRemoveRoomHistory={handleRemoveTeacherRoomHistory}
      onRefreshProfile={handleRefreshProfile}
      theme={displayTheme} themeSettings={themeSettings}
      onThemeSettingsChange={handleThemeSettingsChange}
    />
  );
}

function CreateRoomRoute({ navigation }) {
  const { displayTheme } = useTheme();
  return (
    <RoomFormScreen
      onBack={() => navigation.goBack()}
      theme={displayTheme}
      onSave={async (formData) => {
        try {
          const res = await fetch(`${API_BASE_URL}/rooms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
            body: JSON.stringify(formData),
          });
          if (res.ok) navigation.goBack();
          else alert("Failed to create room");
        } catch (err) { alert("Network error"); }
      }}
    />
  );
}

function TeacherRoomDetailRoute({ navigation, route }) {
  const { displayTheme } = useTheme();
  const { selectedRoomCode, setSelectedRoomCode } = useRoom();
  const code = route.params?.code;
  return (
    <RoomDetailScreen
      room={{ roomCode: selectedRoomCode || code }}
      onBack={() => { setSelectedRoomCode(null); navigation.goBack(); }}
      theme={displayTheme}
    />
  );
}

function EditRoomRoute({ navigation }) {
  const { displayTheme } = useTheme();
  const { editingRoomData, setEditingRoomData } = useRoom();
  useEffect(() => { if (!editingRoomData) navigation.goBack(); }, []);
  if (!editingRoomData) return null;
  return (
    <RoomFormScreen
      onBack={() => { setEditingRoomData(null); navigation.goBack(); }}
      theme={displayTheme} initialData={editingRoomData}
      onSave={async (formData) => {
        try {
          const res = await fetch(`${API_BASE_URL}/rooms/${editingRoomData.roomCode}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
            body: JSON.stringify(formData),
          });
          if (res.ok) { setEditingRoomData(null); navigation.goBack(); }
          else alert("Failed to update room");
        } catch (err) { alert("Network error"); }
      }}
    />
  );
}

function ClipsRoute({ navigation }) {
  const { profile } = useAuth();
  const { displayTheme } = useTheme();
  return (
    <MyClipsScreen
      profile={profile} theme={displayTheme}
      onBack={() => navigation.goBack()}
      onGoToUpload={() => navigation.navigate('Upload')}
    />
  );
}

function UploadRoute({ navigation }) {
  const { profile } = useAuth();
  const { displayTheme } = useTheme();
  return (
    <UploadStoryScreen
      profile={profile} theme={displayTheme}
      onBack={() => navigation.goBack()}
      onUploadSuccess={() => {}}
    />
  );
}

/* ───────── Admin Routes ───────── */
function AdminDashboardRoute({ navigation }) {
  const { profile, loadingAuth, handleLogout: authLogout } = useAuth();
  const { displayTheme, themeSettings, handleThemeSettingsChange } = useTheme();
  const { setActiveRoom } = useRoom();

  useEffect(() => {
    if (loadingAuth) return;
    if (!profile) navigation.replace('Login');
    else if (profile.role !== 'admin') {
      if (profile.role === 'teacher') navigation.replace('TeacherDashboard');
      else navigation.replace('Dashboard');
    }
  }, [profile, loadingAuth]);
  if (!profile || profile.role !== 'admin') return null;

  const handleLogout = useCallback(async () => {
    await authLogout(); setActiveRoom(null); navigation.replace('Login');
  }, [authLogout, setActiveRoom, navigation]);

  return (
    <AdminDashboardScreen
      profile={profile} theme={displayTheme}
      onLogout={handleLogout}
      onViewClips={() => navigation.navigate('AdminClips')}
      onViewPrivacy={() => navigation.navigate('AdminPrivacy')}
      themeSettings={themeSettings}
      onThemeSettingsChange={handleThemeSettingsChange}
    />
  );
}

function AdminClipsRoute({ navigation }) {
  const { profile } = useAuth();
  const { displayTheme } = useTheme();
  return (
    <MyClipsScreen
      profile={profile} theme={displayTheme}
      onBack={() => navigation.goBack()}
      onGoToUpload={() => navigation.navigate('AdminUpload')}
    />
  );
}

function AdminUploadRoute({ navigation }) {
  const { profile } = useAuth();
  const { displayTheme } = useTheme();
  return (
    <UploadStoryScreen
      profile={profile} theme={displayTheme}
      onBack={() => navigation.goBack()}
      onUploadSuccess={() => {}}
    />
  );
}

/* ───────── Common Routes ───────── */
function PrivacyRoute({ navigation }) {
  const { profile } = useAuth();
  const { displayTheme } = useTheme();
  const handleBack = useCallback(() => {
    if (!profile) navigation.replace('Login');
    else if (profile?.role === "admin") navigation.replace('AdminDashboard');
    else if (profile?.role === "teacher") navigation.replace('TeacherDashboard');
    else navigation.replace('Dashboard');
  }, [profile, navigation]);
  return <PrivacyPolicyScreen onBack={handleBack} theme={displayTheme} />;
}

/* ───────── Root Navigator ───────── */
function RootNavigator() {
  const { showIntro, setShowIntro, displayTheme } = useTheme();
  const { loadingAuth } = useAuth();
  if (showIntro || loadingAuth) {
    return <WelcomeAnimation theme={displayTheme} onComplete={() => setShowIntro(false)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: displayTheme?.background || '#07111f' }}>
      <NavigationContainer
        linking={{ enabled: Platform.OS === 'web', config: { screens: screensConfig } }}
        documentTitle={{ enabled: true, formatter: (opts, route) => `${opts?.title || route.name} - FeedbackYantra` }}
        theme={{
          colors: {
            background: displayTheme?.background || '#07111f',
            card: displayTheme?.panel || '#0f1a2e',
            text: displayTheme?.textPrimary || '#fff',
            primary: displayTheme?.accent || '#4f46e5',
            border: displayTheme?.inputBorder || '#1e2d4a',
            notification: displayTheme?.accent || '#4f46e5',
          },
          dark: displayTheme?.mode !== 'light',
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="Login" component={LoginRoute} options={{ title: 'Login' }} />
          <Stack.Screen name="Signup" component={SignupRoute} options={{ title: 'Sign Up' }} />
          <Stack.Screen name="Auth" component={AuthRoute} options={{ title: 'Auth' }} />
          <Stack.Screen name="Dashboard" component={DashboardRoute} options={{ title: 'Dashboard' }} />
          <Stack.Screen name="Selfie" component={SelfieRoute} options={{ title: 'Selfie Feedback' }} />
          <Stack.Screen name="Story" component={StoryRoute} options={{ title: 'Story Mode' }} />
          <Stack.Screen name="Animation" component={AnimationRoute} options={{ title: 'Feedback' }} />
          <Stack.Screen name="StudentRoomDetail" component={StudentRoomDetailRoute} options={{ title: 'Room' }} />
          <Stack.Screen name="Privacy" component={PrivacyRoute} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="TeacherPrivacy" component={PrivacyRoute} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="AdminPrivacy" component={PrivacyRoute} options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="TeacherDashboard" component={TeacherDashboardRoute} options={{ title: 'Teacher' }} />
          <Stack.Screen name="CreateRoom" component={CreateRoomRoute} options={{ title: 'Create Room' }} />
          <Stack.Screen name="TeacherRoomDetail" component={TeacherRoomDetailRoute} options={{ title: 'Room Details' }} />
          <Stack.Screen name="EditRoom" component={EditRoomRoute} options={{ title: 'Edit Room' }} />
          <Stack.Screen name="Clips" component={ClipsRoute} options={{ title: 'My Clips' }} />
          <Stack.Screen name="Upload" component={UploadRoute} options={{ title: 'Upload Story' }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardRoute} options={{ title: 'Admin' }} />
          <Stack.Screen name="AdminClips" component={AdminClipsRoute} options={{ title: 'All Clips' }} />
          <Stack.Screen name="AdminUpload" component={AdminUploadRoute} options={{ title: 'Upload Story' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function AppRoutes() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <RoomProvider>
            <RootNavigator />
          </RoomProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
