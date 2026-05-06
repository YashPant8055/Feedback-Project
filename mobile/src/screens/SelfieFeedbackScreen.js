import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, ActivityIndicator, BackHandler, Image, Platform, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoCamera from 'expo-camera';
import { PlatformWebView } from '../components/WebViewPlatform';
import styles from '../styles/globalStyles';
import { EMOTION_EMOJI_MAP, FEEDBACK_CONFIG } from '../constants/emotions';
import { API_BASE_URL } from '../constants/config.js';
import { getSelfieEmotionHtml, mapEmotionToFeedback } from '../utils/emotionUtils';
import { showAlert } from '../utils/alertUtils';

export default function SelfieFeedbackScreen({ onBack, onSaveFeedback, onNavigateToAnimation, theme }) {
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const webViewRef = useRef(null);
  
  // Safe permission hook that doesn't crash on web
  const nativePermissionHook = Platform.OS !== 'web' && ExpoCamera.useCameraPermissions ? ExpoCamera.useCameraPermissions : () => [null, null];
  const [nativePermission, requestNativePermission] = nativePermissionHook();
  const [webPermission, setWebPermission] = useState(false);
  
  const permission = Platform.OS === 'web' ? { granted: webPermission } : nativePermission;
  const requestPermission = Platform.OS === 'web' ? async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setWebPermission(true);
      // Wait for the component to re-render and mount the video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      showAlert("Camera error", "Could not access web camera. Please check browser permissions.");
    }
  } : requestNativePermission;

  const [capturedBase64, setCapturedBase64] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [emotionResult, setEmotionResult] = useState(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onBack();
        return true;
      }
    );

    return () => subscription.remove();
  }, [onBack]);

  // Clean up web camera stream on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const previewSource = capturedBase64
    ? { uri: `data:image/jpeg;base64,${capturedBase64}` }
    : null;

  const handleCapture = async () => {
    if (capturing) return;

    try {
      setCapturing(true);
      
      if (Platform.OS === 'web') {
        if (videoRef.current && canvasRef.current) {
          const context = canvasRef.current.getContext('2d');
          canvasRef.current.width = videoRef.current.videoWidth || 480;
          canvasRef.current.height = videoRef.current.videoHeight || 640;
          context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
          // Remove the "data:image/jpeg;base64," prefix for consistency
          setCapturedBase64(dataUrl.split(',')[1]);
        }
      } else {
        if (!cameraRef.current) return;
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.78,
          skipProcessing: false,
        });

        if (photo?.base64) {
          setCapturedBase64(photo.base64);
        } else {
          showAlert("Capture failed", "Could not capture the image as base64.");
        }
      }
    } catch (_error) {
      showAlert("Camera error", "Could not take the photo. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  const analysisTimeoutRef = useRef(null);

  const handleAnalyzeEmotion = () => {
    if (!capturedBase64) {
      showAlert("No selfie yet", "Capture a selfie before analyzing emotion.");
      return;
    }

    setAnalyzing(true);
    setEmotionResult(null);

    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({ type: "analyze", base64: capturedBase64 })
      );

      analysisTimeoutRef.current = setTimeout(() => {
        setAnalyzing((current) => {
          if (current) {
            showAlert(
              "Analysis Timed Out",
              "The emotion analyzer took too long. Please try again or retake the photo."
            );
            return false;
          }
          return current;
        });
      }, 30000);
    } else {
      setAnalyzing(false);
      showAlert("Not ready", "Emotion analyzer is still loading. Please wait a moment and try again.");
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "ready") {
        return;
      }

      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }

      setAnalyzing(false);

      if (data.ok && data.faceDetected) {
        const feedback = mapEmotionToFeedback(data.emotion);
        setEmotionResult({ ...data, feedback });
      } else {
        showAlert(
          "Detection Failed",
          data.message || "No face detected. Please retake your selfie with better lighting."
        );
      }
    } catch (_error) {
      setAnalyzing(false);
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = null;
      }
      showAlert("Error", "Failed to process emotion analysis result.");
    }
  };

  const handleSaveSelfieFeedback = async () => {
    if (!emotionResult) {
      return;
    }

    const feedbackLabel = FEEDBACK_CONFIG[emotionResult.feedback].label;

    const result = await onSaveFeedback({
      type: "selfie",
      emoji: emotionResult.emotion,
      emotion: emotionResult.emotion,
      review: emotionResult.feedback,
      message: `Feedback: ${feedbackLabel} — Detected emotion: ${emotionResult.emotion} (${Math.round(emotionResult.confidence * 100)}% confidence)`,
      metadata: {
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
        feedback: emotionResult.feedback,
        feedbackLabel,
        expressions: emotionResult.expressions,
      },
    });

    showAlert(
      result.ok ? "Saved!" : "Error",
      result.ok ? "Your selfie feedback has been saved." : result.message
    );

    if (result.ok) {
      onNavigateToAnimation(emotionResult.feedback);
    }
  };

  const handleRetake = () => {
    setCapturedBase64("");
    setEmotionResult(null);
    setAnalyzing(false);
    setIsPanelExpanded(true);
  };

  if (!permission) {
    return (
      <View style={[styles.selfieScreenRoot, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.selfieLoadingText, { color: theme.textPrimary }]}>
          Preparing camera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.selfieScreenRoot,
          styles.selfiePermissionRoot,
          { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) },
        ]}
      >
        <Text style={[styles.selfieScreenTitle, { color: theme.textPrimary }]}>
          Camera Permission
        </Text>
        <Text style={[styles.selfieScreenText, { color: theme.textMuted }]}>
          Allow camera access so Selfie Feedback can capture your expression.
        </Text>
        <Pressable
          style={[styles.selfiePrimaryAction, { backgroundColor: theme.accent }]}
          onPress={requestPermission}
        >
          <Text style={[styles.selfiePrimaryActionText, { color: theme.onAccent }]}>
            Allow Camera
          </Text>
        </Pressable>
        <Pressable style={styles.selfieGhostAction} onPress={onBack}>
          <Text style={[styles.selfieGhostActionText, { color: theme.textPrimary }]}>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.selfieScreenRoot, { backgroundColor: "#000" }]}>
      <View style={styles.selfieCameraShell}>
        {previewSource ? (
          <Image source={previewSource} style={styles.selfiePreviewImage} />
        ) : (
          Platform.OS === 'web' ? (
            <>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                playsInline
                autoPlay
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </>
          ) : (
            <ExpoCamera.Camera
              ref={cameraRef}
              style={styles.selfieCamera}
              type={ExpoCamera.CameraType.front}
            />
          )
        )}
      </View>

      <View style={[styles.selfieTopBar, { paddingTop: Math.max(insets.top, 18), backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Pressable style={styles.selfieBackButton} onPress={onBack}>
          <Text style={styles.selfieBackButtonText}>Back</Text>
        </Pressable>
        <View style={styles.selfieTopCopy}>
          <Text style={[styles.selfieTopEyebrow, { color: theme.accent }]}>
            Selfie Feedback
          </Text>
          <Text style={[styles.selfieTopTitle, { color: theme.textPrimary }]}>
            Capture your expression
          </Text>
        </View>
      </View>

        <View
          style={[
            styles.selfieControlPanel,
            {
              backgroundColor: "rgba(11, 22, 40, 0.85)",
              borderColor: "rgba(255,255,255,0.15)",
              bottom: Math.max(insets.bottom, 24),
              paddingTop: isPanelExpanded ? 24 : 12,
              paddingBottom: isPanelExpanded ? 24 : 16,
            },
          ]}
        >
          <Pressable
            style={styles.selfiePanelToggle}
            onPress={() => setIsPanelExpanded(!isPanelExpanded)}
            hitSlop={15}
          >
            <Text style={[styles.selfiePanelToggleText, { color: theme.textMuted }]}>
              {isPanelExpanded ? "▼ Hide Controls" : "▲ Show Controls"}
            </Text>
          </Pressable>

          {isPanelExpanded && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.selfieStatusTitle, { color: theme.textPrimary }]}>
                {emotionResult
                  ? "Emotion Detected!"
                  : capturedBase64
                    ? analyzing
                      ? "Analyzing..."
                      : "Selfie captured"
                    : "Ready for selfie"}
              </Text>
              <Text style={[styles.selfieStatusText, { color: theme.textMuted }]}>
                {emotionResult
                  ? "Your facial expression has been analyzed. Save your feedback or retake."
                  : capturedBase64
                    ? analyzing
                      ? "Please wait while we detect your expression..."
                      : "Preview looks good. Tap Analyze Emotion when you are ready."
                    : "Center your face in the frame and capture a clear photo."}
              </Text>

              {emotionResult ? (
                <>
                  <View style={[styles.emotionResultCard, { borderColor: theme.accent }]}>
                    <Text style={styles.emotionEmoji}>
                      {EMOTION_EMOJI_MAP[emotionResult.emotion] || "\u{1F914}"}
                    </Text>
                    <Text style={[styles.emotionLabel, { color: theme.textPrimary }]}>
                      {emotionResult.emotion}
                    </Text>
                    <Text style={[styles.emotionConfidence, { color: theme.textMuted }]}>
                      {Math.round(emotionResult.confidence * 100)}% confidence
                    </Text>
                    <View
                      style={[
                        styles.feedbackResultBanner,
                        { backgroundColor: FEEDBACK_CONFIG[emotionResult.feedback].bg },
                      ]}
                    >
                      <Text style={[styles.feedbackResultLabel, { color: theme.textMuted }]}>
                        Feedback:
                      </Text>
                      <Text
                        style={[
                          styles.feedbackResultValue,
                          { color: FEEDBACK_CONFIG[emotionResult.feedback].color },
                        ]}
                      >
                        {FEEDBACK_CONFIG[emotionResult.feedback].label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.selfieActionRow}>
                    <Pressable
                      style={styles.selfieSecondaryAction}
                      onPress={handleRetake}
                    >
                      <Text style={styles.selfieSecondaryActionText}>Retake</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.selfiePrimaryAction,
                        styles.selfieAnalyzeAction,
                        { backgroundColor: theme.accent },
                      ]}
                      onPress={handleSaveSelfieFeedback}
                    >
                      <Text style={[styles.selfiePrimaryActionText, { color: theme.onAccent }]}>
                        Save Feedback
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : capturedBase64 ? (
                <View style={styles.selfieActionRow}>
                  <Pressable
                    style={styles.selfieSecondaryAction}
                    onPress={handleRetake}
                  >
                    <Text style={styles.selfieSecondaryActionText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.selfiePrimaryAction,
                      styles.selfieAnalyzeAction,
                      { backgroundColor: theme.accent },
                    ]}
                    onPress={handleAnalyzeEmotion}
                  >
                    {analyzing ? (
                      <ActivityIndicator size="small" color={theme.onAccent} />
                    ) : (
                      <Text style={[styles.selfiePrimaryActionText, { color: theme.onAccent }]}>
                        Analyze Emotion
                      </Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.selfieCaptureButton,
                    capturing && styles.selfieCaptureButtonDisabled,
                  ]}
                  onPress={handleCapture}
                >
                  <View style={styles.selfieCaptureButtonInner} />
                </Pressable>
              )}
            </View>
          )}
        </View>

      <PlatformWebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: getSelfieEmotionHtml(API_BASE_URL) }}
        onMessage={handleWebViewMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn("WebView error:", nativeEvent);
        }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        mixedContentMode="always"
        style={{ position: "absolute", top: -1000, left: -1000, width: 300, height: 300, opacity: 0 }}
      />

      <StatusBar hidden />
    </View>
  );
}
