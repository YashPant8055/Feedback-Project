import React, { useState, useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, BackHandler, Platform, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { clips, questions } from "../constants/storyConstants";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import styles from '../styles/globalStyles';
import { API_BASE_URL } from '../constants/config.js';
import { showAlert } from '../utils/alertUtils';

export default function StoryExperience({
  profile,
  activeRoom,
  onBack,
  onSaveFeedback,
  initialStoryId = "story1",
  autoStartToken = 0,
}) {
    const { width, height } = useWindowDimensions();
    const [phase, setPhase] = useState("idle");
    const [answers, setAnswers] = useState({});
    const [outcome, setOutcome] = useState(null);
    const [outcomeReady, setOutcomeReady] = useState(false);
    const [storyId, setStoryId] = useState(initialStoryId);
    const [storyData, setStoryData] = useState(null);
    const [loadingStory, setLoadingStory] = useState(true);

    const [storyMenuOpen, setStoryMenuOpen] = useState(false);
    const insets = useSafeAreaInsets();

    // Inject CSS + resize listener on web to force video to fit viewport responsively
    useEffect(() => {
      if (Platform.OS !== 'web') return;

      // 1. Inject CSS
      const styleId = '__video-fix-css';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          html, body, #root {
            margin: 0; padding: 0;
            width: 100%; height: 100%;
            max-height: 100vh;
            overflow: hidden;
          }
          video {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            object-fit: cover !important;
          }
        `;
        document.head.appendChild(style);
      }

      // 2. Force-apply styles to all video elements (handles expo-av inline overrides)
      const applyVideoFix = () => {
        document.querySelectorAll('video').forEach((vid) => {
          vid.style.setProperty('width', '100%', 'important');
          vid.style.setProperty('height', '100%', 'important');
          vid.style.setProperty('max-width', '100vw', 'important');
          vid.style.setProperty('max-height', '100vh', 'important');
          vid.style.setProperty('object-fit', 'cover', 'important');
          vid.style.setProperty('position', 'absolute', 'important');
          vid.style.setProperty('inset', '0', 'important');
        });
      };

      applyVideoFix();
      window.addEventListener('resize', applyVideoFix);

      // 3. Watch for new video elements added by expo-av
      const observer = new MutationObserver(() => applyVideoFix());
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        window.removeEventListener('resize', applyVideoFix);
        observer.disconnect();
      };
    }, []);

    useEffect(() => {
      const fetchStory = async () => {
        try {
          setLoadingStory(true);
          const response = await fetch(`${API_BASE_URL}/stories/${initialStoryId}`);
          if (response.ok) {
            const data = await response.json();
            setStoryData(data);
          } else {
             // Story not found handling
          }
        } catch (error) {
          // Failure handling
        } finally {
          setLoadingStory(false);
        }
      };

      if (initialStoryId && initialStoryId !== "story1" && initialStoryId !== "story2") {
        fetchStory();
      } else {
        // We no longer support local story1/story2 fallbacks
        setLoadingStory(false);
      }

      setStoryId(initialStoryId);
      setAnswers({});
      setOutcome(null);
      setOutcomeReady(false);
      setPhase(autoStartToken ? "main" : "idle");
    }, [autoStartToken, initialStoryId]);

    const activeClips = useMemo(() => {
      if (!storyData) return null;
      // Smart device-aware selection:
      // - Regular phones (narrow screens <= 500px): mobile clips
      // - Tablets, foldables, wide phones, web: landscape clips
      const isNarrowPhone = width <= 500 && height > width;
      const clipSet = isNarrowPhone ? "mobile" : "landscape";
      return storyData[clipSet];
    }, [storyData, width, height]);

    // Determine which questions to use (Room-specific or Default)
    const activeQuestionsList = useMemo(() => {
      if (activeRoom?.storyQuestions && activeRoom.storyQuestions.length > 0) {
        return activeRoom.storyQuestions.map((q, idx) => ({
          ...q,
          id: `q${idx + 1}` // Map to expected ID format
        }));
      }
      return questions; // Fallback to constants
    }, [activeRoom]);

    const currentQuestionIndex = useMemo(() => {
      return activeQuestionsList.findIndex((question) => answers[question.id] == null);
    }, [answers, activeQuestionsList]);

    const handleMainStatus = (status) => {
      if (status?.didJustFinish) {
        setPhase("questions");
      }
    };

    const handleOutcomeStatus = (status) => {
      if (status?.didJustFinish) {
        setPhase("final_result");
      }
    };

    const handleAnswer = (questionId, score) => {
      const nextAnswers = { ...answers, [questionId]: score };
      setAnswers(nextAnswers);

      // Check if all questions are answered
      const allAnswered = activeQuestionsList.every((question) => nextAnswers[question.id] != null);

      if (allAnswered) {
        // Calculate outcome based on dynamic scoring
        const totalScore = activeQuestionsList.reduce((sum, question) => {
          return sum + (nextAnswers[question.id] ?? 0);
        }, 0);

        // Max possible score is sum of max option scores
        const maxPossible = activeQuestionsList.reduce((sum, q) => {
          const maxOpt = Math.max(...q.options.map(o => o.score));
          return sum + maxOpt;
        }, 0);

        const percentage = (totalScore / maxPossible) * 100;

        let nextOutcome = "bad";
        if (percentage >= 80) {
          nextOutcome = "good";
        } else if (percentage >= 50) {
          nextOutcome = "average";
        }

        setOutcome(nextOutcome);
        setOutcomeReady(false);
        setPhase("outcome"); 
      }
    };

    const handleSubmitStory = async () => {
      showAlert(
        "Submit Story Quiz",
        "Are you sure you want to finish the story and submit your answers?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Yes, Submit", 
            onPress: async () => {
              const finalAnswers = answers;
              const totalScore = activeQuestionsList.reduce((sum, question) => {
                return sum + (finalAnswers[question.id] ?? 0);
              }, 0);

              const result = await onSaveFeedback({
                type: "story",
                storyId,
                message: `Story outcome: ${outcome}`,
                metadata: {
                  answers: finalAnswers,
                  totalScore,
                  outcome: outcome,
                },
              });

              if (result.ok) {
                onBack(); // Return to dashboard after successful submission
              } else {
                showAlert("Story save failed", result.message);
              }
            }
          }
        ]
      );
    };

    const resetFlow = () => {
      setAnswers({});
      setOutcome(null);
      setOutcomeReady(false);
      setPhase("idle");
    };

    const handleSkipStory = () => {
      setStoryMenuOpen(false);

      if (phase === "outcome") {
        setPhase("final_result"); // Skip the clip and go to result
        return;
      }

      if (phase === "questions") {
        // Skip remaining questions and go to outcome
        const skippedAnswers = {};
        activeQuestionsList.forEach((q) => {
          skippedAnswers[q.id] = skippedAnswers[q.id] ?? 0; // Default score 0
        });
        const totalScore = activeQuestionsList.reduce((sum, question) => {
          return sum + (skippedAnswers[question.id] ?? 0);
        }, 0);

        let nextOutcome = "bad";
        if (totalScore >= 5) {
          nextOutcome = "good";
        } else if (totalScore >= 3) {
          nextOutcome = "average";
        }

        setAnswers(skippedAnswers);
        setOutcome(nextOutcome);
        setPhase("outcome");
        return;
      }

      if (phase === "final_result") {
        handleSubmitStory();
        return;
      }

      setPhase("questions");
    };

  const handleQuitStory = () => {
    setStoryMenuOpen(false);
    onBack();
  };

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (storyMenuOpen) {
          setStoryMenuOpen(false);
          return true;
        }

        onBack();
        return true;
      }
    );

    return () => subscription.remove();
  }, [onBack, storyMenuOpen]);

  if (loadingStory) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4fd1ff" />
        <Text style={{ marginTop: 12, color: '#fff' }}>Loading Story Clips...</Text>
      </View>
    );
  }

  if (!storyData || !activeClips) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff' }}>Story not found</Text>
        <Pressable onPress={onBack} style={{ marginTop: 20, padding: 10, backgroundColor: '#4fd1ff', borderRadius: 8 }}>
          <Text>Back</Text>
        </Pressable>
      </View>
    );
  }

  const activeQuestion =
    currentQuestionIndex >= 0 ? activeQuestionsList[currentQuestionIndex] : null;
  const clipResizeMode = ResizeMode.COVER;

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        {(phase === "main" ||
          phase === "idle" ||
          phase === "questions" ||
          (phase === "outcome" && !outcomeReady)) && (
          <Video
            source={typeof activeClips.main === 'string' ? { uri: activeClips.main } : activeClips.main}
            style={styles.video}
            resizeMode={clipResizeMode}
            shouldPlay={phase === "main"}
            onPlaybackStatusUpdate={handleMainStatus}
          />
        )}
        {phase === "outcome" && outcome && (
          <Video
            source={typeof activeClips[outcome] === 'string' ? { uri: activeClips[outcome] } : activeClips[outcome]}
            style={styles.video}
            resizeMode={clipResizeMode}
            shouldPlay
            onLoad={() => setOutcomeReady(true)}
            onReadyForDisplay={() => setOutcomeReady(true)}
            onPlaybackStatusUpdate={handleOutcomeStatus}
          />
        )}

        <View style={[styles.storyTopMenuWrap, { top: Math.max(insets.top + 12, 18) }]}>
          <Pressable
            style={styles.storyMenuButton}
            onPress={() => setStoryMenuOpen((open) => !open)}
          >
            <View style={styles.storyMenuLine} />
            <View style={styles.storyMenuLine} />
            <View style={styles.storyMenuLine} />
          </Pressable>
        </View>

        {storyMenuOpen && (
          <View style={[styles.storyActionMenu, { top: Math.max(insets.top + 66, 72) }]}>
            <Text style={styles.storyActionMenuTitle}>Story Controls</Text>
            <Pressable style={styles.storyActionMenuItem} onPress={handleSkipStory}>
              <View>
                <Text style={styles.storyActionMenuItemTitle}>Skip</Text>
                <Text style={styles.storyActionMenuItemSubtext}>
                  Jump to the next part of this story
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.storyActionMenuItem, styles.storyActionMenuDangerItem]}
              onPress={handleQuitStory}
            >
              <View>
                <Text style={styles.storyActionMenuDangerTitle}>Quit</Text>
                <Text style={styles.storyActionMenuItemSubtext}>
                  Leave Story Mode and return to dashboard
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {phase === "questions" && <View style={styles.overlay} />}

        {phase !== "none" && (
          <View
            style={[
              styles.panel,
              (phase === "questions" || phase === "final_result") ? styles.panelFloating : styles.panelDocked,
              { paddingBottom: 18 },
            ]}
          >
            {phase === "idle" && (
              <>
                <Text style={styles.kicker}>Interactive Session</Text>
                <Text style={styles.title}>Session Question</Text>
                <Text style={[styles.subtitle, { color: '#59f0c2', fontWeight: '900', fontSize: 18 }]}>
                  "{activeRoom?.question || "How was the session?"}"
                </Text>
                <Text style={styles.subtitle}>
                  Watch the story and answer the live questions based on your experience today.
                </Text>
                <View style={styles.storyRow}>
                  <Pressable
                    style={[
                      styles.storyButton,
                      storyId === "story1" && styles.storyButtonActive,
                    ]}
                    onPress={() => setStoryId("story1")}
                  >
                    <Text
                      style={[
                        styles.storyButtonText,
                        storyId === "story1" && styles.storyButtonTextActive,
                      ]}
                    >
                      Story 1
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.storyButton,
                      storyId === "story2" && styles.storyButtonActive,
                    ]}
                    onPress={() => setStoryId("story2")}
                  >
                    <Text
                      style={[
                        styles.storyButtonText,
                        storyId === "story2" && styles.storyButtonTextActive,
                      ]}
                    >
                      Story 2
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => setPhase("main")}
                >
                  <Text style={styles.primaryButtonText}>Start Story</Text>
                </Pressable>
              </>
            )}

            {phase === "main" && (
              <>
                <Text style={styles.kicker}>Session Question</Text>
                <Text style={[styles.title, { fontSize: 20 }]}>"{activeRoom?.question || "How was the session?"}"</Text>
                <Text style={styles.subtitle}>
                  Think about the question above as you watch. Feedback will appear shortly.
                </Text>
              </>
            )}

            {phase === "outcome" && (
              <>
                <Text style={styles.kicker}>Story Conclusion</Text>
                <Text style={styles.title}>The Ending</Text>
                <Text style={styles.subtitle}>
                  Watching the {outcome} outcome. Your feedback score led to this specific scene.
                </Text>
              </>
            )}

            {phase === "questions" && activeQuestion && (
              <>
                <Text style={styles.kicker}>
                  Question {currentQuestionIndex + 1} of {activeQuestionsList.length}
                </Text>
                <Text style={styles.title}>{activeQuestion.text}</Text>
                <View style={styles.optionList}>
                  {activeQuestion.options.map((option) => (
                    <Pressable
                      key={option.label}
                      style={styles.optionButton}
                      onPress={() => handleAnswer(activeQuestion.id, option.score)}
                    >
                      <Text style={styles.optionText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {phase === "final_result" && (
              <>
                <Text style={styles.kicker}>Story Ending</Text>
                <Text style={styles.title}>
                  {outcome === "good" ? "😊 Great Ending!" : outcome === "average" ? "😐 Okay Ending!" : "😞 Low Ending!"}
                </Text>
                <Text style={styles.subtitle}>
                  You scored {activeQuestionsList.reduce((sum, q) => sum + (answers[q.id] ?? 0), 0)} out of {activeQuestionsList.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.score)), 0)}. Based on your feedback, this was an {outcome} outcome.
                </Text>

                <View style={[styles.moodRow, { marginBottom: 20, marginTop: 10 }]}>
                  <View style={[styles.moodButton, styles.moodButtonActive, { backgroundColor: "#59f0c2", borderColor: "#59f0c2" }]}>
                    <Text style={styles.moodEmoji}>
                      {outcome === "good" ? "😊" : outcome === "average" ? "😐" : "😞"}
                    </Text>
                    <Text style={[styles.moodLabel, styles.moodLabelActive, { color: "#000" }]}>
                      {outcome === "good" ? "Great" : outcome === "average" ? "Okay" : "Low"}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 12 }}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleSubmitStory}
                  >
                    <Text style={styles.primaryButtonText}>Submit Feedback</Text>
                  </Pressable>
                  
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }]}
                    onPress={() => {
                      setOutcomeReady(false);
                      setPhase("outcome");
                    }}
                  >
                    <Text style={[styles.primaryButtonText, { color: "#fff" }]}>Watch Again</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {phase === "outcome" && (
          <View style={{ position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' }}>
             {/* Optional: Add a skip button for outcome clip if desired, or leave empty */}
          </View>
        )}
      </View>
      <StatusBar hidden />
    </View>
  );
}
