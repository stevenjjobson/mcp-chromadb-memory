(function() {
    const vscode = acquireVsCodeApi();

    // Elements
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const clearButton = document.getElementById('clear-button');
    const exportButton = document.getElementById('export-button');
    const settingsButton = document.getElementById('settings-button');

    // State
    let isProcessing = false;
    const messages = [];
    let currentStreamingMessage = null;
    const streamingMessages = new Map();

    // Initialize
    function initialize() {
        // Set up event listeners
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', handleKeyDown);
        clearButton.addEventListener('click', clearConversation);
        exportButton.addEventListener('click', exportConversation);
        settingsButton.addEventListener('click', openSettings);

        // Auto-resize textarea
        messageInput.addEventListener('input', autoResizeTextarea);

        // Notify extension that webview is ready
        vscode.postMessage({ command: 'ready' });
    }

    // Send message
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || isProcessing) return;

        // Clear input
        messageInput.value = '';
        autoResizeTextarea();

        // Send to extension
        vscode.postMessage({
            command: 'sendMessage',
            text: text
        });

        // Update UI
        isProcessing = true;
        updateSendButton();
    }

    // Handle keyboard shortcuts
    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    // Auto-resize textarea
    function autoResizeTextarea() {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    }

    // Add message to conversation
    function addMessage(message) {
        messages.push(message);

        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}`;

        const avatarEl = document.createElement('div');
        avatarEl.className = 'avatar';
        avatarEl.innerHTML = message.role === 'user' 
            ? '<i class="codicon codicon-account"></i>' 
            : '<i class="codicon codicon-hubot"></i>';

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';

        if (message.role === 'assistant') {
            // For assistant messages, we'll render markdown
            contentEl.innerHTML = renderMarkdown(message.content);
            highlightCode(contentEl);
        } else {
            contentEl.textContent = message.content;
        }

        const timeEl = document.createElement('div');
        timeEl.className = 'message-time';
        timeEl.textContent = formatTime(message.timestamp);

        messageEl.appendChild(avatarEl);
        
        const messageBody = document.createElement('div');
        messageBody.className = 'message-body';
        messageBody.appendChild(contentEl);
        messageBody.appendChild(timeEl);
        
        messageEl.appendChild(messageBody);

        messagesContainer.appendChild(messageEl);
        scrollToBottom();

        if (message.role === 'assistant') {
            isProcessing = false;
            updateSendButton();
        }
    }

    // Render markdown (basic implementation - will be enhanced)
    function renderMarkdown(text) {
        // Basic markdown rendering
        let html = text
            // Code blocks
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');

        return html;
    }

    // Highlight code blocks (will integrate highlight.js)
    function highlightCode(element) {
        const codeBlocks = element.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            // Add copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button codicon codicon-copy';
            copyButton.title = 'Copy code';
            copyButton.onclick = () => copyCode(block);
            
            const pre = block.parentElement;
            pre.style.position = 'relative';
            pre.appendChild(copyButton);
        });
    }

    // Copy code to clipboard
    function copyCode(codeBlock) {
        const text = codeBlock.textContent;
        navigator.clipboard.writeText(text).then(() => {
            vscode.postMessage({
                command: 'info',
                text: 'Code copied to clipboard!'
            });
        });
    }

    // Format timestamp
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Handle streaming chunk
    function handleStreamingChunk(message) {
        let messageEl = streamingMessages.get(message.id);
        
        if (!messageEl) {
            // Create new streaming message element
            messageEl = document.createElement('div');
            messageEl.className = 'message assistant streaming';
            messageEl.id = `stream-${message.id}`;

            const avatarEl = document.createElement('div');
            avatarEl.className = 'avatar';
            avatarEl.innerHTML = '<i class="codicon codicon-hubot"></i>';

            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.innerHTML = renderMarkdown(message.content || '');

            const messageBody = document.createElement('div');
            messageBody.className = 'message-body';
            messageBody.appendChild(contentEl);
            
            messageEl.appendChild(avatarEl);
            messageEl.appendChild(messageBody);

            messagesContainer.appendChild(messageEl);
            streamingMessages.set(message.id, messageEl);
        } else {
            // Update existing streaming message
            const contentEl = messageEl.querySelector('.message-content');
            if (contentEl) {
                contentEl.innerHTML = renderMarkdown(message.content || '');
                highlightCode(contentEl);
            }
        }

        scrollToBottom();
    }

    // Scroll to bottom of messages
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Update send button state
    function updateSendButton() {
        if (isProcessing) {
            sendButton.className = 'codicon codicon-loading codicon-modifier-spin';
            sendButton.disabled = true;
        } else {
            sendButton.className = 'codicon codicon-send';
            sendButton.disabled = false;
        }
    }

    // Clear conversation
    function clearConversation() {
        if (confirm('Are you sure you want to clear the conversation?')) {
            messages.length = 0;
            messagesContainer.innerHTML = '';
            vscode.postMessage({ command: 'clearConversation' });
        }
    }

    // Export conversation
    function exportConversation() {
        vscode.postMessage({
            command: 'exportConversation',
            messages: messages
        });
    }

    // Open settings
    function openSettings() {
        vscode.postMessage({ command: 'openSettings' });
    }

    // Play audio
    function playAudio(audioData, mimeType) {
        try {
            // Get or create audio element
            let audioEl = document.getElementById('audio-element');
            const audioPlayer = document.getElementById('audio-player');
            
            // Convert base64 to blob
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            // Set source and play
            audioEl.src = url;
            audioEl.play();
            
            // Show audio player
            audioPlayer.style.display = 'block';
            
            // Clean up blob URL when done
            audioEl.addEventListener('ended', () => {
                URL.revokeObjectURL(url);
            }, { once: true });
            
        } catch (error) {
            console.error('Failed to play audio:', error);
            vscode.postMessage({
                command: 'error',
                message: 'Failed to play audio'
            });
        }
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'message':
                addMessage(message);
                break;
            
            case 'initialize':
                // Apply theme settings
                document.body.className = message.theme === 1 ? 'vscode-light' : 'vscode-dark';
                break;
            
            case 'clearMessages':
                messages.length = 0;
                messagesContainer.innerHTML = '';
                break;
            
            case 'streamStart':
                // Start of streaming response
                isProcessing = true;
                updateSendButton();
                break;
            
            case 'streamChunk':
                // Handle streaming chunks
                handleStreamingChunk(message);
                break;
            
            case 'streamEnd':
                // End of streaming response
                isProcessing = false;
                updateSendButton();
                // Remove streaming class from messages
                streamingMessages.forEach((messageEl) => {
                    messageEl.classList.remove('streaming');
                });
                streamingMessages.clear();
                break;
            
            case 'playAudio':
                // Handle audio playback
                playAudio(message.audioData, message.mimeType);
                break;
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();