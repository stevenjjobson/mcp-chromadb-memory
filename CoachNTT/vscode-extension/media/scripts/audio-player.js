(function() {
    const vscode = acquireVsCodeApi();

    // Elements
    const audioElement = document.getElementById('audio-element');
    const playPauseButton = document.getElementById('play-pause-button');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const volumeSlider = document.getElementById('volume-slider');
    const speedSelect = document.getElementById('speed-select');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    const trackTitle = document.getElementById('track-title');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const queueList = document.getElementById('queue-list');
    const queueCount = document.getElementById('queue-count');
    const waveformCanvas = document.getElementById('waveform');

    // State
    let queue = [];
    let currentIndex = -1;
    let audioContext = null;
    let analyser = null;
    let animationId = null;

    // Initialize
    function initialize() {
        // Set up event listeners
        playPauseButton.addEventListener('click', togglePlayPause);
        prevButton.addEventListener('click', playPrevious);
        nextButton.addEventListener('click', playNext);
        volumeSlider.addEventListener('input', updateVolume);
        speedSelect.addEventListener('change', updateSpeed);
        progressBar.addEventListener('click', seek);

        // Audio element events
        audioElement.addEventListener('loadedmetadata', updateDuration);
        audioElement.addEventListener('timeupdate', updateProgress);
        audioElement.addEventListener('ended', onEnded);
        audioElement.addEventListener('play', onPlay);
        audioElement.addEventListener('pause', onPause);
        audioElement.addEventListener('error', onError);

        // Initialize audio context for visualization
        initializeAudioContext();

        // Set initial volume
        audioElement.volume = volumeSlider.value / 100;

        // Notify extension that player is ready
        vscode.postMessage({ command: 'ready' });
    }

    // Initialize audio context for waveform visualization
    function initializeAudioContext() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            const source = audioContext.createMediaElementSource(audioElement);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }

    // Play/Pause toggle
    function togglePlayPause() {
        if (audioElement.paused) {
            play();
        } else {
            pause();
        }
    }

    function play() {
        audioElement.play().then(() => {
            vscode.postMessage({ command: 'play' });
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }).catch(error => {
            console.error('Play failed:', error);
            showError('Failed to play audio');
        });
    }

    function pause() {
        audioElement.pause();
        vscode.postMessage({ command: 'pause' });
    }

    function playPrevious() {
        vscode.postMessage({ command: 'previous' });
    }

    function playNext() {
        vscode.postMessage({ command: 'next' });
    }

    // Volume control
    function updateVolume() {
        const volume = volumeSlider.value / 100;
        audioElement.volume = volume;
        vscode.postMessage({ command: 'volume', volume });
    }

    // Speed control
    function updateSpeed() {
        const speed = parseFloat(speedSelect.value);
        audioElement.playbackRate = speed;
        vscode.postMessage({ command: 'speed', speed });
    }

    // Seek functionality
    function seek(event) {
        const rect = progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const time = percent * audioElement.duration;
        
        if (!isNaN(time)) {
            audioElement.currentTime = time;
            vscode.postMessage({ command: 'seek', position: time });
        }
    }

    // Update progress bar and time display
    function updateProgress() {
        const current = audioElement.currentTime;
        const duration = audioElement.duration;
        
        if (!isNaN(duration)) {
            const percent = (current / duration) * 100;
            progressFill.style.width = percent + '%';
            currentTimeSpan.textContent = formatTime(current);
        }
    }

    // Update duration display
    function updateDuration() {
        const duration = audioElement.duration;
        if (!isNaN(duration)) {
            durationSpan.textContent = formatTime(duration);
        }
    }

    // Format time in mm:ss
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Audio events
    function onPlay() {
        playPauseButton.innerHTML = '<i class="codicon codicon-debug-pause"></i>';
        startVisualization();
    }

    function onPause() {
        playPauseButton.innerHTML = '<i class="codicon codicon-play"></i>';
        stopVisualization();
    }

    function onEnded() {
        vscode.postMessage({ command: 'playbackEnded' });
    }

    function onError(event) {
        console.error('Audio error:', event);
        showError('Failed to load audio');
    }

    // Queue management
    function updateQueue(newQueue, newIndex) {
        queue = newQueue;
        currentIndex = newIndex;
        
        queueCount.textContent = `(${queue.length})`;
        queueList.innerHTML = '';
        
        queue.forEach((item, index) => {
            const queueItem = document.createElement('div');
            queueItem.className = 'queue-item';
            if (index === currentIndex) {
                queueItem.classList.add('current');
            }
            
            const title = document.createElement('span');
            title.className = 'queue-item-title';
            title.textContent = item.title;
            
            const removeButton = document.createElement('button');
            removeButton.className = 'queue-item-remove';
            removeButton.innerHTML = '<i class="codicon codicon-close"></i>';
            removeButton.onclick = () => removeFromQueue(index);
            
            queueItem.appendChild(title);
            queueItem.appendChild(removeButton);
            queueList.appendChild(queueItem);
        });
    }

    function removeFromQueue(index) {
        vscode.postMessage({ command: 'removeFromQueue', index });
    }

    // Load and play audio
    function loadAndPlay(item, index) {
        currentIndex = index;
        trackTitle.textContent = item.title;
        
        // Set source and load
        audioElement.src = item.url;
        audioElement.load();
        
        // Play when ready
        audioElement.addEventListener('canplay', () => {
            play();
        }, { once: true });
    }

    // Waveform visualization
    function startVisualization() {
        if (!analyser) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const ctx = waveformCanvas.getContext('2d');
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;
        
        function draw() {
            animationId = requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);
            
            const barWidth = (width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * height;
                
                const hue = (i / bufferLength) * 120 + 200; // Blue to purple
                ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        }
        
        draw();
    }

    function stopVisualization() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // Error display
    function showError(message) {
        trackTitle.textContent = message;
        trackTitle.style.color = 'var(--vscode-errorForeground)';
        setTimeout(() => {
            trackTitle.style.color = '';
        }, 3000);
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'loadAndPlay':
                loadAndPlay(message.item, message.index);
                break;
            
            case 'play':
                play();
                break;
            
            case 'pause':
                pause();
                break;
            
            case 'stop':
                audioElement.pause();
                audioElement.currentTime = 0;
                trackTitle.textContent = 'No track loaded';
                break;
            
            case 'seek':
                audioElement.currentTime = message.position;
                break;
            
            case 'setVolume':
                audioElement.volume = message.volume;
                volumeSlider.value = message.volume * 100;
                break;
            
            case 'setSpeed':
                audioElement.playbackRate = message.speed;
                speedSelect.value = message.speed;
                break;
            
            case 'updateQueue':
                updateQueue(message.queue, message.currentIndex);
                break;
        }
    });

    // Resize canvas
    function resizeCanvas() {
        const container = waveformCanvas.parentElement;
        waveformCanvas.width = container.clientWidth;
        waveformCanvas.height = 60;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();