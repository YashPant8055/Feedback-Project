import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformWebView } from '../components/WebViewPlatform';
import styles from '../styles/globalStyles';
import { EMOTION_EMOJI_MAP, FEEDBACK_CONFIG } from '../constants/emotions';
import { API_BASE_URL } from '../constants/config.js';
import { getSelfieEmotionHtml, mapEmotionToFeedback } from '../utils/emotionUtils';
import { showAlert } from '../utils/alertUtils';

export default function SelfieFeedbackScreen({ onBack, onSaveFeedback, onNavigateToAnimation, theme }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const webViewRef = useRef(null);
  const [webPermission, setWebPermission] = useState(false);
  const [capturedBase64, setCapturedBase64] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [emotionResult, setEmotionResult] = useState(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const insets = useSafeAreaInsets();

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setWebPermission(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      showAlert("Camera error", "Could not access web camera. Please check browser permissions.");
    }
  };

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (capturing) return;
    try {
      setCapturing(true);
      if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = videoRef.current.videoWidth || 480;
        canvasRef.current.height = videoRef.current.videoHeight || 640;
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedBase64(dataUrl.split(',')[1]);
      }
    } catch (_error) {
      showAlert("Camera error", "Could not take the photo. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  const analysisTimeoutRef = useRef(null);
  const handleAnalyzeEmotion = () => {
    if (!capturedBase64) return;
    setAnalyzing(true);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: "analyze", base64: capturedBase64 }));
      analysisTimeoutRef.current = setTimeout(() => {
        setAnalyzing(false);
        showAlert("Timeout", "Analysis took too long.");
      }, 30000);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") return;
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      setAnalyzing(false);
      if (data.ok && data.faceDetected) {
        const feedback = mapEmotionToFeedback(data.emotion);
        setEmotionResult({ ...data, feedback });
      } else {
        showAlert("Detection Failed", data.message || "No face detected.");
      }
    } catch (_e) { setAnalyzing(false); }
  };

  const handleSaveSelfieFeedback = async () => {
    if (!emotionResult) return;
    const feedbackLabel = FEEDBACK_CONFIG[emotionResult.feedback].label;
    const result = await onSaveFeedback({
      type: "selfie",
      emoji: emotionResult.emotion,
      emotion: emotionResult.emotion,
      review: emotionResult.feedback,
      message: `Feedback: ${feedbackLabel} detected via Selfie`,
      metadata: { ...emotionResult },
    });
    if (result.ok) onNavigateToAnimation(emotionResult.feedback);
  };

  const previewSource = capturedBase64 ? { uri: `data:image/jpeg;base64,${capturedBase64}` } : null;

  if (!webPermission) {
    return (
      <View style={[styles.selfieScreenRoot, { backgroundColor: theme.background, paddingTop: 100, alignItems: 'center' }]}>
        <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 20 }}>Web Camera Access</Text>
        <Pressable style={[styles.selfiePrimaryAction, { backgroundColor: theme.accent }]} onPress={requestPermission}>
          <Text style={{ color: theme.onAccent, fontWeight: '800' }}>Allow Camera</Text>
        </Pressable>
        <Pressable style={{ marginTop: 20 }} onPress={onBack}>
          <Text style={{ color: theme.textMuted }}>Go Back</Text>
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
          <>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} playsInline autoPlay />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}
      </View>

      <View style={[styles.selfieTopBar, { paddingTop: Math.max(insets.top, 20), backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Pressable onPress={onBack}><Text style={{ color: '#fff', padding: 10 }}>Back</Text></Pressable>
      </View>

      <View style={[styles.selfieControlPanel, { bottom: 40, backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, borderRadius: 20, margin: 20 }]}>
        {emotionResult ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>{EMOTION_EMOJI_MAP[emotionResult.emotion]}</Text>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{emotionResult.emotion.toUpperCase()}</Text>
            <Pressable style={{ backgroundColor: theme.accent, padding: 15, borderRadius: 10, marginTop: 10 }} onPress={handleSaveSelfieFeedback}>
              <Text style={{ color: '#fff' }}>Save Feedback</Text>
            </Pressable>
            <Pressable style={{ marginTop: 10 }} onPress={() => setCapturedBase64("")}><Text style={{ color: '#fff' }}>Retake</Text></Pressable>
          </View>
        ) : capturedBase64 ? (
          <View style={{ alignItems: 'center' }}>
            <Pressable style={{ backgroundColor: theme.accent, padding: 15, borderRadius: 10 }} onPress={handleAnalyzeEmotion}>
              {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Analyze Emotion</Text>}
            </Pressable>
            <Pressable style={{ marginTop: 10 }} onPress={() => setCapturedBase64("")}><Text style={{ color: '#fff' }}>Retake</Text></Pressable>
          </View>
        ) : (
          <Pressable style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', alignSelf: 'center', borderWidth: 5, borderColor: theme.accent }} onPress={handleCapture} />
        )}
      </View>

      <PlatformWebView ref={webViewRef} source={{ html: getSelfieEmotionHtml(API_BASE_URL) }} onMessage={handleWebViewMessage} style={{ position: 'absolute', top: -1000 }} />
    </View>
  );
}
