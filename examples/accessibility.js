// Accessibility use case - screen reader style
import { SpeakEasy } from 'speakeasy';

const screenReader = SpeakEasy.builder()
  .withProvider('openai')
  .withOpenAIVoice('nova')
  .withRate(250) // Faster for screen reading
  .build();

// Announce UI elements
export const announce = async (element, message) => {
  await screenReader.speak(message, { priority: 'high', interrupt: true });
};

// Usage in a web app
const button = document.getElementById('submit');
button.addEventListener('focus', () => {
  announce(button, 'Submit form button');
});

button.addEventListener('click', () => {
  announce(button, 'Form submitted successfully');
});