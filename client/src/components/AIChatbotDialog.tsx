import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';

const slideIn = keyframes`
  from {
    transform: translateY(30px) scale(0.95);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const StyledDialog = styled(Dialog)`
  & .MuiDialog-paper {
    position: fixed;
    bottom: 20px;
    right: 20px;
    margin: 0;
    width: 380px;
    max-height: 550px;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    animation: ${slideIn} 0.3s ease-out;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    overflow: hidden;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AvatarCircle = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const BotName = styled.span`
  font-weight: 600;
  font-size: 16px;
`;

const OnlineStatus = styled.span`
  font-size: 12px;
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    background: #4ade80;
    border-radius: 50%;
  }
`;

const MessagesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  min-height: 300px;
  max-height: 350px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 3px;
  }
`;

const MessageWrapper = styled.div<{ sender: 'user' | 'ai' }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ sender }) => (sender === 'user' ? 'flex-end' : 'flex-start')};
  gap: 4px;
`;

const MessageBubble = styled.div<{ sender: 'user' | 'ai' }>`
  background: ${({ sender }) => (sender === 'user' 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
    : '#ffffff')};
  color: ${({ sender }) => (sender === 'user' ? 'white' : '#1e293b')};
  padding: 12px 16px;
  border-radius: ${({ sender }) => (sender === 'user' 
    ? '18px 18px 4px 18px' 
    : '18px 18px 18px 4px')};
  max-width: 85%;
  word-wrap: break-word;
  line-height: 1.5;
  white-space: pre-wrap;
  font-size: 14px;
  box-shadow: ${({ sender }) => (sender === 'user' 
    ? 'none' 
    : '0 2px 8px rgba(0,0,0,0.08)')};
  border: ${({ sender }) => (sender === 'user' ? 'none' : '1px solid #e2e8f0')};
`;

const MessageTime = styled.span`
  font-size: 11px;
  color: #94a3b8;
  padding: 0 4px;
`;

const EmptyChat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: #64748b;
  text-align: center;
  padding: 20px;
`;

const EmptyIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #334155;
`;

const EmptyText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #64748b;
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  background: #ffffff;
  border-radius: 18px 18px 18px 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border: 1px solid #e2e8f0;
  width: fit-content;
`;

const TypingDot = styled.span<{ delay: number }>`
  width: 8px;
  height: 8px;
  background: #667eea;
  border-radius: 50%;
  animation: ${pulse} 1.4s ease-in-out infinite;
  animation-delay: ${({ delay }) => delay}s;
`;

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
`;

const StyledInput = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  background: #f8fafc;
  
  &:focus {
    border-color: #667eea;
    background: #ffffff;
  }
  
  &::placeholder {
    color: #94a3b8;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SendButton = styled(IconButton)<{ disabled?: boolean }>`
  && {
    width: 44px;
    height: 44px;
    background: ${({ disabled }) => disabled 
      ? '#e2e8f0' 
      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
    color: white;
    transition: all 0.2s ease;
    
    &:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    &:disabled {
      color: #94a3b8;
    }
  }
`;

// Get the API URL based on environment
const getApiUrl = () => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3005';
  }
  return '';
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function AIChatbotDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ sender: 'user' | 'ai'; text: string; time: Date }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    const newMessages = [...messages, { sender: 'user' as const, text: userMessage, time: new Date() }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${getApiUrl()}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(m => ({ sender: m.sender, text: m.text })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'ai' as const, text: data.response, time: new Date() },
      ]);
    } catch (err: any) {
      console.error('Error sending message:', err);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'ai' as const, text: `Sorry, I couldn't process that. Please try again.`, time: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <StyledDialog open={open} onClose={onClose} hideBackdrop>
      <Header>
        <HeaderLeft>
          <AvatarCircle>
            <SmartToyIcon sx={{ fontSize: 24 }} />
          </AvatarCircle>
          <HeaderInfo>
            <BotName>AI Assistant</BotName>
            <OnlineStatus>Online</OnlineStatus>
          </HeaderInfo>
        </HeaderLeft>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: 'white', '&:hover': { background: 'rgba(255,255,255,0.1)' } }}
        >
          <CloseIcon />
        </IconButton>
      </Header>
      
      {messages.length === 0 ? (
        <EmptyChat>
          <EmptyIcon>
            <SmartToyIcon sx={{ fontSize: 40, color: '#667eea' }} />
          </EmptyIcon>
          <EmptyTitle>Hi! I'm your AI Assistant</EmptyTitle>
          <EmptyText>Ask me anything and I'll do my best to help you out!</EmptyText>
        </EmptyChat>
      ) : (
        <MessagesContainer>
          {messages.map((msg, idx) => (
            <MessageWrapper key={idx} sender={msg.sender}>
              <MessageBubble sender={msg.sender}>
                {msg.text}
              </MessageBubble>
              <MessageTime>{formatTime(msg.time)}</MessageTime>
            </MessageWrapper>
          ))}
          {isLoading && (
            <TypingIndicator>
              <TypingDot delay={0} />
              <TypingDot delay={0.2} />
              <TypingDot delay={0.4} />
            </TypingIndicator>
          )}
          <div ref={messagesEndRef} />
        </MessagesContainer>
      )}
      
      <InputContainer>
        <StyledInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <SendButton 
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
        >
          <SendIcon sx={{ fontSize: 20 }} />
        </SendButton>
      </InputContainer>
    </StyledDialog>
  );
}
