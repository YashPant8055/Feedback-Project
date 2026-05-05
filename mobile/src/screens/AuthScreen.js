import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, ScrollView, TextInput, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../styles/globalStyles';
import { API_BASE_URL } from '../constants/config.js';
import { saveSession } from '../utils/auth';
import { registerForPushNotificationsAsync } from '../utils/notifications';

export default function AuthScreen({ onEnter, loading, theme }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [role, setRole] = useState("student");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 1080;

  const heading =
    mode === "login" ? "Step back into the story lab" : "Build your story room";
  const subheading =
    mode === "login"
      ? "Sign in to continue your classroom simulations across web and mobile."
      : "Create your account to unlock immersive feedback stories and future progress tracking.";

  const buttonLabel = mode === "login" ? "Login" : "Create Account";

  const handleChange = (field, value) => {
    setMessage("");
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (loading || submitting) {
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
        setMessage(data.message || `${mode} failed.`);
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
                onPress={() => setMode("login")}
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
                onPress={() => setMode("signup")}
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
                  value={form.email}
                  onChangeText={(value) => handleChange("email", value)}
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

              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Password
                </Text>
                <TextInput
                  value={form.password}
                  onChangeText={(value) => handleChange("password", value)}
                  placeholder="Enter password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
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

            <Pressable
              style={[styles.authPrimaryButton, { backgroundColor: theme.accent }]}
              onPress={handleSubmit}
            >
              <Text style={[styles.authPrimaryButtonText, { color: theme.onAccent }]}>
                {submitting ? "Please wait..." : buttonLabel}
              </Text>
            </Pressable>

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
