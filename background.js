// Cross-browser compatibility
const ext = typeof browser !== 'undefined' ? browser : chrome;

// Initialize on install
ext.runtime.onInstalled.addListener(async () => {
  // Set default settings if not existing
  const current = await ext.storage.local.get(['modelId', 'stability', 'similarityBoost', 'voiceId']);
  const defaults = {};
  if (!current.modelId) defaults.modelId = 'eleven_v4';
  if (current.stability === undefined) defaults.stability = 0.5;
  if (current.similarityBoost === undefined) defaults.similarityBoost = 0.75;
  if (!current.voiceId) defaults.voiceId = '21m00Tcm4TlvDq8ikWAM';

  if (Object.keys(defaults).length > 0) {
    await ext.storage.local.set(defaults);
  }

  // Create context menu item
  ext.contextMenus.removeAll(() => {
    ext.contextMenus.create({
      id: 'elevenlabs-read-selection',
      title: 'Read with ElevenLabs (eleven_v4)',
      contexts: ['selection']
    });
  });
});

// Handle context menu click
ext.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'elevenlabs-read-selection') return;
  if (!tab || !tab.id) return;

  const selectedText = (info.selectionText || '').trim();
  if (!selectedText) return;

  const settings = await ext.storage.local.get({
    apiKey: '',
    modelId: 'eleven_v4',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    stability: 0.5,
    similarityBoost: 0.75,
    playbackSpeed: 1.0
  });

  if (!settings.apiKey) {
    try {
      await ext.tabs.sendMessage(tab.id, {
        type: 'TTS_NOTIFICATION',
        status: 'error',
        message: 'Please set your ElevenLabs API key in the extension popup.'
      });
    } catch (e) {
      console.warn('Could not send message to tab:', e);
    }
    return;
  }

  // Notify page that generation has started
  try {
    await ext.tabs.sendMessage(tab.id, {
      type: 'TTS_STARTED',
      modelId: settings.modelId || 'eleven_v4'
    });
  } catch (e) {
    // If content script was not ready, try injecting it
    try {
      await ext.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await ext.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      await ext.tabs.sendMessage(tab.id, {
        type: 'TTS_STARTED',
        modelId: settings.modelId || 'eleven_v4'
      });
    } catch (injectErr) {
      console.warn('Could not inject content script:', injectErr);
      return;
    }
  }

  try {
    const voiceId = settings.voiceId || '21m00Tcm4TlvDq8ikWAM';
    const modelId = settings.modelId || 'eleven_v4';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': settings.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: selectedText,
        model_id: modelId,
        voice_settings: {
          stability: parseFloat(settings.stability) || 0.5,
          similarity_boost: parseFloat(settings.similarityBoost) || 0.75
        }
      })
    });

    if (!response.ok) {
      let errorMsg = `ElevenLabs API error (${response.status})`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail?.message || errJson.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = arrayBufferToBase64(arrayBuffer);
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    // Send audio to active tab to play
    await ext.tabs.sendMessage(tab.id, {
      type: 'TTS_READY',
      audioUrl: audioDataUrl,
      text: selectedText,
      modelId: modelId,
      speed: settings.playbackSpeed || 1.0
    });

    // Save to local storage history
    const stored = await ext.storage.local.get({ history: [] });
    const history = stored.history || [];
    history.unshift({
      text: selectedText,
      voiceName: 'Voice',
      modelId: modelId,
      audioData: audioDataUrl,
      timestamp: Date.now()
    });
    if (history.length > 5) history.pop();
    await ext.storage.local.set({ history });

  } catch (err) {
    console.error('ElevenLabs TTS error:', err);
    try {
      await ext.tabs.sendMessage(tab.id, {
        type: 'TTS_NOTIFICATION',
        status: 'error',
        message: err.message || 'Failed to generate speech.'
      });
    } catch {}
  }
});

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
