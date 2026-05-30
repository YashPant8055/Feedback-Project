import React from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    const theme = this.props.theme || {};

    if (this.state.hasError) {
      return (
        <View style={[errorStyles.root, { backgroundColor: theme.background || '#07111f' }]}>
          <Text style={[errorStyles.title, { color: theme.textPrimary || '#f8fbff' }]}>Something went wrong</Text>
          <Text style={[errorStyles.message, { color: theme.textMuted || '#94a3b8' }]}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Pressable
            style={[errorStyles.button, { backgroundColor: theme.accent || '#4f46e5' }]}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={[errorStyles.buttonText, { color: theme.onAccent || '#ffffff' }]}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
