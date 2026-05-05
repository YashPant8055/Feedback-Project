import React, { forwardRef, useEffect, useRef } from 'react';
import { View } from 'react-native';

export const PlatformWebView = forwardRef(({ source, onMessage, style, ...props }, ref) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    // Expose postMessage method on the forwarded ref to mimic WebView
    if (ref) {
      if (typeof ref === 'function') {
        ref({
          postMessage: (msg) => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
              iframeRef.current.contentWindow.postMessage(msg, "*");
            }
          }
        });
      } else {
        ref.current = {
          postMessage: (msg) => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
              iframeRef.current.contentWindow.postMessage(msg, "*");
            }
          }
        };
      }
    }

    const handleWebMessage = (event) => {
      // Create a mock nativeEvent so the existing onMessage handler works unmodified
      try {
        if (event.data && onMessage) {
           onMessage({ nativeEvent: { data: event.data } });
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [ref, onMessage]);

  return (
    <View style={style}>
      <iframe
        ref={iframeRef}
        srcDoc={source?.html || ""}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="camera; microphone"
        sandbox="allow-scripts allow-same-origin"
      />
    </View>
  );
});
