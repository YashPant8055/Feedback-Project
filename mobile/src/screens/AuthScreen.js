import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, ScrollView, TextInput, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Svg, { Path } from 'react-native-svg';
import styles from '../styles/globalStyles';
import { API_BASE_URL } from '../constants/config.js';
import { saveSession } from '../utils/auth';
import { registerForPushNotificationsAsync } from '../utils/notifications';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch (_e) {}

export default function AuthScreen({ onEnter, loading, theme, initialMode }) {
  const [mode, setMode] = useState(initialMode || "login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [role, setRole] = useState("student");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [otpLoginMode, setOtpLoginMode] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 1080;

  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const isNativeGoogleSignIn = Platform.OS === "android";
  const hasGoogleClientId = Boolean(googleWebClientId);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId,
    androidClientId: googleAndroidClientId || "",
    selectAccount: true,
    redirectUri: Platform.OS === 'web' ? window.location.origin : undefined,
  });

  const canStartGoogle = isNativeGoogleSignIn
    ? hasGoogleClientId
    : Boolean(hasGoogleClientId && request);

  useEffect(() => {
    if (isNativeGoogleSignIn && googleWebClientId) {
      GoogleSignin.configure({
        webClientId: googleWebClientId,
        offlineAccess: false,
      });
    }
  }, [googleWebClientId, isNativeGoogleSignIn]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken =
        response.authentication?.idToken || response.params?.id_token;

      if (idToken) {
        handleGoogleLogin(idToken);
      } else {
        setMessage("Google Sign-In completed, but no ID token was returned.");
      }
    } else if (response?.type === 'error') {
      setMessage("Google Sign-In failed: " + (response.error?.message || "Unknown error"));
    }
  }, [response]);

  const handleGoogleLogin = async (idToken) => {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Google authentication failed.");
        setSubmitting(false);
        return;
      }

      if (data.pending) {
        setMessage(data.message || "Your registration is pending approval.");
        setSubmitting(false);
        return;
      }

      await saveSession(data.user, data.token);

      if (Platform.OS !== 'web') {
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await fetch(`${API_BASE_URL}/users/push-token`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.token}`
              },
              body: JSON.stringify({ pushToken }),
            });
          }
        } catch (pushErr) {
          console.warn("[AUTH] Failed to register push token:", pushErr.message);
        }
      }

      setSubmitting(false);
      onEnter(data.user);
    } catch (error) {
      setMessage("Connection error: " + error.message);
      setSubmitting(false);
    }
  };

  const handleGooglePress = async () => {
    if (!hasGoogleClientId) {
      setMessage("Google web client ID is missing in mobile/.env.");
      return;
    }

    if (!isNativeGoogleSignIn) {
      promptAsync({
        windowFeatures: {
          width: 500,
          height: 600,
        },
      });
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResponse = await GoogleSignin.signIn();

      if (signInResponse.type === "cancelled") {
        setSubmitting(false);
        return;
      }

      const idToken =
        signInResponse.data?.idToken || (await GoogleSignin.getTokens()).idToken;

      if (!idToken) {
        setMessage("Google Sign-In completed, but no ID token was returned.");
        setSubmitting(false);
        return;
      }

      await handleGoogleLogin(idToken);
    } catch (error) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        setSubmitting(false);
        return;
      }

      const developerError =
        error?.code === "10" ||
        error?.code === "DEVELOPER_ERROR" ||
        String(error?.message || "").includes("DEVELOPER_ERROR");

      setMessage(
        developerError
          ? "Google setup error: add this EAS build SHA-1 to the Android OAuth client in Google Cloud."
          : "Google Sign-In failed: " + (error?.message || "Unknown error")
      );
      setSubmitting(false);
    }
  };

  const isOtpLogin = mode === "login" && otpLoginMode;
  const heading =
    mode === "verify"
      ? "Verify your email"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "reset"
          ? "Enter your code"
          : isOtpLogin
            ? "Login with code"
            : mode === "login"
              ? "Step back into the story lab"
              : "Build your story room";
  const subheading =
    mode === "verify"
      ? "Enter the 6-digit code sent to your Gmail inbox."
      : mode === "forgot"
        ? "Enter your account email and we will send a password reset code."
        : mode === "reset"
          ? "Use the code from Gmail and choose a new password."
          : isOtpLogin
            ? "Enter your email to receive a login code. No password needed."
            : mode === "login"
              ? "Sign in to continue your classroom simulations across web and mobile."
              : "Create your account to unlock immersive feedback stories and future progress tracking.";

  const buttonLabel =
    mode === "verify"
      ? "Verify Email"
      : mode === "forgot"
        ? "Send Code"
        : mode === "reset"
          ? "Reset Password"
          : isOtpLogin && form.email && !otp
            ? "Send Code"
            : isOtpLogin
              ? "Login"
              : mode === "login"
                ? "Login"
                : "Create Account";

  const handleChange = (field, value) => {
    setMessage("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const enterVerificationMode = (email, nextMessage) => {
    setVerificationEmail(email || form.email.trim().toLowerCase());
    setOtp("");
    setMode("verify");
    setMessage(nextMessage || "Enter the verification code sent to your email.");
  };

  const finishAuth = async (data) => {
    await saveSession(data.user, data.token);

    if (Platform.OS !== 'web') {
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken) {
          await fetch(`${API_BASE_URL}/users/push-token`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${data.token}`
            },
            body: JSON.stringify({ pushToken }),
          });
        }
      } catch (pushErr) {
        console.warn("[AUTH] Failed to register push token:", pushErr.message);
      }
    }

    onEnter(data.user);
  };

  const postAuthRequest = async (url, body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return { response, data };
  };

  const handleVerifyEmail = async () => {
    const email = (verificationEmail || form.email).trim().toLowerCase();
    const code = otp.trim();

    if (!email || !code) {
      setMessage("Enter email and verification code.");
      return;
    }

    setSubmitting(true);
    try {
      const { response, data } = await postAuthRequest(`${API_BASE_URL}/auth/verify-email`, {
        email,
        otp: code,
      });

      if (!response.ok) {
        setMessage(data.message || "Verification failed.");
        setSubmitting(false);
        return;
      }

      if (data.pending) {
        setMessage(data.message || "Email verified. Please wait for admin approval.");
        setSubmitting(false);
        setMode("login");
        return;
      }

      await finishAuth(data);
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const email = (verificationEmail || form.email).trim().toLowerCase();
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }

    setSubmitting(true);
    try {
      const { response, data } = await postAuthRequest(`${API_BASE_URL}/auth/resend-verification`, {
        email,
      });
      setMessage(data.message || (response.ok ? "Code sent." : "Could not send code."));
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = (mode === "reset" ? verificationEmail : form.email).trim().toLowerCase();
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }

    setSubmitting(true);
    try {
      const { response, data } = await postAuthRequest(`${API_BASE_URL}/auth/forgot-password`, {
        email,
      });

      if (!response.ok) {
        setMessage(data.message || "Could not send reset code.");
        setSubmitting(false);
        return;
      }

      setVerificationEmail(data.email || email);
      setOtp("");
      setResetPassword("");
      setMode("reset");
      setMessage(data.message || "Password reset code sent.");
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    const email = (verificationEmail || form.email).trim().toLowerCase();
    const code = otp.trim();
    const password = resetPassword.trim();

    if (!email || !code || !password) {
      setMessage("Enter email, code, and new password.");
      return;
    }

    setSubmitting(true);
    try {
      const { response, data } = await postAuthRequest(`${API_BASE_URL}/auth/reset-password`, {
        email,
        otp: code,
        password,
      });

      if (!response.ok) {
        setMessage(data.message || "Password reset failed.");
        setSubmitting(false);
        return;
      }

      if (data.pending) {
        setMessage(data.message || "Password reset. Please wait for admin approval.");
        setSubmitting(false);
        setMode("login");
        return;
      }

      await finishAuth(data);
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendLoginOtp = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }
    setSubmitting(true);
    try {
      const { response, data } = await postAuthRequest(`${API_BASE_URL}/auth/send-login-otp`, { email });
      if (!response.ok) {
        setMessage(data.message || "Could not send login code.");
        setSubmitting(false);
        return;
      }
      setVerificationEmail(data.email || email);
      setMessage(data.message || "Login code sent to your email.");
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyLoginOtp = async () => {
    const email = (verificationEmail || form.email).trim().toLowerCase();
    const code = otp.trim();
    if (!email || !code) {
      setMessage("Enter email and login code.");
      return;
    }
    setSubmitting(true);
    try {
      const { response, data } = await postAuthRequest(`${API_BASE_URL}/auth/verify-login-otp`, {
        email,
        otp: code,
      });
      if (!response.ok) {
        setMessage(data.message || "Invalid or expired code.");
        setSubmitting(false);
        return;
      }
      await finishAuth(data);
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (loading || submitting) {
      return;
    }

    if (mode === "verify") {
      await handleVerifyEmail();
      return;
    }

    if (mode === "forgot") {
      await handleForgotPassword();
      return;
    }

    if (mode === "reset") {
      await handleResetPassword();
      return;
    }

    if (isOtpLogin) {
      if (!otp) {
        await handleSendLoginOtp();
      } else {
        await handleVerifyLoginOtp();
      }
      return;
    }

    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();
    const name =
      form.name.trim() || form.email.split("@")[0] || "Story Explorer";

    if (!email || !password) {
      setMessage("Enter email and password first.");
      return;
    }

    if (mode === "signup" && !form.name.trim()) {
      setMessage("Enter your name for signup.");
      return;
    }

    setSubmitting(true);

    try {
      const url = mode === "signup" ? `${API_BASE_URL}/auth/signup` : `${API_BASE_URL}/auth/login`;
      const body = mode === "signup"
        ? { name, email, password, role }
        : { email, password };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

const data = await response.json();

      if (!response.ok) {
        if (data.pendingVerification) {
          enterVerificationMode(data.email || email, data.message);
          setSubmitting(false);
          return;
        }
        setMessage(data.message || `${mode} failed.`);
        setSubmitting(false);
        return;
      }

      if (data.pendingVerification) {
        enterVerificationMode(data.email || email, data.message);
        setSubmitting(false);
        return;
      }

      // Check if teacher registration is pending approval
      if (data.pending) {
        setMessage(data.message || "Your registration request has been sent. Please wait for admin approval.");
        setSubmitting(false);
        setForm({ name: "", email: "", password: "" });
        return;
      }

// Save session with JWT
      await saveSession(data.user, data.token);

      // Register for Push Notifications (Native Only)
      if (Platform.OS !== 'web') {
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await fetch(`${API_BASE_URL}/users/push-token`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.token}`
              },
              body: JSON.stringify({ pushToken }),
            });
            // console.log("[AUTH] Registered push token on backend");
          }
        } catch (pushErr) {
          console.warn("[AUTH] Failed to register push token:", pushErr.message);
        }
      }

      setForm({ name: "", email: "", password: "" });
      setSubmitting(false);
      onEnter(data.user);
    } catch (error) {
      setMessage("Connection error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.authRoot, { backgroundColor: theme.background }]}>
      <View
        pointerEvents="none"
        style={[styles.authBackdrop, { backgroundColor: theme.background }]}
      >
        <View style={[styles.orbOne, { backgroundColor: theme.glowOne }]} />
        <View style={[styles.orbTwo, { backgroundColor: theme.glowTwo }]} />
        <View style={[styles.orbThree, { backgroundColor: theme.accentSoft }]} />
        <View style={styles.gridGlow} />
      </View>

      <ScrollView
        style={styles.authScroll}
        contentContainerStyle={[
          styles.authLayout,
          isWide ? styles.authLayoutWide : styles.authLayoutStack,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.heroColumn, isWide && styles.heroColumnWide]}>
          <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>
            Give Feedback in Interesting Ways.
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>
            Why settle for boring surveys? Share your thoughts through quick
            mood emojis, AI-driven emotion detection, and immersive interactive
            stories that make every feedback session more engaging.
          </Text>

          <View style={styles.heroStats}>
            <View style={[styles.statCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
              <Text style={[styles.statNumber, { color: theme.textPrimary }]}>Instant</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Emoji Moods</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
              <Text style={[styles.statNumber, { color: theme.textPrimary }]}>Expressive</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AI Selfie Detection</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
              <Text style={[styles.statNumber, { color: theme.textPrimary }]}>Dynamic</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Immersive Stories</Text>
            </View>
          </View>
        </View>

        <View style={styles.formScene}>
          <View pointerEvents="none" style={styles.cardShadowLayer} />
          <View
            pointerEvents="none"
            style={[styles.cardGlowLayer, { backgroundColor: theme.accentSoft }]}
          />
          <View style={[styles.authCard, { backgroundColor: theme.panel }]}>
            <View style={styles.authSwitch}>
              <Pressable
                style={[
                  styles.authSwitchButton,
                  mode === "login" && styles.authSwitchButtonActive,
                  mode === "login" && { backgroundColor: theme.secondary },
                ]}
                onPress={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                <Text
                  style={[
                    styles.authSwitchText,
                    mode === "login" && styles.authSwitchTextActive,
                  ]}
                >
                  Login
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.authSwitchButton,
                  mode === "signup" && styles.authSwitchButtonActive,
                  mode === "signup" && { backgroundColor: theme.secondary },
                ]}
                onPress={() => {
                  setMode("signup");
                  setOtpLoginMode(false);
                  setMessage("");
                }}
              >
                <Text
                  style={[
                    styles.authSwitchText,
                    mode === "signup" && styles.authSwitchTextActive,
                  ]}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.authHeading, { color: theme.textPrimary }]}>{heading}</Text>
            <Text style={[styles.authSubheading, { color: theme.textMuted }]}>
              {subheading}
            </Text>

            <View style={styles.formFields}>
              {mode === "signup" && (
                <View style={styles.inputWrap}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Full name
                  </Text>
                  <TextInput
                    value={form.name}
                    onChangeText={(value) => handleChange("name", value)}
                    placeholder="Yash Kumar"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.inputText,
                      },
                    ]}
                  />
                </View>
              )}

              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email</Text>
                <TextInput
                  value={mode === "verify" || mode === "reset" || (mode === "login" && otpLoginMode && otp) ? verificationEmail : form.email}
                  onChangeText={(value) => {
                    if (mode === "verify" || mode === "reset" || (mode === "login" && otpLoginMode)) {
                      setMessage("");
                      setVerificationEmail(value);
                    } else {
                      handleChange("email", value);
                    }
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                />
              </View>

              {(mode === "verify" || mode === "reset") && (
                <View style={styles.inputWrap}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Verification code
                  </Text>
                  <TextInput
                    value={otp}
                    onChangeText={(value) => {
                      setMessage("");
                      setOtp(value.replace(/[^0-9]/g, "").slice(0, 6));
                    }}
                    placeholder="123456"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.inputText,
                      },
                    ]}
                  />
                </View>
              )}

              {mode === "login" && isOtpLogin && (
                <View style={styles.inputWrap}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Login code
                  </Text>
                  <TextInput
                    value={otp}
                    onChangeText={(value) => {
                      setMessage("");
                      setOtp(value.replace(/[^0-9]/g, "").slice(0, 6));
                    }}
                    placeholder="123456"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.inputText,
                      },
                    ]}
                  />
                </View>
              )}

              {(mode === "login" || mode === "signup") && !isOtpLogin && (
              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Password
                </Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    value={form.password}
                    onChangeText={(value) => handleChange("password", value)}
                    placeholder="Enter password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showPassword}
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBackground,
                        borderColor: theme.inputBorder,
                        color: theme.inputText,
                        paddingRight: 52,
                      },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword((current) => !current)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 0,
                      bottom: 0,
                      width: 36,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Svg width="22" height="22" viewBox="0 0 24 24">
                      <Path
                        fill="none"
                        stroke={theme.textSecondary || "#9fb3ce"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={
                          showPassword
                            ? "M2 2l20 20M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 4.24A10.94 10.94 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-3.16 4.56M6.61 6.61C3.98 8.36 2 12 2 12s3 8 10 8a10.84 10.84 0 005.39-1.39"
                            : "M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8zM12 9a3 3 0 100 6 3 3 0 000-6z"
                        }
                      />
                    </Svg>
                  </Pressable>
                </View>
                {mode === "login" && (
                  <Pressable
                    onPress={() => {
                      setVerificationEmail(form.email.trim().toLowerCase());
                      setMode("forgot");
                      setMessage("");
                    }}
                    style={{ alignSelf: "flex-end", paddingVertical: 4 }}
                  >
                    <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "800" }}>
                      Forgot password?
                    </Text>
                  </Pressable>
                )}
              </View>
              )}

              {mode === "reset" && (
                <View style={styles.inputWrap}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    New password
                  </Text>
                  <View style={{ position: "relative" }}>
                    <TextInput
                      value={resetPassword}
                      onChangeText={(value) => {
                        setMessage("");
                        setResetPassword(value);
                      }}
                      placeholder="Enter new password"
                      placeholderTextColor={theme.textMuted}
                      secureTextEntry={!showNewPassword}
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          color: theme.inputText,
                          paddingRight: 52,
                        },
                      ]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showNewPassword ? "Hide new password" : "Show new password"}
                      onPress={() => setShowNewPassword((current) => !current)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: 0,
                        bottom: 0,
                        width: 36,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Svg width="22" height="22" viewBox="0 0 24 24">
                        <Path
                          fill="none"
                          stroke={theme.textSecondary || "#9fb3ce"}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={
                            showNewPassword
                              ? "M2 2l20 20M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 4.24A10.94 10.94 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-3.16 4.56M6.61 6.61C3.98 8.36 2 12 2 12s3 8 10 8a10.84 10.84 0 005.39-1.39"
                              : "M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8zM12 9a3 3 0 100 6 3 3 0 000-6z"
                          }
                        />
                      </Svg>
                    </Pressable>
                  </View>
                </View>
              )}

              {mode === "signup" && (
                <View style={styles.inputWrap}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    I am a...
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      style={[
                        {
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingVertical: 14,
                          borderRadius: 16,
                          borderWidth: 1.5,
                          backgroundColor:
                            role === "teacher"
                              ? theme.accentSoft
                              : theme.inputBackground,
                          borderColor:
                            role === "teacher"
                              ? theme.accent
                              : theme.inputBorder,
                        },
                      ]}
                      onPress={() => setRole("teacher")}
                    >
                      <Text style={{ fontSize: 20 }}>👨‍🏫</Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: role === "teacher" ? theme.accent : theme.textSecondary,
                        }}
                      >
                        Teacher
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        {
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingVertical: 14,
                          borderRadius: 16,
                          borderWidth: 1.5,
                          backgroundColor:
                            role === "student"
                              ? theme.accentSoft
                              : theme.inputBackground,
                          borderColor:
                            role === "student"
                              ? theme.accent
                              : theme.inputBorder,
                        },
                      ]}
                      onPress={() => setRole("student")}
                    >
                      <Text style={{ fontSize: 20 }}>👨‍🎓</Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: role === "student" ? theme.accent : theme.textSecondary,
                        }}
                      >
                        Student
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {mode === "login" && (
              <Pressable
                onPress={() => {
                  setOtpLoginMode((prev) => !prev);
                  setOtp("");
                  setMessage("");
                }}
                style={{ alignSelf: "center", paddingVertical: 6 }}
              >
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "800" }}>
                  {isOtpLogin ? "Login with password instead" : "Login with code instead"}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.authPrimaryButton, { backgroundColor: theme.accent }]}
              onPress={handleSubmit}
            >
              <Text style={[styles.authPrimaryButtonText, { color: theme.onAccent }]}>
                {submitting ? "Please wait..." : buttonLabel}
              </Text>
            </Pressable>

            {(mode === "verify" || mode === "reset" || (mode === "login" && otpLoginMode && !!otp)) && (
              <Pressable
                disabled={submitting}
                onPress={mode === "verify" ? handleResendVerification : mode === "reset" ? handleForgotPassword : handleSendLoginOtp}
                style={{ alignItems: "center", paddingVertical: 12 }}
              >
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "800" }}>
                  Resend code
                </Text>
              </Pressable>
            )}

            {(mode === "forgot" || mode === "verify" || mode === "reset") && (
              <Pressable
                disabled={submitting}
                onPress={() => {
                  setMode("login");
                  setMessage("");
                }}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: "800" }}>
                  Back to login
                </Text>
              </Pressable>
            )}

            {(mode === "login" || mode === "signup") && (
            <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 18 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.inputBorder || 'rgba(143, 200, 255, 0.18)', opacity: 0.5 }} />
              <Text style={{ marginHorizontal: 12, color: theme.textMuted || '#9fb3ce', fontSize: 13, fontWeight: '700' }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.inputBorder || 'rgba(143, 200, 255, 0.18)', opacity: 0.5 }} />
            </View>

            <Pressable
              disabled={!canStartGoogle || submitting}
              onPress={handleGooglePress}
              style={{ marginTop: 6 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    borderRadius: 20,
                    backgroundColor: pressed ? '#f5f5f5' : '#ffffff',
                    borderWidth: 1,
                    borderColor: '#e1e1e1',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(Platform.OS === 'android' ? { elevation: 3 } : {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }),
                  }}
                >
                  <View 
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      opacity: (!canStartGoogle || submitting) ? 0.5 : 1,
                    }}
                  >
                    <Svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
                      <Path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <Path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <Path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <Path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </Svg>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#1f1f1f',
                        fontSize: 14,
                        fontWeight: '600',
                      }}
                    >
                      {submitting ? "Connecting..." : "Continue with Google"}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
            </>
            )}

            {!!message && <Text style={[styles.authMessage, { color: theme.accent }]}>{message}</Text>}

            <Text style={[styles.authNote, { color: theme.noteText }]}>
              Secure encrypted session managed by StoryVerse Cloud.
            </Text>
          </View>
        </View>
      </ScrollView>
      <StatusBar hidden />
    </View>
  );
}
