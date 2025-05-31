const express = require('express');
const path = require('path');
const cors = require('cors');
const { LMStudioClient } = require('@lmstudio/sdk');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize LM Studio client
const client = new LMStudioClient({
  baseUrl: 'ws://192.168.1.2:1234'
});

// Store conversation history
let conversationHistory = []; // Clean history for specialists (user + specialist responses only)

// Track loaded models separately
let routerModel = {
  handle: null,
  path: null,
  preset: null,
  isLoaded: false
};

let specialistModel = {
  handle: null,
  path: null,
  preset: null,
  category: null,
  isLoaded: false
};

let userSettings = {
  router: null,
  routerPreset: null,
  creative: null,
  creativePreset: null,
  coding: null,
  codingPreset: null,
  analysis: null,
  analysisPreset: null,
  math: null,
  mathPreset: null,
  general: null,
  generalPreset: null,
  keepRouterLoaded: false
};

// Load settings from file
async function loadSettings() {
  try {
    const settingsData = await fs.readFile('settings.json', 'utf8');
    userSettings = { ...userSettings, ...JSON.parse(settingsData) };
    console.log('Settings loaded:', userSettings);
  } catch (error) {
    console.log('No settings file found, using defaults');
  }
}

// Save settings to file
async function saveSettings() {
  try {
    await fs.writeFile('settings.json', JSON.stringify(userSettings, null, 2));
    console.log('Settings saved');
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Get available models from LM Studio
app.get('/api/models', async (req, res) => {
  try {
    const downloadedModels = await client.system.listDownloadedModels();
    const llmModels = downloadedModels
      .filter(model => model.type === 'llm')
      .map(model => ({
        id: model.path,
        name: model.path.split('/').pop() || model.path // Use filename as display name
      }));
    
    res.json(llmModels);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models from LM Studio' });
  }
});

// Get current settings
app.get('/api/settings', (req, res) => {
  res.json(userSettings);
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    userSettings = { ...userSettings, ...req.body };
    await saveSettings();
    
    // If router config changed, mark as needing reload
    if (req.body.router !== undefined || req.body.routerPreset !== undefined) {
      if (routerModel.path !== userSettings.router || routerModel.preset !== userSettings.routerPreset) {
        console.log('Router configuration changed, will reload on next use');
        routerModel.isLoaded = false; // Mark for reload
      }
    }
    
    res.json({ success: true, settings: userSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Load router model if needed
async function ensureRouterLoaded() {
  if (!userSettings.router) {
    throw new Error('No router model configured');
  }

  // Check if current router is what we need
  if (routerModel.isLoaded && 
      routerModel.path === userSettings.router && 
      routerModel.preset === userSettings.routerPreset &&
      routerModel.handle) {
    console.log('Router already loaded and current');
    return routerModel.handle;
  }

  // Unload old router if different
  if (routerModel.handle && routerModel.isLoaded) {
    console.log(`Unloading old router: ${routerModel.path}`);
    try {
      await routerModel.handle.unload();
    } catch (error) {
      console.warn('Error unloading old router:', error);
    }
  }

  // Load new router
  console.log(`Loading router: ${userSettings.router}${userSettings.routerPreset ? ` with preset "${userSettings.routerPreset}"` : ''}`);
  
  const loadOptions = {
    verbose: false,
    noHup: false
  };
  
  if (userSettings.routerPreset) {
    loadOptions.preset = userSettings.routerPreset;
  }
  
  try {
    const handle = await client.llm.load(userSettings.router, loadOptions);
    
    routerModel.handle = handle;
    routerModel.path = userSettings.router;
    routerModel.preset = userSettings.routerPreset;
    routerModel.isLoaded = true;
    
    console.log(`Router loaded successfully: ${userSettings.router}`);
    return handle;
  } catch (error) {
    routerModel.isLoaded = false;
    throw new Error(`Failed to load router: ${error.message}`);
  }
}

// Load specialist model for given category
async function ensureSpecialistLoaded(category) {
  const modelPath = userSettings[category];
  if (!modelPath) {
    throw new Error(`No model configured for category: ${category}`);
  }

  const presetKey = `${category}Preset`;
  const preset = userSettings[presetKey];

  // Check if current specialist is what we need
  if (specialistModel.isLoaded &&
      specialistModel.path === modelPath &&
      specialistModel.preset === preset &&
      specialistModel.category === category &&
      specialistModel.handle) {
    console.log(`Specialist ${category} already loaded and current`);
    return specialistModel.handle;
  }

  // Unload old specialist if different
  if (specialistModel.handle && specialistModel.isLoaded) {
    console.log(`Unloading old specialist: ${specialistModel.category} (${specialistModel.path})`);
    try {
      await specialistModel.handle.unload();
    } catch (error) {
      console.warn('Error unloading old specialist:', error);
    }
  }

  // Load new specialist
  console.log(`Loading specialist ${category}: ${modelPath}${preset ? ` with preset "${preset}"` : ''}`);
  
  const loadOptions = {
    verbose: false,
    noHup: false
  };
  
  if (preset) {
    loadOptions.preset = preset;
  }
  
  try {
    const handle = await client.llm.load(modelPath, loadOptions);
    
    specialistModel.handle = handle;
    specialistModel.path = modelPath;
    specialistModel.preset = preset;
    specialistModel.category = category;
    specialistModel.isLoaded = true;
    
    console.log(`Specialist ${category} loaded successfully: ${modelPath}`);
    return handle;
  } catch (error) {
    specialistModel.isLoaded = false;
    throw new Error(`Failed to load specialist ${category}: ${error.message}`);
  }
}

// Parse router response - extract routing decision from anywhere in the response (use last occurrence)
function parseRouterResponse(response) {
  const text = response.trim();
  
  // Find ALL MODEL: responses and use the last one (final decision)
  const modelMatches = [...text.matchAll(/MODEL:\s*(creative|coding|analysis|math|general)/gi)];
  if (modelMatches.length > 0) {
    const lastMatch = modelMatches[modelMatches.length - 1];
    return { type: 'model', category: lastMatch[1].toLowerCase() };
  }
  
  // Find ALL FOLLOW-UP responses and use the last one
  const followUpMatches = [...text.matchAll(/\[FOLLOW-UP\]:\s*(.+?)(?:\n|$)/gi)];
  if (followUpMatches.length > 0) {
    const lastMatch = followUpMatches[followUpMatches.length - 1];
    return { type: 'followup', question: lastMatch[1].trim() };
  }
  
  // Find ALL ERROR responses and use the last one
  const errorMatches = [...text.matchAll(/ERROR:\s*(.+?)(?:\n|$)/gi)];
  if (errorMatches.length > 0) {
    const lastMatch = errorMatches[errorMatches.length - 1];
    return { type: 'error', message: lastMatch[1].trim() };
  }
  
  // Default to error if format not recognized - show what we got
  return { 
    type: 'error', 
    message: `Router response format not recognized. Got: "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"` 
  };
}

// Send message to router model
async function routeMessage(message, cleanHistory) {
  try {
    const routerHandle = await ensureRouterLoaded();

    // Prepare messages for router (clean conversation history + current message)
    const messages = [
      ...cleanHistory,
      { role: 'user', content: message }
    ];

    // Get router response
    const result = await routerHandle.respond(messages, {
      temperature: 0.1,
      maxTokens: 4096
    });

    console.log('Raw router response:', JSON.stringify(result.content));
    return parseRouterResponse(result.content);
  } catch (error) {
    console.error('Router error:', error);
    return { type: 'error', message: `Router error: ${error.message}` };
  }
}

// Send message to specialist model
async function sendToSpecialist(category, message, history) {
  try {
    const specialistHandle = await ensureSpecialistLoaded(category);

    // Send full conversation history + current message to specialist
    const messages = [
      ...history,
      { role: 'user', content: message }
    ];

    const result = await specialistHandle.respond(messages, {
      temperature: 0.7,
      maxTokens: 2000
    });

    return result.content;
  } catch (error) {
    console.error(`Specialist error for ${category}:`, error);
    throw error;
  }
}

// Cleanup models when not keeping router loaded
async function cleanupModelsIfNeeded() {
  if (!userSettings.keepRouterLoaded) {
    // Unload router to save memory
    if (routerModel.handle && routerModel.isLoaded) {
      console.log('Unloading router (keepRouterLoaded is false)');
      try {
        await routerModel.handle.unload();
        routerModel.isLoaded = false;
      } catch (error) {
        console.warn('Error unloading router:', error);
      }
    }
  }
}

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`User message: ${message}`);
    console.log(`Current specialist: ${specialistModel.isLoaded ? specialistModel.category : 'None'}`);

    // Route the message using current clean history (don't add user message yet)
    const routerResult = await routeMessage(message, conversationHistory);
    console.log('Router result:', routerResult);

    let response;
    let responseSource;

    if (routerResult.type === 'model') {
      // Send to specialist with full conversation history
      try {
        response = await sendToSpecialist(routerResult.category, message, conversationHistory);
        responseSource = routerResult.category;
        console.log(`Response from ${routerResult.category} model`);
        
        // Clean up router if not keeping it loaded
        await cleanupModelsIfNeeded();
        
      } catch (error) {
        response = `Error with ${routerResult.category} model: ${error.message}`;
        responseSource = 'error';
      }
    } else if (routerResult.type === 'followup') {
      // Router asking for clarification
      response = routerResult.question;
      responseSource = 'router';
    } else {
      // Error case
      response = routerResult.message;
      responseSource = 'error';
    }

    // Add user message and assistant response to clean history
    // (Router internal decisions are never added to this history)
    conversationHistory.push({ role: 'user', content: message, timestamp: Date.now() });
    conversationHistory.push({ 
      role: 'assistant', 
      content: response, 
      timestamp: Date.now(),
      source: responseSource 
    });

    res.json({
      message: response,
      source: responseSource,
      routerDecision: routerResult.type === 'model' ? routerResult.category : routerResult.type
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: `Chat error: ${error.message}` });
  }
});

// Get conversation history
app.get('/api/history', (req, res) => {
  res.json(conversationHistory);
});

// Clear conversation history
app.post('/api/clear', (req, res) => {
  conversationHistory = [];
  res.json({ success: true });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Try to list models to test connection
    await client.system.listDownloadedModels();
    
    res.json({ 
      status: 'ok', 
      lmStudioConnected: true,
      currentModels: {
        router: routerModel.isLoaded ? `${routerModel.path}` : 'None',
        specialist: specialistModel.isLoaded ? `${specialistModel.category} (${specialistModel.path})` : 'None'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      lmStudioConnected: false, 
      error: error.message 
    });
  }
});

// Initialize and start server
async function startServer() {
  await loadSettings();
  
  app.listen(PORT, () => {
    console.log(`MoE Router server running on http://localhost:${PORT}`);
    console.log(`LM Studio WebSocket URL: ws://192.168.1.2:1234`);
    console.log('Visit http://localhost:3000 for the chat interface');
    console.log('Visit http://localhost:3000/settings.html for configuration');
  });
}

startServer().catch(console.error);