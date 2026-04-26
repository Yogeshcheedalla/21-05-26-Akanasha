'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Mic, MicOff, Send, Square, BookMarked, Image as ImageIcon, X, FileText } from 'lucide-react';


interface ChatComposerProps {
  onSend: (content: string, attachments?: File[]) => void;
  onOpenPromptLibrary: () => void;
  isStreaming: boolean;
  selectedModel: string;
  onToggleMic?: () => void;
  isListening?: boolean;
}

export default function ChatComposer({ onSend, onOpenPromptLibrary, isStreaming, onToggleMic, isListening }: ChatComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleApplyPrompt = (e: any) => {
      const promptText = e.detail;
      setContent(promptText);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        textareaRef.current.focus();
      }
    };
    window.addEventListener('akansha-apply-prompt', handleApplyPrompt);
    return () => window.removeEventListener('akansha-apply-prompt', handleApplyPrompt);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!content.trim() || isStreaming) return;
    onSend(content, attachments.length > 0 ? attachments : undefined);
    setContent('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5);
    setAttachments(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon size={12} className="text-blue-400" />;
    return <FileText size={12} className="text-muted-foreground" />;
  };

  return (
    <div className="px-4 pb-4 pt-2">
      {isDragging && (
        <div className="absolute inset-4 rounded-xl border-2 border-dashed border-[#6C47FF] bg-[#6C47FF]/5 z-10 flex items-center justify-center pointer-events-none">
          <p className="text-sm font-medium text-[#6C47FF]">Drop files to attach</p>
        </div>
      )}

      <div
        className={`
          relative border rounded-2xl bg-card transition-all duration-150
          ${isDragging ? 'border-[#6C47FF]' : 'border-border'}
          focus-within:border-[#6C47FF]/50 focus-within:ring-1 focus-within:ring-[#6C47FF]/20
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((file, i) => (
              <div key={`attachment-${i}-${file.name}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs group">
                {getFileIcon(file)}
                <span className="font-mono text-foreground max-w-[120px] truncate">{file.name}</span>
                <span className="text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-500 transition-colors ml-1">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {isListening && (
          <div className="flex items-center gap-3 px-4 pt-3">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={`wave-${i}`}
                  className="w-1 bg-red-500 rounded-full waveform-bar"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-red-500 font-medium animate-pulse">Listening...</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message Akansha... (Shift+Enter for new line)"
          rows={1}
          className="w-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed min-h-[52px]"
          disabled={isStreaming}
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.py,.json,.csv"
              className="hidden"
              onChange={e => handleFileSelect(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Attach files"
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={onOpenPromptLibrary}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Prompt templates"
            >
              <BookMarked size={16} />
            </button>
            {onToggleMic && (
              <button
                onClick={onToggleMic}
                className={`p-2 rounded-lg transition-colors ${
                  isListening
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' :'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground/60 hidden sm:block">
              {content.length > 0 && `${content.length} chars`}
            </span>
            {isStreaming ? (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors">
                <Square size={12} fill="currentColor" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!content.trim()}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95
                  ${content.trim()
                    ? 'bg-[#6C47FF] hover:bg-[#5A35EE] text-white shadow-sm shadow-[#6C47FF]/20'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                <Send size={13} />
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground/40 mt-2">
        Akansha can make mistakes. Verify important information.
      </p>
    </div>
  );
}