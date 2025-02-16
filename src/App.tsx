import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import CodeBlock from './components/CodeBlock';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const API_BASE_URL = 'http://localhost:3001/api';

interface Message {
  id?: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt?: Date;
  chatId?: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface Model {
  name: string;
  id: string;
}

interface OpenRouterModel {
  id: string;
}

function App() {
  const [selectedLLM, setSelectedLLM] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const [openRouterApiKey, setOpenRouterApiKey] = useState(import.meta.env.VITE_OPENROUTER_API_KEY || '');
  const [availableModels, setAvailableModels] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [settingsError, setSettingsError] = useState('');
  const [apiProvider, setApiProvider] = useState('openrouter');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const responseDisplayRef = useRef<HTMLDivElement>(null);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamBufferRef = useRef('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingDots, setLoadingDots] = useState('');
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const [isConversationStarted, setIsConversationStarted] = useState(false);

  useEffect(() => {
    const apiKey = localStorage.getItem('openRouterApiKey');
    const savedEndpoint = localStorage.getItem('ollamaEndpoint');
    if (apiKey && apiProvider === 'openrouter') {
      setOpenRouterApiKey(apiKey);
      fetchOpenRouterModels(apiKey);
    }
    if (savedEndpoint) {
      setOllamaEndpoint(savedEndpoint);
    }
    if (apiProvider === 'ollama') {
      fetchOllamaModels();
    }
  }, [apiProvider]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingDots(prev => (prev.length >= 6 ? '' : prev + '.'));
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const fetchOllamaModels = async () => {
    try {
      const response = await fetch(`${ollamaEndpoint}/api/tags`);
      if (!response.ok) {
        throw new Error('Failed to fetch Ollama models');
      }
      const data = await response.json();
      setOllamaModels(data.models.map((model: Model) => model.name));
      setSettingsError('');
    } catch (error) {
      console.error("Error fetching Ollama models:", error);
      setSettingsError('Failed to connect to Ollama. Please check if Ollama is running and the endpoint is correct.');
      setOllamaModels([]);
    }
  };

  const fetchOpenRouterModels = async (apiKey: string) => {
    if (apiProvider !== 'openrouter') return;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'HTTP-Referer': window.location.href,
          'X-Title': 'Xponder',
          'Authorization': `Bearer ${apiKey}`
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAvailableModels(data.data.map((model: OpenRouterModel) => model.id));
      setSettingsError('');
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
      setSettingsError('Invalid OpenRouter API Key or network error.');
      setAvailableModels([]);
    }
  };

  useEffect(() => {
    const loadChats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/chats`);
            if (!response.ok) {
                throw new Error('Failed to fetch chats');
            }
            const loadedChats = await response.json();
            setChats(loadedChats);
            
            if (loadedChats.length > 0) {
                const mostRecentChat = loadedChats[0];
                setCurrentChatId(mostRecentChat.id);
                
                const messagesResponse = await fetch(`${API_BASE_URL}/chats/${mostRecentChat.id}/messages`);
                if (!messagesResponse.ok) {
                    throw new Error('Failed to fetch messages');
                }
                const messages = await messagesResponse.json();
                setChatHistory(messages);
                setIsConversationStarted(messages.length > 0);
            } else {
                handleNewChat();
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    };
    loadChats();
  }, []);

  const handleNewChat = () => {
    setCurrentChatId(null);
    setChatHistory([]);
    setStreamedResponse('');
    streamBufferRef.current = '';
    setIsConversationStarted(false);
  };

  const handleChatClick = async (chatId: string) => {
    setCurrentChatId(chatId);
    setStreamedResponse('');
    streamBufferRef.current = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`);
        if (!response.ok) {
            throw new Error('Failed to fetch chat messages');
        }
        const messages = await response.json();
        console.log('Loaded messages:', messages); // Debug log
        setChatHistory(messages);
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        setChatHistory([]);
    }
  };

  const handleStreamResponse = async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    const isGeminiModel = selectedLLM.includes('gemini');
    let wordBuffer = '';
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            
            if (apiProvider === 'ollama') {
                try {
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        
                        const data = JSON.parse(line);
                        if (data.message) {
                            const content = data.message.content;
                            streamBufferRef.current += content;
                            setStreamedResponse(streamBufferRef.current);
                        } else if (data.response) {
                            const content = data.response;
                            streamBufferRef.current += content;
                            setStreamedResponse(streamBufferRef.current);
                        }
                    }
                } catch (e) {
                    streamBufferRef.current += chunk;
                    setStreamedResponse(streamBufferRef.current);
                }
            } else {
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.trim() || line.includes('[DONE]')) continue;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonData = JSON.parse(line.slice(6));
                            if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
                                const content = jsonData.choices[0].delta.content;
                                
                                if (isGeminiModel) {
                                    wordBuffer += content;
                                    const words = content.split(/(\s+|[.,!?])/);
                                    for (const word of words) {
                                        if (word) {
                                            await new Promise(resolve => setTimeout(resolve, 30));
                                            streamBufferRef.current += word;
                                            setStreamedResponse(streamBufferRef.current);
                                        }
                                    }
                                    wordBuffer = '';
                                } else {
                                    streamBufferRef.current += content;
                                    setStreamedResponse(streamBufferRef.current);
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing line:', e);
                        }
                    }
                }
            }
        }
        
        // Flush any remaining word buffer
        if (wordBuffer) {
            streamBufferRef.current += wordBuffer;
            setStreamedResponse(streamBufferRef.current);
        }
    } catch (error) {
        console.error('Error reading stream:', error);
        throw error;
    } finally {
        reader.releaseLock();
    }

    return streamBufferRef.current;
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim() || !selectedLLM) return;

    if (!isConversationStarted) {
      setIsConversationStarted(true);
    }

    const currentPrompt = prompt;
    setPrompt('');
    setIsGenerating(true);
    streamBufferRef.current = '';
    setStreamedResponse('');

    try {
      let chatId = currentChatId;
      
      // Create a new chat if none exists
      if (!chatId) {
        const chatResponse = await fetch(`${API_BASE_URL}/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: currentPrompt.split('\n')[0].slice(0, 30)
          }),
        });
        
        if (!chatResponse.ok) {
          throw new Error('Failed to create new chat');
        }
        
        const newChat = await chatResponse.json();
        chatId = newChat.id;
        setCurrentChatId(chatId);
        setChats(prev => [newChat, ...prev]);
      }

      // Save user message
      const userMessageResponse = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: currentPrompt,
          role: 'user',
        }),
      });

      if (!userMessageResponse.ok) {
        throw new Error('Failed to save user message');
      }

      const userMessage = await userMessageResponse.json();
      setChatHistory(prev => [...prev, userMessage]);

      // Get API response
      let response;
      if (apiProvider === 'openrouter') {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': 'Xponder',
            'Authorization': `Bearer ${openRouterApiKey}`
          },
          body: JSON.stringify({
            model: selectedLLM,
            messages: [
              ...chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
              })),
              { role: 'user', content: currentPrompt }
            ],
            stream: true
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle the streaming response
        const completeResponse = await handleStreamResponse(response);

        // Save assistant's message after stream is complete
        if (completeResponse.trim()) {
          const assistantMessageResponse = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: completeResponse,
              role: 'assistant',
            }),
          });

          if (!assistantMessageResponse.ok) {
            throw new Error('Failed to save assistant message');
          }

          const assistantMessage = await assistantMessageResponse.json();
          setChatHistory(prev => [...prev, assistantMessage]);
        }
      } else if (apiProvider === 'ollama') {
        response = await fetch(`${ollamaEndpoint}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedLLM,
            prompt: currentPrompt,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle the streaming response
        const completeResponse = await handleStreamResponse(response);

        // Save assistant's message after stream is complete
        if (completeResponse.trim()) {
          const assistantMessageResponse = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: completeResponse,
              role: 'assistant',
            }),
          });

          if (!assistantMessageResponse.ok) {
            throw new Error('Failed to save assistant message');
          }

          const assistantMessage = await assistantMessageResponse.json();
          setChatHistory(prev => [...prev, assistantMessage]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setSettingsError('Failed to send message. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    setDeleteError(null);
    setChatToDelete(chatId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/chats/${chatToDelete}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete chat');
      }

      setChats(prev => prev.filter(chat => chat.id !== chatToDelete));
      if (currentChatId === chatToDelete) {
        setCurrentChatId(null);
        setChatHistory([]);
        setStreamedResponse('');
      }
      setIsDeleteModalOpen(false);
      setChatToDelete(null);
    } catch (error) {
      console.error('Error deleting chat:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete chat');
    }
  };

  const toggleSettings = () => setIsSettingsOpen(!isSettingsOpen);

  const handleClickOutsideSettings = (event: MouseEvent) => {
    if (
      isSettingsOpen && 
      settingsPanelRef.current && 
      event.target instanceof Node && 
      !settingsPanelRef.current.contains(event.target)
    ) {
      setIsSettingsOpen(false);
    }
  };

  const handleSaveSettings = () => {
    try {
      if (apiProvider === 'openrouter') {
        localStorage.setItem('openRouterApiKey', openRouterApiKey);
        fetchOpenRouterModels(openRouterApiKey);
      } else if (apiProvider === 'ollama') {
        localStorage.setItem('ollamaEndpoint', ollamaEndpoint);
        fetchOllamaModels();
      }
      setSettingsError('');
      setIsSettingsOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettingsError('Failed to save settings');
    }
  };

  useEffect(() => {
    const savedOpenRouterKey = localStorage.getItem('openRouterApiKey');
    console.log('Loaded OpenRouter API key:', savedOpenRouterKey ? 'Present (hidden)' : 'Missing');
    
    if (savedOpenRouterKey) {
        setOpenRouterApiKey(savedOpenRouterKey);
        fetchOpenRouterModels(savedOpenRouterKey);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutsideSettings);
    return () => document.removeEventListener('mousedown', handleClickOutsideSettings);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (responseDisplayRef.current) {
      responseDisplayRef.current.scrollTop = responseDisplayRef.current.scrollHeight;
    }
  }, [chatHistory, response, streamedResponse]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const renderMessage = (message: { role: string; content: string }) => {
    const codeBlockRegex = /```([\w-]*)?(?:\n|\s)([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(message.content)) !== null) {
        if (match.index > lastIndex) {
            parts.push(
                <div key={`text-${lastIndex}`} className="whitespace-pre-wrap mb-2">
                    {message.content.slice(lastIndex, match.index)}
                </div>
            );
        }

        const language = match[1]?.trim() || 'text';
        const code = match[2].replace(/^\n+|\n+$/g, '');
        
        parts.push(
            <CodeBlock
                key={`code-${match.index}`}
                code={code}
                language={language}
                isDarkMode={isDarkMode}
            />
        );

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < message.content.length) {
        parts.push(
            <div key={`text-${lastIndex}`} className="whitespace-pre-wrap">
                {message.content.slice(lastIndex)}
            </div>
        );
    }

    return parts.length > 0 ? parts : (
        <div className="whitespace-pre-wrap">
            {message.content}
        </div>
    );
  };

  useEffect(() => {
    if (streamedResponse && responseDisplayRef.current) {
        responseDisplayRef.current.scrollTop = responseDisplayRef.current.scrollHeight;
    }
  }, [streamedResponse]);

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-gray-900' : 'bg-teal-800'}`}>
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <header className={`flex items-center justify-between px-6 py-3`}>
          <div className="text-3xl font-bold text-white drop-shadow-lg hover:drop-shadow-xl transition-all">
            Xponder
          </div>
          
          <div className="flex gap-4">
            <Button 
              onClick={handleNewChat}
              variant="ghost"
              className="text-white hover:bg-gray-700 transition duration-300 shadow-md hover:shadow-lg"
            >
              New Chat
            </Button>
            <Sheet 
              open={isChatsOpen} 
              onOpenChange={setIsChatsOpen}
            >
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-gray-700 transition duration-300 shadow-md hover:shadow-lg"
                >
                  Chats
                </Button>
              </SheetTrigger>
              <SheetContent 
                className={`w-[400px] mt-16 border-none shadow-none ${
                  isDarkMode 
                    ? 'bg-gray-800' 
                    : 'bg-white'
                }`}
                style={{
                  '--tw-bg-opacity': '0',
                  '--tw-backdrop-blur': 'none'
                } as React.CSSProperties}
              >
                <div className="flex-1 overflow-y-auto mt-4 space-y-2">
                  {chats.map(chat => (
                    <div key={chat.id}>
                      {chatToDelete === chat.id ? (
                        // Delete confirmation inline
                        <div className={`p-4 rounded-xl mb-2 ${
                          isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm mb-3">Are you sure you want to delete this chat?</p>
                          {deleteError && (
                            <p className="text-red-500 text-xs mb-3">{deleteError}</p>
                          )}
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setChatToDelete(null);
                                setDeleteError(null);
                              }}
                              className={`px-3 py-1 rounded text-sm ${
                                isDarkMode 
                                  ? 'bg-gray-600 hover:bg-gray-500' 
                                  : 'bg-gray-200 hover:bg-gray-300'
                              }`}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={confirmDelete}
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Regular chat button
                        <button
                          onClick={() => {
                            handleChatClick(chat.id);
                            setIsChatsOpen(false);
                          }}
                          className={`w-full p-3 text-left rounded-xl transition-colors ${
                            chat.id === currentChatId
                              ? isDarkMode
                                ? 'bg-gray-700/90 text-white'
                                : 'bg-teal-500/90 text-white'
                              : isDarkMode
                              ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                              : 'bg-gray-100/50 text-gray-900 hover:bg-gray-200/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium">
                                {chat.title || 'New Chat'}
                              </p>
                              {chat.messages.length > 0 && (
                                <p className="truncate text-xs opacity-70 mt-1">
                                  {chat.messages[chat.messages.length - 1].content}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                handleDeleteChat(chat.id);
                              }}
                              className="ml-2 opacity-60 hover:opacity-100 shadow-sm hover:shadow-md"
                              title="Delete chat"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </Button>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
            <Button 
              onClick={toggleSettings}
              variant="ghost"
              className={`text-white hover:bg-gray-700 transition duration-300 shadow-md hover:shadow-lg`}
            >
              Settings
            </Button>
            <Button 
              onClick={toggleDarkMode}
              variant="ghost"
              className={`text-white hover:bg-gray-700 transition duration-300 shadow-md hover:shadow-lg`}
            >
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-hidden flex items-center justify-center">
          <div className={`transition-all duration-500 ease-in-out ${
              isConversationStarted 
                  ? 'max-w-4xl w-full h-full' 
                  : 'max-w-xl w-full h-[400px]'
          }`}>
            <div className={`h-full flex flex-col rounded-xl overflow-hidden ${
                isDarkMode 
                    ? 'bg-gray-800'
                    : 'bg-white'
            }`}>
                {/* Chat header */}
                <div className="flex items-center justify-between p-6 pb-4">
                    <h2 className={`text-xl font-semibold ${
                        isDarkMode ? 'text-white' : 'text-teal-900'
                    }`}>
                        {isConversationStarted 
                            ? (chats.find(chat => chat.id === currentChatId)?.title || 'New Chat')
                            : 'Start a New Conversation'
                        }
                    </h2>
                </div>

                {/* Messages container */}
                <div 
                    ref={responseDisplayRef}
                    className={`flex-1 overflow-y-auto p-6 space-y-4 ${
                        !isConversationStarted && chatHistory.length === 0 
                            ? 'flex items-center justify-center' 
                            : ''
                    }`}
                >
                    {!isConversationStarted && chatHistory.length === 0 ? (
                        <div className="text-center text-gray-500">
                            <p className="text-lg mb-2">👋 Welcome to Xpond Chat</p>
                            <p className="text-sm">Select a model and start typing to begin a conversation</p>
                        </div>
                    ) : (
                        <div className="flex flex-col space-y-4">
                            {chatHistory.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${
                                        message.role === 'assistant' ? 'justify-start' : 'justify-end'
                                    }`}
                                >
                                    <div
                                        className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                            message.role === 'assistant'
                                                ? isDarkMode
                                                    ? 'bg-gray-700 text-white'
                                                    : 'bg-gray-200 text-gray-900'
                                                : isDarkMode
                                                ? 'bg-teal-600 text-white'
                                                : 'bg-teal-500 text-white'
                                        }`}
                                    >
                                        {renderMessage(message)}
                                    </div>
                                </div>
                            ))}

                            {/* Only show streaming response if it's not already in chatHistory */}
                            {streamedResponse && !chatHistory.some(msg => msg.content === streamedResponse) && (
                                <div className="flex justify-start">
                                    <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                        isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                                    }`}>
                                        {renderMessage({ role: 'assistant', content: streamedResponse })}
                                    </div>
                                </div>
                            )}

                            {/* Loading animation */}
                            {isGenerating && !streamedResponse && (
                                <div className="flex justify-start">
                                    <div className={`rounded-lg px-4 py-2 ${
                                        isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900'
                                    }`}>
                                        <div className="flex items-center space-x-2">
                                            <span>Generating magic</span>
                                            <span className="w-16 text-left">{loadingDots}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input container */}
                <div className={`p-4 border-t ${
                    isDarkMode 
                        ? 'border-gray-700/50'
                        : 'border-gray-200/50'
                }`}>
                    <div className="flex flex-col gap-4">
                        {/* Model selection row */}
                        <div className="flex gap-2">
                            <select
                                value={apiProvider}
                                onChange={(e) => {
                                    setApiProvider(e.target.value);
                                    setSelectedLLM('');
                                }}
                                className={`px-3 py-2 rounded-lg text-sm ${
                                    isDarkMode
                                        ? 'bg-gray-700 text-white border-gray-600'
                                        : 'bg-white text-gray-900 border-gray-200'
                                } border focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
                            >
                                <option value="openrouter">OpenRouter</option>
                                <option value="ollama">Ollama</option>
                            </select>

                            <select
                                value={selectedLLM}
                                onChange={(e) => setSelectedLLM(e.target.value)}
                                className={`px-3 py-2 rounded-lg text-sm min-w-[200px] max-w-[400px] ${
                                    isDarkMode
                                        ? 'bg-gray-700 text-white border-gray-600'
                                        : 'bg-white text-gray-900 border-gray-200'
                                } border focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
                            >
                                <option value="">Select Model</option>
                                {(apiProvider === 'openrouter' ? availableModels : ollamaModels).map((model: string) => {
                                    return (
                                        <option 
                                            key={model} 
                                            value={model}
                                            className={`${
                                                isDarkMode ? 'bg-gray-700' : 'bg-white'
                                            } whitespace-normal`}
                                            style={{ width: 'auto' }}
                                        >
                                            {model}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Input and send button row */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendPrompt();
                                    }
                                }}
                                placeholder="Type your message..."
                                className={`flex-1 py-2 px-4 rounded-xl border ${
                                    isDarkMode 
                                        ? 'bg-gray-700/50 border-gray-600/50 text-white placeholder-gray-400' 
                                        : 'bg-white/80 border-gray-200/50 text-teal-900 placeholder-gray-400'
                                } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
                            />
                            <button
                                onClick={handleSendPrompt}
                                disabled={!prompt || !selectedLLM}
                                className={`px-6 py-2 text-white rounded-xl transition-colors whitespace-nowrap shadow-md hover:shadow-lg ${
                                    isDarkMode
                                        ? 'bg-teal-600/90 hover:bg-teal-500/90'
                                        : 'bg-teal-600/90 hover:bg-teal-500/90'
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </main>
      </div>

      {isSettingsOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setIsSettingsOpen(false)} />
          <div
            ref={settingsPanelRef}
            className={`fixed right-0 top-16 h-[calc(100vh-4rem)] w-[400px] z-50 p-6 ${
              isDarkMode 
                ? 'bg-transparent text-white' 
                : 'bg-transparent text-gray-900'
            }`}
          >
            <div className="h-full overflow-y-auto space-y-4">
              <div className={`p-4 rounded-xl ${
                isDarkMode ? 'bg-gray-800/90' : 'bg-white/90'
              }`}>
                <h2 className={`text-xl font-semibold mb-4 ${
                  isDarkMode ? 'text-white' : 'text-teal-900'
                }`}>
                  Settings
                </h2>

                {apiProvider === 'openrouter' && (
                  <div className={`p-4 rounded-xl mb-4 ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'
                  }`}>
                    <label className="block text-sm font-medium mb-2">
                      OpenRouter API Key:
                    </label>
                    <input
                      type="password"
                      className={`w-full p-2 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-gray-800 text-white border-gray-600 placeholder-gray-400' 
                          : 'bg-white text-gray-900 border-gray-200 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
                      value={openRouterApiKey}
                      onChange={(e) => {
                        setOpenRouterApiKey(e.target.value);
                        setSettingsError('');
                      }}
                      placeholder="Enter OpenRouter API key"
                    />
                  </div>
                )}

                {apiProvider === 'ollama' && (
                  <div className={`p-4 rounded-xl mb-4 ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'
                  }`}>
                    <label className="block text-sm font-medium mb-2">
                      Ollama Endpoint:
                    </label>
                    <input
                      type="text"
                      className={`w-full p-2 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-gray-800 text-white border-gray-600 placeholder-gray-400' 
                          : 'bg-white text-gray-900 border-gray-200 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-teal-500/50`}
                      value={ollamaEndpoint}
                      onChange={(e) => {
                        setOllamaEndpoint(e.target.value);
                        setSettingsError('');
                      }}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                )}

                {settingsError && (
                  <div className={`p-4 rounded-xl mb-4 ${
                    isDarkMode ? 'bg-red-900/20' : 'bg-red-100/50'
                  }`}>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-red-300' : 'text-red-600'
                    }`}>
                      {settingsError}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSaveSettings}
                  className={`w-full p-3 rounded-xl transition-colors shadow-md hover:shadow-lg ${
                    isDarkMode
                      ? 'bg-teal-600 hover:bg-teal-500 text-white'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                  }`}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;