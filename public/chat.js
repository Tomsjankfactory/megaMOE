class MoEChat {
    constructor() {
        this.baseUrl = window.location.origin;
        this.isLoading = false;
        
        // DOM elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.statusText = document.getElementById('status-text');
        this.statusIndicator = document.getElementById('status');
        this.charCount = document.getElementById('charCount');
        this.currentModelSpan = document.getElementById('currentModel');
        this.lastDecisionSpan = document.getElementById('lastDecision');
        
        this.initializeEventListeners();
        this.setupCodeBlockHandlers();
        this.checkSystemHealth();
        this.loadChatHistory();
    }

    initializeEventListeners() {
        // Send button click
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enter key in textarea (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeTextarea();
            this.updateSendButton();
        });

        // Clear chat button
        this.clearBtn.addEventListener('click', () => this.clearChat());

        // Initial setup
        this.updateCharCount();
        this.updateSendButton();
    }

    setupCodeBlockHandlers() {
        // Add global functions for code block interactions
        window.toggleCodeView = (codeId) => {
            const preview = document.getElementById(`preview-${codeId}`);
            const source = document.getElementById(`source-${codeId}`);
            const toggleButton = document.querySelector(`[onclick="toggleCodeView('${codeId}')"] .toggle-text`);
            
            if (source.style.display === 'none') {
                preview.style.display = 'none';
                source.style.display = 'block';
                toggleButton.textContent = 'Show Preview';
            } else {
                preview.style.display = 'block';
                source.style.display = 'none';
                toggleButton.textContent = 'Show Code';
            }
        };

        window.copyCode = (codeId) => {
            const sourceElement = document.querySelector(`#source-${codeId} code`);
            const text = sourceElement.textContent;
            
            navigator.clipboard.writeText(text).then(() => {
                // Show feedback
                const button = document.querySelector(`[onclick="copyCode('${codeId}')"]`);
                const originalText = button.innerHTML;
                button.innerHTML = '✅ Copied!';
                button.classList.add('copied');
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                const button = document.querySelector(`[onclick="copyCode('${codeId}')"]`);
                const originalText = button.innerHTML;
                button.innerHTML = '✅ Copied!';
                setTimeout(() => {
                    button.innerHTML = originalText;
                }, 2000);
            });
        };
    }

    updateCharCount() {
        const count = this.messageInput.value.length;
        this.charCount.textContent = count;
        
        if (count > 3500) {
            this.charCount.parentElement.classList.add('warning');
        } else {
            this.charCount.parentElement.classList.remove('warning');
        }
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    updateSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasText || this.isLoading;
    }

    async checkSystemHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            const health = await response.json();
            
            if (health.status === 'ok') {
                this.updateStatus('connected', 'Connected to LM Studio');
                this.currentModelSpan.textContent = health.currentModel || 'None loaded';
            } else {
                this.updateStatus('error', 'LM Studio connection failed');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateStatus('error', 'Server connection failed');
        }
    }

    updateStatus(type, message) {
        this.statusIndicator.className = `status-indicator ${type}`;
        this.statusText.textContent = message;
    }

    async loadChatHistory() {
        try {
            const response = await fetch(`${this.baseUrl}/api/history`);
            const history = await response.json();
            
            // Clear welcome message if we have history
            if (history.length > 0) {
                this.chatMessages.innerHTML = '';
            }
            
            history.forEach(msg => {
                this.addMessageToChat(msg.content, msg.role, msg.source, false);
            });
            
            this.scrollToBottom();
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        // Clear welcome message on first interaction
        const welcomeMsg = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        // Add user message to chat
        this.addMessageToChat(message, 'user');
        
        // Clear input and disable send button
        this.messageInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        this.setLoading(true);

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Add assistant response to chat
            this.addMessageToChat(result.message, 'assistant', result.source);
            
            // Update model info
            this.currentModelSpan.textContent = result.source;
            this.lastDecisionSpan.textContent = result.routerDecision;
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessageToChat(
                `Error: ${error.message}`, 
                'assistant', 
                'error'
            );
        } finally {
            this.setLoading(false);
        }
    }

    
    // FIXED: Simplified math processing that works with KaTeX
    processMathExpressions(text) {
        // Step 1: Handle \boxed{content} expressions - extract content and wrap in special span
        text = text.replace(/\\boxed\s*\{([^}]+)\}/g, (match, content) => {
            // Clean the content of any extra braces
            const cleanContent = content.trim().replace(/^\{|\}$/g, '');
            return `<span class="boxed-answer">${cleanContent}</span>`;
        });
        
        // Step 2: Handle malformed boxed expressions (missing closing brace)
        text = text.replace(/\\boxed\s*\{([^}]*?)(?:\s*$)/g, (match, content) => {
            const cleanContent = content.trim().replace(/^\{|\}$/g, '');
            return `<span class="boxed-answer">${cleanContent}</span>`;
        });
        
        // Step 3: DON'T wrap math expressions - let KaTeX handle them directly
        // Just clean up any stray braces that aren't part of LaTeX commands
        text = text.replace(/(?<!\\)\{(\d+(?:\.\d+)?)\}/g, '$1');
        
        // Step 4: Remove LaTeX commands that KaTeX won't handle
        text = text.replace(/\\text\{([^}]+)\}/g, '$1');
        text = text.replace(/\\mathrm\{([^}]+)\}/g, '$1');
        text = text.replace(/\\mathbf\{([^}]+)\}/g, '$1');
        
        // Step 5: Clean up spacing
        text = text.replace(/\s{2,}/g, ' ');
        text = text.trim();
        
        return text;
    }

    // ENHANCED: Better formatMessage with improved code/math separation
    formatMessage(content) {
        // Step 1: Protect code blocks and inline code from math processing
        let formatted = content;
        const protectedBlocks = [];
        let blockIndex = 0;
        
        // Protect code blocks first
        formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => {
            const placeholder = `___PROTECTED_BLOCK_${blockIndex}___`;
            const lang = language.toLowerCase() || 'text';
            const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
            const cleanCode = code.trim();
            
            protectedBlocks[blockIndex] = `<div class="code-block-container"><div class="code-header"><span class="code-language">${lang.toUpperCase()}</span><div class="code-controls"><button class="code-toggle" onclick="toggleCodeView('${codeId}')"><span class="toggle-text">${lang === 'html' ? 'Show Code' : 'View Code'}</span></button><button class="code-copy" onclick="copyCode('${codeId}')">📋 Copy</button></div></div><div class="code-preview" id="preview-${codeId}">${lang === 'html' ? cleanCode : `<pre><code>${this.escapeHtml(cleanCode)}</code></pre>`}</div><div class="code-source" id="source-${codeId}" style="display: none;"><pre><code>${this.escapeHtml(cleanCode)}</code></pre></div></div>`;
            blockIndex++;
            return placeholder;
        });
        
        // Protect inline code
        formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
            const placeholder = `___PROTECTED_BLOCK_${blockIndex}___`;
            protectedBlocks[blockIndex] = `<code>${this.escapeHtml(code)}</code>`;
            blockIndex++;
            return placeholder;
        });

        // Step 2: Process math expressions on the text (avoiding protected blocks)
        formatted = this.processMathExpressions(formatted);

        // Step 3: Restore protected blocks
        for (let i = blockIndex - 1; i >= 0; i--) {
            const placeholder = `___PROTECTED_BLOCK_${i}___`;
            formatted = formatted.replace(placeholder, protectedBlocks[i]);
        }

        // Step 4: Handle line breaks last
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    // FIXED: Updated addMessageToChat with better KaTeX rendering
    addMessageToChat(content, role, source = null, scroll = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        // Add source class for styling
        if (source) {
            messageDiv.classList.add(`source-${source}`);
        }

        const timestamp = new Date().toLocaleTimeString();
        
        let sourceLabel = '';
        if (role === 'assistant' && source) {
            const sourceEmojis = {
                creative: '🎨',
                coding: '💻',
                analysis: '📊',
                math: '🔢',
                general: '💬',
                router: '🤖',
                error: '❌'
            };
            sourceLabel = `<span class="source-label">${sourceEmojis[source] || '🤖'} ${source}</span>`;
        }

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="role">${role === 'user' ? 'You' : 'Assistant'}</span>
                ${sourceLabel}
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        
        // FIXED: Enhanced KaTeX rendering with proper element selection
        if (typeof renderMathInElement !== 'undefined') {
            try {
                // Render math in the message content div specifically
                const contentDiv = messageDiv.querySelector('.message-content');
                renderMathInElement(contentDiv, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "\\[", right: "\\]", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\(", right: "\\)", display: false}
                    ],
                    throwOnError: false,
                    strict: false,
                    trust: true,
                    fleqn: false,
                    // Add preprocessing to handle the already-extracted boxed content
                    preProcess: (math) => {
                        // Don't process content inside boxed-answer spans
                        if (math.includes('boxed-answer')) {
                            return math;
                        }
                        return math;
                    }
                });
                
                // Apply any additional styling to rendered math
                const mathElements = contentDiv.querySelectorAll('.katex');
                mathElements.forEach(el => {
                    el.classList.add('math-rendered');
                });
                
            } catch (error) {
                console.warn('KaTeX rendering error:', error);
            }
        }
        
        if (scroll) {
            this.scrollToBottom();
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.sendBtn.disabled = loading || this.messageInput.value.trim().length === 0;
        
        if (loading) {
            this.sendBtn.innerHTML = '<span class="loading-spinner"></span>';
            this.updateStatus('loading', 'Processing...');
        } else {
            this.sendBtn.innerHTML = '<span class="send-icon">➤</span>';
            this.updateStatus('connected', 'Ready');
        }
        
        this.messageInput.disabled = loading;
    }

    async clearChat() {
        if (!confirm('Are you sure you want to clear the chat history?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/clear`, {
                method: 'POST'
            });

            if (response.ok) {
                this.chatMessages.innerHTML = `
                    <div class="welcome-message">
                        <h3>Chat cleared! 🧹</h3>
                        <p>Start a new conversation below.</p>
                        <p>Math models will render equations beautifully with LaTeX formatting!</p>
                    </div>
                `;
                this.currentModelSpan.textContent = 'None';
                this.lastDecisionSpan.textContent = 'None';
            } else {
                throw new Error('Failed to clear chat');
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
            alert('Failed to clear chat history');
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MoEChat();
});