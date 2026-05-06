export function getSelfieEmotionHtml(apiBaseUrl) {
  var modelUrl = apiBaseUrl + "/models";
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body { width:100%; height:100%; margin:0; overflow:hidden; background:#07111f; color:#f8fbff; font-family:system-ui,sans-serif; }
      #status { box-sizing:border-box; width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding:18px; text-align:center; color:#b8c7df; font-size:13px; line-height:1.5; }
      img { display:none; }
    </style>
  </head>
  <body>
    <div id="status">Emotion analyzer is loading...</div>
    <img id="selfie" alt="selfie" />
    <script>
      var MODEL_URL = "${modelUrl}";
      var statusNode = document.getElementById("status");
      var imageNode = document.getElementById("selfie");
      var modelsPromise = null;
      var faceApiLoaded = false;

      function sendToRN(p) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(p));
          } else if (window.parent && window.parent.postMessage) {
            window.parent.postMessage(JSON.stringify(p), "*");
          }
        } catch(e) {}
      }

      function setStatus(m) { statusNode.textContent = m; }

      // Catch ALL uncaught errors and send them back
      window.onerror = function(msg, url, line, col, error) {
        sendToRN({ok:false, faceDetected:false, message:"WebView error: " + msg});
        return true;
      };

      window.addEventListener("unhandledrejection", function(event) {
        sendToRN({ok:false, faceDetected:false, message:"WebView promise error: " + (event.reason ? event.reason.message || String(event.reason) : "unknown")});
      });

      function getReview(e) {
        if(e==="happy") return "good";
        if(e==="neutral"||e==="surprised") return "average";
        return "bad";
      }

      function topExpr(ex) {
        return Object.entries(ex).sort(function(a,b){return b[1]-a[1]})[0];
      }

      function loadModels() {
        if(!modelsPromise) {
          if (typeof faceapi === "undefined") {
            modelsPromise = Promise.reject(new Error("face-api.js library failed to load from CDN. Check your internet connection."));
          } else {
            modelsPromise = Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
              faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
          }
        }
        return modelsPromise;
      }

      function analyzeImage(base64) {
        setStatus("Loading emotion model...");
        loadModels().then(function() {
          setStatus("Analyzing expression...");
          imageNode.onload = function() {
            faceapi.detectSingleFace(imageNode, new faceapi.TinyFaceDetectorOptions({inputSize:416, scoreThreshold:0.4}))
              .withFaceExpressions()
              .then(function(result) {
                if(!result) {
                  sendToRN({ok:false, faceDetected:false, status:"no-face", message:"No face detected. Please retake the selfie with better lighting and face the camera directly."});
                  setStatus("No face detected.");
                  return;
                }
                var top = topExpr(result.expressions);
                sendToRN({ok:true, faceDetected:true, emotion:top[0], confidence:top[1], review:getReview(top[0]), expressions:result.expressions});
                setStatus("Analysis complete.");
              })
              .catch(function(err) {
                sendToRN({ok:false, faceDetected:false, message:"Detection error: " + (err.message||"Analysis failed.")});
                setStatus("Analysis failed.");
              });
          };
          imageNode.onerror = function() {
            sendToRN({ok:false, faceDetected:false, message:"Failed to load the captured image for analysis."});
            setStatus("Image load failed.");
          };
          
          // Clean the base64 string and ensure correct prefix
          var cleanBase64 = base64.replace(/\s/g, "");
          if (!cleanBase64.startsWith("data:")) {
            cleanBase64 = "data:image/jpeg;base64," + cleanBase64;
          }
          imageNode.src = cleanBase64;
        }).catch(function(err) {
          sendToRN({ok:false, faceDetected:false, message:"Model load error: " + (err.message||"Could not load emotion model.")});
          setStatus("Could not load model.");
        });
      }

      function handleMessage(event) {
        try {
          var p = JSON.parse(event.data);
          if(p.type==="analyze" && p.base64) {
            analyzeImage(p.base64);
          }
        } catch(e) {
          sendToRN({ok:false, faceDetected:false, message:"Message parse error: " + e.message});
        }
      }

      document.addEventListener("message", handleMessage);
      window.addEventListener("message", handleMessage);

      // Load the face-api script dynamically so we can detect failures
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
      script.onload = function() {
        faceApiLoaded = true;
        setStatus("Emotion analyzer ready.");
        sendToRN({type:"ready"});
      };
      script.onerror = function() {
        setStatus("Failed to load emotion library. Check internet.");
        sendToRN({ok:false, faceDetected:false, message:"Failed to load face-api.js from CDN. Make sure your phone has a working internet connection."});
      };
      document.head.appendChild(script);
    </script>
  </body>
</html>`;
}

export function mapEmotionToFeedback(emotion) {
  if (emotion === "happy") return "good";
  if (emotion === "neutral") return "average";
  return "bad";
}

/**
 * Simple sentiment analysis helper to determine the 'vibe' of written feedback.
 * Returns 'good', 'average', or 'bad'.
 */
export function getSentimentVibe(text = "") {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return "average";

  const positiveWords = [
    "good", "great", "excellent", "amazing", "wonderful", "happy", "love", "perfect",
    "best", "nice", "helpful", "thanks", "thank", "awesome", "fantastic", "cool",
    "learned", "interesting", "enjoyed", "fun", "clear", "well", "positive"
  ];

  const negativeWords = [
    "bad", "terrible", "horrible", "awful", "sad", "hate", "worst", "poor", "slow",
    "confusing", "hard", "difficult", "boring", "angry", "annoyed", "wrong", "fail",
    "broken", "negative", "no", "not", "unhappy", "frustrated"
  ];

  let score = 0;
  
  // Basic word matching
  positiveWords.forEach(word => {
    if (normalized.includes(word)) score += 1;
  });

  negativeWords.forEach(word => {
    if (normalized.includes(word)) score -= 1;
  });

  if (score > 0) return "good";
  if (score < 0) return "bad";
  return "average";
}

/**
 * Format time remaining for a room expiry.
 * Returns human-readable format like "1 hour 23 min" or "45 min" or "Closed".
 */
export function formatTimeRemaining(expiresAt, status) {
  if (!expiresAt || status === "closed") return null;
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;
  
  if (diff <= 0) return "Closed";
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
  }
  return `${minutes} min`;
}

/**
 * Format time passed since room creation.
 * Returns human-readable format like "2h 15m" or "45m".
 */
export function formatTimePassed(createdAt) {
  if (!createdAt) return "Just now";
  
  const now = new Date();
  const created = new Date(createdAt);
  const diff = now - created;
  
  if (diff < 60000) return "Just now";
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
