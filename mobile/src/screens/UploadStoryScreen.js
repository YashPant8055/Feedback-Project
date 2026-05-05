import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
// globalStyles not used in this screen - local styles only
import { API_BASE_URL } from '../constants/config.js';
import { getAuthHeader } from '../utils/auth';
import { showAlert } from '../utils/alertUtils';

export default function UploadStoryScreen({ onBack, profile, theme, onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [currentClipProgress, setCurrentClipProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [activeClipId, setActiveClipId] = useState(null);
  const [completedClips, setCompletedClips] = useState([]);
  const [uploadedPublicIds, setUploadedPublicIds] = useState([]); // Track for cleanup
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  
  const [clips, setClips] = useState({
    landscape_main: null,
    landscape_good: null,
    landscape_average: null,
    landscape_bad: null,
    mobile_main: null,
    mobile_good: null,
    mobile_average: null,
    mobile_bad: null,
  });

  const clipConfig = [
    { id: 'landscape_main', label: 'Landscape Main', icon: '🎬' },
    { id: 'landscape_good', label: 'Landscape Good', icon: '😊' },
    { id: 'landscape_average', label: 'Landscape Average', icon: '😐' },
    { id: 'landscape_bad', label: 'Landscape Bad', icon: '😞' },
    { id: 'mobile_main', label: 'Mobile Main', icon: '🎬' },
    { id: 'mobile_good', label: 'Mobile Good', icon: '😊' },
    { id: 'mobile_average', label: 'Mobile Average', icon: '😐' },
    { id: 'mobile_bad', label: 'Mobile Bad', icon: '😞' },
  ];

  const pickFile = async (clipId) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        setClips(prev => ({ ...prev, [clipId]: result.assets[0] }));
      }
    } catch (error) {
      console.error('Pick File Error:', error);
      showAlert('Error', `Failed to pick a file: ${error.message}`);
    }
  };

  const uploadClipSequentially = async (clipId, file, index) => {
    // 1. Get Signature from our server
    const authHeader = await getAuthHeader();
    const sigResponse = await fetch(`${API_BASE_URL}/stories/upload-signature`, {
      headers: { ...authHeader }
    });
    
    if (!sigResponse.ok) {
      throw new Error(`Failed to get upload signature for ${clipId}`);
    }
    
    const { signature, timestamp, cloud_name, api_key, folder } = await sigResponse.json();

    // 2. Upload Direct to Cloudinary
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      const fileExtension = file?.uri?.includes('.')
        ? file.uri.split('.').pop()
        : 'mp4';
      const fallbackMimeType = file?.mimeType || `video/${fileExtension}`;
      const fallbackName = file?.fileName || `${clipId}.${fileExtension}`;
      
      // Cloudinary required fields for signed upload
      if (Platform.OS === 'web') {
        if (!file?.file) {
          reject(new Error(`Web upload failed: missing browser file object for ${clipId}`));
          return;
        }

        formData.append('file', file.file, file.file.name || fallbackName);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: fallbackName,
          type: fallbackMimeType,
        });
      }
      formData.append('api_key', api_key);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const progress = Math.min(Math.round((event.loaded * 100) / event.total), 100);
          setCurrentClipProgress(progress);
          
          // Total progress math: Each clip is 11.25% of the total (8 * 11.25 = 90%)
          const completedWeight = (index / 8) * 90;
          const currentWeight = (progress / 100) * (90 / 8);
          const total = Math.min(Math.round(completedWeight + currentWeight), 90);
          setTotalProgress(total);
        }
      };

      xhr.onload = () => {
        try {
          const responseText = xhr.responseText;
          const data = JSON.parse(responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            setCompletedClips(prev => [...prev, clipId]);
            const newPublicIds = [...uploadedPublicIds, data.public_id];
            setUploadedPublicIds(newPublicIds);
            
            // Persist to storage in case of app kill/crash
            AsyncStorage.setItem('pending-story-cleanup', JSON.stringify(newPublicIds)).catch(err => {
              console.error("Failed to save cleanup state:", err);
            });

            resolve({
              url: data.secure_url,
              public_id: data.public_id
            });
          } else {
            reject(new Error(data.error?.message || `Cloudinary upload failed with status ${xhr.status}`));
          }
        } catch (e) {
          console.error("[CLOUDINARY-PARSE-ERROR]", e.message);
          reject(new Error(`Invalid response from Cloudinary (Status ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        console.error("[CLOUDINARY-NETWORK-ERROR]");
        reject(new Error('Network error during direct upload'));
      };
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    const missingClips = clipConfig.filter(c => !clips[c.id]);
    if (missingClips.length > 0) {
      showAlert('Incomplete Story', `Please select all 8 clips. Missing: ${missingClips.map(c => c.label).join(', ')}`);
      return;
    }

    if (!title.trim()) {
      showAlert('Title Required', 'Please give your story a name.');
      return;
    }

    setUploading(true);
    setCurrentClipProgress(0);
    setTotalProgress(0);
    setCompletedClips([]);

    try {
      const landscape = {};
      const mobile = {};
      const cloudinaryIds = [];

      // Loop through and upload each clip one by one
      for (let i = 0; i < clipConfig.length; i++) {
        const config = clipConfig[i];
        setActiveClipId(config.id);
        setCurrentClipProgress(0);

        console.log(`[SEQUENTIAL-UPLOAD] Starting clip ${i + 1}: ${config.label}`);
        const result = await uploadClipSequentially(config.id, clips[config.id], i);
        
        // Organize results
        if (config.id.startsWith('landscape_')) {
          landscape[config.id.replace('landscape_', '')] = result.url;
        } else {
          mobile[config.id.replace('mobile_', '')] = result.url;
        }
        cloudinaryIds.push(result.public_id);
      }

      // Final step: Create the story record
      setActiveClipId('finalizing');
      setTotalProgress(95);
      
      const response = await fetch(`${API_BASE_URL}/stories/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          title,
          landscape,
          mobile,
          cloudinaryIds,
          teacherId: profile.id,
          teacherName: profile.name,
        }),
      });

      const finalData = await response.json();
      setTotalProgress(100);
      setUploading(false);

      if (response.ok) {
        showAlert('Success', 'Full story created successfully!');
        // Clear cleanup storage on success
        await AsyncStorage.removeItem('pending-story-cleanup');
        onUploadSuccess?.(finalData);
        onBack();
      } else {
        showAlert('Error', finalData.message || 'Failed to finalize story.');
      }

    } catch (error) {
      setUploading(false);
      setActiveClipId(null);
      console.error('[UPLOAD-ERROR]', error);
      showAlert('Upload Failed', error.message || 'An error occurred during sequential upload.');
    }
  };

  const handleBack = async () => {
    if (uploading && uploadedPublicIds.length > 0) {
      showAlert(
        "Cancel Upload?",
        `You have already uploaded ${uploadedPublicIds.length} clips. These will be deleted if you cancel now.`,
        [
          { text: "Continue Uploading", style: "cancel" },
          { 
            text: "Cancel & Delete", 
            style: "destructive", 
            onPress: async () => {
              setIsCleaningUp(true);
              try {
                const authHeader = await getAuthHeader();
                await fetch(`${API_BASE_URL}/stories/delete-clips`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ publicIds: uploadedPublicIds })
                });
                await AsyncStorage.removeItem('pending-story-cleanup');
              } catch (err) {
                console.error("Cleanup failed:", err);
              } finally {
                setIsCleaningUp(false);
                onBack();
              }
            }
          }
        ]
      );
    } else if (uploading) {
      showAlert("Cancel Upload?", "Are you sure you want to stop?", [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: onBack }
      ]);
    } else {
      onBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={!isCleaningUp}>
        <View style={styles.header}>
          <Pressable 
            onPress={handleBack} 
            style={[styles.backButton, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]} 
            disabled={isCleaningUp}
          >
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '800' }}>Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Create New Story</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Story Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.textPrimary }]}
            placeholder="e.g. Science Lab Safety"
            placeholderTextColor={theme.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 20 }]}>Video Clips (All 8 Required)</Text>
          
          <View style={styles.clipsGrid}>
            {clipConfig.map((config) => {
              const isUploading = activeClipId === config.id;
              const isCompleted = completedClips.includes(config.id);
              const isSelected = !!clips[config.id];

              return (
                <Pressable
                  key={config.id}
                  style={[
                    styles.clipPicker,
                    { 
                      backgroundColor: theme.inputBackground, 
                      borderColor: isUploading ? theme.accent : (isCompleted || isSelected ? theme.accentSoft : theme.inputBorder)
                    }
                  ]}
                  onPress={() => !uploading && pickFile(config.id)}
                  disabled={uploading}
                >
                  <Text style={{ fontSize: 24 }}>
                    {isCompleted ? '✅' : (isUploading ? '⏳' : config.icon)}
                  </Text>
                  <Text style={[styles.clipLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                    {config.label}
                  </Text>
                  
                  {isUploading && (
                    <View style={styles.miniProgressContainer}>
                      <View style={[styles.miniProgressBarBackground, { backgroundColor: theme.panel }]}>
                        <View 
                          style={[
                            styles.miniProgressBarFill, 
                            { backgroundColor: theme.accent, width: `${currentClipProgress}%` }
                          ]} 
                        />
                      </View>
                      <Text style={{ color: theme.accent, fontSize: 9, fontWeight: '800', marginTop: 2 }}>
                        {currentClipProgress}%
                      </Text>
                    </View>
                  )}

                  {!isUploading && isSelected && !isCompleted && (
                    <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '800' }}>Selected</Text>
                  )}
                  {isCompleted && (
                    <Text style={{ color: '#59f0c2', fontSize: 10, fontWeight: '800' }}>Uploaded</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {uploading && (
            <View style={styles.totalProgressContainer}>
              <View style={styles.totalProgressHeader}>
                <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0 }]}>
                  {activeClipId === 'finalizing' ? 'Finalizing Story...' : 'Overall Progress'}
                </Text>
                <Text style={[styles.totalProgressPercentage, { color: theme.accent }]}>{totalProgress}%</Text>
              </View>
              
              <View style={[styles.totalProgressBarBackground, { backgroundColor: theme.inputBackground }]}>
                <View 
                  style={[
                    styles.totalProgressBarFill, 
                    { 
                      backgroundColor: theme.accent,
                      width: `${totalProgress}%`
                    }
                  ]} 
                />
              </View>
              
              <Text style={[styles.progressNote, { color: theme.textMuted }]}>
                {activeClipId === 'finalizing' 
                  ? 'Saving story details to database...' 
                  : `Uploading 8 video clips one by one to ensure stability.`}
              </Text>
            </View>
          )}

          {isCleaningUp && (
            <View style={{ marginVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#ff4f70" />
              <Text style={{ color: '#ff4f70', marginTop: 10, fontWeight: 'bold' }}>Cleaning up Cloudinary storage...</Text>
            </View>
          )}

          <Pressable
            style={[styles.uploadButton, { backgroundColor: theme.accent, opacity: uploading ? 0.7 : 1, marginTop: 20 }]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={[styles.uploadButtonText, { color: theme.onAccent }]}>Upload Full Story</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
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
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 10,
  },
  clipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  clipPicker: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    padding: 8,
  },
  clipLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  uploadButton: {
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '800',
  },
  miniProgressContainer: {
    width: '80%',
    alignItems: 'center',
    marginTop: 8,
  },
  miniProgressBarBackground: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressBarFill: {
    height: '100%',
  },
  totalProgressContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  totalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  totalProgressPercentage: {
    fontSize: 14,
    fontWeight: '900',
  },
  totalProgressBarBackground: {
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  totalProgressBarFill: {
    height: '100%',
  },
  progressNote: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
