import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../utils/alertUtils';

export default function RoomFormScreen({ 
  onBack, 
  onSave, 
  theme, 
  initialData = null 
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [roomName, setRoomName] = useState(initialData?.roomName || "");
  const [subject, setSubject] = useState(initialData?.subject || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [question, setQuestion] = useState(initialData?.question || "");
  const [showNames, setShowNames] = useState(initialData ? !initialData.isAnonymous : true);
  const [duration, setDuration] = useState(initialData?.durationMinutes?.toString() || "0");
  const [feedbackLimit, setFeedbackLimit] = useState(initialData?.feedbackLimitPerStudent?.toString() || "0");
  const [maxStudents, setMaxStudents] = useState(initialData?.maxStudents?.toString() || "0");
  
  // Feedback Modes State
  const [enabledModes, setEnabledModes] = useState(initialData?.enabledFeedbackModes || ["emoji", "selfie", "written", "story"]);

  const toggleMode = (mode) => {
    if (enabledModes.includes(mode)) {
      if (enabledModes.length === 1) {
        showAlert("Action Denied", "At least one feedback mode must remain active.");
        return;
      }
      setEnabledModes(enabledModes.filter(m => m !== mode));
    } else {
      setEnabledModes([...enabledModes, mode]);
    }
  };

  // Story Questions State
  const defaultStoryQuestions = [
    { text: "Did you find the lesson easy to follow?", options: [{ label: "Yes, very easy", score: 2 }, { label: "Somewhat", score: 1 }, { label: "No, it was hard", score: 0 }] },
    { text: "How would you rate the teacher's explanation?", options: [{ label: "Excellent", score: 2 }, { label: "Good", score: 1 }, { label: "Could be better", score: 0 }] },
    { text: "Do you feel confident about today's topic?", options: [{ label: "Totally!", score: 2 }, { label: "A little bit", score: 1 }, { label: "Not at all", score: 0 }] }
  ];

  const [storyQuestions, setStoryQuestions] = useState(initialData?.storyQuestions || []);

  const isEdit = !!initialData;
  const canSave = roomName.trim().length >= 2;

  const handleSave = () => {
    onSave?.({
      roomName: roomName.trim(),
      subject: subject.trim(),
      description: description.trim(),
      question: question.trim(),
      enabledFeedbackModes: enabledModes,
      storyQuestions: storyQuestions,
      isAnonymous: !showNames,
      durationMinutes: parseInt(duration) || 0,
      feedbackLimitPerStudent: parseInt(feedbackLimit) || 0,
      maxStudents: parseInt(maxStudents) || 0,
    });
  };

  const PRESETS = [
    { label: "Communication", options: [{ label: "Excellent", score: 3 }, { label: "Average", score: 2 }, { label: "Poor", score: 1 }] },
    { label: "Explanation", options: [{ label: "Very Clear", score: 3 }, { label: "Somewhat Clear", score: 2 }, { label: "Not Clear", score: 1 }] },
    { label: "Behavior", options: [{ label: "Good", score: 3 }, { label: "Average", score: 2 }, { label: "Poor", score: 1 }] },
    { label: "Satisfaction", options: [{ label: "Highly Satisfied", score: 3 }, { label: "Neutral", score: 2 }, { label: "Unsatisfied", score: 1 }] },
    { label: "Return Intent", options: [{ label: "Yes", score: 3 }, { label: "Maybe", score: 2 }, { label: "No", score: 1 }] }
  ];

  const applyPreset = (qIdx, preset) => {
    const next = [...storyQuestions];
    next[qIdx].options = JSON.parse(JSON.stringify(preset.options));
    setStoryQuestions(next);
  };

  const addStoryQuestion = () => {
    if (storyQuestions.length >= 5) {
      showAlert("Limit Reached", "You can add up to 5 questions for Story Mode.");
      return;
    }
    setStoryQuestions([
      ...storyQuestions, 
      { 
        text: "", 
        options: [
          { label: "Option 1", score: 3 }, 
          { label: "Option 2", score: 2 }, 
          { label: "Option 3", score: 1 }
        ] 
      }
    ]);
  };

  const removeStoryQuestion = (index) => {
    const next = [...storyQuestions];
    next.splice(index, 1);
    setStoryQuestions(next);
  };

  const updateQuestionText = (index, text) => {
    const next = [...storyQuestions];
    next[index].text = text;
    setStoryQuestions(next);
  };

  const updateOption = (qIndex, oIndex, label, score) => {
    const next = [...storyQuestions];
    next[qIndex].options[oIndex] = { label, score: parseInt(score) || 0 };
    setStoryQuestions(next);
  };

  return (
    <View style={[localStyles.root, { backgroundColor: theme.background }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[localStyles.glowOrb, { top: -80, right: -30, width: 220, height: 220, backgroundColor: theme.glowOne }]} />
        <View style={[localStyles.glowOrb, { bottom: 50, left: -50, width: 180, height: 180, backgroundColor: theme.glowTwo }]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isWide ? 32 : 20,
          paddingTop: Math.max(insets.top, 20) + 10,
          paddingBottom: Math.max(insets.bottom, 20) + 30,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={localStyles.headerRow}>
          <Pressable
            style={[localStyles.backButton, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}
            onPress={onBack}
          >
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '800' }}>Back</Text>
          </Pressable>
          <Text style={[localStyles.headerTitle, { color: theme.textPrimary }]}>
            {isEdit ? "Edit Room" : "Create Room"}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View
          style={[
            localStyles.formCard,
            {
              backgroundColor: theme.panel,
              borderColor: theme.inputBorder,
              maxWidth: isWide ? 600 : undefined,
              alignSelf: isWide ? "center" : undefined,
              width: isWide ? "100%" : undefined,
            },
          ]}
        >
          {/* Main Details */}
          <View style={localStyles.fieldGroup}>
            <Text style={[localStyles.fieldLabel, { color: theme.textSecondary }]}>Room Name *</Text>
            <TextInput
              style={[localStyles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="e.g., Physics Lab"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          {/* Feedback Mode Selector */}
          <View style={[localStyles.fieldGroup, { marginTop: 10 }]}>
            <Text style={[localStyles.fieldLabel, { color: theme.textSecondary }]}>Enabled Feedback Modes</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 }}>
              {[
                { id: 'emoji', label: 'Emoji', icon: '😊' },
                { id: 'selfie', label: 'Selfie', icon: '🤳' },
                { id: 'written', label: 'Written', icon: '✍️' },
                { id: 'story', label: 'Story', icon: '🎬' },
              ].map((mode) => (
                <Pressable
                  key={mode.id}
                  onPress={() => toggleMode(mode.id)}
                  style={[
                    localStyles.modeToggle,
                    { 
                      backgroundColor: enabledModes.includes(mode.id) ? theme.accent : theme.inputBackground,
                      borderColor: enabledModes.includes(mode.id) ? theme.accent : theme.inputBorder
                    }
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>{mode.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: enabledModes.includes(mode.id) ? '#fff' : theme.textSecondary }}>{mode.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>Select which methods students can use to give feedback.</Text>
          </View>

          <View style={localStyles.fieldGroup}>
            <Text style={[localStyles.fieldLabel, { color: theme.textSecondary }]}>Default Feedback Question</Text>
            <TextInput
              style={[localStyles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText, fontWeight: '700' }]}
              value={question}
              onChangeText={setQuestion}
              placeholder="e.g., How was your experience?"
              placeholderTextColor={theme.textMuted}
            />
            <Text style={{ fontSize: 11, color: theme.textMuted }}>This question will appear on the student's feedback screen.</Text>
          </View>

          {/* Room Configuration */}
          <View style={[localStyles.fieldGroup, { marginTop: 10 }]}>
             <Text style={[localStyles.fieldLabel, { color: theme.accent, fontSize: 16 }]}>Room Configuration</Text>
             
             <View style={{ marginTop: 10, gap: 14 }}>
                {/* Anonymity Toggle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                   <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '700' }}>Anonymous Feedback</Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11 }}>Students can submit without their names showing.</Text>
                   </View>
                   <Pressable 
                    onPress={() => setShowNames(!showNames)}
                    style={{ 
                      width: 50, 
                      height: 28, 
                      borderRadius: 14, 
                      backgroundColor: !showNames ? theme.accent : theme.inputBackground,
                      borderWidth: 1,
                      borderColor: !showNames ? theme.accent : theme.inputBorder,
                      padding: 2,
                      justifyContent: 'center'
                    }}
                   >
                      <View style={{ 
                        width: 22, 
                        height: 22, 
                        borderRadius: 11, 
                        backgroundColor: '#fff', 
                        alignSelf: !showNames ? 'flex-end' : 'flex-start' 
                      }} />
                   </Pressable>
                </View>

                {/* Capacity Row (Duration hidden) */}
                <View style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Max Students</Text>
                        <TextInput
                          style={[localStyles.input, { height: 48, paddingVertical: 0, backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText }]}
                          value={maxStudents}
                          onChangeText={setMaxStudents}
                          keyboardType="numeric"
                          placeholder="0 = Unlimited"
                          placeholderTextColor={theme.textMuted}
                        />
                    </View>
                    <View style={{ flex: 1 }} />
                </View>
             </View>
          </View>

          {/* Story Quiz Builder */}
          <View style={[localStyles.fieldGroup, { marginTop: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[localStyles.fieldLabel, { color: theme.accent, fontSize: 16 }]}>Story Mode Quiz</Text>
              <Pressable onPress={addStoryQuestion} style={{ backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>+ Add Question</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 15 }}>Create custom quiz questions for the story mode.</Text>

            {storyQuestions.map((q, qIdx) => (
              <View key={qIdx} style={[localStyles.quizItem, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.textSecondary, fontWeight: 'bold', fontSize: 12 }}>Question {qIdx + 1}</Text>
                  <Pressable onPress={() => removeStoryQuestion(qIdx)}>
                    <Text style={{ color: theme.danger, fontWeight: 'bold', fontSize: 12 }}>Remove</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={[localStyles.input, { marginTop: 8, height: 44, paddingVertical: 0 }]}
                  value={q.text}
                  onChangeText={(val) => updateQuestionText(qIdx, val)}
                  placeholder="Enter question text..."
                />
                
                <View style={{ marginTop: 12 }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                     <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '900' }}>QUICK PRESETS</Text>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingLeft: 10 }}>
                        {PRESETS.map((p, pIdx) => (
                          <Pressable 
                            key={pIdx} 
                            onPress={() => applyPreset(qIdx, p)}
                            style={{ backgroundColor: theme.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.accent }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.accent }}>{p.label}</Text>
                          </Pressable>
                        ))}
                     </ScrollView>
                   </View>

                   <View style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
                     <Text style={{ width: 45, color: theme.textMuted, fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>PTS</Text>
                     <Text style={{ flex: 1, color: theme.textMuted, fontSize: 9, fontWeight: 'bold' }}>OPTION LABEL</Text>
                   </View>
                   
                   {q.options.map((opt, oIdx) => (
                     <View key={oIdx} style={{ flexDirection: 'row', gap: 8, marginBottom: 5 }}>
                        <TextInput 
                          style={[localStyles.input, { width: 45, height: 38, fontSize: 13, textAlign: 'center', paddingVertical: 0, fontWeight: 'bold', color: theme.accent }]}
                          value={opt.score.toString()}
                          onChangeText={(val) => updateOption(qIdx, oIdx, opt.label, val)}
                          keyboardType="numeric"
                        />
                        <TextInput 
                          style={[localStyles.input, { flex: 1, height: 38, fontSize: 13, paddingVertical: 0 }]}
                          value={opt.label}
                          onChangeText={(val) => updateOption(qIdx, oIdx, val, opt.score)}
                          placeholder="e.g., Excellent"
                        />
                     </View>
                   ))}
                </View>
              </View>
            ))}
          </View>

          <View style={localStyles.fieldGroup}>
            <Text style={[localStyles.fieldLabel, { color: theme.textSecondary }]}>Description</Text>
            <TextInput
              style={[localStyles.input, localStyles.textArea, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.inputText }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={[localStyles.saveButton, { backgroundColor: canSave ? theme.accent : theme.inputBackground, marginTop: 30 }]}
            disabled={!canSave}
            onPress={handleSave}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: canSave ? theme.onAccent : theme.textMuted }}>
              {isEdit ? "Update Room" : "Create Room"}
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
  glowOrb: { position: "absolute", borderRadius: 999 },
  headerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: 'space-between',
    marginBottom: 24 
  },
  backButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14, 
    borderWidth: 1.5, 
    justifyContent: 'center' 
  },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  formCard: { padding: 22, borderRadius: 26, borderWidth: 1 },
  fieldGroup: { marginBottom: 18, gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "700" },
  input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  textArea: { minHeight: 90, paddingTop: 14 },
  quizItem: { padding: 15, borderRadius: 18, borderWidth: 1, marginBottom: 15 },
  saveButton: { paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  modeToggle: { flex: 1, height: 60, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 2, minWidth: 60 },
});
