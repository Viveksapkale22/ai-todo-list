import express from 'express';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';
import { SYSTEM_PROMPT } from '../prompts/taskAgent.js';

const router = express.Router();

// Fallback models in case of rate limits (429) on the free tier
const FREE_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'deepseek/deepseek-chat'
];

router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { messages, clientTime, timezoneOffset } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Sanitize message roles: map 'ai' to 'assistant' to prevent deserialization 400 errors from OpenRouter
    const sanitizedMessages = messages.map(msg => ({
      role: msg.role === 'ai' ? 'assistant' : msg.role,
      content: msg.content
    }));

    // Retrieve user and their encrypted API key
    const user = await User.findById(req.user._id);
    if (!user || !user.openRouterApiKey) {
      return res.status(400).json({ 
        error: 'OpenRouter API key is missing. Please set your API key in settings.' 
      });
    }

    let decryptedKey;
    try {
      decryptedKey = decrypt(user.openRouterApiKey);
    } catch (err) {
      console.error('API key decryption failed:', err);
      return res.status(500).json({ error: 'Failed to decrypt API key.' });
    }

    if (!decryptedKey) {
      return res.status(400).json({ error: 'Invalid API key stored.' });
    }

    // Dynamic timezone/time context injection
    const timeContext = clientTime && timezoneOffset ? 
      `[System Context: Current User Local Time is ${clientTime}. User timezone offset is ${timezoneOffset}. All relative date/time calculations like 'today', 'tomorrow', 'next week', '9:00', or '2:30 PM' must be calculated relative to this reference local date-time. You MUST output scheduledAt in user's local date-time format (YYYY-MM-DDTHH:mm:ss) without any timezone offset or 'Z' suffix (e.g. if the user says 9:00 AM on June 22, scheduledAt must be '2026-06-22T09:00:00').]` : '';

    // Build the messages list, placing the time context right before the user query
    const finalMessages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    if (timeContext) {
      finalMessages.push({ role: 'system', content: timeContext });
    }

    finalMessages.push(...sanitizedMessages);

    let lastError = null;
    let apiData = null;

    // Loop through fallback models if rate limited
    for (const model of FREE_MODELS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout per model

      try {
        console.log(`[AI] Attempting chat completions with model: ${model}`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-todo-list.vercel.app',
            'X-Title': 'AITodo'
          },
          body: JSON.stringify({
            model: model,
            messages: finalMessages,
            temperature: 0.1 // Low temperature for consistent JSON output
          }),
          signal: controller.signal
        });

        if (response.ok) {
          apiData = await response.json();
          console.log(`[AI] Successfully generated task with model: ${model}`);
          break;
        } else {
          const errText = await response.text();
          console.warn(`[AI] Model ${model} returned error status ${response.status}:`, errText);
          lastError = errText;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.warn(`[AI] Model ${model} request timed out (12s).`);
          lastError = 'Request timed out after 12 seconds';
        } else {
          console.error(`[AI] Network/execution error with model ${model}:`, err);
          lastError = err.message;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!apiData) {
      console.error('[AI] All models failed or rate-limited. Last error:', lastError);
      
      let userFriendlyError = 'OpenRouter service free-tier is temporarily rate-limited or unavailable. Please retry shortly.';
      
      if (lastError) {
        try {
          const parsedErr = JSON.parse(lastError);
          const errMsg = parsedErr.error?.message || '';
          
          if (errMsg.includes('free-models-per-day')) {
            userFriendlyError = 'Daily free request limit (50/day) exceeded on your OpenRouter account. Add credits (min $10) to your OpenRouter billing page to unlock higher limits.';
          } else if (errMsg.includes('spend limit exceeded') || errMsg.includes('Insufficient balance') || errMsg.includes('USD spend limit')) {
            userFriendlyError = 'Your OpenRouter key has reached its spend limit or has insufficient balance. Check your billing at openrouter.ai.';
          } else if (errMsg) {
            userFriendlyError = errMsg;
          }
        } catch (e) {
          if (typeof lastError === 'string') {
            if (lastError.includes('free-models-per-day')) {
              userFriendlyError = 'Daily free request limit (50/day) exceeded on your OpenRouter account. Add credits (min $10) to your OpenRouter billing page to unlock higher limits.';
            } else if (lastError.includes('spend limit exceeded') || lastError.includes('Insufficient balance')) {
              userFriendlyError = 'Your OpenRouter key has reached its spend limit or has insufficient balance. Check your billing at openrouter.ai.';
            } else {
              userFriendlyError = lastError;
            }
          }
        }
      }
      
      return res.status(429).json({ error: userFriendlyError });
    }

    res.json(apiData);
  } catch (error) {
    console.error('AI Proxy error:', error);
    res.status(500).json({ error: 'Failed to communicate with AI model.' });
  }
});

export default router;
