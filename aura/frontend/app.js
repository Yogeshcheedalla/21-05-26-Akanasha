document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabs = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const avatar = document.getElementById('akansha-avatar');
    
    // Web Speech API for TTS
    const synth = window.speechSynthesis;
    let akanshaVoice = null;

    let availableVoices = [];

    // Load Voices
    function loadVoices() {
        availableVoices = synth.getVoices();
        const select = document.getElementById('voice-select');
        if(select && availableVoices.length > 0) {
            // Keep current selection if it exists
            const currentSelection = select.value;
            select.innerHTML = availableVoices.map(v => `<option value="${v.name}">${v.name}</option>`).join('');
            
            if (currentSelection && availableVoices.find(v => v.name === currentSelection)) {
                select.value = currentSelection;
            } else {
                // Default to a female voice if possible
                const defaultVoice = availableVoices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google UK English Female'));
                if(defaultVoice) {
                    select.value = defaultVoice.name;
                    akanshaVoice = defaultVoice;
                } else {
                    akanshaVoice = availableVoices[0];
                }
            }
        }
    }
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Test voice when changed
    const voiceSelectElement = document.getElementById('voice-select');
    if (voiceSelectElement) {
        voiceSelectElement.addEventListener('change', () => {
            speak("Voice updated.");
        });
    }
    
    // Voice Mode Setup (STT)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;
    const visualizer = document.getElementById('audio-visualizer');
    const voiceAvatar = document.getElementById('akansha-voice-avatar');

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            visualizer.classList.add('active');
            document.getElementById('start-listening-btn').style.display = 'none';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            if(transcript.trim()) {
                addMessage(transcript, 'user');
                sendToAPI(transcript);
            }
        };

        recognition.onend = () => {
            isListening = false;
            visualizer.classList.remove('active');
            document.getElementById('start-listening-btn').style.display = 'flex';
        };

        document.getElementById('start-listening-btn').addEventListener('click', () => recognition.start());
        document.getElementById('stop-listening-btn').addEventListener('click', () => {
            if(isListening) recognition.stop();
            if(synth.speaking) synth.cancel();
        });
        
        document.getElementById('mic-btn').addEventListener('click', () => {
            document.querySelector('[data-tab="voice"]').click();
            recognition.start();
        });
    }

    // Google Login Placeholder
    document.getElementById('google-login-btn').addEventListener('click', () => {
        alert("Google OAuth Flow Initiated. This will redirect to Google's consent screen to securely link your Gmail and Calendar.");
    });

    // Navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(`${target}-view`).classList.add('active-view');
            
            if(target === 'memory') fetchMemories();
            if(target === 'tasks') fetchTasks();
            if(target === 'voice') {
                speak("Voice mode activated. I am listening.");
            }
        });
    });

    // Chat Functionality
    function addMessage(text, role) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.innerHTML = `<div class="bubble">${text}</div>`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Global reference to prevent garbage collection of long speeches in Chrome
    window.utterances = [];

    function speak(text) {
        if (synth.speaking) synth.cancel();
        
        // Temporarily pause listening while speaking to prevent feedback loops
        if(isListening && recognition) recognition.stop();

        const utterThis = new SpeechSynthesisUtterance(text);
        window.utterances.push(utterThis); // Prevent GC
        
        // Apply Custom Voice
        const voiceSelect = document.getElementById('voice-select');
        if(voiceSelect && availableVoices.length > 0) {
            const selectedVoice = availableVoices.find(v => v.name === voiceSelect.value);
            if (selectedVoice) {
                utterThis.voice = selectedVoice;
                utterThis.lang = selectedVoice.lang;
            }
        } else if (akanshaVoice) {
            utterThis.voice = akanshaVoice;
            utterThis.lang = akanshaVoice.lang;
        }

        // Apply Custom Tone
        const tone = document.getElementById('tone-select') ? document.getElementById('tone-select').value : 'friendly';
        if(tone === 'professional') { utterThis.pitch = 0.9; utterThis.rate = 1.0; }
        else if(tone === 'calm') { utterThis.pitch = 0.8; utterThis.rate = 0.85; }
        else { utterThis.pitch = 1.1; utterThis.rate = 1.05; } // friendly
        
        utterThis.onstart = () => {
            avatar.classList.add('speaking');
            if(voiceAvatar) voiceAvatar.classList.add('speaking');
        };
        utterThis.onend = () => {
            avatar.classList.remove('speaking');
            if(voiceAvatar) voiceAvatar.classList.remove('speaking');
            
            // Resume listening if in voice mode
            const activeTab = document.querySelector('.nav-links li.active');
            if(activeTab && activeTab.getAttribute('data-tab') === 'voice' && recognition) {
                recognition.start();
            }
        };
        
        synth.speak(utterThis);
    }

    async function sendToAPI(text) {
        const typing = document.createElement('div');
        typing.className = 'message akansha typing-indicator';
        typing.innerHTML = `<div class="bubble">...</div>`;
        chatMessages.appendChild(typing);

        try {
            const res = await fetch('http://localhost:8000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.detail || "Server error");
            
            chatMessages.removeChild(typing);
            if (data.response) {
                // Simulated Streaming/Typing Effect
                const msgDiv = document.createElement('div');
                msgDiv.className = `message akansha`;
                const bubble = document.createElement('div');
                bubble.className = 'bubble';
                msgDiv.appendChild(bubble);
                chatMessages.appendChild(msgDiv);
                
                let i = 0;
                const text = data.response;
                
                function typeChar() {
                    if (i < text.length) {
                        bubble.innerHTML += text.charAt(i);
                        i++;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        setTimeout(typeChar, 15); // Typing speed
                    } else {
                        // Once finished typing, trigger voice
                        speak(text);
                    }
                }
                typeChar();
            }
        } catch (e) {
            chatMessages.removeChild(typing);
            const errorMsg = `I'm having trouble connecting. Error: ${e.message}`;
            addMessage(errorMsg, 'akansha');
            speak("I am having trouble connecting to my core servers.");
            console.error(e);
        }
    }

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        chatInput.value = '';
        sendToAPI(text);
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Fetch Data Functions
    async function fetchMemories() {
        const grid = document.getElementById('memory-grid');
        try {
            const res = await fetch('http://localhost:8000/api/memories');
            const data = await res.json();
            grid.innerHTML = data.memories.map(m => `
                <div class="card">
                    <h3 style="color: var(--accent); margin-bottom: 0.5rem;">${m.topic}</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">${m.insight}</p>
                </div>
            `).join('') || '<div class="card">No memories yet.</div>';
        } catch(e) { console.error(e); }
    }

    async function fetchTasks() {
        const list = document.getElementById('task-list');
        try {
            const res = await fetch('http://localhost:8000/api/tasks');
            const data = await res.json();
            list.innerHTML = data.tasks.map(t => `
                <div class="card" style="display: flex; gap: 1rem; align-items: center;">
                    <input type="checkbox" style="width: 20px; height: 20px;">
                    <div>
                        <h4 style="margin-bottom: 0.2rem;">${t.title}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">${t.description}</p>
                    </div>
                </div>
            `).join('') || '<div class="card">No pending tasks.</div>';
        } catch(e) { console.error(e); }
    }
});
