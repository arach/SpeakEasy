// Notification system use case
import { SpeakEasy } from 'speakeasy';

const notificationSpeaker = new SpeakEasy({
  provider: 'system',
  systemVoice: 'Samantha',
  rate: 200
});

// Priority-based notifications
export const notify = async (message, priority = 'normal') => {
  const options = {
    high: { priority: 'high', interrupt: true },
    medium: { priority: 'normal' },
    low: { priority: 'low' }
  };
  
  await notificationSpeaker.speak(message, options[priority]);
};

// Usage examples
await notify('You have a new email', 'medium');
await notify('Critical system alert!', 'high');
await notify('Daily reminder: Drink water', 'low');