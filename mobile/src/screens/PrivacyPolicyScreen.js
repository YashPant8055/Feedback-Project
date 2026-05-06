import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function PrivacyPolicyScreen({ onBack, theme }) {
  const insets = useSafeAreaInsets();

  const Section = ({ title, icon, children }) => (
    <View style={[localStyles.section, { backgroundColor: theme.panel, borderColor: theme.inputBorder }]}>
      <View style={localStyles.sectionHeader}>
        <Text style={localStyles.sectionIcon}>{icon}</Text>
        <Text style={[localStyles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text>
      </View>
      <View style={localStyles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const BulletPoint = ({ text }) => (
    <View style={localStyles.bulletRow}>
      <View style={[localStyles.bullet, { backgroundColor: theme.accent }]} />
      <Text style={[localStyles.bulletText, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );

  return (
    <View style={[localStyles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[localStyles.header, { paddingTop: Math.max(insets.top, 20), backgroundColor: theme.panel, borderBottomColor: theme.inputBorder }]}>
        <Pressable style={localStyles.backButton} onPress={onBack}>
          <Text style={[localStyles.backButtonText, { color: theme.accent }]}>← Back</Text>
        </Pressable>
        <Text style={[localStyles.headerTitle, { color: theme.textPrimary }]}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[localStyles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={localStyles.topBanner}>
          <View style={[localStyles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={[localStyles.badgeText, { color: theme.accent }]}>🛡️ Privacy & Security</Text>
          </View>
          <Text style={[localStyles.mainTitle, { color: theme.textPrimary }]}>Our Commitment to Privacy</Text>
          <Text style={[localStyles.lastUpdated, { color: theme.textMuted }]}>Last Updated: May 6, 2026</Text>
        </View>

        <Text style={[localStyles.introText, { color: theme.textMuted }]}>
          At CodroidHub, we believe that privacy is a fundamental right. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our interactive Feedback application and Room services.
        </Text>

        <Section title="Information We Collect" icon="📊">
          <Text style={[localStyles.subTitle, { color: theme.textPrimary }]}>Personal Information</Text>
          <BulletPoint text="Name, email address, and account role (Teacher/Student)" />
          <BulletPoint text="Room codes, session history, and participation data" />
          <BulletPoint text="Feedback responses (Emoji, Written, and Story Mode choices)" />
          <BulletPoint text="Facial expression data for emotion analysis (only when using Selfie Feedback)" />
          
          <Text style={[localStyles.subTitle, { color: theme.textPrimary, marginTop: 15 }]}>Technical Information</Text>
          <BulletPoint text="Device information and operating system" />
          <BulletPoint text="App performance and crash logs" />
          <BulletPoint text="Usage patterns within rooms and stories" />
        </Section>

        <Section title="How We Use Your Information" icon="👁️">
          <Text style={[localStyles.subTitle, { color: theme.textPrimary }]}>App Services</Text>
          <BulletPoint text="Facilitate live classroom feedback sessions" />
          <BulletPoint text="Analyze emotional sentiment to generate teacher reports" />
          <BulletPoint text="Process camera input locally for Selfie Feedback analysis" />
          <BulletPoint text="Provide interactive Story Mode experiences" />
          
          <Text style={[localStyles.subTitle, { color: theme.textPrimary, marginTop: 15 }]}>Communication</Text>
          <BulletPoint text="Send account notifications and room updates" />
          <BulletPoint text="Provide technical customer support" />
          <BulletPoint text="Process feedback submissions and room creations" />
        </Section>

        <Section title="Data Protection & Security" icon="🔐">
          <BulletPoint text="Industry-standard encryption for data transmission" />
          <BulletPoint text="Facial images from Selfie Feedback are NOT stored permanently" />
          <BulletPoint text="Secure servers with regular security audits" />
          <BulletPoint text="Session feedback and room history kept securely until deleted by the user" />
        </Section>

        <Section title="Third-Party Services" icon="🌐">
          <Text style={[localStyles.bodyText, { color: theme.textMuted }]}>
            We may use trusted third-party services to enhance your experience, including secure cloud hosting for our servers and databases, and push notification services to keep you updated on active rooms.
          </Text>
        </Section>

        <Section title="Your Rights & Choices" icon="🛡️">
          <BulletPoint text="Access, update, or delete your account information" />
          <BulletPoint text="Delete your submitted feedback from the My Feedback history" />
          <BulletPoint text="Teachers can permanently delete rooms and all associated data" />
          <BulletPoint text="Revoke camera permissions at any time via device settings" />
        </Section>

        <Section title="Contact Us" icon="📧">
          <Text style={[localStyles.bodyText, { color: theme.textMuted, marginBottom: 10 }]}>
            If you have any questions or concerns about this Privacy Policy, please reach out to us:
          </Text>
          <View style={[localStyles.contactCard, { backgroundColor: theme.background }]}>
            <Text style={[localStyles.contactLabel, { color: theme.textPrimary }]}>General Inquiries</Text>
            <Text style={[localStyles.contactEmail, { color: theme.accent }]}>info@codroidhub.com</Text>
          </View>
          <View style={[localStyles.contactCard, { backgroundColor: theme.background, marginTop: 10 }]}>
            <Text style={[localStyles.contactLabel, { color: theme.textPrimary }]}>Data Protection Officer</Text>
            <Text style={[localStyles.contactEmail, { color: theme.accent }]}>info@codroidhub.com</Text>
          </View>
        </Section>

        <Text style={[localStyles.footerText, { color: theme.textMuted }]}>
          © 2026 CodroidHub. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 20,
  },
  topBanner: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
  },
  lastUpdated: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  section: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionContent: {
    paddingLeft: 4,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    marginRight: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactCard: {
    padding: 15,
    borderRadius: 12,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 15,
    fontWeight: '800',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 20,
    fontWeight: '600',
  },
});
