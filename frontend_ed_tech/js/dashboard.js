document.addEventListener('DOMContentLoaded', () => {
    const isFileProtocol = window.location.protocol === 'file:';
    const PROD_API_URL = '';
    let API_BASE_URL;

    if (PROD_API_URL) {
        API_BASE_URL = PROD_API_URL;
    } else if (isFileProtocol) {
        API_BASE_URL = 'http://localhost:8000';
    } else {
        API_BASE_URL = window.location.origin;
    }
    // DOM Element Targets
    const selectionGrid = document.getElementById('selection-grid');
    const viewContainer = document.querySelector('.feature-view-container');
    const featureCards = document.querySelectorAll('.feature-card');
    const backBtn = document.getElementById('back-to-hub');
    const cortexBackBtn = document.getElementById('cortex-back-hub-btn');
    if (cortexBackBtn && backBtn) {
        cortexBackBtn.addEventListener('click', () => {
            backBtn.click();
        });
    }
    const forgerBackBtn = document.getElementById('forger-back-hub-btn');
    if (forgerBackBtn && backBtn) {
        forgerBackBtn.addEventListener('click', () => {
            backBtn.click();
        });
    }
    const researchBackBtn = document.getElementById('research-back-hub-btn');
    if (researchBackBtn && backBtn) {
        researchBackBtn.addEventListener('click', () => {
            backBtn.click();
        });
    }
    const dynamicPanels = document.querySelectorAll('.dynamic-panel');
    const username = document.querySelector('.username');
    const avatar = document.querySelector('.avatar');

    const storedUser = JSON.parse(sessionStorage.getItem('eduai_user') || 'null');

    if (storedUser?.first_name) {
        username.textContent = storedUser.first_name;
        avatar.textContent = storedUser.first_name.slice(0, 2).toUpperCase();
        document.querySelectorAll('.insight-profile-name').forEach(el => {
            el.textContent = storedUser.first_name;
        });
    } else {
        // Redirect to login if user is not authenticated
        window.location.href = window.location.protocol === 'file:' ? 'index.html' : '/';
        return;
    }

    // --- Profile Dropdown & Logout Logic ---
    const userProfileBtn = document.getElementById('user-profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown');
    const myProfileBtn = document.getElementById('my-profile-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('first_name');
            localStorage.removeItem('last_name');
            localStorage.removeItem('email');
            window.location.href = window.location.protocol === 'file:' ? 'index.html' : '/';
        });
    }

    if (userProfileBtn && profileDropdown && logoutBtn) {
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userProfileBtn.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });

        if (myProfileBtn) {
            myProfileBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                profileDropdown.classList.remove('active');
                
                // Hide selection interface grid
                selectionGrid.classList.remove('active');
                viewContainer.classList.add('active');
                
                // Activate the profile panel
                dynamicPanels.forEach(panel => {
                    if (panel.id === 'profile-section') {
                        panel.classList.add('active');
                    } else {
                        panel.classList.remove('active');
                    }
                });

                // Fetch current user details from sessionStorage instead of GET
                try {
                    const data = JSON.parse(sessionStorage.getItem('eduai_user') || '{}');
                    document.getElementById('profile-firstname').value = data.first_name || '';
                    document.getElementById('profile-lastname').value = data.last_name || '';
                    document.getElementById('profile-email').value = data.email || '';
                } catch (err) {
                    console.error('Failed to parse profile details from session', err);
                }
            });
        }

        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            logoutBtn.innerHTML = 'Logging out...';
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST'
                });
            } catch (err) {
                console.error('Logout error:', err);
            } finally {
                sessionStorage.clear();
                localStorage.clear();
                const chatOutput = document.getElementById('chat-output');
                const notesOutput = document.getElementById('notes-output');
                const researchLogs = document.getElementById('research-logs');
                if (chatOutput) chatOutput.innerHTML = '';
                if (notesOutput) notesOutput.innerHTML = '';
                if (researchLogs) researchLogs.innerHTML = '';
                window.location.href = window.location.protocol === 'file:' ? 'index.html' : '/';
            }
        });
    }
    // ---------------------------------------

    // 1. Navigation Flow: Selecting an Option Card
    featureCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetPanelId = card.getAttribute('data-action');

            // Prevent opening WIP sections (removed for research-section)

            // Hide selection interface grid
            selectionGrid.classList.remove('active');

            // Show dynamic functionality interface container
            viewContainer.classList.add('active');

            // Activate the corresponding custom panel view
            dynamicPanels.forEach(panel => {
                if (panel.id === targetPanelId) {
                    panel.classList.add('active');
                    if (targetPanelId === 'rag-section') {
                        loadChatSessions();
                    }
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });

    // 2. Navigation Flow: Back to Dashboard Selection Hub
    backBtn.addEventListener('click', () => {
        viewContainer.classList.remove('active');
        dynamicPanels.forEach(panel => panel.classList.remove('active'));
        selectionGrid.classList.add('active');
    });

    // 3. RAG Chat Simulation
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatOutput = document.getElementById('chat-output');
    const strictDocsToggle = document.getElementById('strict-docs-toggle');
    const ragFileInput = document.getElementById('rag-file-input');
    const ragFileName = document.getElementById('rag-file-name');
    const uploadRagFileBtn = document.getElementById('upload-rag-file');
    const ragUploadStatus = document.getElementById('rag-upload-status');
    const strictDocsModal = document.getElementById('strict-docs-modal');
    const strictDocsYes = document.getElementById('strict-docs-yes');
    const strictDocsNo = document.getElementById('strict-docs-no');
    let docsAvailable = false;
    let useStrictlyRetriever = false;

    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    let currentSessionId = null;

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            currentSessionId = null;
            document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
            showCortexGreeting();
            chatOutput.innerHTML = '<div class="message system">System initialized. Awaiting source queries or document specifications...</div>';
        });
    }

    async function loadChatSessions() {
        if (!chatHistoryList) return;
        try {
            const response = await fetch(`${API_BASE_URL}/rag-agent/sessions`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch sessions');
            const sessions = await response.json();

            chatHistoryList.innerHTML = '';
            if (sessions.length === 0) {
                chatHistoryList.innerHTML = '<li class="history-item placeholder">History will load here</li>';
                return;
            }

            sessions.forEach(session => {
                const li = document.createElement('li');
                li.className = 'history-item';
                if (session._id === currentSessionId) {
                    li.classList.add('active');
                }
                li.textContent = session.title || 'Untitled Chat';
                li.addEventListener('click', () => loadChatHistory(session._id, li));
                chatHistoryList.appendChild(li);
            });
        } catch (err) {
            console.error('Error loading sessions:', err);
            chatHistoryList.innerHTML = '<li class="history-item placeholder">History will load here</li>';
        }
    }

    async function loadChatHistory(sessionId, liElement) {
        currentSessionId = sessionId;

        document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
        if (liElement) liElement.classList.add('active');

        hideCortexGreeting();
        chatOutput.innerHTML = '';
        appendMsg('Loading history...', 'system', 'history-loader');

        try {
            const response = await fetch(`${API_BASE_URL}/rag-agent/messages/${sessionId}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch messages');
            const messages = await response.json();

            const loader = document.getElementById('history-loader');
            if (loader) loader.remove();

            if (messages.length === 0) {
                appendMsg('No messages in this chat.', 'system');
                return;
            }

            messages.forEach(msg => {
                if (msg.role === 'user') {
                    appendMsg(msg.content, 'user');
                } else if (msg.role === 'assistant' || msg.role === 'bot') {
                    appendMsg(msg.content, 'bot');
                }
            });

        } catch (err) {
            console.error('Error loading messages:', err);
            const loader = document.getElementById('history-loader');
            if (loader) loader.remove();
            appendMsg('Failed to load messages.', 'system');
        }
    }

    updateStrictDocsToggle();

    ragFileInput.addEventListener('change', () => {
        const file = ragFileInput.files[0];
        if (file) {
            ragFileName.textContent = `Attached: ${file.name}`;
            ragFileName.style.display = 'inline-block';
            setUploadStatus('', '');
            uploadRagFileBtn.click();
        } else {
            ragFileName.style.display = 'none';
        }
    });

    uploadRagFileBtn.addEventListener('click', async () => {
        const file = ragFileInput.files[0];

        if (!file) {
            setUploadStatus('Choose a document first.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        uploadRagFileBtn.disabled = true;
        uploadRagFileBtn.textContent = 'Uploading...';
        setUploadStatus('Uploading and indexing document...', '');

        try {
            const response = await fetch(`${API_BASE_URL}/rag-agent/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            const data = await parseApiResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Document upload failed'));
            }

            docsAvailable = true;
            setUploadStatus(`${data.message}. ${data.chunks || 0} chunks, ${data.vectors || 0} vectors indexed.`, 'success');
            appendMsg(`Document uploaded: ${file.name}`, 'system');
            updateStrictDocsToggle();
            openStrictDocsModal();
        } catch (error) {
            setUploadStatus(error.message, 'error');
        } finally {
            uploadRagFileBtn.disabled = false;
            uploadRagFileBtn.textContent = 'Upload to RAG';
        }
    });

    strictDocsYes.addEventListener('click', () => {
        useStrictlyRetriever = true;
        updateStrictDocsToggle();
        closeStrictDocsModal();
        appendMsg('Strict document mode enabled. Answers will use only uploaded documents.', 'system');
    });

    strictDocsNo.addEventListener('click', () => {
        useStrictlyRetriever = false;
        updateStrictDocsToggle();
        closeStrictDocsModal();
        appendMsg('Flexible RAG mode enabled. Answers can use documents plus general knowledge.', 'system');
    });

    strictDocsToggle.addEventListener('click', () => {
        if (!docsAvailable) {
            appendMsg('Upload a document before enabling docs-only mode.', 'system');
            return;
        }

        useStrictlyRetriever = !useStrictlyRetriever;
        updateStrictDocsToggle();
        appendMsg(
            useStrictlyRetriever
                ? 'Next questions will use only uploaded documents.'
                : 'Next questions can use uploaded documents plus general knowledge.',
            'system'
        );
    });

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = chatInput.value.trim();
        if (!query) return;

        hideCortexGreeting();
        appendMsg(query, 'user');
        chatInput.value = '';

        const typingId = 'typing-' + Date.now();
        appendMsg('<div class="skeleton-loader title" style="margin-bottom:8px; width:40%;"></div><div class="skeleton-loader text"></div><div class="skeleton-loader text short"></div>', 'bot', typingId);

        try {
            const response = await fetch(`${API_BASE_URL}/rag-agent/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    user_query: query,
                    docs_available: docsAvailable,
                    use_strictly_retriever: docsAvailable && useStrictlyRetriever,
                }),
                credentials: 'include',
            });
            const data = await parseApiResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Chat request failed'));
            }

            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            appendMsg(data.result?.final_answer || data.final_answer || data.message || 'No answer returned.', 'bot');

            if (!currentSessionId && data.session_id) {
                currentSessionId = data.session_id;
                loadChatSessions();
            }
        } catch (error) {
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            appendMsg(error.message, 'system');
        }
    });

    function formatMarkdown(text) {
        if (!text) return '';

        let html = text
            // Replace #### Headings
            .replace(/^#### (.*$)/gim, '<h4 class="chat-heading" style="margin-top: 12px; font-size: 1.05rem;">$1</h4>')
            // Replace ### Headings
            .replace(/^### (.*$)/gim, '<h3 class="chat-heading" style="margin-top: 16px; font-size: 1.15rem; color: var(--accent);">$1</h3>')
            // Replace ## Headings
            .replace(/^## (.*$)/gim, '<h2 class="chat-heading" style="margin-top: 20px; font-size: 1.3rem; border-bottom: 1px solid var(--border); padding-bottom: 4px;">$1</h2>')
            // Replace **bold**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Replace *italic*
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Replace links [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: var(--accent); text-decoration: underline;">$1</a>')
            // Replace bullet points (basic implementation)
            .replace(/^- (.*$)/gim, '<li class="chat-bullet" style="margin-left: 20px;">$1</li>')
            // Format meta fields (formula, example, analogy)
            .replace(/^(formula|example|analogy): (.*$)/gim, '<p class="chat-meta"><strong>$1</strong>: $2</p>');

        html = html.replace(/\n/g, '<br>');

        // Clean up excessive breaks after block elements
        html = html.replace(/<\/h3><br>/g, '</h3>');
        html = html.replace(/<\/ul><br>/g, '</ul>');
        html = html.replace(/<\/p><br>/g, '</p>');
        html = html.replace(/(<br>){2,}/g, '<br>');

        return html;
    }

    function appendMsg(text, type, id = null) {
        const div = document.createElement('div');
        div.classList.add('message', type);
        if (id) div.id = id;
        if (id && (text.includes('typing-dots') || text.includes('skeleton-loader'))) {
            div.innerHTML = text;
        } else if (type === 'bot') {
            div.innerHTML = formatMarkdown(text);
        } else {
            div.textContent = text;
        }
        chatOutput.appendChild(div);
        chatOutput.scrollTop = chatOutput.scrollHeight;
    }

    async function parseApiResponse(response) {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return response.json();
        }

        return { detail: await response.text() };
    }

    function getApiErrorMessage(data, fallback) {
        if (Array.isArray(data.detail)) {
            return data.detail.map((error) => error.msg).join(' ');
        }

        return data.detail || fallback;
    }

    function setUploadStatus(message, type) {
        ragUploadStatus.textContent = message;
        ragUploadStatus.className = type ? `upload-status ${type}` : 'upload-status';
    }

    function openStrictDocsModal() {
        strictDocsModal.classList.add('active');
        strictDocsModal.setAttribute('aria-hidden', 'false');
    }

    function closeStrictDocsModal() {
        strictDocsModal.classList.remove('active');
        strictDocsModal.setAttribute('aria-hidden', 'true');
    }

    function updateStrictDocsToggle() {
        strictDocsToggle.disabled = !docsAvailable;
        strictDocsToggle.setAttribute('aria-pressed', String(docsAvailable && useStrictlyRetriever));

        if (!docsAvailable) {
            strictDocsToggle.textContent = 'No docs';
            strictDocsToggle.title = 'Upload a document to enable docs-only mode';
            return;
        }

        strictDocsToggle.textContent = useStrictlyRetriever ? 'Docs only' : 'Flexible';
        strictDocsToggle.title = useStrictlyRetriever
            ? 'This question will use only uploaded documents'
            : 'This question can use uploaded documents plus general knowledge';
    }

    
    // Cortex Starter Prompt Cards
    document.querySelectorAll('.cortex-card').forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            if (promptText && chatInput) {
                chatInput.value = promptText;
                chatInput.focus();
            }
        });
    });

    function hideCortexGreeting() {
        const greeting = document.getElementById('cortex-greeting-banner');
        if (greeting) greeting.style.display = 'none';
        const starters = document.getElementById('cortex-starter-prompts');
        if (starters) starters.style.display = 'none';
        const stream = document.querySelector('.cortex-chat-stream');
        if (stream) stream.classList.add('has-messages');
    }

    function showCortexGreeting() {
        const greeting = document.getElementById('cortex-greeting-banner');
        if (greeting) greeting.style.display = 'flex';
        const starters = document.getElementById('cortex-starter-prompts');
        if (starters) starters.style.display = 'grid';
        const stream = document.querySelector('.cortex-chat-stream');
        if (stream) stream.classList.remove('has-messages');
    }

    // 4. Notes Generation Logic (Forger Concept Studio)
    const genNotesBtn = document.getElementById('generate-notes-btn');
    const notesOutput = document.getElementById('notes-output');
    const notesFileInput = document.getElementById('notes-file-input');
    const notesFileName = document.getElementById('notes-file-name');
    const notesFileTitle = document.getElementById('notes-file-title');
    const forgerStatusBadge = document.getElementById('forger-status-badge');
    const copyNotesBtn = document.getElementById('copy-notes-btn');
    const printNotesBtn = document.getElementById('print-notes-btn');
    let rawGeneratedNotes = '';

    function formatForgerMarkdown(text) {
        if (!text) return '';

        let lines = text.split('\n');
        let htmlLines = [];
        let inList = false;

        for (let line of lines) {
            let trimmed = line.trim();

            if (trimmed.startsWith('# ')) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<h1 class="forger-doc-h1">${escapeHtml(trimmed.slice(2))}</h1>`);
            } else if (trimmed.startsWith('## ')) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<h2 class="forger-doc-h2">${escapeHtml(trimmed.slice(3))}</h2>`);
            } else if (trimmed.startsWith('### ')) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<h3 class="forger-doc-h3">${escapeHtml(trimmed.slice(4))}</h3>`);
            } else if (trimmed.startsWith('#### ')) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<h4 class="forger-doc-h4">${escapeHtml(trimmed.slice(5))}</h4>`);
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                if (!inList) { htmlLines.push('<ul class="forger-doc-list">'); inList = true; }
                let bulletContent = formatInlineStyles(trimmed.slice(2));
                htmlLines.push(`<li class="forger-doc-item">${bulletContent}</li>`);
            } else if (/^\d+\.\s/.test(trimmed)) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                let itemContent = formatInlineStyles(trimmed.replace(/^\d+\.\s/, ''));
                htmlLines.push(`<div class="forger-numbered-item"><span class="num-bullet">✦</span><div>${itemContent}</div></div>`);
            } else if (trimmed.startsWith('> ')) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<blockquote class="forger-callout">${formatInlineStyles(trimmed.slice(2))}</blockquote>`);
            } else if (trimmed === '') {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
            } else {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<p class="forger-doc-p">${formatInlineStyles(trimmed)}</p>`);
            }
        }

        if (inList) htmlLines.push('</ul>');
        return htmlLines.join('');
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatInlineStyles(str) {
        return escapeHtml(str)
            .replace(/\*\*(.*?)\*\*/g, '<strong class="forger-keyword">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="forger-em">$1</em>')
            .replace(/`([^`]+)`/g, '<code class="forger-code">$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="forger-link">$1</a>');
    }

    if (notesFileInput) {
        notesFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const fname = e.target.files[0].name;
                if (notesFileTitle) notesFileTitle.textContent = fname;
                if (notesFileName) {
                    notesFileName.textContent = `Ready to synthesize (${(e.target.files[0].size / 1024).toFixed(1)} KB)`;
                    notesFileName.style.color = 'var(--accent)';
                }
                if (forgerStatusBadge) {
                    forgerStatusBadge.textContent = 'File attached';
                    forgerStatusBadge.className = 'reader-status attached';
                }
            } else {
                if (notesFileTitle) notesFileTitle.textContent = 'Drop reference book here';
                if (notesFileName) {
                    notesFileName.textContent = 'Supports PDF, DOCX, TXT, Markdown';
                    notesFileName.style.color = 'var(--text-muted)';
                }
            }
        });
    }

    if (copyNotesBtn) {
        copyNotesBtn.addEventListener('click', () => {
            if (!rawGeneratedNotes) return;
            navigator.clipboard.writeText(rawGeneratedNotes).then(() => {
                const originalHtml = copyNotesBtn.innerHTML;
                copyNotesBtn.innerHTML = '<span>✓ Copied!</span>';
                setTimeout(() => { copyNotesBtn.innerHTML = originalHtml; }, 2000);
            });
        });
    }

    if (printNotesBtn) {
        printNotesBtn.addEventListener('click', () => {
            window.print();
        });
    }

    genNotesBtn.addEventListener('click', async () => {
        if (!notesFileInput.files || notesFileInput.files.length === 0) {
            alert('Please select a reference book or study document first.');
            return;
        }

        const file = notesFileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        notesOutput.innerHTML = `
            <div class="forger-loading-screen">
                <div class="forger-pulse-orb"></div>
                <h3 class="forger-loading-title">Synthesizing Technical Concepts</h3>
                <p class="forger-loading-desc">Parsing context windows, extracting definitions, and compiling clean study notes...</p>
                <div class="forger-shimmer-box">
                    <div class="skeleton-loader title" style="width: 50%;"></div>
                    <div class="skeleton-loader text"></div>
                    <div class="skeleton-loader text"></div>
                    <div class="skeleton-loader text short"></div>
                    <div class="skeleton-loader title" style="width: 35%; margin-top: 24px;"></div>
                    <div class="skeleton-loader text"></div>
                    <div class="skeleton-loader text short"></div>
                </div>
            </div>
        `;
        genNotesBtn.disabled = true;
        genNotesBtn.innerHTML = '<span>Processing...</span>';
        if (forgerStatusBadge) {
            forgerStatusBadge.textContent = 'Synthesizing...';
            forgerStatusBadge.className = 'reader-status processing';
        }

        try {
            const response = await fetch(`${API_BASE_URL}/notebook-agent/generate-notes`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to generate notes');
            }

            const data = await response.json();
            rawGeneratedNotes = data.notes || '';

            let formattedNotes = formatForgerMarkdown(data.notes);

            notesOutput.innerHTML = `
                <div class="forger-success-banner">
                    <div class="banner-left">
                        <span class="banner-badge">COMPLETE</span>
                        <strong>Synthesis successful:</strong> Processed ${data.total_windows} overlapping windows.
                    </div>
                    <span class="banner-meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <article class="forger-article-content">
                    ${formattedNotes}
                </article>
            `;

            if (copyNotesBtn) copyNotesBtn.style.display = 'inline-flex';
            if (printNotesBtn) printNotesBtn.style.display = 'inline-flex';
            if (forgerStatusBadge) {
                forgerStatusBadge.textContent = 'Compiled';
                forgerStatusBadge.className = 'reader-status ready';
            }

        } catch (error) {
            notesOutput.innerHTML = `
                <div class="forger-error-card">
                    <h4>Synthesis Error</h4>
                    <p>${error.message}</p>
                </div>
            `;
            if (forgerStatusBadge) {
                forgerStatusBadge.textContent = 'Failed';
                forgerStatusBadge.className = 'reader-status error';
            }
        } finally {
            genNotesBtn.disabled = false;
            genNotesBtn.innerHTML = '<span>[ COMPILE NOTES ]</span>';
        }
    });

    // 5. Research Agent Output Trace Simulation
    const startResearchBtn = document.getElementById('start-research-btn');
    const researchLogs = document.getElementById('research-logs');
    const topicInput = document.getElementById('research-topic');
    const researchStatusBadge = document.getElementById('research-status-badge');
    const copyResearchBtn = document.getElementById('copy-research-btn');
    const printResearchBtn = document.getElementById('print-research-btn');
    let rawResearchReport = '';
    let progressInterval = null;

    // Quick Suggested Topics Chips
    document.querySelectorAll('.quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const topic = chip.getAttribute('data-topic');
            if (topicInput && topic) {
                topicInput.value = topic;
                topicInput.focus();
            }
        });
    });

    // Enter key to launch research (Shift+Enter for new line)
    if (topicInput && startResearchBtn) {
        topicInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                startResearchBtn.click();
            }
        });
    }

    // Copy Research Report
    if (copyResearchBtn) {
        copyResearchBtn.addEventListener('click', () => {
            if (!rawResearchReport) return;
            navigator.clipboard.writeText(rawResearchReport).then(() => {
                const originalHtml = copyResearchBtn.innerHTML;
                copyResearchBtn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span style="color:var(--success)">Copied!</span>
                `;
                setTimeout(() => {
                    copyResearchBtn.innerHTML = originalHtml;
                }, 2000);
            });
        });
    }

    // Print / Export Research Report
    if (printResearchBtn) {
        printResearchBtn.addEventListener('click', () => {
            if (!rawResearchReport) return;
            const printWin = window.open('', '_blank');
            printWin.document.write(`
                <html>
                <head>
                    <title>ExplorerAI Intelligence Dossier</title>
                    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', sans-serif; line-height: 1.8; color: #111; max-width: 800px; margin: 40px auto; padding: 0 20px; }
                        h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; color: #000; }
                        h1 { border-bottom: 2px solid #ddd; padding-bottom: 12px; }
                        h2 { border-bottom: 1px solid #eee; margin-top: 28px; padding-bottom: 6px; }
                        pre, code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
                        pre { padding: 16px; overflow-x: auto; }
                        blockquote { border-left: 4px solid #c8a84e; margin: 0; padding-left: 16px; font-style: italic; }
                    </style>
                </head>
                <body>
                    ${formatMarkdown(rawResearchReport)}
                </body>
                </html>
            `);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => {
                printWin.print();
            }, 600);
        });
    }

    function renderResearchLoading(topic, isResuming = false) {
        researchLogs.classList.remove('has-results');
        if (progressInterval) clearInterval(progressInterval);

        if (copyResearchBtn) copyResearchBtn.style.display = 'none';
        if (printResearchBtn) printResearchBtn.style.display = 'none';

        if (researchStatusBadge) {
            researchStatusBadge.textContent = isResuming ? "Synthesizing Feedback..." : "Decomposing Objectives...";
            researchStatusBadge.style.color = "#dfc17b";
            researchStatusBadge.style.borderColor = "rgba(200, 168, 78, 0.3)";
            researchStatusBadge.style.background = "rgba(200, 168, 78, 0.08)";
        }

        const statusMessage = isResuming ? "Resuming execution with feedback..." : `Spawning autonomous researcher for: "${topic}"`;

        researchLogs.innerHTML = `
            <div class="research-progress-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:380px; text-align:center;">
                <div class="radar-scanner">
                    <div class="radar-ring ring-1"></div>
                    <div class="radar-ring ring-2"></div>
                    <div class="radar-ring ring-3"></div>
                    <div class="radar-dot"></div>
                </div>
                <div class="progress-details" style="width: 100%; margin-top: 20px;">
                    <h4 id="progress-phase-title" style="color: #f5f5f5; font-family:'Playfair Display', serif; font-size: 1.3rem; margin-bottom: 6px; font-weight: 600;">Initializing...</h4>
                    <p id="progress-phase-desc" style="color: #888888; font-size: 0.88rem; max-width: 440px; margin: 0 auto 16px;">${statusMessage}</p>
                    
                    <div class="progress-bar-container" style="width: 280px; height: 5px; background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; margin: 0 auto 20px;">
                        <div id="progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #c8a84e, #38bdf8); transition: width 0.5s ease; border-radius: 10px;"></div>
                    </div>
                </div>
                <div id="progress-terminal" style="width: 100%; max-width: 520px; background: #040404; border: 1px solid #1c1c1c; border-radius: 8px; padding: 14px; font-family: monospace; font-size: 0.78rem; color: #a1a1aa; text-align: left; max-height: 120px; overflow-y: auto; margin: 0 auto;">
                    <div style="color: #c8a84e; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; font-size: 0.72rem; letter-spacing:0.05em;">TELEMETRY TRACE</div>
                    <div id="progress-terminal-lines" style="display: flex; flex-direction: column; gap: 4px;">
                        <div>&gt; Spawning autonomous orchestrator graph...</div>
                    </div>
                </div>
            </div>
        `;

        const phaseTitleEl = document.getElementById('progress-phase-title');
        const phaseDescEl = document.getElementById('progress-phase-desc');
        const barFillEl = document.getElementById('progress-bar-fill');
        const terminalLinesEl = document.getElementById('progress-terminal-lines');
        const terminalEl = document.getElementById('progress-terminal');

        const phases = [
            { time: 0, title: "Spawning Agent...", desc: "Initializing autonomous researcher thread." },
            { time: 2, title: "Formulating Search Vectors...", desc: "LLM Orchestrator is decomposing target into multi-hop queries." },
            { time: 5, title: "Querying Live Web Sources...", desc: "Dispatching parallel search workers to verify technical claims." },
            { time: 9, title: "Deduplicating Evidence...", desc: "Cross-referencing papers, documentation, and technical sources." },
            { time: 14, title: "Synthesizing Analytical Digest...", desc: "Drafting publication-ready sections with strict source grounding." },
            { time: 20, title: "Finalizing Report...", desc: "Compiling markdown structure and citations." }
        ];

        let secondsElapsed = 0;
        progressInterval = setInterval(() => {
            secondsElapsed++;

            for (let i = phases.length - 1; i >= 0; i--) {
                if (secondsElapsed >= phases[i].time) {
                    if (phaseTitleEl) phaseTitleEl.textContent = phases[i].title;
                    if (phaseDescEl) phaseDescEl.textContent = phases[i].desc;
                    break;
                }
            }

            const pct = Math.min(95, Math.floor((secondsElapsed / 24) * 100));
            if (barFillEl) barFillEl.style.width = `${pct}%`;

            if (terminalLinesEl) {
                if (secondsElapsed === 2) {
                    appendTerminalLine(terminalLinesEl, terminalEl, "Running router_node -> Deciding research strategy");
                } else if (secondsElapsed === 4) {
                    appendTerminalLine(terminalLinesEl, terminalEl, "Mode: HYBRID | High-signal queries formulated");
                } else if (secondsElapsed === 7) {
                    appendTerminalLine(terminalLinesEl, terminalEl, "Invoking Tavily API multi-search across technical web");
                } else if (secondsElapsed === 11) {
                    appendTerminalLine(terminalLinesEl, terminalEl, "Verified 10+ distinct sources. Filtering recency window");
                } else if (secondsElapsed === 16) {
                    appendTerminalLine(terminalLinesEl, terminalEl, "Fan-out: Spawning parallel section generator workers");
                } else if (secondsElapsed === 22) {
                    appendTerminalLine(terminalLinesEl, terminalEl, "Aggregating ordered sections and resolving citations");
                }
            }
        }, 1000);
    }

    function appendTerminalLine(container, scrollEl, text) {
        const line = document.createElement('div');
        line.textContent = `> ${text}`;
        container.appendChild(line);
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    function stopResearchProgress() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    function displayResearchResults(data) {
        stopResearchProgress();
        researchLogs.classList.add('has-results');
        rawResearchReport = data.final_answer || '';

        if (copyResearchBtn) copyResearchBtn.style.display = 'inline-flex';
        if (printResearchBtn) printResearchBtn.style.display = 'inline-flex';

        if (researchStatusBadge) {
            researchStatusBadge.textContent = "Report Complete";
            researchStatusBadge.style.color = "#10b981";
            researchStatusBadge.style.borderColor = "rgba(16, 185, 129, 0.4)";
            researchStatusBadge.style.background = "rgba(16, 185, 129, 0.08)";
        }

        let evidenceHtml = '';
        if (data.evidence && data.evidence.length > 0) {
            evidenceHtml = `
                <details class="evidence-details" style="margin-bottom: 24px; background: #090909; border: 1px solid #1c1c1c; border-radius: 10px; padding: 14px 18px;">
                    <summary style="font-weight: 600; cursor: pointer; color: #dfc17b; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8;"></span>
                            <span>Verified Research Sources (${data.evidence.length})</span>
                        </div>
                        <span class="collapse-icon" style="transition: transform 0.3s ease; color: #888888; font-size: 0.85rem;">▼</span>
                    </summary>
                    <div class="sources-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-top: 16px;">
                        ${data.evidence.map((e, idx) => {
                            let domain = '';
                            try {
                                domain = new URL(e.url).hostname.replace('www.', '');
                            } catch(err) {
                                domain = 'source';
                            }
                            return `
                                <div class="source-card" style="background:#040404; border:1px solid #1a1a1a; border-radius:8px; padding:12px;">
                                    <div>
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                            <span class="chip" style="font-size: 0.65rem; background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.25);">${domain}</span>
                                            <span style="font-size: 0.7rem; color: #666666; font-weight: 500;">#${idx + 1}</span>
                                        </div>
                                        <a href="${e.url}" target="_blank" style="display:block; color:#f3f4f6; text-decoration:none; font-weight:600; font-size:0.85rem; margin-bottom:4px; line-height:1.3;">${e.title || 'Research Link'}</a>
                                        <p style="font-size: 0.78rem; color: #888888; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0;">${e.snippet || ''}</p>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }

        researchLogs.innerHTML = `
            <div style="margin-bottom: 24px; padding: 14px 18px; background: rgba(200, 168, 78, 0.08); border-left: 4px solid #c8a84e; border-radius: 8px;">
                <strong style="color: #dfc17b; font-size: 1.05rem;">Intelligence Report Ready</strong>
                <span style="color: #9ca3af; margin-left: 8px; font-size: 0.88rem;">Autonomous multi-hop synthesis completed with live evidence grounding.</span>
            </div>
            ${evidenceHtml}
            <div class="markdown-body">
                ${formatMarkdown(data.final_answer)}
            </div>
        `;
    }

    startResearchBtn.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        if (!topic) {
            topicInput.focus();
            return;
        }

        renderResearchLoading(topic);

        startResearchBtn.disabled = true;
        startResearchBtn.innerHTML = '<span>[ EXECUTING... ]</span>';

        try {
            const response = await fetch(`${API_BASE_URL}/research-agent/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: topic
                }),
                credentials: 'include',
            });

            const data = await parseApiResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Research failed'));
            }

            if (data.status === 'awaiting_feedback') {
                stopResearchProgress();
                startResearchBtn.disabled = false;
                startResearchBtn.innerHTML = '<span>[ LAUNCH DEEP RESEARCH ]</span>';

                if (researchStatusBadge) {
                    researchStatusBadge.textContent = "Awaiting Human Review";
                    researchStatusBadge.style.color = "#f59e0b";
                    researchStatusBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";
                    researchStatusBadge.style.background = "rgba(245, 158, 11, 0.1)";
                }

                // Populate queries list with interactive selection items
                const queriesList = document.getElementById('research-queries-list');
                const countBadge = document.getElementById('query-selection-count');
                const submitFeedbackBtn = document.getElementById('submit-feedback-btn');

                function updateQuerySelectionState() {
                    const allItems = Array.from(queriesList.querySelectorAll('.query-select-item'));
                    const selectedItems = allItems.filter(item => {
                        const cb = item.querySelector('.query-checkbox');
                        return cb && cb.checked;
                    });

                    if (countBadge) {
                        countBadge.textContent = `Selected: ${selectedItems.length} of ${allItems.length}`;
                    }

                    if (submitFeedbackBtn) {
                        if (selectedItems.length === 0) {
                            submitFeedbackBtn.disabled = true;
                            submitFeedbackBtn.innerHTML = '<span>[ SELECT AT LEAST 1 QUERY ]</span>';
                            submitFeedbackBtn.style.opacity = '0.5';
                        } else {
                            submitFeedbackBtn.disabled = false;
                            submitFeedbackBtn.innerHTML = `<span>[ CONFIRM &amp; EXECUTE RESEARCH (${selectedItems.length} SECTIONS) ]</span>`;
                            submitFeedbackBtn.style.opacity = '1';
                        }
                    }
                }

                queriesList.innerHTML = '';
                if (data.queries && data.queries.length > 0) {
                    data.queries.forEach((q, idx) => {
                        const li = document.createElement('li');
                        li.className = 'query-select-item selected';
                        
                        // Check first 3 by default to keep strictly within 8k TPM
                        const isChecked = idx < 3;
                        if (!isChecked) li.classList.remove('selected');

                        li.innerHTML = `
                            <label class="query-checkbox-label">
                                <input type="checkbox" class="query-checkbox" ${isChecked ? 'checked' : ''} data-query="${encodeURIComponent(q)}">
                                <span class="query-text">${q}</span>
                            </label>
                            <button type="button" class="remove-query-btn" title="Remove query">✕</button>
                        `;

                        const cb = li.querySelector('.query-checkbox');
                        cb.addEventListener('change', () => {
                            if (cb.checked) {
                                li.classList.add('selected');
                            } else {
                                li.classList.remove('selected');
                            }
                            updateQuerySelectionState();
                        });

                        const removeBtn = li.querySelector('.remove-query-btn');
                        removeBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            li.remove();
                            updateQuerySelectionState();
                        });

                        queriesList.appendChild(li);
                    });
                } else {
                    queriesList.innerHTML = '<li>No queries generated.</li>';
                }

                updateQuerySelectionState();

                // Show feedback container
                document.getElementById('feedback-container').style.display = 'flex';
                document.getElementById('feedback-container').dataset.threadId = data.thread_id;

                researchLogs.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:350px; text-align:center;">
                        <div style="width:60px; height:60px; border-radius:50%; background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; display:flex; align-items:center; justify-content:center; color:#f59e0b; font-size:1.8rem; margin-bottom:18px;">◷</div>
                        <h3 style="font-family:'Playfair Display', serif; font-size:1.4rem; color:#f3f4f6; margin-bottom:8px;">Human Review Required</h3>
                        <p style="color:#9ca3af; font-size:0.88rem; max-width:440px; line-height:1.5;">Select only the search queries you wish to research. The agent will execute strictly for the selected vectors to stay within token limits.</p>
                    </div>
                `;
            } else {
                startResearchBtn.disabled = false;
                startResearchBtn.innerHTML = '<span>[ LAUNCH DEEP RESEARCH ]</span>';
                displayResearchResults(data);
            }

        } catch (error) {
            stopResearchProgress();
            startResearchBtn.disabled = false;
            startResearchBtn.innerHTML = '<span>[ LAUNCH DEEP RESEARCH ]</span>';
            if (researchStatusBadge) {
                researchStatusBadge.textContent = "Execution Error";
                researchStatusBadge.style.color = "#f87171";
            }
            researchLogs.innerHTML = `
                <div style="padding: 16px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 6px; color: #f87171;">
                    <strong>[Error]</strong> ${error.message}
                </div>
            `;
        }
    });

    // Handle Feedback Submission with strictly selected queries
    const submitFeedbackBtn = document.getElementById('submit-feedback-btn');

    async function handleFeedbackSubmission(feedbackText, selectedQueries) {
        const threadId = document.getElementById('feedback-container').dataset.threadId;
        if (!threadId) return;

        document.getElementById('feedback-container').style.display = 'none';

        renderResearchLoading(null, true);

        startResearchBtn.disabled = true;
        startResearchBtn.innerHTML = '<span>[ EXECUTING... ]</span>';

        try {
            const response = await fetch(`${API_BASE_URL}/research-agent/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    thread_id: threadId,
                    feedback: feedbackText,
                    selected_queries: selectedQueries
                }),
                credentials: 'include',
            });

            const data = await parseApiResponse(response);

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, 'Research feedback failed'));
            }

            if (data.status === 'awaiting_feedback') {
                stopResearchProgress();
                startResearchBtn.disabled = false;
                startResearchBtn.innerHTML = '<span>[ LAUNCH DEEP RESEARCH ]</span>';

                if (researchStatusBadge) {
                    researchStatusBadge.textContent = "Awaiting Further Review";
                    researchStatusBadge.style.color = "#f59e0b";
                }

                const queriesList = document.getElementById('research-queries-list');
                const countBadge = document.getElementById('query-selection-count');
                queriesList.innerHTML = '';
                if (data.queries && data.queries.length > 0) {
                    data.queries.forEach((q, idx) => {
                        const li = document.createElement('li');
                        li.className = 'query-select-item selected';
                        const isChecked = idx < 3;
                        if (!isChecked) li.classList.remove('selected');
                        li.innerHTML = `
                            <label class="query-checkbox-label">
                                <input type="checkbox" class="query-checkbox" ${isChecked ? 'checked' : ''} data-query="${encodeURIComponent(q)}">
                                <span class="query-text">${q}</span>
                            </label>
                            <button type="button" class="remove-query-btn" title="Remove query">✕</button>
                        `;
                        const cb = li.querySelector('.query-checkbox');
                        cb.addEventListener('change', () => {
                            if (cb.checked) li.classList.add('selected');
                            else li.classList.remove('selected');
                            const all = Array.from(queriesList.querySelectorAll('.query-select-item'));
                            const sel = all.filter(i => i.querySelector('.query-checkbox')?.checked);
                            if (countBadge) countBadge.textContent = `Selected: ${sel.length} of ${all.length}`;
                        });
                        const rem = li.querySelector('.remove-query-btn');
                        rem.addEventListener('click', (e) => {
                            e.stopPropagation();
                            li.remove();
                            const all = Array.from(queriesList.querySelectorAll('.query-select-item'));
                            const sel = all.filter(i => i.querySelector('.query-checkbox')?.checked);
                            if (countBadge) countBadge.textContent = `Selected: ${sel.length} of ${all.length}`;
                        });
                        queriesList.appendChild(li);
                    });
                }

                document.getElementById('feedback-container').style.display = 'flex';
                document.getElementById('feedback-container').dataset.threadId = data.thread_id;
                
                const feedbackInputEl = document.getElementById('research-feedback-input');
                if (feedbackInputEl) feedbackInputEl.value = '';

                researchLogs.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:350px; text-align:center;">
                        <div style="width:60px; height:60px; border-radius:50%; background:rgba(245, 158, 11, 0.15); border:1px solid #f59e0b; display:flex; align-items:center; justify-content:center; color:#f59e0b; font-size:1.8rem; margin-bottom:18px;">◷</div>
                        <h3 style="font-family:'Playfair Display', serif; font-size:1.4rem; color:#f3f4f6; margin-bottom:8px;">Awaiting Query Confirmation</h3>
                        <p style="color:#9ca3af; font-size:0.88rem; max-width:440px; line-height:1.5;">Review the updated search queries on the left panel to proceed with live research.</p>
                    </div>
                `;
            } else {
                startResearchBtn.disabled = false;
                startResearchBtn.innerHTML = '<span>[ LAUNCH DEEP RESEARCH ]</span>';
                displayResearchResults(data);
            }

        } catch (error) {
            stopResearchProgress();
            startResearchBtn.disabled = false;
            startResearchBtn.innerHTML = '<span>[ LAUNCH DEEP RESEARCH ]</span>';
            if (researchStatusBadge) {
                researchStatusBadge.textContent = "Execution Error";
                researchStatusBadge.style.color = "#f87171";
            }
            researchLogs.innerHTML = `
                <div style="padding: 16px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 6px; color: #f87171;">
                    <strong>[Error]</strong> ${error.message}
                </div>
            `;
        }
    }

    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener('click', () => {
            const queriesList = document.getElementById('research-queries-list');
            const checkedBoxes = Array.from(queriesList.querySelectorAll('.query-checkbox:checked'));
            const selectedQueries = checkedBoxes.map(cb => decodeURIComponent(cb.getAttribute('data-query') || '')).filter(Boolean);

            if (selectedQueries.length === 0) {
                alert('Please select at least 1 search query to continue.');
                return;
            }

            const feedbackInput = document.getElementById('research-feedback-input').value.trim();
            handleFeedbackSubmission(feedbackInput || 'start', selectedQueries);
        });
    }

    // 6. Profile Settings Form Handling
    const profileDetailsForm = document.getElementById('profile-details-form');
    const profilePasswordForm = document.getElementById('profile-password-form');
    const profileDetailsMsg = document.getElementById('profile-details-msg');
    const profilePasswordMsg = document.getElementById('profile-password-msg');

    if (profileDetailsForm) {
        profileDetailsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = profileDetailsForm.querySelector('button');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Updating...';
            profileDetailsMsg.textContent = '';
            profileDetailsMsg.style.color = 'inherit';

            const payload = {
                first_name: document.getElementById('profile-firstname').value.trim() || undefined,
                last_name: document.getElementById('profile-lastname').value.trim() || undefined,
                email: document.getElementById('profile-email').value.trim() || undefined
            };

            if (payload.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(payload.email)) {
                    profileDetailsMsg.textContent = 'Please enter a valid email address.';
                    profileDetailsMsg.style.color = '#f87171';
                    btn.disabled = false;
                    btn.textContent = originalText;
                    return;
                }
            }

            try {
                const response = await fetch(`${API_BASE_URL}/profile/me`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });
                
                const data = await parseApiResponse(response);
                if (!response.ok) throw new Error(getApiErrorMessage(data, 'Update failed'));
                
                profileDetailsMsg.textContent = 'Details updated successfully!';
                profileDetailsMsg.style.color = 'var(--success)';
                
                // Update UI and session
                if (data.first_name) {
                    username.textContent = data.first_name;
                    avatar.textContent = data.first_name.slice(0, 2).toUpperCase();
                    
                    const user = JSON.parse(sessionStorage.getItem('eduai_user') || '{}');
                    user.first_name = data.first_name;
                    if (data.last_name) user.last_name = data.last_name;
                    if (data.email) user.email = data.email;
                    sessionStorage.setItem('eduai_user', JSON.stringify(user));
                }
            } catch (error) {
                profileDetailsMsg.textContent = error.message;
                profileDetailsMsg.style.color = '#f87171';
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    if (profilePasswordForm) {
        profilePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = profilePasswordForm.querySelector('button');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Updating...';
            profilePasswordMsg.textContent = '';
            profilePasswordMsg.style.color = 'inherit';

            const current_password = document.getElementById('profile-current-password').value;
            const new_password = document.getElementById('profile-new-password').value;
            const confirm_password = document.getElementById('profile-confirm-password').value;

            if (new_password !== confirm_password) {
                profilePasswordMsg.textContent = 'New passwords do not match';
                profilePasswordMsg.style.color = '#f87171';
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/profile/me/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_password, new_password }),
                    credentials: 'include'
                });
                
                if (response.status !== 204) {
                    const data = await parseApiResponse(response);
                    throw new Error(getApiErrorMessage(data, 'Password update failed'));
                }
                
                profilePasswordMsg.textContent = 'Password updated successfully!';
                profilePasswordMsg.style.color = 'var(--success)';
                profilePasswordForm.reset();
            } catch (error) {
                profilePasswordMsg.textContent = error.message;
                profilePasswordMsg.style.color = '#f87171';
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }


});
