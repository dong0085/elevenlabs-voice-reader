// Cross-browser compatibility wrapper
const ext = typeof browser !== 'undefined' ? browser : chrome;

// DOM Elements
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyBanner = document.getElementById('apiKeyBanner');
const bannerSetupBtn = document.getElementById('bannerSetupBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibilityBtn');
const modelIdInput = document.getElementById('modelIdInput');
const modelBadge = document.getElementById('modelBadge');
const stabilityInput = document.getElementById('stabilityInput');
const stabilityVal = document.getElementById('stabilityVal');
const similarityInput = document.getElementById('similarityInput');
const similarityVal = document.getElementById('similarityVal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const testApiKeyBtn = document.getElementById('testApiKeyBtn');
const accountInfo = document.getElementById('accountInfo');

const voiceSelect = document.getElementById('voiceSelect');
const previewVoiceBtn = document.getElementById('previewVoiceBtn');
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const clearTextBtn = document.getElementById('clearTextBtn');
const getSelectionBtn = document.getElementById('getSelectionBtn');
const speedSlider = document.getElementById('speedSlider');
const speedVal = document.getElementById('speedVal');
const speedDecBtn = document.getElementById('speedDecBtn');
const speedIncBtn = document.getElementById('speedIncBtn');
const resetSpeedBtn = document.getElementById('resetSpeedBtn');
const generateBtn = document.getElementById('generateBtn');
const btnSpinner = document.getElementById('btnSpinner');
const btnPlayIcon = document.getElementById('btnPlayIcon');
const btnText = document.getElementById('btnText');

const playerCard = document.getElementById('playerCard');
const playerLabel = document.getElementById('playerLabel');
const audioElement = document.getElementById('audioElement');
const seekSlider = document.getElementById('seekSlider');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const durationDisplay = document.getElementById('durationDisplay');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const seekBackBtn = document.getElementById('seekBackBtn');
const seekForwardBtn = document.getElementById('seekForwardBtn');
const downloadAudioLink = document.getElementById('downloadAudioLink');

const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const toastEl = document.getElementById('toast');

// State
let currentVoicePreviews = {};
let currentAudioBlobUrl = null;

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  checkForSelectedText();
  renderHistory();
});

async function loadSettings() {
  const result = await ext.storage.local.get({
    apiKey: '',
    modelId: 'eleven_v4',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    stability: 0.5,
    similarityBoost: 0.75,
    playbackSpeed: 1.0,
    voices: []
  });

  apiKeyInput.value = result.apiKey;
  modelIdInput.value = result.modelId || 'eleven_v4';
  modelBadge.textContent = result.modelId || 'eleven_v4';
  stabilityInput.value = result.stability;
  stabilityVal.textContent = parseFloat(result.stability).toFixed(2);
  similarityInput.value = result.similarityBoost;
  similarityVal.textContent = parseFloat(result.similarityBoost).toFixed(2);
  updateSpeed(result.playbackSpeed || 1.0, false);

  if (!result.apiKey) {
    apiKeyBanner.classList.remove('hidden');
  } else {
    apiKeyBanner.classList.add('hidden');
  }

  // Populate voices
  if (result.voices && result.voices.length > 0) {
    populateVoiceSelect(result.voices, result.voiceId);
  } else {
    // If we have an API key, fetch voices automatically in background
    if (result.apiKey) {
      fetchAndStoreVoices(result.apiKey, result.voiceId);
    }
  }
}

function populateVoiceSelect(voices, selectedId) {
  voiceSelect.replaceChildren();
  currentVoicePreviews = {};

  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voice_id;
    opt.textContent = `${v.name}${v.category ? ' (' + v.category + ')' : ''}`;
    if (v.voice_id === selectedId) {
      opt.selected = true;
    }
    voiceSelect.appendChild(opt);

    if (v.preview_url) {
      currentVoicePreviews[v.voice_id] = v.preview_url;
    }
  });

  // If selectedId wasn't set, default to first
  if (!voiceSelect.value && voices.length > 0) {
    voiceSelect.value = voices[0].voice_id;
  }
}

function setupEventListeners() {
  // Settings toggle
  toggleSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });

  bannerSetupBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
    apiKeyInput.focus();
  });

  // Key visibility toggle
  toggleKeyVisibilityBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyVisibilityBtn.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyVisibilityBtn.textContent = 'Show';
    }
  });

  // Range slider labels
  stabilityInput.addEventListener('input', () => {
    stabilityVal.textContent = parseFloat(stabilityInput.value).toFixed(2);
  });

  similarityInput.addEventListener('input', () => {
    similarityVal.textContent = parseFloat(similarityInput.value).toFixed(2);
  });

  // Save Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const modelId = modelIdInput.value.trim() || 'eleven_v4';
    const stability = parseFloat(stabilityInput.value);
    const similarityBoost = parseFloat(similarityInput.value);

    await ext.storage.local.set({
      apiKey,
      modelId,
      stability,
      similarityBoost
    });

    modelBadge.textContent = modelId;

    if (apiKey) {
      apiKeyBanner.classList.add('hidden');
      showToast('Settings saved successfully!');
      // Refresh voices if list is empty
      const stored = await ext.storage.local.get({ voices: [] });
      if (stored.voices.length === 0) {
        fetchAndStoreVoices(apiKey, voiceSelect.value);
      }
    } else {
      apiKeyBanner.classList.remove('hidden');
      showToast('Settings saved (API key missing)');
    }

    settingsPanel.classList.add('hidden');
  });

  // Verify API Key
  testApiKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showToast('Enter an API key first');
      return;
    }

    testApiKeyBtn.disabled = true;
    testApiKeyBtn.textContent = 'Checking...';
    accountInfo.classList.remove('hidden');
    accountInfo.textContent = 'Connecting to ElevenLabs...';

    try {
      // 1. Verify User endpoint
      const userRes = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': key }
      });

      if (!userRes.ok) {
        const err = await userRes.json();
        throw new Error(err.detail?.message || err.message || 'Invalid API key');
      }

      const userData = await userRes.json();
      const sub = userData.subscription || {};
      const remaining = (sub.character_limit || 0) - (sub.character_count || 0);

      accountInfo.replaceChildren();

      const statusLine = document.createElement('div');
      const statusStrong = document.createElement('strong');
      statusStrong.textContent = 'Status: Connected';
      statusLine.appendChild(statusStrong);

      const tierLine = document.createElement('div');
      tierLine.textContent = 'Tier: ';
      const tierCode = document.createElement('code');
      tierCode.textContent = sub.tier || 'Standard';
      tierLine.appendChild(tierCode);

      const usedLine = document.createElement('div');
      usedLine.textContent = 'Used: ';
      const usedStrong = document.createElement('strong');
      usedStrong.textContent = (sub.character_count || 0).toLocaleString();
      usedLine.appendChild(usedStrong);
      usedLine.appendChild(document.createTextNode(` / ${(sub.character_limit || 0).toLocaleString()} chars`));

      const remLine = document.createElement('div');
      remLine.textContent = 'Remaining: ';
      const remStrong = document.createElement('strong');
      remStrong.textContent = Math.max(0, remaining).toLocaleString();
      remLine.appendChild(remStrong);
      remLine.appendChild(document.createTextNode(' chars'));

      accountInfo.append(statusLine, tierLine, usedLine, remLine);

      // 2. Refresh Voice list
      await fetchAndStoreVoices(key, voiceSelect.value);
      showToast('API key verified & voices refreshed!');
    } catch (e) {
      accountInfo.replaceChildren();
      const errSpan = document.createElement('span');
      errSpan.style.color = '#ef4444';
      errSpan.textContent = `Error: ${e.message}`;
      accountInfo.appendChild(errSpan);
      showToast('Verification failed');
    } finally {
      testApiKeyBtn.disabled = false;
      testApiKeyBtn.textContent = 'Verify & Refresh';
    }
  });

  // Voice Selection Change
  voiceSelect.addEventListener('change', async () => {
    await ext.storage.local.set({ voiceId: voiceSelect.value });
  });

  // Voice Preview
  previewVoiceBtn.addEventListener('click', () => {
    const vId = voiceSelect.value;
    const previewUrl = currentVoicePreviews[vId];
    if (previewUrl) {
      const previewAudio = new Audio(previewUrl);
      previewAudio.play().catch(e => console.error(e));
      showToast('Playing voice sample...');
    } else {
      showToast('Sample unavailable for this voice');
    }
  });

  // Textarea helpers
  textInput.addEventListener('input', () => {
    const count = textInput.value.length;
    charCount.textContent = `${count.toLocaleString()} character${count === 1 ? '' : 's'}`;
  });

  clearTextBtn.addEventListener('click', () => {
    textInput.value = '';
    charCount.textContent = '0 characters';
    textInput.focus();
  });

  getSelectionBtn.addEventListener('click', async () => {
    try {
      const tabs = await ext.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return;

      const res = await ext.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => window.getSelection().toString()
      });

      if (res && res[0] && res[0].result && res[0].result.trim()) {
        textInput.value = res[0].result.trim();
        charCount.textContent = `${textInput.value.length} characters`;
        showToast('Selection imported!');
      } else {
        showToast('No text selected on page');
      }
    } catch (e) {
      console.warn(e);
      showToast('Select text directly on the page');
    }
  });

  // Generate Button
  generateBtn.addEventListener('click', handleGenerateSpeech);

  // Fine playback speed controls (0.05x steps)
  speedSlider.addEventListener('input', () => {
    updateSpeed(parseFloat(speedSlider.value));
  });

  speedDecBtn.addEventListener('click', () => {
    updateSpeed(parseFloat(speedSlider.value) - 0.05);
  });

  speedIncBtn.addEventListener('click', () => {
    updateSpeed(parseFloat(speedSlider.value) + 0.05);
  });

  resetSpeedBtn.addEventListener('click', () => {
    updateSpeed(1.0);
  });

  // Audio player events
  setupAudioPlayer();

  // Clear history
  clearHistoryBtn.addEventListener('click', async () => {
    await ext.storage.local.set({ history: [] });
    renderHistory();
    showToast('History cleared');
  });
}

async function checkForSelectedText() {
  try {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const res = await ext.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => window.getSelection().toString()
    });

    if (res && res[0] && res[0].result && res[0].result.trim()) {
      textInput.value = res[0].result.trim();
      charCount.textContent = `${textInput.value.length} characters`;
    }
  } catch {
    // Non-fatal if page permissions restrict scripting
  }
}

async function fetchAndStoreVoices(apiKey, currentSelectedId) {
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey }
    });

    if (!res.ok) return;

    const data = await res.json();
    if (data.voices && Array.isArray(data.voices)) {
      const voiceList = data.voices.map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url
      }));

      await ext.storage.local.set({ voices: voiceList });
      populateVoiceSelect(voiceList, currentSelectedId);
    }
  } catch (e) {
    console.error('Failed to fetch voices:', e);
  }
}

async function handleGenerateSpeech() {
  const text = textInput.value.trim();
  if (!text) {
    showToast('Please enter some text');
    textInput.focus();
    return;
  }

  const stored = await ext.storage.local.get({
    apiKey: '',
    modelId: 'eleven_v4',
    stability: 0.5,
    similarityBoost: 0.75
  });

  if (!stored.apiKey) {
    showToast('Please set your ElevenLabs API Key');
    settingsPanel.classList.remove('hidden');
    apiKeyInput.focus();
    return;
  }

  const voiceId = voiceSelect.value;
  const modelId = stored.modelId || 'eleven_v4';

  setGeneratingState(true);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': stored.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text,
        model_id: modelId,
        voice_settings: {
          stability: parseFloat(stored.stability) || 0.5,
          similarity_boost: parseFloat(stored.similarityBoost) || 0.75
        }
      })
    });

    if (!response.ok) {
      let errorMsg = `API request failed (${response.status})`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail?.message || errJson.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    // Play audio
    loadAndPlayAudio(dataUrl, `eleven_v4 (${voiceSelect.selectedOptions[0]?.text || 'Voice'})`);

    // Save to history
    await saveToHistory({
      text: text,
      voiceName: voiceSelect.selectedOptions[0]?.text || 'Voice',
      modelId: modelId,
      audioData: dataUrl,
      timestamp: Date.now()
    });

    renderHistory();
    showToast('Audio ready!');
  } catch (error) {
    console.error('TTS error:', error);
    showToast(error.message || 'Generation failed');
  } finally {
    setGeneratingState(false);
  }
}

function setGeneratingState(isGenerating) {
  if (isGenerating) {
    generateBtn.disabled = true;
    btnSpinner.classList.remove('hidden');
    btnPlayIcon.classList.add('hidden');
    btnText.textContent = 'Generating...';
  } else {
    generateBtn.disabled = false;
    btnSpinner.classList.add('hidden');
    btnPlayIcon.classList.remove('hidden');
    btnText.textContent = 'Generate & Play';
  }
}

function updateSpeed(newSpeed, save = true) {
  const clamped = Math.min(2.5, Math.max(0.5, Math.round(newSpeed * 20) / 20));
  speedSlider.value = clamped;
  speedVal.textContent = clamped.toFixed(2) + 'x';
  audioElement.playbackRate = clamped;
  if (save) {
    ext.storage.local.set({ playbackSpeed: clamped });
  }
}

function loadAndPlayAudio(audioSrc, label) {
  if (currentAudioBlobUrl) {
    URL.revokeObjectURL(currentAudioBlobUrl);
  }

  audioElement.src = audioSrc;
  audioElement.playbackRate = parseFloat(speedSlider.value) || 1.0;
  playerLabel.textContent = label || 'Now Playing';
  downloadAudioLink.href = audioSrc;
  playerCard.classList.remove('hidden');

  audioElement.play().catch(e => console.warn('Autoplay blocked:', e));
}

function setupAudioPlayer() {
  playPauseBtn.addEventListener('click', () => {
    if (audioElement.paused) {
      audioElement.play();
    } else {
      audioElement.pause();
    }
  });

  audioElement.addEventListener('play', () => {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  });

  audioElement.addEventListener('pause', () => {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  });

  audioElement.addEventListener('timeupdate', () => {
    if (!isNaN(audioElement.duration) && audioElement.duration > 0) {
      const progress = (audioElement.currentTime / audioElement.duration) * 100;
      seekSlider.value = progress;
      currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
      durationDisplay.textContent = formatTime(audioElement.duration);
    }
  });

  audioElement.addEventListener('loadedmetadata', () => {
    durationDisplay.textContent = formatTime(audioElement.duration);
  });

  seekSlider.addEventListener('input', () => {
    if (!isNaN(audioElement.duration)) {
      audioElement.currentTime = (seekSlider.value / 100) * audioElement.duration;
    }
  });

  seekBackBtn.addEventListener('click', () => {
    audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
  });

  seekForwardBtn.addEventListener('click', () => {
    audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + 5);
  });
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function saveToHistory(item) {
  const stored = await ext.storage.local.get({ history: [] });
  const history = stored.history || [];

  // Keep up to 5 most recent clips
  history.unshift(item);
  if (history.length > 5) {
    history.pop();
  }

  await ext.storage.local.set({ history });
}

async function renderHistory() {
  const stored = await ext.storage.local.get({ history: [] });
  const items = stored.history || [];

  if (items.length === 0) {
    historySection.classList.add('hidden');
    return;
  }

  historySection.classList.remove('hidden');
  historyList.replaceChildren();

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'history-item';

    const snippet = document.createElement('div');
    snippet.className = 'history-snippet';
    snippet.title = item.text || '';
    snippet.textContent = item.text || '';

    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = item.modelId || 'eleven_v4';

    el.replaceChildren(snippet, meta);

    el.addEventListener('click', () => {
      textInput.value = item.text;
      charCount.textContent = `${item.text.length} characters`;
      loadAndPlayAudio(item.audioData, `${item.modelId || 'eleven_v4'} (${item.voiceName || 'Voice'})`);
    });

    historyList.appendChild(el);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let toastTimeout = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2800);
}
