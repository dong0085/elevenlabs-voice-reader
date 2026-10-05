(() => {
  // Guard against multiple injections
  if (window.__elevenlabs_reader_injected) return;
  window.__elevenlabs_reader_injected = true;

  const ext = typeof browser !== 'undefined' ? browser : chrome;

  let hostElement = null;
  let shadowRoot = null;
  let currentAudio = null;
  let toastTimer = null;

  function createSvg(width, height, viewBox, children) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', viewBox);
    children.forEach(child => svg.appendChild(child));
    return svg;
  }

  function createSvgNode(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  function ensureShadowRoot() {
    if (!hostElement) {
      hostElement = document.createElement('div');
      hostElement.id = 'elevenlabs-voice-reader-root';
      shadowRoot = hostElement.attachShadow({ mode: 'open' });
      document.documentElement.appendChild(hostElement);

      const style = document.createElement('style');
      style.textContent = `
        :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
        .eleven-floating-widget {
          position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
          display: flex; align-items: center; gap: 12px; background-color: #0f172a;
          color: #f8fafc; padding: 10px 16px; border-radius: 9999px; border: 1px solid #334155;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); font-size: 13px; user-select: none;
          animation: elevenSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes elevenSlide { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .eleven-badge { background: linear-gradient(135deg, #4f46e5, #9333ea); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; }
        .eleven-status-text { color: #e2e8f0; font-weight: 500; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .eleven-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #818cf8; border-radius: 50%; animation: elevenSpin 0.8s linear infinite; display: inline-block; }
        @keyframes elevenSpin { to { transform: rotate(360deg); } }
        .eleven-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .eleven-btn:hover { color: #fff; background-color: #334155; }
        .eleven-play-btn { background-color: #6366f1; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .eleven-play-btn:hover { background-color: #4f46e5; color: #fff; }
        .eleven-time { font-size: 11px; color: #94a3b8; font-variant-numeric: tabular-nums; }
        .eleven-toast { position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; background-color: #1e293b; border: 1px solid #ef4444; color: #f87171; padding: 12px 18px; border-radius: 12px; font-size: 13px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: elevenSlide 0.3s ease; max-width: 340px; }
      `;
      shadowRoot.appendChild(style);
    }
  }

  function removeWidget() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const widget = shadowRoot ? shadowRoot.querySelector('.eleven-floating-widget') : null;
    if (widget) {
      widget.remove();
    }
  }

  function createCloseButton() {
    const btn = document.createElement('button');
    btn.className = 'eleven-btn';
    btn.title = 'Close';

    const line1 = createSvgNode('line', { x1: '18', y1: '6', x2: '6', y2: '18' });
    const line2 = createSvgNode('line', { x1: '6', y1: '6', x2: '18', y2: '18' });
    const svg = createSvg('14', '14', '0 0 24 24', [line1, line2]);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    btn.appendChild(svg);
    btn.addEventListener('click', removeWidget);
    return btn;
  }

  function showLoadingWidget(modelId) {
    ensureShadowRoot();
    removeWidget();

    const widget = document.createElement('div');
    widget.className = 'eleven-floating-widget';

    const badge = document.createElement('span');
    badge.className = 'eleven-badge';
    badge.textContent = modelId || 'eleven_v4';

    const spinner = document.createElement('span');
    spinner.className = 'eleven-spinner';

    const text = document.createElement('span');
    text.className = 'eleven-status-text';
    text.textContent = 'Generating speech...';

    const closeBtn = createCloseButton();

    widget.replaceChildren(badge, spinner, text, closeBtn);
    shadowRoot.appendChild(widget);
  }

  function showPlayerWidget(audioUrl, modelId, speed) {
    ensureShadowRoot();
    removeWidget();

    currentAudio = new Audio(audioUrl);
    if (speed && typeof speed === 'number') {
      currentAudio.playbackRate = speed;
    }

    const widget = document.createElement('div');
    widget.className = 'eleven-floating-widget';

    const badge = document.createElement('span');
    badge.className = 'eleven-badge';
    badge.textContent = modelId || 'eleven_v4';

    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'eleven-btn eleven-play-btn';
    playPauseBtn.title = 'Play/Pause';

    const pauseRect1 = createSvgNode('rect', { x: '6', y: '4', width: '4', height: '16' });
    const pauseRect2 = createSvgNode('rect', { x: '14', y: '4', width: '4', height: '16' });
    const pauseIcon = createSvg('14', '14', '0 0 24 24', [pauseRect1, pauseRect2]);
    pauseIcon.setAttribute('fill', 'currentColor');

    const playPoly = createSvgNode('polygon', { points: '5 3 19 12 5 21 5 3' });
    const playIcon = createSvg('14', '14', '0 0 24 24', [playPoly]);
    playIcon.setAttribute('fill', 'currentColor');
    playIcon.style.display = 'none';

    playPauseBtn.appendChild(pauseIcon);
    playPauseBtn.appendChild(playIcon);

    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'eleven-time';
    timeDisplay.textContent = '0:00';

    const closeBtn = createCloseButton();

    playPauseBtn.addEventListener('click', () => {
      if (currentAudio.paused) {
        currentAudio.play();
      } else {
        currentAudio.pause();
      }
    });

    currentAudio.addEventListener('play', () => {
      pauseIcon.style.display = 'block';
      playIcon.style.display = 'none';
    });

    currentAudio.addEventListener('pause', () => {
      pauseIcon.style.display = 'none';
      playIcon.style.display = 'block';
    });

    currentAudio.addEventListener('timeupdate', () => {
      if (currentAudio.duration) {
        const cur = formatTime(currentAudio.currentTime);
        const dur = formatTime(currentAudio.duration);
        timeDisplay.textContent = `${cur} / ${dur}`;
      }
    });

    currentAudio.addEventListener('ended', () => {
      pauseIcon.style.display = 'none';
      playIcon.style.display = 'block';
    });

    widget.replaceChildren(badge, playPauseBtn, timeDisplay, closeBtn);
    shadowRoot.appendChild(widget);

    currentAudio.play().catch(e => {
      console.warn('Playback error / autoplay blocked:', e);
      pauseIcon.style.display = 'none';
      playIcon.style.display = 'block';
    });
  }

  function showToast(message) {
    ensureShadowRoot();
    const existing = shadowRoot.querySelector('.eleven-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'eleven-toast';
    toast.textContent = message;

    shadowRoot.appendChild(toast);

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Listen for background notifications
  ext.runtime.onMessage.addListener((message) => {
    if (message.type === 'TTS_STARTED') {
      showLoadingWidget(message.modelId);
    } else if (message.type === 'TTS_READY') {
      showPlayerWidget(message.audioUrl, message.modelId, message.speed);
    } else if (message.type === 'TTS_NOTIFICATION') {
      showToast(message.message);
    }
  });
})();
