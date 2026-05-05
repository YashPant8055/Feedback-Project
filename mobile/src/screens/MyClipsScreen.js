import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { API_BASE_URL } from '../constants/config.js';
import { getAuthHeader } from '../utils/auth';
import { showAlert } from '../utils/alertUtils';

export default function MyClipsScreen({ onBack, profile, theme, onGoToUpload }) {
  const { width } = useWindowDimensions();
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);

  const isWeb = Platform.OS === 'web';
  const cardsPerRow = !isWeb ? 1 : width >= 1320 ? 3 : width >= 920 ? 2 : 1;
  const contentWidth = isWeb ? Math.min(width - 48, 1120) : undefined;
  const storyCardWidth =
    isWeb && cardsPerRow > 1
      ? (contentWidth - 12 * (cardsPerRow - 1)) / cardsPerRow
      : '100%';

  const fetchClips = async () => {
    try {
      setLoading(true);
      const authHeader = await getAuthHeader();
      const endpoint = profile.role === 'admin' 
        ? `${API_BASE_URL}/stories` 
        : `${API_BASE_URL}/stories/teacher/${profile.id}`;
        
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setClips(data);
      }
    } catch (error) {
      console.error('Failed to fetch clips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  const handleDelete = (clipId) => {
    showAlert(
      'Delete Story',
      'Are you sure you want to delete this full story from the cloud? All 8 video clips will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/stories/${clipId}`, {
                method: 'DELETE',
                headers: await getAuthHeader(),
              });

              if (response.ok) {
                setClips((current) => current.filter((clip) => clip._id !== clipId));
              } else {
                showAlert('Error', 'Failed to delete story');
              }
            } catch (_err) {
              showAlert('Error', 'Network error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
        >
          <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '800' }}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Story Library</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.contentColumn, isWeb && { width: contentWidth }]}>
          <Pressable
            style={[
              styles.uploadCard,
              isWeb && styles.uploadCardWeb,
              { backgroundColor: theme.accentSoft, borderColor: theme.accent },
            ]}
            onPress={onGoToUpload}
          >
            <Text style={styles.uploadIcon}>Upload</Text>
            <View style={styles.uploadCopy}>
              <Text style={{ color: theme.textPrimary, fontWeight: '800', fontSize: 16 }}>
                Create New Story
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Upload 8 clips to build a story flow
              </Text>
            </View>
          </Pressable>

          {loading ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 40 }} />
          ) : clips.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Library Empty</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Your library is empty. Upload your first story to see it here.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {clips.map((clip) => (
                <View
                  key={clip._id}
                  style={[
                    styles.storyCard,
                    isWeb && styles.storyCardWeb,
                    {
                      width: storyCardWidth,
                      backgroundColor: theme.panel,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                >
                  <View style={[styles.typeBadge, { backgroundColor: theme.accentSoft }]}>
                    <Text style={{ fontSize: 10, fontWeight: '800' }}>8 CLIPS</Text>
                  </View>
                  <Text style={[styles.clipTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                    {clip.title}
                  </Text>
                  <Text style={[styles.clipDate, { color: theme.textMuted }]}>
                    Created: {new Date(clip.createdAt).toLocaleDateString()}
                  </Text>

                  <View style={styles.cardActions}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: 'rgba(255, 91, 127, 0.1)' }]}
                      onPress={() => handleDelete(clip._id)}
                    >
                      <Text style={{ color: '#ff5b7f', fontWeight: '700' }}>Delete Story</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 20,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  uploadCardWeb: {
    paddingVertical: 16,
    borderRadius: 20,
  },
  uploadIcon: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  uploadCopy: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
  },
  storyCard: {
    width: '100%',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 8,
  },
  storyCardWeb: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 0,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  clipTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  clipDate: {
    fontSize: 12,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 260,
  },
});
